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
  extractVariableValues,
  isAllValue,
  normalizeVariableEntries,
  normalizeVariableOptions,
  toArray,
} from './normalize';

describe('toArray', () => {
  it('wraps scalars and passes arrays through, treating null/undefined as empty', () => {
    expect(toArray('a')).toEqual(['a']);
    expect(toArray(['a', 'b'])).toEqual(['a', 'b']);
    expect(toArray(null)).toEqual([]);
    expect(toArray(undefined)).toEqual([]);
  });
});

describe('isAllValue', () => {
  it('detects the various $__all encodings', () => {
    expect(isAllValue({ value: '$__all' })).toBe(true);
    expect(isAllValue({ value: '__all' })).toBe(true);
    expect(isAllValue({ value: 'x', text: 'All' })).toBe(true);
    expect(isAllValue({ value: 'us', text: 'US' })).toBe(false);
  });
});

describe('normalizeVariableEntries', () => {
  it('coerces mixed structures into value/text pairs', () => {
    expect(
      normalizeVariableEntries([{ value: '123' }, { text: 'abc' }, 'raw', 42, undefined], ['text-123', 'text-abc'])
    ).toEqual([
      { value: '123', text: 'text-123' },
      { value: 'abc', text: 'abc' },
      { value: 'raw', text: undefined },
      { value: '42', text: undefined },
    ]);
  });

  it('drops empty/null sources', () => {
    expect(normalizeVariableEntries(['', null, undefined])).toEqual([]);
  });
});

describe('normalizeVariableOptions', () => {
  it('keeps the selected flag and drops empty options', () => {
    expect(
      normalizeVariableOptions([
        { value: 'a', text: 'A', selected: true },
        { value: '', text: '' },
        { value: 'b' },
      ])
    ).toEqual([
      { value: 'a', text: 'A', selected: true },
      { value: 'b', text: undefined, selected: false },
    ]);
  });
});

describe('extractVariableValues', () => {
  it('expands $__all into concrete options', () => {
    expect(
      extractVariableValues({
        current: { value: ['$__all'], text: ['All'] },
        options: [
          { value: '$__all', text: 'All', selected: true },
          { value: '1', text: 'One' },
          { value: '2', text: 'Two' },
        ],
      } as any)
    ).toEqual([
      { value: '1', text: 'One' },
      { value: '2', text: 'Two' },
    ]);
  });

  it('prefers current selection over options', () => {
    expect(
      extractVariableValues({
        current: { value: 'eu', text: 'EU' },
        options: [{ value: 'us', text: 'US', selected: true }],
      } as any)
    ).toEqual([{ value: 'eu', text: 'EU' }]);
  });

  it('falls back to selected options, then to all options', () => {
    expect(
      extractVariableValues({
        options: [
          { value: 'eu', text: 'EU', selected: true },
          { value: 'us', text: 'US', selected: false },
        ],
      } as any)
    ).toEqual([{ value: 'eu', text: 'EU' }]);

    expect(
      extractVariableValues({
        options: [{ value: 'eu', text: 'EU' }, { value: 'us', text: 'US' }],
      } as any)
    ).toEqual([
      { value: 'eu', text: 'EU' },
      { value: 'us', text: 'US' },
    ]);
  });
});
