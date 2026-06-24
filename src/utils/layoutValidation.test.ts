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

import { DEFAULT_LAYOUT_SETTINGS } from '../types/reporting';
import { createLayoutDraft, mergeDraftValues, validateLayoutDraft } from './layoutValidation';

describe('createLayoutDraft', () => {
  it('serializes resolved numeric layout fields to strings', () => {
    const draft = createLayoutDraft(DEFAULT_LAYOUT_SETTINGS);
    expect(draft.panelsPerPage).toBe(String(DEFAULT_LAYOUT_SETTINGS.panels.perPage));
    expect(draft.renderConcurrency).toBe(String(DEFAULT_LAYOUT_SETTINGS.renderConcurrency));
  });
});

describe('validateLayoutDraft', () => {
  it('parses a valid draft into numbers with no errors', () => {
    const result = validateLayoutDraft(createLayoutDraft(DEFAULT_LAYOUT_SETTINGS));
    expect(result.errors).toBeUndefined();
    expect(result.values?.panelsPerPage).toBe(DEFAULT_LAYOUT_SETTINGS.panels.perPage);
  });

  it('reports non-numeric and below-minimum fields', () => {
    const draft = { ...createLayoutDraft(DEFAULT_LAYOUT_SETTINGS), panelsPerPage: 'x', pageMargin: '-5' };
    const result = validateLayoutDraft(draft);
    expect(result.values).toBeUndefined();
    expect(result.errors?.panelsPerPage).toMatch(/must be a number/);
    expect(result.errors?.pageMargin).toMatch(/at least 0/);
  });
});

describe('mergeDraftValues', () => {
  it('writes validated numbers back into the nested layout shape', () => {
    const values = validateLayoutDraft(createLayoutDraft(DEFAULT_LAYOUT_SETTINGS)).values!;
    const merged = mergeDraftValues(DEFAULT_LAYOUT_SETTINGS, { ...values, panelsPerPage: 9, headerPadding: 3 });
    expect(merged.panels.perPage).toBe(9);
    expect(merged.header.padding).toBe(3);
    // untouched fields preserved
    expect(merged.logo.url).toBe(DEFAULT_LAYOUT_SETTINGS.logo.url);
  });

  it('returns the base unchanged when no values are given', () => {
    expect(mergeDraftValues(DEFAULT_LAYOUT_SETTINGS, undefined)).toBe(DEFAULT_LAYOUT_SETTINGS);
  });
});
