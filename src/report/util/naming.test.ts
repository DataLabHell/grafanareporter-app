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

import { formatTimestamp, slugify } from './naming';

describe('slugify', () => {
  it('lowercases and collapses non-alphanumerics into single dashes', () => {
    expect(slugify('My Dashboard: Sales / 2025')).toBe('my-dashboard-sales-2025');
  });

  it('trims leading and trailing dashes', () => {
    expect(slugify('  --Hello-- ')).toBe('hello');
  });

  it('falls back to "dashboard" when nothing usable remains', () => {
    expect(slugify('***')).toBe('dashboard');
    expect(slugify('')).toBe('dashboard');
  });
});

describe('formatTimestamp', () => {
  it('formats a date as YYYYMMDD-HHmmss with zero padding', () => {
    const date = new Date(2025, 0, 5, 9, 3, 7); // local time
    expect(formatTimestamp(date)).toBe('20250105-090307');
  });
});
