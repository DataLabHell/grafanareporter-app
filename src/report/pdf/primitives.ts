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

export const parseHexColor = (hex: string | undefined): { r: number; g: number; b: number } | null => {
  if (!hex) {
    return null;
  }
  const normalized = hex.replace('#', '').trim();
  const expand =
    normalized.length === 3
      ? normalized
          .split('')
          .map((c) => c + c)
          .join('')
      : normalized;
  if (expand.length !== 6) {
    return null;
  }
  const value = Number.parseInt(expand, 16);
  if (Number.isNaN(value)) {
    return null;
  }
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  };
};

export const fitRectangle = (maxWidth: number, maxHeight: number, originalWidth: number, originalHeight: number) => {
  if (maxWidth <= 0 || maxHeight <= 0 || originalWidth <= 0 || originalHeight <= 0) {
    return { width: 0, height: 0 };
  }

  const aspectRatio = originalWidth / originalHeight;
  let width = maxWidth;
  let height = width / aspectRatio;

  if (height > maxHeight) {
    height = maxHeight;
    width = height * aspectRatio;
  }

  return { width, height };
};

export const determineGridColumns = (slotsPerPage: number) => {
  if (slotsPerPage >= 4) {
    return 2;
  }

  return 1;
};
