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

import { PluginExtensionPanelContext, RawTimeRange } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import { TimeZone } from '@grafana/schema';
import { VariableValueMap } from '../types/reporting';

export const DEFAULT_RAW_TIME_RANGE: RawTimeRange = { from: 'now-6h', to: 'now' };

/**
 * Manual dashboard inputs used when generating from the app page.
 */
export interface ManualDashboardContext {
  dashboardUid?: string;
  dashboardTitle?: string;
  timeRange?: RawTimeRange;
  timeZone?: TimeZone;
  variables?: VariableValueMap;
}

/**
 * Derived dashboard context (UID, title, time range, variables) from either a panel or URL.
 */
export interface DashboardContextResult {
  dashboardUid?: string;
  dashboardTitle?: string;
  timeRange?: RawTimeRange;
  timeZone?: TimeZone;
  variables?: VariableValueMap;
}

export const getDashboardContext = (
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
