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
import { VariableValue, VariableValueMap } from '../../types/reporting';
import { isAllValue, normalizeVariableEntries, toArray } from './normalize';

const INTERNAL_SCOPED_VARS_ALLOWLIST = new Set(['__repeat', '__repeat_index', '__repeatRow', '__repeat_row']);

export const getScopedVariableOverrides = (scopedVars?: ScopedVars): VariableValueMap | undefined => {
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

export const hasScopedOverride = (
  scopedVars: ScopedVars | undefined,
  variableName: string,
  repeatValues?: VariableValue[]
) => {
  if (repeatValues?.length && repeatValues.length > 1) {
    return false;
  }
  const scoped = scopedVars?.[variableName];
  if (!scoped) {
    return false;
  }
  const scopedValues = toArray(scoped.value ?? scoped.text);
  // If multiple values are present (e.g., $__all or multi-select), let repeats expand them.
  if (scopedValues.length !== 1) {
    return false;
  }
  // If a single string contains comma-separated values (Grafana sometimes serializes multi values as a string), treat it as multi.
  const single = scopedValues[0];
  if (typeof single === 'string' && single.includes(',')) {
    return false;
  }
  // Allow repeats to expand $__all even when Grafana injects scopedVars for the current selection.
  if (scopedValues.some((entry) => isAllValue({ value: entry } as VariableValue))) {
    return false;
  }
  return true;
};

export const mergeScopedVars = (parent?: ScopedVars, child?: ScopedVars): ScopedVars | undefined => {
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

export const buildScopedVarOverride = (name: string, entry: VariableValue): ScopedVars => ({
  [name]: {
    text: entry.text ?? entry.value,
    value: entry.value,
  },
});
