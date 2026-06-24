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

import {
  buildScopedVarsFromValueMap,
  buildVariableDefinitionLookup,
  buildVariablePairs,
  mapVariableTextFromDashboard,
  mergeVariableValues,
  parseDefinitionPairs,
} from './collect';

describe('mergeVariableValues', () => {
  it('ignores a manual $__all override when concrete base values exist', () => {
    const base = { iterator: [{ value: '1' }, { value: '2' }] };
    expect(mergeVariableValues(base, { iterator: [{ value: '$__all', text: 'All' }] }).iterator).toEqual(base.iterator);
  });

  it('applies concrete manual overrides', () => {
    const base = { iterator: [{ value: '1' }] };
    expect(mergeVariableValues(base, { iterator: [{ value: '9' }] }).iterator).toEqual([{ value: '9' }]);
  });

  it('returns the base untouched when overrides are empty', () => {
    const base = { a: [{ value: '1' }] };
    expect(mergeVariableValues(base, undefined)).toBe(base);
  });
});

describe('buildVariablePairs', () => {
  it('emits a var-<name> pair per value', () => {
    expect(
      buildVariablePairs({
        region: [{ value: 'us', text: 'US' }, { value: 'eu', text: 'EU' }],
        env: [{ value: 'prod' }],
      })
    ).toEqual([
      { key: 'var-region', value: 'us' },
      { key: 'var-region', value: 'eu' },
      { key: 'var-env', value: 'prod' },
    ]);
  });
});

describe('buildScopedVarsFromValueMap', () => {
  it('collapses single values and joins multi-value text', () => {
    expect(
      buildScopedVarsFromValueMap({
        single: [{ value: '1', text: 'One' }],
        multi: [{ value: 'a' }, { value: 'b' }],
      })
    ).toEqual({
      single: { value: '1', text: 'One' },
      multi: { value: ['a', 'b'], text: 'a, b' },
    });
  });

  it('returns undefined when there are no entries', () => {
    expect(buildScopedVarsFromValueMap(undefined)).toBeUndefined();
    expect(buildScopedVarsFromValueMap({ empty: [] })).toBeUndefined();
  });
});

describe('mapVariableTextFromDashboard', () => {
  it('backfills friendly text from dashboard values and parsed definitions', () => {
    const result = mapVariableTextFromDashboard(
      { region: [{ value: 'us' }, { value: 'eu' }] },
      { region: [{ value: 'us', text: 'United States' }] },
      { region: new Map([['eu', 'Europe']]) }
    );
    expect(result.region).toEqual([
      { value: 'us', text: 'United States' },
      { value: 'eu', text: 'Europe' },
    ]);
  });

  it('keeps existing distinct text', () => {
    const result = mapVariableTextFromDashboard({ a: [{ value: 'x', text: 'Label' }] });
    expect(result.a).toEqual([{ value: 'x', text: 'Label' }]);
  });
});

describe('parseDefinitionPairs / buildVariableDefinitionLookup', () => {
  it('extracts (text, value) tuples from a SQL-like VALUES definition', () => {
    const map = parseDefinitionPairs("SELECT * FROM (VALUES ('United States','us'),('Europe','eu'))");
    expect(map.get('us')).toBe('United States');
    expect(map.get('eu')).toBe('Europe');
  });

  it('builds a per-variable lookup from a dashboard model', () => {
    const lookup = buildVariableDefinitionLookup({
      templating: {
        list: [{ name: 'region', definition: "VALUES ('US','us')" }],
      },
    } as any);
    expect(lookup.region.get('us')).toBe('US');
  });
});
