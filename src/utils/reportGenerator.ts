/*
 * Copyright 2025 DatalabHell
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { dateMath, PluginExtensionPanelContext, RawTimeRange, ScopedVars, TypedVariableModel } from '@grafana/data';
import { TimeZone } from '@grafana/schema';

import { config, getBackendSrv, getTemplateSrv, locationService } from '@grafana/runtime';
import { jsPDF, TextOptionsLight } from 'jspdf';
import { lastValueFrom } from 'rxjs';
import { DashboardApiResponse, DashboardModel, DashboardTemplateVariable, PanelModel } from '../types/grafana';
import {
  LayoutAlignment,
  LayoutPlacement,
  ReporterPluginSettings,
  ReportTheme,
  ResolvedLayoutSettings,
  resolveLayoutSettings,
  VariableValue,
  VariableValueMap,
} from '../types/reporting';

type ProgressHandler = (message: string) => void;

/**
 * Manual dashboard inputs used when generating from the app page.
 */
interface ManualDashboardContext {
  dashboardUid?: string;
  dashboardTitle?: string;
  timeRange?: RawTimeRange;
  timeZone?: TimeZone;
  variables?: VariableValueMap;
}

/**
 * Derived dashboard context (UID, title, time range, variables) from either a panel or URL.
 */
interface DashboardContextResult {
  dashboardUid?: string;
  dashboardTitle?: string;
  timeRange?: RawTimeRange;
  timeZone?: TimeZone;
  variables?: VariableValueMap;
}

/**
 * Options for orchestrating report generation.
 * - `panelContext` is passed by Grafana when invoked from a panel extension.
 * - `manualContext` is used by the app page when running against an explicit dashboard selection.
 */
interface GenerateReportOptions {
  panelContext?: PluginExtensionPanelContext;
  settings?: ReporterPluginSettings;
  onProgress?: ProgressHandler;
  manualContext?: ManualDashboardContext;
  signal?: AbortSignal;
}

const DEFAULT_RAW_TIME_RANGE: RawTimeRange = { from: 'now-6h', to: 'now' };

const parseHexColor = (hex: string | undefined): { r: number; g: number; b: number } | null => {
  if (!hex) {
    return null;
  }
  const normalized = hex.replace('#', '').trim();
  const expand =
    normalized.length === 3
      ? normalized
          .split('')
          .map((c) => c + c)
          .join('')
      : normalized;
  if (expand.length !== 6) {
    return null;
  }
  const value = Number.parseInt(expand, 16);
  if (Number.isNaN(value)) {
    return null;
  }
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  };
};

/**
 * Orchestrates the report flow: fetch dashboard, resolve variables, render panels via /render, then compose a PDF.
 * Emits progress messages via `onProgress` and returns the saved filename on success.
 */
export const generateDashboardReport = async ({
  panelContext,
  settings,
  onProgress,
  manualContext,
  signal,
}: GenerateReportOptions) => {
  const reportTheme = resolveThemePreference(settings?.themePreference ?? 'user');
  const notify = (message: string) => onProgress?.(message);
  const backendSrv = getBackendSrv();
  const templateSrv = getTemplateSrv();
  const {
    dashboardUid,
    dashboardTitle: fallbackTitle,
    timeRange: contextTimeRange,
    timeZone,
    variables: manualVariables,
  } = getDashboardContext(panelContext, manualContext);

  if (!dashboardUid) {
    throw new Error('Dashboard information was not available for this action.');
  }

  notify('Loading dashboard definition...');
  throwIfAborted(signal);

  const response = await backendSrv.get<DashboardApiResponse>(`/api/dashboards/uid/${dashboardUid}`);
  // Variables can come from three places: Grafana template variables, dashboard defaults, and manual overrides/query params.
  const templateVariableValues = getTemplateVariableValues();
  const dashboardVariableValues = getDashboardTemplateVariableValues(response.dashboard);
  const mergedVariableValues = mergeVariableValues(
    mergeVariableValues(templateVariableValues, dashboardVariableValues),
    manualVariables
  );
  const dashboardTitle = response.dashboard?.title || fallbackTitle || `dashboard-${dashboardUid}`;
  const slug = response.meta?.slug || slugify(dashboardTitle);
  const groupedPanels = groupPanelsByRows(response.dashboard?.panels ?? []);
  const panels = flattenPanels(groupedPanels, mergedVariableValues);

  if (!panels.length) {
    throw new Error('No panels were found on this dashboard.');
  }

  notify(`Found ${panels.length} panels, rendering screenshots...`);
  const rawRange = contextTimeRange ?? response.dashboard?.time ?? DEFAULT_RAW_TIME_RANGE;
  const timeRange = resolveTimeRange(rawRange, timeZone);

  if (!timeRange) {
    throw new Error('Could not determine the current time range.');
  }

  // Layout preferences come from the resolved plugin settings. Manual overrides are merged upstream.
  const layoutConfig = resolveLayoutSettings(settings?.layout);
  const renderWidth = layoutConfig.panels.width;
  const renderHeight = layoutConfig.panels.height;
  const pageMargin = layoutConfig.pageMargin;
  const logoAsset =
    layoutConfig.logo.enabled && layoutConfig.logo.url ? await loadLogoAsset(layoutConfig.logo.url) : undefined;
  const headerHeight = getBrandingReservedHeight('header', layoutConfig, logoAsset);
  const footerHeight = getBrandingReservedHeight('footer', layoutConfig, logoAsset);

  const renderablePanels = panels
    .map((panel, originalIndex) => ({ panel, originalIndex }))
    .filter(({ panel }) => Boolean(panel.id || panel.renderId));
  const panelImageSlots: Array<{ title: string; dataUrl: string } | undefined> = new Array(renderablePanels.length);
  const totalRenderable = renderablePanels.length;
  let nextRenderableToNotify = 0;

  await runWithConcurrency(renderablePanels, layoutConfig.renderConcurrency ?? 1, async ({ panel }, queueIndex) => {
    throwIfAborted(signal);

    const scopedVariableOverrides = getScopedVariableOverrides(panel.scopedVars);
    const panelVariableValues = mergeVariableValues(mergedVariableValues, scopedVariableOverrides);
    const panelTitleScopedVars = mergeScopedVars(buildScopedVarsFromValueMap(panelVariableValues), panel.scopedVars);
    const resolvedPanelTitle = getPanelTitle(panel, templateSrv, panelTitleScopedVars);
    const panelRenderId = getPanelRenderId(panel);
    if (!panelRenderId) {
      return;
    }
    const panelVariablePairs = buildVariablePairs(panelVariableValues);

    const params = new URLSearchParams({
      panelId: String(panelRenderId),
      from: String(timeRange.from),
      to: String(timeRange.to),
      theme: reportTheme,
      width: String(renderWidth),
      height: String(renderHeight),
      timezone: String(timeZone ?? 'browser'),
      kiosk: '1',
    });

    params.set('tz', String(timeZone ?? 'browser'));

    for (const pair of panelVariablePairs) {
      params.append(pair.key, pair.value);
    }

    const renderUrl = `/render/d-solo/${dashboardUid}/${slug}?${params.toString()}`;

    const renderResponse = await withAbort(
      lastValueFrom(
        backendSrv.fetch<Blob>({
          url: renderUrl,
          method: 'GET',
          responseType: 'blob',
          credentials: 'same-origin',
        })
      ),
      signal
    );

    if (!renderResponse.data) {
      throw new Error(`The rendered image for panel ${panel.id} was empty.`);
    }

    throwIfAborted(signal);
    const dataUrl = await blobToDataUrl(renderResponse.data);
    panelImageSlots[queueIndex] = {
      title: resolvedPanelTitle,
      dataUrl,
    };
    // Emit completions in order even though renders finish in parallel.
    while (panelImageSlots[nextRenderableToNotify]) {
      const slot = panelImageSlots[nextRenderableToNotify]!;
      notify(`Rendered panel ${nextRenderableToNotify + 1}/${totalRenderable}: ${slot.title}`);
      nextRenderableToNotify += 1;
    }
  });

  const panelImages = panelImageSlots.filter(Boolean) as Array<{ title: string; dataUrl: string }>;

  if (!panelImages.length) {
    throw new Error('No renderable panels were found on this dashboard.');
  }

  notify('Composing PDF...');
  throwIfAborted(signal);
  const pdf = new jsPDF({
    orientation: layoutConfig.orientation,
    unit: 'pt',
    format: 'a4',
    compress: true,
  });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const panelsPerPage = Math.max(1, layoutConfig.panels.perPage);
  const panelsSpacing = Math.max(0, layoutConfig.panels.spacing);
  const gridColumns = determineGridColumns(panelsPerPage);
  const gridRows = Math.max(1, Math.ceil(panelsPerPage / gridColumns));
  const totalPages = Math.max(1, Math.ceil(panelImages.length / panelsPerPage));
  const panelsTitleEnabled = layoutConfig.panels.title.enabled;
  const panelsTitleFontSize = layoutConfig.panels.title.fontSize;
  const panelsTitleFontFamily = layoutConfig.panels.title.fontFamily;
  const panelsTitleFontStyle = layoutConfig.panels.title.fontStyle ?? 'normal';
  const panelsTitleFontColor = layoutConfig.panels.title.fontColor;
  const titleOffset = panelsTitleEnabled ? panelsTitleFontSize : 0;
  const contentOffset = panelsTitleEnabled ? panelsTitleFontSize + 4 : 0;

  // Walk through the rendered panels in chunks of `panelsPerPage`, laying them out on each PDF page.
  for (let pageIndex = 0; pageIndex < panelImages.length; pageIndex += panelsPerPage) {
    if (pageIndex > 0) {
      pdf.addPage(undefined, layoutConfig.orientation);
    }

    const pageItems = panelImages.slice(pageIndex, pageIndex + panelsPerPage);
    throwIfAborted(signal);
    const activeColumns = Math.min(gridColumns, Math.max(1, pageItems.length));
    const slotWidth = Math.max(10, (pageWidth - pageMargin * 2 - panelsSpacing * (activeColumns - 1)) / activeColumns);
    const slotHeight = Math.max(
      40,
      (pageHeight - pageMargin * 2 - headerHeight - footerHeight - panelsSpacing * (gridRows - 1)) / gridRows
    );
    for (const [slotIndex, image] of pageItems.entries()) {
      const rowIndex = Math.floor(slotIndex / activeColumns);
      const columnIndex = slotIndex % activeColumns;
      const xOffset = pageMargin + columnIndex * (slotWidth + panelsSpacing);
      const yOffset = pageMargin + headerHeight + rowIndex * (slotHeight + panelsSpacing);
      const contentHeight = Math.max(10, slotHeight - contentOffset);
      const maxImageWidth = slotWidth;
      const { width: imageWidth, height: imageHeight } = fitRectangle(
        maxImageWidth,
        contentHeight,
        renderWidth,
        renderHeight
      );
      const imageX = xOffset + (slotWidth - imageWidth) / 2;
      const imageY = yOffset + contentOffset + (contentHeight - imageHeight) / 2;

      if (panelsTitleEnabled) {
        pdf.setFont(panelsTitleFontFamily, panelsTitleFontStyle);
        pdf.setFontSize(panelsTitleFontSize);
        const rgb = parseHexColor(panelsTitleFontColor);
        if (rgb) {
          pdf.setTextColor(rgb.r, rgb.g, rgb.b);
        }
        pdf.text(image.title, xOffset, yOffset + titleOffset);
      }

      // we could implement additional downscaling of the PNG via canvas if needed
      pdf.addImage(image.dataUrl, 'PNG', imageX, imageY, imageWidth, imageHeight);
    }

    const pageNumber = Math.floor(pageIndex / panelsPerPage) + 1;

    renderBrandingArea(pdf, {
      placement: 'header',
      layoutSettings: layoutConfig,
      logo: logoAsset,
      areaHeight: headerHeight,
      pageWidth,
      pageHeight,
      pageNumber,
      totalPages,
    });

    renderBrandingArea(pdf, {
      placement: 'footer',
      layoutSettings: layoutConfig,
      logo: logoAsset,
      areaHeight: footerHeight,
      pageWidth,
      pageHeight,
      pageNumber,
      totalPages,
    });
  }

  const fileName = `${slugify(dashboardTitle)}-${formatTimestamp(new Date())}.pdf`;
  throwIfAborted(signal);
  notify('Saving PDF...');
  pdf.save(fileName);
  notify('Report ready.');

  return {
    fileName,
  };
};

// Recursively expands rows/repeat panels and clones them for every variable iteration.
const flattenPanels = (
  panels: PanelModel[] = [],
  variableValues: VariableValueMap,
  inheritedScopedVars?: ScopedVars,
  cloneSuffix = ''
): PanelModel[] => {
  const result: PanelModel[] = [];

  for (const panel of panels) {
    if (!panel) {
      continue;
    }

    const combinedScopedVars = mergeScopedVars(inheritedScopedVars, panel.scopedVars);

    if (panel.type === 'row') {
      if (panel.repeat && !hasScopedOverride(combinedScopedVars, panel.repeat)) {
        const repeatValues = variableValues[panel.repeat];
        if (repeatValues?.length) {
          repeatValues.forEach((entry, index) => {
            const repeatScope = mergeScopedVars(combinedScopedVars, buildScopedVarOverride(panel.repeat!, entry));
            const nextSuffix = appendCloneSuffix(cloneSuffix, index);
            result.push(...flattenPanels(panel.panels, variableValues, repeatScope, nextSuffix));
          });
          continue;
        }
      }

      if (panel.panels?.length) {
        result.push(...flattenPanels(panel.panels, variableValues, combinedScopedVars, cloneSuffix));
      }
      continue;
    }

    if (panel.repeat && !hasScopedOverride(combinedScopedVars, panel.repeat)) {
      const repeatValues = variableValues[panel.repeat];
      if (repeatValues?.length) {
        repeatValues.forEach((entry, index) => {
          const repeatScope = mergeScopedVars(combinedScopedVars, buildScopedVarOverride(panel.repeat!, entry));
          const nextSuffix = appendCloneSuffix(cloneSuffix, index);
          result.push({
            ...panel,
            scopedVars: repeatScope,
            renderId: getCloneId(panel.id, nextSuffix),
          });
        });
        continue;
      }
    }

    if (panel.type !== 'row' && panel.id !== undefined) {
      result.push({
        ...panel,
        scopedVars: combinedScopedVars,
        renderId: getCloneId(panel.id, cloneSuffix),
      });
    }

    if (panel.panels?.length) {
      result.push(...flattenPanels(panel.panels, variableValues, combinedScopedVars, cloneSuffix));
    }
  }

  return result;
};

const appendCloneSuffix = (parentSuffix: string, iterationIndex: number) => `${parentSuffix}clone${iterationIndex + 1}`;

const getCloneId = (panelId: PanelModel['id'], suffix: string): PanelModel['id'] => {
  if (!panelId || !suffix) {
    return panelId;
  }
  return `${panelId}${suffix}`;
};

// Prefer the dashboard's canonical id whenever possible: Grafana >=12.2 ignores synthetic clone ids in /render.
const getPanelRenderId = (panel: PanelModel) => (panel.id !== undefined ? panel.id : panel.renderId);

// Grafana <=12.1 emitted row children immediately after the row definition, while >=12.2 only sets rowPanelId.
// We normalize both models here so downstream logic can treat row.panels uniformly regardless of Grafana version.
const groupPanelsByRows = (panels: PanelModel[] = []): PanelModel[] => {
  const result: PanelModel[] = [];
  const rowLookup = new Map<string, PanelModel>();

  const getKey = (value: PanelModel['id'] | PanelModel['rowPanelId']) =>
    value !== undefined && value !== null ? String(value) : undefined;

  for (const panel of panels) {
    if (panel?.type !== 'row') {
      continue;
    }
    const key = getKey(panel.id);
    if (key && !rowLookup.has(key)) {
      panel.panels = panel.panels ?? [];
      rowLookup.set(key, panel);
    }
  }

  let activeRow: PanelModel | undefined;

  for (const panel of panels) {
    if (!panel) {
      continue;
    }

    if (panel.type === 'row') {
      activeRow = panel.collapsed === false ? panel : undefined;
      if (activeRow && !activeRow.panels) {
        activeRow.panels = [];
      }
      result.push(panel);
      continue;
    }

    const parentKey = getKey(panel.rowPanelId);
    if (parentKey && rowLookup.has(parentKey)) {
      const parent = rowLookup.get(parentKey)!;
      parent.panels = parent.panels ?? [];
      parent.panels.push(panel);
      continue;
    }

    if (activeRow) {
      activeRow.panels = activeRow.panels ?? [];
      activeRow.panels.push(panel);
      continue;
    }

    result.push(panel);
  }

  return result;
};

const resolveTimeRange = (range?: RawTimeRange, timeZone?: TimeZone) => {
  if (!range) {
    return undefined;
  }

  const from = convertTimeValue(range.from, false, timeZone);
  const to = convertTimeValue(range.to, true, timeZone);

  if (from === undefined || to === undefined) {
    return undefined;
  }

  return { from, to };
};

const convertTimeValue = (value: RawTimeRange['from'], roundUp: boolean, timeZone?: TimeZone) => {
  if (typeof value === 'number') {
    return value;
  }

  if (typeof value === 'string') {
    const numeric = Number(value);

    if (!Number.isNaN(numeric) && value.trim() !== '') {
      return numeric;
    }

    const parsed = dateMath.parse(value, roundUp, timeZone);
    return parsed?.valueOf();
  }

  if (value && typeof value.valueOf === 'function') {
    return value.valueOf();
  }

  return undefined;
};

const blobToDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-') || 'dashboard';

const formatTimestamp = (date: Date) => {
  const pad = (part: number) => part.toString().padStart(2, '0');
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(
    date.getMinutes()
  )}${pad(date.getSeconds())}`;
};

const hasVariableCurrentValue = (
  variable: TypedVariableModel
): variable is TypedVariableModel & { current: { value?: unknown; text?: unknown } } => 'current' in variable;

const resolveThemePreference = (preference: ReportTheme): Exclude<ReportTheme, 'user'> => {
  if (preference === 'user') {
    const userTheme = config.bootData?.user?.theme;
    return userTheme === 'light' ? 'light' : 'dark';
  }

  return preference;
};

const getDashboardContext = (
  panelContext?: PluginExtensionPanelContext,
  overrides?: ManualDashboardContext
): DashboardContextResult => {
  const base = panelContext?.dashboard?.uid ? getContextFromPanel(panelContext) : getContextFromLocation();

  return {
    dashboardUid: overrides?.dashboardUid ?? base.dashboardUid,
    dashboardTitle: overrides?.dashboardTitle ?? base.dashboardTitle,
    timeRange: overrides?.timeRange ?? base.timeRange,
    timeZone: overrides?.timeZone ?? base.timeZone,
    variables: overrides?.variables ?? base.variables,
  };
};

const getContextFromPanel = (panelContext: PluginExtensionPanelContext): DashboardContextResult => ({
  dashboardUid: panelContext.dashboard.uid,
  dashboardTitle: panelContext.dashboard.title,
  timeRange: panelContext.timeRange,
  timeZone: panelContext.timeZone,
});

const getContextFromLocation = (): DashboardContextResult => {
  const location = locationService.getLocation();
  const uidMatch = location.pathname.match(/\/d(?:-solo)?\/([^/]+)/i);
  const dashboardUid = uidMatch?.[1];
  const query = locationService.getSearchObject();
  const from = (query.from as string | undefined) ?? DEFAULT_RAW_TIME_RANGE.from;
  const to = (query.to as string | undefined) ?? DEFAULT_RAW_TIME_RANGE.to;
  const timeZone = (query.timezone as TimeZone | undefined) ?? (query.tz as TimeZone | undefined) ?? 'browser';

  return {
    dashboardUid,
    dashboardTitle: undefined,
    timeRange: {
      from,
      to,
    },
    timeZone,
    variables: undefined,
  };
};

const getDashboardTemplateVariableValues = (dashboard?: DashboardModel): VariableValueMap => {
  const list = dashboard?.templating?.list;
  if (!list?.length) {
    return {};
  }

  const values: VariableValueMap = {};

  for (const variable of list) {
    if (!variable.name) {
      continue;
    }

    const normalized = extractVariableValues(variable);
    if (normalized.length) {
      values[variable.name] = normalized;
    }
  }

  return values;
};

const getTemplateVariableValues = (): VariableValueMap => {
  const templateSrv = getTemplateSrv();
  const result: VariableValueMap = {};

  templateSrv.getVariables().forEach((variable) => {
    if (!hasVariableCurrentValue(variable)) {
      return;
    }

    const normalized = extractVariableValues(variable);

    if (normalized.length) {
      result[variable.name] = normalized;
    }
  });

  return result;
};

const mergeVariableValues = (base: VariableValueMap, overrides?: VariableValueMap): VariableValueMap => {
  if (!overrides || !Object.keys(overrides).length) {
    return base;
  }

  const result: VariableValueMap = { ...base };

  for (const [name, overrideValues] of Object.entries(overrides)) {
    if (!overrideValues?.length) {
      result[name] = overrideValues;
      continue;
    }

    const filtered = overrideValues.filter((entry) => !isAllValue(entry));

    if (filtered.length) {
      result[name] = filtered;
      continue;
    }

    if (base?.[name]?.length) {
      result[name] = base[name];
      continue;
    }

    result[name] = overrideValues;
  }

  return result;
};

const buildVariablePairs = (values: VariableValueMap): Array<{ key: string; value: string }> =>
  Object.entries(values)
    .map(([name, variableValues]) =>
      variableValues.map((entry) => ({
        key: `var-${name}`,
        value: entry.value,
      }))
    )
    .flat();

const buildScopedVarsFromValueMap = (values?: VariableValueMap): ScopedVars | undefined => {
  if (!values || !Object.keys(values).length) {
    return undefined;
  }

  const scoped: ScopedVars = {};
  let hasEntries = false;

  for (const [name, variableValues] of Object.entries(values)) {
    if (!variableValues?.length) {
      continue;
    }
    const valueList = variableValues.map((entry) => entry.value);
    const textList = variableValues.map((entry) => entry.text ?? entry.value);
    scoped[name] = {
      value: valueList.length === 1 ? valueList[0] : valueList,
      text: textList.length === 1 ? textList[0] : textList.join(', '),
    };
    hasEntries = true;
  }

  return hasEntries ? scoped : undefined;
};

const toArray = (input: any) => {
  if (input === undefined || input === null) {
    return [];
  }
  return Array.isArray(input) ? input : [input];
};

const normalizeVariableEntries = (value: any, text?: any): VariableValue[] => {
  const values = toArray(value);
  const texts = toArray(text);
  const max = Math.max(values.length, texts.length);
  const normalized: VariableValue[] = [];

  for (let i = 0; i < max; i++) {
    let source = values[i];
    const textCandidate = texts[i];

    if (source === undefined) {
      source = textCandidate;
    }

    if (source === undefined || source === null || source === '') {
      continue;
    }

    if (typeof source === 'object') {
      const candidateValue = (source as any).value;
      const candidateText = (source as any).text;
      if (candidateValue !== undefined && candidateValue !== null && candidateValue !== '') {
        normalized.push({
          value: String(candidateValue),
          text:
            candidateText !== undefined && candidateText !== null && candidateText !== ''
              ? String(candidateText)
              : textCandidate !== undefined && textCandidate !== null && textCandidate !== ''
              ? String(textCandidate)
              : undefined,
        });
        continue;
      }
      if (candidateText !== undefined && candidateText !== null && candidateText !== '') {
        normalized.push({
          value: String(candidateText),
          text: String(candidateText),
        });
        continue;
      }
    }

    normalized.push({
      value: String(source),
      text:
        textCandidate !== undefined && textCandidate !== null && textCandidate !== ''
          ? String(textCandidate)
          : undefined,
    });
  }

  return normalized;
};

const extractVariableValues = (
  variable: Partial<DashboardTemplateVariable> | Partial<TypedVariableModel>
): VariableValue[] => {
  const current = normalizeVariableEntries((variable as any)?.current?.value, (variable as any)?.current?.text);
  const options = normalizeVariableOptions((variable as any)?.options);
  const allSelected = current.some(isAllValue);

  if (allSelected && options.length) {
    const withoutAll = options.filter((option) => !isAllValue(option));
    if (withoutAll.length) {
      return withoutAll;
    }
  }

  if (current.length) {
    return current;
  }

  const selectedOptions = options.filter((option) => option.selected);
  if (selectedOptions.length) {
    return selectedOptions;
  }

  return options;
};

interface NormalizedVariableOption extends VariableValue {
  selected: boolean;
}

const normalizeVariableOptions = (options?: Array<{ value?: any; text?: any; selected?: boolean }>) => {
  if (!options?.length) {
    return [] as NormalizedVariableOption[];
  }

  const normalized: NormalizedVariableOption[] = [];

  for (const option of options) {
    const source = option.value ?? option.text;
    if (source === undefined || source === null || source === '') {
      continue;
    }
    normalized.push({
      value: String(source),
      text: option.text !== undefined && option.text !== null && option.text !== '' ? String(option.text) : undefined,
      selected: Boolean(option.selected),
    });
  }

  return normalized;
};

const isAllValue = (entry: VariableValue) => {
  const value = entry.value?.toString().toLowerCase();
  const text = entry.text?.toString().toLowerCase();
  return value === '$__all' || value === '__all' || text === 'all';
};

const INTERNAL_SCOPED_VARS_ALLOWLIST = new Set(['__repeat', '__repeat_index', '__repeatRow', '__repeat_row']);

const getScopedVariableOverrides = (scopedVars?: ScopedVars): VariableValueMap | undefined => {
  if (!scopedVars) {
    return undefined;
  }

  const overrides: VariableValueMap = {};

  for (const [key, scopedVar] of Object.entries(scopedVars)) {
    if (!scopedVar) {
      continue;
    }

    const isInternal = key.startsWith('__');
    if (isInternal && !INTERNAL_SCOPED_VARS_ALLOWLIST.has(key)) {
      continue;
    }

    const normalized = normalizeVariableEntries(scopedVar.value, scopedVar.text);

    if (normalized.length) {
      overrides[key] = normalized;
    }
  }

  return Object.keys(overrides).length ? overrides : undefined;
};

const hasScopedOverride = (scopedVars: ScopedVars | undefined, variableName: string) =>
  Boolean(scopedVars?.[variableName]);

const mergeScopedVars = (parent?: ScopedVars, child?: ScopedVars): ScopedVars | undefined => {
  if (!parent) {
    return child;
  }

  if (!child) {
    return parent;
  }

  return {
    ...parent,
    ...child,
  };
};

const buildScopedVarOverride = (name: string, entry: VariableValue): ScopedVars => ({
  [name]: {
    text: entry.text ?? entry.value,
    value: entry.value,
  },
});

const determineGridColumns = (slotsPerPage: number) => {
  if (slotsPerPage >= 4) {
    return 2;
  }

  return 1;
};

const getBrandingReservedHeight = (placement: LayoutPlacement, layout: ResolvedLayoutSettings, logo?: LogoAsset) => {
  const logoDimensions =
    layout.logo.enabled && layout.logo.placement === placement && logo
      ? fitRectangle(layout.logo.width, layout.logo.height, logo.width, logo.height)
      : undefined;
  const showNumbers = layout.pageNumber.enabled && layout.pageNumber.placement === placement;

  let maxHeight = logoDimensions?.height ?? 0;

  const textLineHeight = placement === 'footer' ? layout.footer.lineHeight : layout.header.lineHeight;
  if (showNumbers) {
    maxHeight = Math.max(maxHeight, textLineHeight);
  }

  layout.customElements
    .filter((element) => element.type === 'text' && element.placement === placement)
    .forEach((element) => {
      if (element.fontSize !== undefined) {
        maxHeight = Math.max(maxHeight, element.fontSize);
      } else {
        maxHeight = Math.max(maxHeight, textLineHeight);
      }
    });

  if (maxHeight <= 0) {
    return 0;
  }

  const padding = placement === 'header' ? layout.header.padding : layout.footer.padding;
  return maxHeight + padding * 2;
};

const fitRectangle = (maxWidth: number, maxHeight: number, originalWidth: number, originalHeight: number) => {
  if (maxWidth <= 0 || maxHeight <= 0 || originalWidth <= 0 || originalHeight <= 0) {
    return { width: 0, height: 0 };
  }

  const aspectRatio = originalWidth / originalHeight;
  let width = maxWidth;
  let height = width / aspectRatio;

  if (height > maxHeight) {
    height = maxHeight;
    width = height * aspectRatio;
  }

  return { width, height };
};

const getPanelTitle = (
  panel: PanelModel,
  templateSrv: ReturnType<typeof getTemplateSrv>,
  scopedContext?: ScopedVars
) => {
  const fallbackTitle = `Panel ${panel.id ?? ''}`.trim() || 'Panel';
  const baseTitle = panel.title ?? fallbackTitle;

  try {
    const replaced = templateSrv.replace(baseTitle, scopedContext ?? panel.scopedVars, 'text');
    return replaced?.trim() || baseTitle;
  } catch {
    return baseTitle;
  }
};

const renderBrandingArea = (
  pdf: jsPDF,
  options: {
    placement: LayoutPlacement;
    layoutSettings: ResolvedLayoutSettings;
    logo?: LogoAsset;
    areaHeight: number;
    pageWidth: number;
    pageHeight: number;
    pageNumber: number;
    totalPages: number;
  }
) => {
  const { placement, layoutSettings, logo, areaHeight, pageWidth, pageHeight, pageNumber, totalPages } = options;

  if (!areaHeight) {
    return;
  }

  const logoDimensions =
    layoutSettings.logo.enabled && layoutSettings.logo.placement === placement && logo
      ? fitRectangle(layoutSettings.logo.width, layoutSettings.logo.height, logo.width, logo.height)
      : undefined;
  const showNumbers = layoutSettings.pageNumber.enabled && layoutSettings.pageNumber.placement === placement;

  if (!logoDimensions && !showNumbers) {
    // We may still render custom elements; continue.
  }

  const padding = placement === 'header' ? layoutSettings.header.padding : layoutSettings.footer.padding;
  const areaTop = placement === 'header' ? padding : pageHeight - areaHeight + padding;
  const centerY = areaTop + (areaHeight - padding * 2) / 2;

  if (logoDimensions && logo) {
    const logoX = getAlignedX(
      layoutSettings.logo.alignment,
      logoDimensions.width,
      pageWidth,
      layoutSettings.pageMargin
    );
    const logoY = centerY - logoDimensions.height / 2;
    pdf.addImage(logo.dataUrl, 'PNG', logoX, logoY, logoDimensions.width, logoDimensions.height);
  }

  if (showNumbers) {
    const language = layoutSettings.pageNumber.language;
    let label = '';
    if (language === 'de') {
      label = `Seite ${pageNumber} von ${totalPages}`;
    } else {
      label = `Page ${pageNumber} of ${totalPages}`;
    }
    const textLineHeight = placement === 'footer' ? layoutSettings.footer.lineHeight : layoutSettings.header.lineHeight;
    const textY = centerY + textLineHeight / 3;
    pdf.setFont(layoutSettings.pageNumber.fontFamily, layoutSettings.pageNumber.fontStyle ?? 'normal');
    pdf.setFontSize(layoutSettings.pageNumber.fontSize);
    const pageNumberColor = parseHexColor(layoutSettings.pageNumber.fontColor);
    if (pageNumberColor) {
      pdf.setTextColor(pageNumberColor.r, pageNumberColor.g, pageNumberColor.b);
    }
    const { textX, textOptions } = getAlignedTextPosition(
      layoutSettings.pageNumber.alignment,
      pageWidth,
      layoutSettings.pageMargin
    );
    pdf.text(label, textX, textY, textOptions);
  }

  layoutSettings.customElements
    .filter((element) => element.type === 'text' && element.placement === placement)
    .forEach((element) => {
      const fontSize =
        element.fontSize ?? (placement === 'footer' ? layoutSettings.footer.lineHeight : layoutSettings.header.lineHeight);
      pdf.setFont(
        element.fontFamily ?? layoutSettings.pageNumber.fontFamily,
        element.fontStyle ?? layoutSettings.pageNumber.fontStyle ?? 'normal'
      );
      pdf.setFontSize(fontSize);
      const color = parseHexColor(element.fontColor ?? layoutSettings.pageNumber.fontColor);
      if (color) {
        pdf.setTextColor(color.r, color.g, color.b);
      }
      const textY = centerY + fontSize / 3;
      const { textX, textOptions } = getAlignedTextPosition(element.alignment, pageWidth, layoutSettings.pageMargin);
      pdf.text(element.content, textX, textY, textOptions);
    });
};

const getAlignedX = (alignment: LayoutAlignment, contentWidth: number, pageWidth: number, pageMargin: number) => {
  if (alignment === 'center') {
    return pageWidth / 2 - contentWidth / 2;
  }
  if (alignment === 'right') {
    return pageWidth - pageMargin - contentWidth;
  }
  return pageMargin;
};

const getAlignedTextPosition = (
  alignment: LayoutAlignment,
  pageWidth: number,
  pageMargin: number
): {
  textX: number;
  textOptions?: TextOptionsLight;
} => {
  if (alignment === 'center') {
    return {
      textX: pageWidth / 2,
      textOptions: { align: 'center' },
    };
  }

  if (alignment === 'right') {
    return {
      textX: pageWidth - pageMargin,
      textOptions: { align: 'right' },
    };
  }

  return {
    textX: pageMargin,
  };
};

const throwIfAborted = (signal?: AbortSignal) => {
  if (signal?.aborted) {
    throw new DOMException('Aborted', 'AbortError');
  }
};

const withAbort = async <T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> => {
  if (!signal) {
    return promise;
  }

  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(new DOMException('Aborted', 'AbortError'));
    signal.addEventListener('abort', onAbort);

    promise
      .then((value) => {
        signal.removeEventListener('abort', onAbort);
        resolve(value);
      })
      .catch((error) => {
        signal.removeEventListener('abort', onAbort);
        reject(error);
      });
  });
};

const runWithConcurrency = async <T>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<void>
) => {
  if (!items.length) {
    return;
  }
  const poolSize = Math.max(1, Math.min(limit, items.length));
  let nextIndex = 0;

  const launch = async (): Promise<void> => {
    const current = nextIndex++;
    if (current >= items.length) {
      return;
    }
    await worker(items[current], current);
    await launch();
  };

  const runners = Array.from({ length: poolSize }, () => launch());
  await Promise.all(runners);
};

export const __testables = {
  flattenPanels,
  groupPanelsByRows,
  determineGridColumns,
  getBrandingReservedHeight,
  fitRectangle,
  mergeVariableValues,
  buildVariablePairs,
  normalizeVariableEntries,
  getPanelTitle,
  extractVariableValues,
};

interface LogoAsset {
  dataUrl: string;
  width: number;
  height: number;
}

const loadLogoAsset = async (logoUrl?: string): Promise<LogoAsset | undefined> => {
  if (!logoUrl) {
    return undefined;
  }

  const trimmed = logoUrl.trim();

  if (!trimmed) {
    return undefined;
  }

  try {
    const baseDataUrl = trimmed.startsWith('data:') ? trimmed : await downloadImageAsDataUrl(trimmed);
    const dataUrl = isSvgDataUrl(baseDataUrl) ? await rasterizeSvgDataUrl(baseDataUrl) : baseDataUrl;
    const size = await getImageDimensions(dataUrl);
    return {
      dataUrl,
      width: size.width,
      height: size.height,
    };
  } catch (error) {
    console.warn('Failed to load logo', error);
    return undefined;
  }
};

const downloadImageAsDataUrl = async (url: string) => {
  // Browser CORS rules apply: the logo must be hosted on the same origin (or a CORS-enabled endpoint).
  // There is no way for the plugin to bypass CORS, so ensure Grafana (or a proxy under the same host) serves the asset.
  const response = await fetch(url, { credentials: 'same-origin' });
  if (!response.ok) {
    throw new Error('Failed to download logo image.');
  }
  const blob = await response.blob();
  return blobToDataUrl(blob);
};

const getImageDimensions = (dataUrl: string) =>
  new Promise<{ width: number; height: number }>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = () => reject(new Error('Failed to read image dimensions.'));
    image.src = dataUrl;
  });

const isSvgDataUrl = (value: string) => value.toLowerCase().startsWith('data:image/svg+xml');

const rasterizeSvgDataUrl = (dataUrl: string) =>
  new Promise<string>((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const width = image.naturalWidth || image.width || 100;
      const height = image.naturalHeight || image.height || 100;
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d');
      if (!context) {
        reject(new Error('Failed to create canvas context.'));
        return;
      }
      context.drawImage(image, 0, 0, width, height);
      resolve(canvas.toDataURL('image/png'));
    };
    image.onerror = () => reject(new Error('Failed to rasterize SVG logo.'));
    image.src = dataUrl;
  });
