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

import { LogoLibraryItem } from '../../types/reporting';
import { resolveLogoSource } from './logo';

const library: LogoLibraryItem[] = [
  { id: 'abc', name: 'Brand', dataUrl: 'data:image/png;base64,BRAND' },
  { id: 'def', name: 'Alt', dataUrl: 'data:image/png;base64,ALT' },
];

describe('resolveLogoSource', () => {
  it('resolves a library logo selected by id to its data url', () => {
    expect(resolveLogoSource({ id: 'def' }, library)).toBe('data:image/png;base64,ALT');
  });

  it('falls back to the direct url when the id is not found', () => {
    expect(resolveLogoSource({ id: 'missing', url: '/public/logo.svg' }, library)).toBe('/public/logo.svg');
  });

  it('uses the direct url when no id is set', () => {
    expect(resolveLogoSource({ url: '/public/logo.svg' }, library)).toBe('/public/logo.svg');
  });

  it('returns undefined when neither id resolves nor a url is present', () => {
    expect(resolveLogoSource({ id: 'missing' }, library)).toBeUndefined();
    expect(resolveLogoSource({})).toBeUndefined();
  });
});
