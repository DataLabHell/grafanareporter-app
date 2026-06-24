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
  MAX_LOGO_BYTES,
  createLogoId,
  dataUrlByteSize,
  formatBytes,
  isImageMimeType,
  validateLogoDataUrl,
} from './logoLibrary';

describe('isImageMimeType', () => {
  it('accepts image/* and rejects others', () => {
    expect(isImageMimeType('image/png')).toBe(true);
    expect(isImageMimeType('image/svg+xml')).toBe(true);
    expect(isImageMimeType('application/pdf')).toBe(false);
    expect(isImageMimeType(undefined)).toBe(false);
  });
});

describe('dataUrlByteSize', () => {
  it('estimates decoded byte size accounting for base64 padding', () => {
    expect(dataUrlByteSize('data:image/png;base64,AAAA')).toBe(3);
    expect(dataUrlByteSize('data:image/png;base64,AAA=')).toBe(2);
    expect(dataUrlByteSize('data:image/png;base64,AA==')).toBe(1);
    expect(dataUrlByteSize('')).toBe(0);
  });
});

describe('formatBytes', () => {
  it('formats B / KB / MB', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(2048)).toBe('2.0 KB');
    expect(formatBytes(3 * 1024 * 1024)).toBe('3.0 MB');
  });
});

describe('validateLogoDataUrl', () => {
  it('accepts a small image data url', () => {
    expect(validateLogoDataUrl('data:image/png;base64,AAAA')).toBeUndefined();
  });

  it('rejects non-image data urls', () => {
    expect(validateLogoDataUrl('data:text/plain;base64,AAAA')).toMatch(/not a valid image/);
  });

  it('rejects images over the size cap', () => {
    const oversized = `data:image/png;base64,${'A'.repeat(Math.ceil((MAX_LOGO_BYTES + 1024) * (4 / 3)))}`;
    expect(validateLogoDataUrl(oversized)).toMatch(/too large/);
  });
});

describe('createLogoId', () => {
  it('returns a non-empty url-safe id', () => {
    const id = createLogoId('My Logo.png', []);
    expect(id).toBeTruthy();
    expect(id).not.toMatch(/\s/);
  });

  it('falls back to a unique slug when crypto.randomUUID is unavailable', () => {
    const original = globalThis.crypto?.randomUUID;
    // Force the slug fallback path.
    (globalThis.crypto as any).randomUUID = undefined;
    try {
      const existing = [{ id: 'my-logo', name: 'My Logo', dataUrl: 'data:image/png;base64,AA' }];
      const id = createLogoId('My Logo.png', existing);
      expect(id).toBe('my-logo-2');
    } finally {
      (globalThis.crypto as any).randomUUID = original;
    }
  });
});
