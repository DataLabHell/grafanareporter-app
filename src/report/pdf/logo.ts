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
import { blobToDataUrl } from '../util/blob';

export interface LogoAsset {
  dataUrl: string;
  width: number;
  height: number;
}

/**
 * Resolves the image source to render: a library logo selected by `id` (looked up in the logo
 * library) takes precedence; otherwise the direct `url`/data URI is used. Falls back to `url`
 * when the referenced id is not found, so a stale id never silently drops the logo.
 */
export const resolveLogoSource = (
  logo: { id?: string; url?: string },
  logos?: LogoLibraryItem[]
): string | undefined => {
  if (logo.id) {
    const match = logos?.find((item) => item.id === logo.id);
    if (match?.dataUrl) {
      return match.dataUrl;
    }
  }
  return logo.url || undefined;
};

export const loadLogoAsset = async (logoUrl?: string): Promise<LogoAsset | undefined> => {
  if (!logoUrl) {
    return undefined;
  }

  const trimmed = logoUrl.trim();

  if (!trimmed) {
    return undefined;
  }

  try {
    const baseDataUrl = trimmed.startsWith('data:') ? trimmed : await downloadImageAsDataUrl(trimmed);
    const dataUrl = isSvgDataUrl(baseDataUrl) ? await rasterizeSvgDataUrl(baseDataUrl) : baseDataUrl;
    const size = await getImageDimensions(dataUrl);
    return {
      dataUrl,
      width: size.width,
      height: size.height,
    };
  } catch (error) {
    console.warn('Failed to load logo', error);
    return undefined;
  }
};

const downloadImageAsDataUrl = async (url: string) => {
  // Browser CORS rules apply: the logo must be hosted on the same origin (or a CORS-enabled endpoint).
  // There is no way for the plugin to bypass CORS, so ensure Grafana (or a proxy under the same host) serves the asset.
  const response = await fetch(url, { credentials: 'same-origin' });
  if (!response.ok) {
    throw new Error('Failed to download logo image.');
  }
  const blob = await response.blob();
  return blobToDataUrl(blob);
};

const getImageDimensions = (dataUrl: string) =>
  new Promise<{ width: number; height: number }>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = () => reject(new Error('Failed to read image dimensions.'));
    image.src = dataUrl;
  });

const isSvgDataUrl = (value: string) => value.toLowerCase().startsWith('data:image/svg+xml');

const rasterizeSvgDataUrl = (dataUrl: string) =>
  new Promise<string>((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const width = image.naturalWidth || image.width || 100;
      const height = image.naturalHeight || image.height || 100;
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d');
      if (!context) {
        reject(new Error('Failed to create canvas context.'));
        return;
      }
      context.drawImage(image, 0, 0, width, height);
      resolve(canvas.toDataURL('image/png'));
    };
    image.onerror = () => reject(new Error('Failed to rasterize SVG logo.'));
    image.src = dataUrl;
  });
