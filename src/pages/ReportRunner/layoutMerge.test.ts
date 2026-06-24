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

import { DEFAULT_LAYOUT_SETTINGS } from '../../types/reporting';
import { mergeResolvedLayouts } from './layoutMerge';

describe('mergeResolvedLayouts', () => {
  it('returns the base unchanged when no override is given', () => {
    expect(mergeResolvedLayouts(DEFAULT_LAYOUT_SETTINGS)).toBe(DEFAULT_LAYOUT_SETTINGS);
  });

  it('deep-merges nested sections while preserving untouched base fields', () => {
    const merged = mergeResolvedLayouts(DEFAULT_LAYOUT_SETTINGS, {
      panels: { perPage: 6 },
      logo: { placement: 'header' },
    });
    expect(merged.panels.perPage).toBe(6);
    // base spacing/title survive the partial panels override
    expect(merged.panels.spacing).toBe(DEFAULT_LAYOUT_SETTINGS.panels.spacing);
    expect(merged.panels.title.fontFamily).toBe(DEFAULT_LAYOUT_SETTINGS.panels.title.fontFamily);
    // base logo url survives a partial logo override
    expect(merged.logo.url).toBe(DEFAULT_LAYOUT_SETTINGS.logo.url);
    expect(merged.logo.placement).toBe('header');
  });

  it('preserves header/footer merging (regression for the dropped-header bug)', () => {
    const merged = mergeResolvedLayouts(DEFAULT_LAYOUT_SETTINGS, {
      header: { padding: 20 },
    });
    expect(merged.header.padding).toBe(20);
    // the other header field and the whole footer must survive
    expect(merged.header.lineHeight).toBe(DEFAULT_LAYOUT_SETTINGS.header.lineHeight);
    expect(merged.footer).toEqual(DEFAULT_LAYOUT_SETTINGS.footer);
  });

  it('honors an explicit panel-title enabled=false override', () => {
    const merged = mergeResolvedLayouts(DEFAULT_LAYOUT_SETTINGS, {
      panels: { title: { enabled: false } },
    });
    expect(merged.panels.title.enabled).toBe(false);
  });
});
