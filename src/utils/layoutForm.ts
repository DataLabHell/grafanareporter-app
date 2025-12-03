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

import { LayoutSettings } from '../types/reporting';
import { LayoutNumericField } from './layoutValidation';

const mergePanels = (base?: LayoutSettings['panels'], patch?: LayoutSettings['panels']) => ({
  ...(base || {}),
  ...(patch || {}),
  title: {
    ...(base?.title || {}),
    ...(patch?.title || {}),
  },
});

export const mergeLayoutPatch = <T extends LayoutSettings>(base: T, patch: Partial<LayoutSettings>): T =>
  ({
    ...base,
    ...patch,
    panels: mergePanels(base.panels, patch.panels),
    logo: { ...(base.logo || {}), ...(patch.logo || {}) },
    pageNumber: { ...(base.pageNumber || {}), ...(patch.pageNumber || {}) },
    header: { ...(base.header || {}), ...(patch.header || {}) },
    footer: { ...(base.footer || {}), ...(patch.footer || {}) },
  }) as T;

export const numericFieldToPatch = (field: LayoutNumericField, value: number): Partial<LayoutSettings> => {
  switch (field) {
    case 'panelsPerPage':
      return { panels: { perPage: value } };
    case 'panelsSpacing':
      return { panels: { spacing: value } };
    case 'panelsTitleFontSize':
      return { panels: { title: { fontSize: value } } };
    case 'panelsWidth':
      return { panels: { width: value } };
    case 'panelsHeight':
      return { panels: { height: value } };
    case 'pageMargin':
      return { pageMargin: value };
    case 'logoWidth':
      return { logo: { width: value } };
    case 'logoHeight':
      return { logo: { height: value } };
    case 'headerLineHeight':
      return { header: { lineHeight: value } };
    case 'headerPadding':
      return { header: { padding: value } };
    case 'footerPadding':
      return { footer: { padding: value } };
    case 'footerLineHeight':
      return { footer: { lineHeight: value } };
    case 'pageNumberFontSize':
      return { pageNumber: { fontSize: value } };
    default:
      return {};
  }
};

export const deriveNumericValues = (
  layout: LayoutSettings
): Partial<Record<LayoutNumericField, string | number>> => ({
  panelsPerPage: layout.panels?.perPage,
  panelsSpacing: layout.panels?.spacing,
  panelsTitleFontSize: layout.panels?.title?.fontSize,
  panelsWidth: layout.panels?.width,
  panelsHeight: layout.panels?.height,
  pageMargin: layout.pageMargin,
  logoWidth: layout.logo?.width,
  logoHeight: layout.logo?.height,
  headerLineHeight: layout.header?.lineHeight,
  headerPadding: layout.header?.padding,
  footerPadding: layout.footer?.padding,
  footerLineHeight: layout.footer?.lineHeight,
  pageNumberFontSize: layout.pageNumber?.fontSize,
});
