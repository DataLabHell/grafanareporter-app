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

import { buildDatasourceQueryPayload, extractQueryVariableQuery, interpolateObject, mapMetricFindResults } from './query';

describe('extractQueryVariableQuery', () => {
  it('returns trimmed string queries', () => {
    expect(extractQueryVariableQuery({ query: '  SELECT 1  ' } as any)).toBe('SELECT 1');
  });

  it('returns the full query model object when it carries an infinityQuery (no .query key)', () => {
    const query = { infinityQuery: { refId: 'A', type: 'json' } };
    expect(extractQueryVariableQuery({ query } as any)).toEqual(query);
  });

  it('returns the nested .query string when the model wraps it', () => {
    expect(extractQueryVariableQuery({ query: { query: 'SELECT 2' } } as any)).toBe('SELECT 2');
  });

  it('returns undefined when there is no query', () => {
    expect(extractQueryVariableQuery({} as any)).toBeUndefined();
  });
});

describe('mapMetricFindResults', () => {
  it('maps scalars and {text,value} objects to value/text pairs', () => {
    expect(mapMetricFindResults(['a', { text: 'B', value: 'b' }])).toEqual([
      { value: 'a', text: 'a', selected: false },
      { value: 'b', text: 'B', selected: false },
    ]);
  });

  it('applies a capture-group regex when provided', () => {
    expect(mapMetricFindResults(['host-01-prod'], '/host-(\\d+)-/')).toEqual([
      { value: '01', text: '01', selected: false },
    ]);
  });
});

describe('interpolateObject', () => {
  it('recursively interpolates string fields', () => {
    const templateSrv = { replace: (s?: string) => s?.replace('$env', 'prod') ?? '' };
    expect(interpolateObject({ a: '$env', nested: ['x', '$env'], n: 5 }, templateSrv)).toEqual({
      a: 'prod',
      nested: ['x', 'prod'],
      n: 5,
    });
  });
});

describe('buildDatasourceQueryPayload', () => {
  const templateSrv = { replace: (s?: string) => s ?? '' };

  it('mirrors a plain query string into rawSql/rawQuery/sql and defaults format to table', () => {
    const payload = buildDatasourceQueryPayload(
      { query: 'SELECT 1' } as any,
      'SELECT 1',
      { uid: 'pg-uid', type: 'postgres' },
      templateSrv
    );
    expect(payload).toMatchObject({
      refId: 'Var',
      datasource: { uid: 'pg-uid' },
      query: 'SELECT 1',
      rawSql: 'SELECT 1',
      rawQuery: 'SELECT 1',
      sql: 'SELECT 1',
      format: 'table',
    });
  });

  it('does not inject a string format for trino datasources', () => {
    const payload = buildDatasourceQueryPayload(
      { query: 'SELECT 1' } as any,
      'SELECT 1',
      { uid: 'trino-uid', type: 'trino-datasource' },
      templateSrv
    );
    expect(payload.format).toBeUndefined();
  });

  it('forwards the infinity query model with type and uid', () => {
    const payload = buildDatasourceQueryPayload(
      { query: { infinityQuery: { refId: 'A', type: 'json', url: '/x' } } } as any,
      '',
      { uid: 'inf-uid', type: 'yesoreyeram-infinity-datasource' },
      templateSrv
    );
    expect(payload).toMatchObject({
      refId: 'A',
      queryType: 'infinity',
      datasource: { uid: 'inf-uid', type: 'yesoreyeram-infinity-datasource' },
      type: 'json',
      url: '/x',
    });
  });
});
