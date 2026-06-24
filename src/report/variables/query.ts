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
import { getBackendSrv, getDataSourceSrv } from '@grafana/runtime';
import { DashboardModel, DashboardTemplateVariable } from '../../types/grafana';
import { VariableValueMap } from '../../types/reporting';
import { resolveTimeRange } from '../time';
import { buildScopedVarsFromValueMap } from './collect';
import { normalizeVariableOptions, toArray } from './normalize';

type TemplateSrvLike = {
  replace?: (target?: string, scopedVars?: ScopedVars, format?: string | Function) => string;
};

// Resolves options for query variables by executing their queries against their datasource.
export const resolveQueryVariableValues = async (
  dashboard: DashboardModel | undefined,
  existingValues: VariableValueMap,
  rawRange: RawTimeRange,
  timeZone?: string,
  templateSrvInstance?: TemplateSrvLike
) => {
  const list = dashboard?.templating?.list;
  if (!list?.length) {
    return {};
  }

  const resolved: VariableValueMap = {};
  const timeRange = resolveTimeRange(rawRange, timeZone as any);

  for (const variable of list) {
    if (!variable?.name || variable?.type !== 'query') {
      continue;
    }

    const query = extractQueryVariableQuery(variable);
    if (!query) {
      continue;
    }

    try {
      const datasourceRef = (variable as any).datasource;
      const scopedVars = buildScopedVarsFromValueMap(existingValues);
      const interpolatedQuery =
        typeof query === 'string' ? templateSrvInstance?.replace?.(query, scopedVars) ?? query : query;

      const options = await runQueryVariableFallback(
        variable,
        interpolatedQuery,
        datasourceRef,
        rawRange,
        timeRange,
        templateSrvInstance,
        scopedVars
      );

      const normalized = normalizeVariableOptions(mapMetricFindResults(options, (variable as any)?.regex));

      if (normalized.length) {
        resolved[variable.name] = normalized.map(({ value, text }) => ({ value, text }));
      }
    } catch (error) {
      console.warn('Failed to resolve query variable options', variable?.name, error);
    }
  }

  return resolved;
};

// Extracts the raw query string from a query variable definition.
export const extractQueryVariableQuery = (variable: Partial<DashboardTemplateVariable>) => {
  const query = (variable as any)?.query;
  const infinityQuery = query?.infinityQuery;
  if (!query) {
    if (infinityQuery) {
      return infinityQuery;
    }
    return undefined;
  }

  if (typeof query === 'string') {
    const trimmed = query.trim();
    if (trimmed) {
      return trimmed;
    }
    if (infinityQuery) {
      return infinityQuery;
    }
    return undefined;
  }

  if (typeof query === 'object' && 'query' in query && (query as any).query) {
    return (query as any).query;
  }

  if (typeof query === 'object') {
    return query;
  }

  // Return object payloads as-is for datasources (e.g., Infinity) that store the full model on `query`.
  return undefined;
};

export const mapMetricFindResults = (options: any, rawRegex?: any) => {
  const results = toArray(options);
  if (!results.length) {
    return [];
  }
  const regex = coerceRegex(rawRegex);
  const mapped: Array<{ value?: any; text?: any; selected?: boolean }> = [];

  for (const entry of results) {
    const value = (entry as any)?.value ?? (entry as any)?.text ?? entry;
    const text = (entry as any)?.text ?? (entry as any)?.value ?? entry;

    if (value === undefined || value === null || value === '') {
      continue;
    }

    const coercedValue = String(value);
    const coercedText = text === undefined || text === null || text === '' ? undefined : String(text);

    if (!regex) {
      mapped.push({ value: coercedValue, text: coercedText, selected: false });
      continue;
    }

    const candidate = applyRegexToValue(regex, coercedValue, coercedText);
    if (candidate) {
      mapped.push({ ...candidate, selected: false });
    }
  }

  return mapped;
};

const coerceRegex = (rawRegex: any) => {
  if (!rawRegex || typeof rawRegex !== 'string') {
    return undefined;
  }

  try {
    if (rawRegex.startsWith('/')) {
      const lastSlash = rawRegex.lastIndexOf('/');
      if (lastSlash > 1) {
        const pattern = rawRegex.slice(1, lastSlash);
        const flags = rawRegex.slice(lastSlash + 1);
        return new RegExp(pattern, flags);
      }
    }

    return new RegExp(rawRegex);
  } catch {
    return undefined;
  }
};

const applyRegexToValue = (regex: RegExp, value: string, text?: string) => {
  const target = text ?? value;
  const match = target.match(regex);
  if (!match) {
    return undefined;
  }

  if (match.length > 1 && match[1] !== undefined) {
    return { value: match[1], text: match[1] };
  }

  return { value: target, text: target };
};

// Fallback for query variables when only the raw query model is available: run /api/ds/query and map the first columns.
// Required for $__all expansion when the datasource doesn’t expose variable options directly.
const runQueryVariableFallback = async (
  variable: Partial<DashboardTemplateVariable>,
  interpolatedQuery: string,
  datasourceRef: any,
  rawRange: RawTimeRange,
  timeRange: { from: number; to: number } | undefined,
  templateSrvInstance?: TemplateSrvLike,
  scopedVars?: ScopedVars
) => {
  const dsSettings = getDataSourceSrv().getInstanceSettings(datasourceRef as any);
  if (!dsSettings?.uid) {
    console.warn('Missing datasource settings for variable query fallback');
    return [];
  }

  try {
    // Build a datasource-specific query (with interpolation) so plugins can respond even without exposing variable helpers.
    const payload = buildDatasourceQueryPayload(
      variable,
      interpolatedQuery,
      dsSettings,
      templateSrvInstance,
      scopedVars,
      timeRange
    );
    const resultKey = payload.refId ?? 'Var';

    const response = await getBackendSrv().post('/api/ds/query', {
      queries: [payload],
      from: rawRange?.from ?? timeRange?.from,
      to: rawRange?.to ?? timeRange?.to,
    });

    // Respect the refId used in the payload; plugins echo it back in results.
    const frames = response?.results?.[resultKey]?.frames;
    if (!frames?.length) {
      return [];
    }

    const mapped: Array<{ value?: any; text?: any; selected?: boolean }> = [];

    for (const frame of frames) {
      const fields: Array<{ name?: string; type?: string; typeInfo?: { frame?: string } }> =
        frame?.schema?.fields ?? [];
      const values: any[][] = frame?.data?.values ?? [];
      if (!fields.length || !values.length) {
        continue;
      }

      let valueIndex = fields.findIndex((f) => f?.name === '__value' || f?.name === 'value');
      let textIndex = fields.findIndex((f) => f?.name === '__text' || f?.name === 'text');

      if (valueIndex < 0 && textIndex < 0) {
        // Fall back to the first string column when explicit __value/__text hints are missing.
        const firstString = fields.findIndex((f) => f?.type === 'string' || f?.typeInfo?.frame === 'string');
        if (firstString >= 0) {
          valueIndex = firstString;
          textIndex = firstString;
        }
      }

      if (valueIndex < 0) {
        valueIndex = Math.max(0, Math.min(fields.length - 1, 0));
      }
      if (textIndex < 0) {
        textIndex = valueIndex;
      }

      const valueColumn = values[valueIndex] ?? [];
      const textColumn = values[textIndex] ?? [];
      const rowCount = Math.max(valueColumn.length, textColumn.length);

      for (let i = 0; i < rowCount; i++) {
        const value = valueColumn[i];
        if (value === undefined || value === null || value === '') {
          continue;
        }
        const text = textColumn[i];
        mapped.push({ value: String(value), text: text === undefined ? undefined : String(text), selected: false });
      }
    }

    return mapped;
  } catch (error) {
    console.warn('Fallback variable query failed', error);
    return [];
  }
};

// Builds a datasource-specific query payload from the variable definition.
export const buildDatasourceQueryPayload = (
  variable: Partial<DashboardTemplateVariable>,
  interpolatedQuery: string,
  dsSettings: { uid: string; type: string },
  templateSrvInstance?: TemplateSrvLike,
  scopedVars?: ScopedVars,
  timeRange?: { from: number; to: number }
) => {
  const rawQuery = (variable as any)?.query;
  const infinityQuery = rawQuery?.infinityQuery;

  let payload: Record<string, any>;

  // Infinity datasource stores the full query model on `infinityQuery`; forward it as-is.
  if (infinityQuery && typeof infinityQuery === 'object') {
    const interpolatedInfinity = interpolateObject(infinityQuery, templateSrvInstance, scopedVars);
    return {
      refId: (interpolatedInfinity as any)?.refId ?? 'Var',
      queryType: rawQuery?.queryType ?? 'infinity',
      datasource: { uid: dsSettings.uid, type: dsSettings.type },
      ...interpolatedInfinity,
    };
  }

  if (rawQuery && typeof rawQuery === 'object') {
    payload = interpolateObject(rawQuery, templateSrvInstance, scopedVars);
  } else {
    // Default to a minimal query payload; plugins vary on format handling.
    payload = {
      query: interpolatedQuery,
    };
  }

  // If the plugin expects rawSql/sql but only a query string is present, mirror it.
  // Datasources disagree on the field name (Postgres/MySQL: rawSql, Trino: rawSQL, others: sql/rawQuery),
  // so populate all of them; each plugin reads the one it knows and ignores the rest.
  if (!payload.rawSql && typeof payload.query === 'string') {
    payload.rawSql = payload.query;
  }
  if (!payload.rawSQL && typeof payload.query === 'string') {
    payload.rawSQL = payload.query;
  }
  if (!payload.rawQuery && typeof payload.query === 'string') {
    payload.rawQuery = payload.query;
  }
  if (!payload.sql && typeof payload.query === 'string') {
    payload.sql = payload.query;
  }
  // Only add a default format for SQL-style datasources; some plugins (e.g., Trino) reject string formats.
  if (!payload.format && typeof payload.query === 'string' && !String(dsSettings.type ?? '').includes('trino')) {
    payload.format = 'table';
  }

  // Grafana usually adds these for query requests; helpful for plugins that expect them.
  if (timeRange?.from !== undefined && timeRange?.to !== undefined) {
    const span = Math.max(1, timeRange.to - timeRange.from);
    payload.intervalMs = Math.max(50, Math.floor(span / 100));
    payload.maxDataPoints = Math.max(1, Math.floor(span / payload.intervalMs));
  }

  return {
    refId: (payload as any)?.refId ?? 'Var',
    datasource: { uid: dsSettings.uid },
    ...payload,
  };
};

// Recursively interpolates string fields in query payloads.
export const interpolateObject = (input: any, templateSrvInstance?: TemplateSrvLike, scopedVars?: ScopedVars): any => {
  if (typeof input === 'string') {
    return templateSrvInstance?.replace?.(input, scopedVars) ?? input;
  }

  if (Array.isArray(input)) {
    return input.map((item) => interpolateObject(item, templateSrvInstance, scopedVars));
  }

  if (input && typeof input === 'object') {
    const result: Record<string, any> = {};
    for (const [key, value] of Object.entries(input)) {
      result[key] = interpolateObject(value, templateSrvInstance, scopedVars);
    }
    return result;
  }

  return input;
};
