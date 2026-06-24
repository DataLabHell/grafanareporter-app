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

import { PluginExtensionPanelContext } from '@grafana/data';
import { getBackendSrv, getTemplateSrv } from '@grafana/runtime';
import { lastValueFrom } from 'rxjs';
import { DashboardApiResponse } from '../types/grafana';
import { ReporterPluginSettings, resolveLayoutSettings } from '../types/reporting';
import { DEFAULT_RAW_TIME_RANGE, getDashboardContext, ManualDashboardContext } from './context';
import { getBrandingReservedHeight } from './pdf/branding';
import { composeReportPdf, PanelImage } from './pdf/compose';
import { loadLogoAsset, resolveLogoSource } from './pdf/logo';
import { flattenPanels, getPanelRenderId, groupPanelsByRows } from './panels/flatten';
import { getPanelTitle } from './panels/title';
import { resolveTimeRange } from './time';
import { resolveThemePreference } from './theme';
import { runWithConcurrency, throwIfAborted, withAbort } from './util/async';
import { blobToDataUrl } from './util/blob';
import { formatTimestamp, slugify } from './util/naming';
import {
  buildScopedVarsFromValueMap,
  buildVariableDefinitionLookup,
  buildVariablePairs,
  getDashboardTemplateVariableValues,
  getRuntimeTemplateVariableValues,
  mapVariableTextFromDashboard,
  mergeVariableValues,
} from './variables/collect';
import { resolveQueryVariableValues } from './variables/query';
import { getScopedVariableOverrides, mergeScopedVars } from './variables/scoped';

type ProgressHandler = (message: string) => void;

/**
 * Options for orchestrating report generation.
 * - `panelContext` is passed by Grafana when invoked from a panel extension.
 * - `manualContext` is used by the app page when running against an explicit dashboard selection.
 */
export interface GenerateReportOptions {
  panelContext?: PluginExtensionPanelContext;
  settings?: ReporterPluginSettings;
  onProgress?: ProgressHandler;
  manualContext?: ManualDashboardContext;
  signal?: AbortSignal;
}

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
  const rawRange = contextTimeRange ?? response.dashboard?.time ?? DEFAULT_RAW_TIME_RANGE;
  const timeRange = resolveTimeRange(rawRange, timeZone);

  // Variables can come from three places: Grafana template variables, dashboard defaults, and manual overrides/query params.
  const dashboardVariableValues = getDashboardTemplateVariableValues(response.dashboard);
  const runtimeVariableValues = getRuntimeTemplateVariableValues(templateSrv);
  const withRuntimeVariables = mergeVariableValues(dashboardVariableValues, runtimeVariableValues);
  const queryVariableValues = await resolveQueryVariableValues(
    response.dashboard,
    withRuntimeVariables,
    rawRange,
    timeZone,
    templateSrv
  );
  const baseVariableValues = mergeVariableValues(withRuntimeVariables, queryVariableValues);
  const definitionLookup = buildVariableDefinitionLookup(response.dashboard);
  const mergedVariableValues = mapVariableTextFromDashboard(
    mergeVariableValues(baseVariableValues, manualVariables),
    baseVariableValues,
    definitionLookup
  );
  const dashboardTitle = response.dashboard?.title || fallbackTitle || `dashboard-${dashboardUid}`;
  const slug = response.meta?.slug || slugify(dashboardTitle);
  const groupedPanels = groupPanelsByRows(response.dashboard?.panels ?? []);
  const panels = flattenPanels(groupedPanels, mergedVariableValues);

  if (!panels.length) {
    throw new Error('No panels were found on this dashboard.');
  }

  notify(`Found ${panels.length} panels, rendering screenshots...`);

  if (!timeRange) {
    throw new Error('Could not determine the current time range.');
  }

  // Layout preferences come from the resolved plugin settings. Manual overrides are merged upstream.
  const layoutConfig = resolveLayoutSettings(settings?.layout);
  const renderWidth = layoutConfig.panels.width;
  const renderHeight = layoutConfig.panels.height;
  // A library logo selected by id resolves to its stored data URI; otherwise the direct url is used.
  const logoSource = resolveLogoSource(layoutConfig.logo, settings?.logos);
  const logoAsset = layoutConfig.logo.enabled && logoSource ? await loadLogoAsset(logoSource) : undefined;
  const headerHeight = getBrandingReservedHeight('header', layoutConfig, logoAsset);
  const footerHeight = getBrandingReservedHeight('footer', layoutConfig, logoAsset);

  const renderablePanels = panels
    .map((panel, originalIndex) => ({ panel, originalIndex }))
    .filter(({ panel }) => Boolean(panel.id || panel.renderId));
  const panelImageSlots: Array<PanelImage | undefined> = new Array(renderablePanels.length);
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

  const panelImages = panelImageSlots.filter(Boolean) as PanelImage[];

  if (!panelImages.length) {
    throw new Error('No renderable panels were found on this dashboard.');
  }

  notify('Composing PDF...');
  throwIfAborted(signal);

  const pdf = composeReportPdf({
    panelImages,
    layout: layoutConfig,
    logo: logoAsset,
    headerHeight,
    footerHeight,
    renderWidth,
    renderHeight,
    signal,
  });

  const fileName = `${slugify(dashboardTitle)}-${formatTimestamp(new Date())}.pdf`;
  throwIfAborted(signal);
  notify('Saving PDF...');
  pdf.save(fileName);
  notify('Report ready.');

  return {
    fileName,
  };
};
