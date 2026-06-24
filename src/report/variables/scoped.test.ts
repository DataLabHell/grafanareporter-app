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

import { buildScopedVarOverride, getScopedVariableOverrides, hasScopedOverride, mergeScopedVars } from './scoped';

describe('getScopedVariableOverrides', () => {
  it('keeps user variables and allowlisted internals, dropping other __ vars', () => {
    const overrides = getScopedVariableOverrides({
      region: { value: 'us', text: 'US' },
      __repeat: { value: '0', text: '0' },
      __sceneObject: { value: 'x', text: 'x' },
    } as any);
    expect(overrides).toEqual({
      region: [{ value: 'us', text: 'US' }],
      __repeat: [{ value: '0', text: '0' }],
    });
  });

  it('returns undefined when nothing survives', () => {
    expect(getScopedVariableOverrides(undefined)).toBeUndefined();
    expect(getScopedVariableOverrides({ __sceneObject: { value: 'x', text: 'x' } } as any)).toBeUndefined();
  });
});

describe('hasScopedOverride', () => {
  it('is true for a single concrete scoped value', () => {
    expect(hasScopedOverride({ region: { value: 'us', text: 'US' } } as any, 'region')).toBe(true);
  });

  it('is false when repeats should expand (multi value, comma string, or $__all)', () => {
    expect(hasScopedOverride({ r: { value: ['a', 'b'], text: 'a,b' } } as any, 'r')).toBe(false);
    expect(hasScopedOverride({ r: { value: 'a,b', text: 'a,b' } } as any, 'r')).toBe(false);
    expect(hasScopedOverride({ r: { value: '$__all', text: 'All' } } as any, 'r')).toBe(false);
  });

  it('is false when there are multiple repeat values to expand', () => {
    expect(hasScopedOverride({ r: { value: 'a', text: 'a' } } as any, 'r', [{ value: 'a' }, { value: 'b' }])).toBe(
      false
    );
  });

  it('is false when the variable is absent from scopedVars', () => {
    expect(hasScopedOverride({} as any, 'missing')).toBe(false);
  });
});

describe('mergeScopedVars', () => {
  it('merges with the child winning on conflicts', () => {
    expect(mergeScopedVars({ a: { value: '1', text: '1' } }, { a: { value: '2', text: '2' } } as any)).toEqual({
      a: { value: '2', text: '2' },
    });
  });

  it('returns the defined side when the other is missing', () => {
    const child = { a: { value: '1', text: '1' } } as any;
    expect(mergeScopedVars(undefined, child)).toBe(child);
    expect(mergeScopedVars(child, undefined)).toBe(child);
  });
});

describe('buildScopedVarOverride', () => {
  it('builds a scoped var entry, defaulting text to value', () => {
    expect(buildScopedVarOverride('r', { value: 'us' })).toEqual({ r: { value: 'us', text: 'us' } });
    expect(buildScopedVarOverride('r', { value: 'us', text: 'US' })).toEqual({ r: { value: 'us', text: 'US' } });
  });
});
