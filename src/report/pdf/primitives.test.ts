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

import { determineGridColumns, fitRectangle, parseHexColor } from './primitives';

describe('parseHexColor', () => {
  it('parses 6-digit hex with and without leading #', () => {
    expect(parseHexColor('#ff8800')).toEqual({ r: 255, g: 136, b: 0 });
    expect(parseHexColor('ff8800')).toEqual({ r: 255, g: 136, b: 0 });
  });

  it('expands 3-digit shorthand', () => {
    expect(parseHexColor('#f80')).toEqual({ r: 255, g: 136, b: 0 });
  });

  it('returns null for missing or malformed values', () => {
    expect(parseHexColor(undefined)).toBeNull();
    expect(parseHexColor('#12')).toBeNull();
    expect(parseHexColor('#zzzzzz')).toBeNull();
  });
});

describe('fitRectangle', () => {
  it('scales by width when the source is wider than tall', () => {
    expect(fitRectangle(100, 100, 200, 100)).toEqual({ width: 100, height: 50 });
  });

  it('clamps to the max height when needed', () => {
    expect(fitRectangle(100, 40, 200, 100)).toEqual({ width: 80, height: 40 });
  });

  it('returns a zero rectangle for non-positive inputs', () => {
    expect(fitRectangle(0, 100, 200, 100)).toEqual({ width: 0, height: 0 });
    expect(fitRectangle(100, 100, 0, 100)).toEqual({ width: 0, height: 0 });
  });
});

describe('determineGridColumns', () => {
  it('uses one column below 4 slots and two columns at or above', () => {
    expect(determineGridColumns(1)).toBe(1);
    expect(determineGridColumns(3)).toBe(1);
    expect(determineGridColumns(4)).toBe(2);
    expect(determineGridColumns(8)).toBe(2);
  });
});
