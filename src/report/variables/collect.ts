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

import { ScopedVars, TypedVariableModel } from '@grafana/data';
import { DashboardModel } from '../../types/grafana';
import { VariableValueMap } from '../../types/reporting';
import { extractVariableValues, isAllValue } from './normalize';

export const getDashboardTemplateVariableValues = (dashboard?: DashboardModel): VariableValueMap => {
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

// Reads variable values/options from the live Grafana template service (includes query variable options).
export const getRuntimeTemplateVariableValues = (templateSrvInstance?: {
  getVariables?: () => TypedVariableModel[];
}) => {
  const variables = templateSrvInstance?.getVariables?.();
  if (!variables?.length) {
    return {};
  }

  const values: VariableValueMap = {};

  for (const variable of variables) {
    if (!variable?.name) {
      continue;
    }

    const normalized = extractVariableValues(variable);
    if (normalized.length) {
      values[variable.name] = normalized;
    }
  }

  return values;
};

// Merges dashboard variables with manual overrides, keeping display text when possible.
export const mergeVariableValues = (base: VariableValueMap, overrides?: VariableValueMap): VariableValueMap => {
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

// Flattens variable map into repeated var- key/value pairs for render requests.
export const buildVariablePairs = (values: VariableValueMap): Array<{ key: string; value: string }> =>
  Object.entries(values)
    .map(([name, variableValues]) =>
      variableValues.map((entry) => ({
        key: `var-${name}`,
        value: entry.value,
      }))
    )
    .flat();

// Converts a VariableValueMap into Grafana ScopedVars shape for template replacement.
export const buildScopedVarsFromValueMap = (values?: VariableValueMap): ScopedVars | undefined => {
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

// Applies friendly text labels to merged values, using dashboard values and parsed definitions as fallback.
export const mapVariableTextFromDashboard = (
  values: VariableValueMap,
  dashboardValues?: VariableValueMap,
  definitionLookup?: Record<string, Map<string, string>>
): VariableValueMap => {
  const result: VariableValueMap = {};
  for (const [name, entries] of Object.entries(values)) {
    if (!entries?.length) {
      result[name] = entries;
      continue;
    }
    const dashboardEntries = dashboardValues?.[name] ?? [];
    const definitionMap = definitionLookup?.[name];
    result[name] = entries.map((entry) => {
      if (entry.text && entry.text !== entry.value) {
        return entry;
      }
      const dashboardMatch = dashboardEntries.find(
        (dash) => dash.value === entry.value && dash.text && dash.text !== dash.value
      );
      const definitionText = definitionMap?.get(entry.value);
      if (dashboardMatch?.text) {
        return { ...entry, text: dashboardMatch.text };
      }
      if (definitionText) {
        return { ...entry, text: definitionText };
      }
      return { ...entry, text: entry.text ?? entry.value };
    });
  }
  return result;
};

// Grafana omits resolved option lists for query variables in the dashboard JSON, so we parse the raw
// SQL-like definition to recover value->text pairs for non-current selections.
// Parses variable definitions to build a value->text lookup for query variables.
export const buildVariableDefinitionLookup = (dashboard?: DashboardModel) => {
  const lookup: Record<string, Map<string, string>> = {};
  const list = dashboard?.templating?.list;
  if (!list?.length) {
    return lookup;
  }
  for (const variable of list) {
    if (!variable?.name || !variable?.definition || typeof variable.definition !== 'string') {
      continue;
    }
    const map = parseDefinitionPairs(variable.definition);
    if (map.size) {
      lookup[variable.name] = map;
    }
  }
  return lookup;
};

// Extracts (text, value) tuples from a SQL-like VALUES definition string.
export const parseDefinitionPairs = (definition: string): Map<string, string> => {
  const map = new Map<string, string>();
  const regex = /\(\s*'([^']+)'\s*,\s*'([^']+)'\s*\)/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(definition)) !== null) {
    const [, text, value] = match;
    if (value) {
      map.set(value, text);
    }
  }
  return map;
};
