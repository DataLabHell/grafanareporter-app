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

import { LogoLibraryItem } from '../types/reporting';

// Logos are stored base64-encoded in plugin jsonData (Grafana's DB) and loaded with every settings
// fetch, so keep them small. Reject anything over this decoded size.
export const MAX_LOGO_BYTES = 256 * 1024;

export const isImageMimeType = (type?: string): boolean => typeof type === 'string' && type.startsWith('image/');

/** Approximate decoded byte size of a base64 data URL payload. */
export const dataUrlByteSize = (dataUrl: string): number => {
  const comma = dataUrl.indexOf(',');
  const payload = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
  const length = payload.length;
  if (!length) {
    return 0;
  }
  const padding = payload.endsWith('==') ? 2 : payload.endsWith('=') ? 1 : 0;
  return Math.floor((length * 3) / 4) - padding;
};

export const formatBytes = (bytes: number): string => {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

/** Validates a decoded logo data URL; returns an error message, or undefined when acceptable. */
export const validateLogoDataUrl = (dataUrl: string): string | undefined => {
  if (!dataUrl.startsWith('data:image/')) {
    return 'The selected file is not a valid image.';
  }
  const size = dataUrlByteSize(dataUrl);
  if (size > MAX_LOGO_BYTES) {
    return `Image is too large (${formatBytes(size)}). Maximum is ${formatBytes(MAX_LOGO_BYTES)}.`;
  }
  return undefined;
};

/** Derives a friendly logo name from a URL's last path segment (without extension/query). */
export const deriveLogoNameFromUrl = (url: string): string => {
  const path = url.split('?')[0].split('#')[0];
  const last = path.substring(path.lastIndexOf('/') + 1);
  const name = last.replace(/\.[a-z0-9]+$/i, '').trim();
  return name || 'logo';
};

const slugifyName = (name: string): string =>
  name
    .toLowerCase()
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'logo';

/**
 * Produces a short, URL-safe, unique id for a new library entry. Prefers crypto.randomUUID when
 * available, otherwise derives a slug from the name and disambiguates against existing ids.
 */
export const createLogoId = (name: string, existing: LogoLibraryItem[]): string => {
  const cryptoObj = typeof globalThis !== 'undefined' ? (globalThis.crypto as Crypto | undefined) : undefined;
  if (cryptoObj?.randomUUID) {
    return cryptoObj.randomUUID();
  }
  const base = slugifyName(name);
  const taken = new Set(existing.map((item) => item.id));
  if (!taken.has(base)) {
    return base;
  }
  let suffix = 2;
  while (taken.has(`${base}-${suffix}`)) {
    suffix += 1;
  }
  return `${base}-${suffix}`;
};
