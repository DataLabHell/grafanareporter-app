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

import { ScopedVars } from '@grafana/data';
import { PanelModel } from '../../types/grafana';
import { VariableValueMap } from '../../types/reporting';
import { buildScopedVarOverride, hasScopedOverride, mergeScopedVars } from '../variables/scoped';

// Recursively expands rows/repeat panels and clones them for every variable iteration.
export const flattenPanels = (
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
      if (panel.repeat && !hasScopedOverride(combinedScopedVars, panel.repeat, variableValues[panel.repeat])) {
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

    if (panel.repeat && !hasScopedOverride(combinedScopedVars, panel.repeat, variableValues[panel.repeat])) {
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
export const getPanelRenderId = (panel: PanelModel) => (panel.id !== undefined ? panel.id : panel.renderId);

// Grafana <=12.1 emitted row children immediately after the row definition, while >=12.2 only sets rowPanelId.
// We normalize both models here so downstream logic can treat row.panels uniformly regardless of Grafana version.
export const groupPanelsByRows = (panels: PanelModel[] = []): PanelModel[] => {
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
      // Treat missing `collapsed` as expanded; only skip children when it is explicitly true (critical for $__all repeats).
      const isExpanded = panel.collapsed !== true;
      activeRow = isExpanded ? panel : undefined;
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
