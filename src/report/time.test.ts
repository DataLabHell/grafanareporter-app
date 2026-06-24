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

import { convertTimeValue, resolveTimeRange } from './time';

describe('convertTimeValue', () => {
  it('passes through numeric epochs', () => {
    expect(convertTimeValue(1700000000000 as any, false)).toBe(1700000000000);
  });

  it('parses numeric strings as epochs', () => {
    expect(convertTimeValue('1700000000000', false)).toBe(1700000000000);
  });

  it('resolves relative expressions via dateMath', () => {
    const now = convertTimeValue('now', true);
    expect(typeof now).toBe('number');
    expect(Number.isNaN(now)).toBe(false);
  });

  it('yields NaN (an invalid moment) for an unparseable expression', () => {
    expect(Number.isNaN(convertTimeValue('not-a-time', false) as number)).toBe(true);
  });

  it('returns undefined for a nullish value with no valueOf', () => {
    expect(convertTimeValue(null as any, false)).toBeUndefined();
  });
});

describe('resolveTimeRange', () => {
  it('returns undefined when no range is provided', () => {
    expect(resolveTimeRange(undefined)).toBeUndefined();
  });

  it('resolves both ends of a numeric range', () => {
    expect(resolveTimeRange({ from: 1000, to: 2000 } as any)).toEqual({ from: 1000, to: 2000 });
  });

  it('returns undefined when an end resolves to undefined', () => {
    expect(resolveTimeRange({ from: null as any, to: 'now' })).toBeUndefined();
  });
});
