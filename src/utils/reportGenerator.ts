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

/**
 * Backwards-compatible entry point for report generation.
 *
 * The implementation has been decoupled into focused modules under `src/report/`
 * (variable resolution, panel flattening, PDF composition, utilities). This file
 * re-exports the public orchestrator and a `__testables` surface so existing
 * imports and unit tests keep working against a single import path.
 */

import { getBrandingReservedHeight } from '../report/pdf/branding';
import { determineGridColumns, fitRectangle } from '../report/pdf/primitives';
import { flattenPanels, groupPanelsByRows } from '../report/panels/flatten';
import { getPanelTitle } from '../report/panels/title';
import { extractVariableValues, normalizeVariableEntries } from '../report/variables/normalize';
import { buildVariablePairs, mergeVariableValues } from '../report/variables/collect';

export { generateDashboardReport } from '../report/generateReport';
export type { GenerateReportOptions } from '../report/generateReport';

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
