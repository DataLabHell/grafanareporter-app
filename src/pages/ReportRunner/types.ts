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

import { RawTimeRange } from '@grafana/data';
import { TimeZone } from '@grafana/schema';
import { DashboardModel } from '../../types/grafana';
import { ReportTheme, ResolvedLayoutSettings, VariableValueMap } from '../../types/reporting';

export interface DashboardSearchHit {
  uid: string;
  title: string;
  url: string;
  folderTitle?: string;
}

export interface DashboardDetailsResponse {
  dashboard: Pick<DashboardModel, 'title' | 'time' | 'templating'>;
}

export interface ManualRunContext {
  dashboardUid?: string;
  dashboardTitle?: string;
  timeRange?: RawTimeRange;
  timeZone?: TimeZone | 'browser';
  variables?: VariableValueMap;
}

export interface AdvancedSettingsSnapshot {
  range: RawTimeRange;
  timezone: TimeZone | 'browser';
  reportTheme: ReportTheme;
  variablesText: string;
  layout: ResolvedLayoutSettings;
}
