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
import {
  BrandingAlignment,
  BrandingPlacement,
  DEFAULT_LAYOUT_SETTINGS,
  LayoutSettings,
  ReporterPluginSettings,
  ReportTheme,
  resolveLayoutSettings,
} from '../types/reporting';
import { DashboardApiResponse, DashboardModel, PanelModel } from '../types/grafana';

type ProgressHandler = (message: string) => void;

type VariableValueMap = Record<string, string[]>;

interface ManualDashboardContext {
  dashboardUid?: string;
  dashboardTitle?: string;
  timeRange?: RawTimeRange;
  timeZone?: TimeZone;
  variables?: VariableValueMap;
  layout?: LayoutSettings;
}

interface DashboardContextResult {
  dashboardUid?: string;
  dashboardTitle?: string;
  timeRange?: RawTimeRange;
  timeZone?: TimeZone;
  variables?: VariableValueMap;
}

interface GenerateReportOptions {
  panelContext?: PluginExtensionPanelContext;
  settings?: ReporterPluginSettings;
  onProgress?: ProgressHandler;
  manualContext?: ManualDashboardContext;
  signal?: AbortSignal;
}

const RENDER_WIDTH = 1600;
const RENDER_HEIGHT = 900;
const PDF_MARGIN = 32;
const BRANDING_LOGO_MAX_WIDTH = 120;
const BRANDING_LOGO_MAX_HEIGHT = 36;
const BRANDING_TEXT_LINE_HEIGHT = 12;
const BRANDING_SECTION_PADDING = 6;
const DEFAULT_RAW_TIME_RANGE: RawTimeRange = { from: 'now-6h', to: 'now' };

// Orchestrates the entire report flow: fetch dashboard, resolve variables, render panels via /render, then compose PDF.
export const generateDashboardReport = async ({
  panelContext,
  settings,
  onProgress,
  manualContext,
  signal,
}: GenerateReportOptions) => {
  const reporterTheme = resolveThemePreference(settings?.themePreference ?? 'user');
  const notify = (message: string) => onProgress?.(message);
  const backendSrv = getBackendSrv();
  const templateSrv = getTemplateSrv();
  const manualLayout = manualContext?.layout;
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

  const panelImages: Array<{ title: string; dataUrl: string }> = [];

  // Render each flattened panel via Grafana's /render/d-solo endpoint and collect the resulting data URLs.
  for (const [index, panel] of panels.entries()) {
    throwIfAborted(signal);
    if (!panel.id && !panel.renderId) {
      continue;
    }

    const resolvedPanelTitle = getPanelTitle(panel, templateSrv);
    notify(`Rendering panel ${index + 1}/${panels.length}: ${resolvedPanelTitle}`);

    const scopedVariableOverrides = getScopedVariableOverrides(panel.scopedVars);
    const panelVariableValues = mergeVariableValues(mergedVariableValues, scopedVariableOverrides);
    const panelVariablePairs = buildVariablePairs(panelVariableValues);
    const panelRenderId = getPanelRenderId(panel);
    if (!panelRenderId) {
      continue;
    }

    const params = new URLSearchParams({
      panelId: String(panelRenderId),
      from: String(timeRange.from),
      to: String(timeRange.to),
      theme: reporterTheme,
      width: String(RENDER_WIDTH),
      height: String(RENDER_HEIGHT),
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
    panelImages.push({
      title: resolvedPanelTitle,
      dataUrl,
    });
  }

  if (!panelImages.length) {
    throw new Error('No renderable panels were found on this dashboard.');
  }

  // Layout preferences can come from plugin defaults (AppConfig) or manual overrides (advanced settings/query params).
  // resolveReportLayout merges them and falls back to DEFAULT_LAYOUT_SETTINGS if nothing else is defined.
  const layoutConfig = resolveReportLayout(settings?.layout, manualLayout);
  const logoAsset =
    layoutConfig.logoEnabled && layoutConfig.logoUrl ? await loadLogoAsset(layoutConfig.logoUrl) : undefined;
  const headerHeight = getBrandingReservedHeight('header', layoutConfig, logoAsset);
  const footerHeight = getBrandingReservedHeight('footer', layoutConfig, logoAsset);

  notify('Composing PDF...');
  throwIfAborted(signal);
  const pdf = new jsPDF({
    orientation: layoutConfig.orientation,
    unit: 'pt',
    format: 'a4',
  });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const panelsPerPage = Math.max(1, layoutConfig.panelsPerPage);
  const panelSpacing = Math.max(0, layoutConfig.panelSpacing);
  const gridColumns = determineGridColumns(panelsPerPage);
  const gridRows = Math.max(1, Math.ceil(panelsPerPage / gridColumns));
  const totalPages = Math.max(1, Math.ceil(panelImages.length / panelsPerPage));
  const showPanelTitles = layoutConfig.showPanelTitles;
  const titleOffset = showPanelTitles ? 14 : 0;
  const contentOffset = showPanelTitles ? titleOffset + 4 : 0;

  // Walk through the rendered panels in chunks of `panelsPerPage`, laying them out on each PDF page.
  for (let pageIndex = 0; pageIndex < panelImages.length; pageIndex += panelsPerPage) {
    if (pageIndex > 0) {
      pdf.addPage(undefined, layoutConfig.orientation);
    }

    const pageItems = panelImages.slice(pageIndex, pageIndex + panelsPerPage);
    throwIfAborted(signal);
    const activeColumns = Math.min(gridColumns, Math.max(1, pageItems.length));
    const slotWidth = Math.max(10, (pageWidth - PDF_MARGIN * 2 - panelSpacing * (activeColumns - 1)) / activeColumns);
    const slotHeight = Math.max(
      40,
      (pageHeight - PDF_MARGIN * 2 - headerHeight - footerHeight - panelSpacing * (gridRows - 1)) / gridRows
    );
    pageItems.forEach((image, slotIndex) => {
      const rowIndex = Math.floor(slotIndex / activeColumns);
      const columnIndex = slotIndex % activeColumns;
      const xOffset = PDF_MARGIN + columnIndex * (slotWidth + panelSpacing);
      const yOffset = PDF_MARGIN + headerHeight + rowIndex * (slotHeight + panelSpacing);
      const contentHeight = Math.max(10, slotHeight - contentOffset);
      const maxImageWidth = slotWidth;
      const { width: imageWidth, height: imageHeight } = fitRectangle(
        maxImageWidth,
        contentHeight,
        RENDER_WIDTH,
        RENDER_HEIGHT
      );
      const imageX = xOffset + (slotWidth - imageWidth) / 2;
      const imageY = yOffset + contentOffset + (contentHeight - imageHeight) / 2;

      if (showPanelTitles) {
        pdf.setFontSize(14);
        pdf.text(image.title, xOffset, yOffset + titleOffset);
      }
      pdf.addImage(image.dataUrl, 'PNG', imageX, imageY, imageWidth, imageHeight);
    });

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
          repeatValues.forEach((value, index) => {
            const repeatScope = mergeScopedVars(combinedScopedVars, buildScopedVarOverride(panel.repeat!, value));
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
        repeatValues.forEach((value, index) => {
          const repeatScope = mergeScopedVars(combinedScopedVars, buildScopedVarOverride(panel.repeat!, value));
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

    const parsed = dateMath.toDateTime(value, { roundUp, timezone: timeZone });
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

    const normalized = normalizeVariableValues(variable.current?.value ?? variable.current?.text);
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

    const normalized = normalizeVariableValues(variable.current?.value ?? variable.current?.text);

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

  return {
    ...base,
    ...overrides,
  };
};

const buildVariablePairs = (values: VariableValueMap): Array<{ key: string; value: string }> =>
  Object.entries(values)
    .map(([name, variableValues]) =>
      variableValues.map((value) => ({
        key: `var-${name}`,
        value,
      }))
    )
    .flat();

const normalizeVariableValues = (value: any): string[] => {
  const raw = Array.isArray(value) ? value : [value];
  const normalized: string[] = [];

  for (const item of raw) {
    if (item === undefined || item === null || item === '') {
      continue;
    }

    if (typeof item === 'object') {
      if ('value' in item && item.value !== undefined && item.value !== null && item.value !== '') {
        normalized.push(String(item.value));
        continue;
      }
      if ('text' in item && item.text !== undefined && item.text !== null && item.text !== '') {
        normalized.push(String(item.text));
        continue;
      }
    }

    normalized.push(String(item));
  }

  return normalized;
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

    const normalized = normalizeVariableValues(scopedVar.value ?? scopedVar.text);

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

const buildScopedVarOverride = (name: string, value: string): ScopedVars => ({
  [name]: {
    text: value,
    value,
  },
});

const resolveReportLayout = (base?: LayoutSettings, override?: LayoutSettings) =>
  resolveLayoutSettings({
    orientation: override?.orientation ?? base?.orientation,
    panelsPerPage: override?.panelsPerPage ?? base?.panelsPerPage ?? DEFAULT_LAYOUT_SETTINGS.panelsPerPage,
    panelSpacing: override?.panelSpacing ?? base?.panelSpacing ?? DEFAULT_LAYOUT_SETTINGS.panelSpacing,
    logoUrl: override?.logoUrl ?? base?.logoUrl,
    logoEnabled: override?.logoEnabled ?? base?.logoEnabled,
    showPageNumbers: override?.showPageNumbers ?? base?.showPageNumbers,
    showPanelTitles: override?.showPanelTitles ?? base?.showPanelTitles,
    logoPlacement: override?.logoPlacement ?? base?.logoPlacement,
    logoAlignment: override?.logoAlignment ?? base?.logoAlignment,
    pageNumberPlacement: override?.pageNumberPlacement ?? base?.pageNumberPlacement,
    pageNumberAlignment: override?.pageNumberAlignment ?? base?.pageNumberAlignment,
  });

const determineGridColumns = (slotsPerPage: number) => {
  if (slotsPerPage >= 4) {
    return 2;
  }

  return 1;
};

const getBrandingReservedHeight = (
  placement: BrandingPlacement,
  layout: Required<LayoutSettings>,
  logo?: LogoAsset
) => {
  const logoDimensions =
    layout.logoEnabled && layout.logoPlacement === placement && logo
      ? fitRectangle(BRANDING_LOGO_MAX_WIDTH, BRANDING_LOGO_MAX_HEIGHT, logo.width, logo.height)
      : undefined;
  const showNumbers = layout.showPageNumbers && layout.pageNumberPlacement === placement;

  if (!logoDimensions && !showNumbers) {
    return 0;
  }

  const contentHeight = Math.max(logoDimensions?.height ?? 0, showNumbers ? BRANDING_TEXT_LINE_HEIGHT : 0);
  return contentHeight > 0 ? contentHeight + BRANDING_SECTION_PADDING * 2 : 0;
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

const getPanelTitle = (panel: PanelModel, templateSrv: ReturnType<typeof getTemplateSrv>) => {
  const fallbackTitle = `Panel ${panel.id ?? ''}`.trim() || 'Panel';
  const baseTitle = panel.title ?? fallbackTitle;

  try {
    const replaced = templateSrv.replace(baseTitle, panel.scopedVars);
    return replaced?.trim() || baseTitle;
  } catch {
    return baseTitle;
  }
};

const renderBrandingArea = (
  pdf: jsPDF,
  options: {
    placement: BrandingPlacement;
    layoutSettings: Required<LayoutSettings>;
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
    layoutSettings.logoEnabled && layoutSettings.logoPlacement === placement && logo
      ? fitRectangle(BRANDING_LOGO_MAX_WIDTH, BRANDING_LOGO_MAX_HEIGHT, logo.width, logo.height)
      : undefined;
  const showNumbers = layoutSettings.showPageNumbers && layoutSettings.pageNumberPlacement === placement;

  if (!logoDimensions && !showNumbers) {
    return;
  }

  const areaTop = placement === 'header' ? PDF_MARGIN : pageHeight - PDF_MARGIN - areaHeight;
  const centerY = areaTop + areaHeight / 2;

  if (logoDimensions && logo) {
    const logoX = getAlignedX(layoutSettings.logoAlignment, logoDimensions.width, pageWidth);
    const logoY = centerY - logoDimensions.height / 2;
    pdf.addImage(logo.dataUrl, 'PNG', logoX, logoY, logoDimensions.width, logoDimensions.height);
  }

  if (showNumbers) {
    const label = `Page ${pageNumber} of ${totalPages}`;
    const textY = centerY + BRANDING_TEXT_LINE_HEIGHT / 3;
    pdf.setFontSize(10);
    const { textX, textOptions } = getAlignedTextPosition(layoutSettings.pageNumberAlignment, pageWidth);
    pdf.text(label, textX, textY, textOptions);
  }
};

const getAlignedX = (alignment: BrandingAlignment, contentWidth: number, pageWidth: number) => {
  if (alignment === 'center') {
    return pageWidth / 2 - contentWidth / 2;
  }
  if (alignment === 'right') {
    return pageWidth - PDF_MARGIN - contentWidth;
  }
  return PDF_MARGIN;
};

const getAlignedTextPosition = (
  alignment: BrandingAlignment,
  pageWidth: number
): {
  textX: number;
  textOptions?: TextOptionsLight;
} => {
  if (alignment === 'center') {
    return { textX: pageWidth / 2, textOptions: { align: 'center' as const } };
  }
  if (alignment === 'right') {
    return { textX: pageWidth - PDF_MARGIN, textOptions: { align: 'right' as const } };
  }
  return { textX: PDF_MARGIN, textOptions: undefined };
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

export const __testables = {
  flattenPanels,
  groupPanelsByRows,
  resolveReportLayout,
  determineGridColumns,
  getBrandingReservedHeight,
  fitRectangle,
  mergeVariableValues,
  buildVariablePairs,
  normalizeVariableValues,
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
