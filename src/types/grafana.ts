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

import { RawTimeRange, ScopedVars } from '@grafana/data';

export interface DashboardTemplateVariable {
  name?: string;
  current?: {
    // Grafana template variables change shape per variable type (string, array, {text,value}, etc.),
    // so we keep them as unknown and normalize at runtime to avoid incorrect assumptions.
    value?: unknown;
    text?: unknown;
  };
  options?: Array<{
    value?: unknown;
    text?: unknown;
    selected?: boolean;
  }>;
  includeAll?: boolean;
  multi?: boolean;
  definition?: string;
  query?: unknown;
  type?: string;
  datasource?: {
    type?: string;
    uid?: string;
  };
}

export interface DashboardTemplating {
  list?: DashboardTemplateVariable[];
}

export interface PanelModel {
  id?: number | string;
  title?: string;
  type?: string;
  repeat?: string;
  collapsed?: boolean;
  scopedVars?: ScopedVars;
  panels?: PanelModel[];
  renderId?: number | string;
  rowPanelId?: number | string;
}

export interface DashboardModel {
  title?: string;
  panels?: PanelModel[];
  templating?: DashboardTemplating;
  time?: RawTimeRange;
}

export interface DashboardApiResponse {
  dashboard?: DashboardModel;
  meta?: {
    slug?: string;
  };
}
