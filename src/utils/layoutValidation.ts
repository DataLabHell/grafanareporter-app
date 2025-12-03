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

import { ResolvedLayoutSettings } from '../types/reporting';

export type LayoutNumericField =
  | 'panelsPerPage'
  | 'panelsSpacing'
  | 'panelsTitleFontSize'
  | 'panelsWidth'
  | 'panelsHeight'
  | 'pageMargin'
  | 'logoWidth'
  | 'logoHeight'
  | 'headerLineHeight'
  | 'headerPadding'
  | 'footerPadding'
  | 'footerLineHeight'
  | 'pageNumberFontSize';

export type LayoutDraft = Record<LayoutNumericField, string>;
export type LayoutDraftErrors = Partial<Record<LayoutNumericField, string>>;

const CONSTRAINTS: Record<LayoutNumericField, { label: string; min: number; description?: string }> = {
  panelsPerPage: {
    label: 'Panels per page',
    min: 1,
    description: 'Controls how many panels are rendered on each PDF page.',
  },
  panelsSpacing: {
    label: 'Panels spacing',
    min: 0,
    description: 'Vertical space between panels on the same page.',
  },
  panelsTitleFontSize: { label: 'Panels title font size', min: 1 },
  panelsWidth: { label: 'Panels render width', min: 100 },
  panelsHeight: { label: 'Panels render height', min: 100 },
  pageMargin: { label: 'Page margin', min: 0 },
  logoWidth: { label: 'Logo width', min: 1 },
  logoHeight: { label: 'Logo height', min: 1 },
  headerLineHeight: { label: 'Header text height', min: 1 },
  headerPadding: { label: 'Header padding', min: 0 },
  footerPadding: { label: 'Footer padding', min: 0 },
  footerLineHeight: { label: 'Footer text height', min: 1 },
  pageNumberFontSize: { label: 'Page number font size', min: 1 },
};

export const LAYOUT_NUMERIC_CONSTRAINTS: Readonly<typeof CONSTRAINTS> = CONSTRAINTS;

export const createLayoutDraft = (layout: ResolvedLayoutSettings): LayoutDraft => ({
  panelsPerPage: String(layout.panels.perPage),
  panelsSpacing: String(layout.panels.spacing),
  panelsTitleFontSize: String(layout.panels.title.fontSize),
  pageNumberFontSize: String(layout.pageNumber.fontSize),
  panelsWidth: String(layout.panels.width),
  panelsHeight: String(layout.panels.height),
  pageMargin: String(layout.pageMargin),
  logoWidth: String(layout.logo.width),
  logoHeight: String(layout.logo.height),
  headerLineHeight: String(layout.header.lineHeight),
  headerPadding: String(layout.header.padding),
  footerPadding: String(layout.footer.padding),
  footerLineHeight: String(layout.footer.lineHeight),
});

const parseNumberInput = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }
  const numeric = Number(trimmed);
  return Number.isFinite(numeric) ? numeric : NaN;
};

export const validateLayoutDraft = (
  draft: LayoutDraft
): { values?: Record<LayoutNumericField, number>; errors?: LayoutDraftErrors } => {
  // We validate numeric inputs in a flat shape, then reconstruct nested layout parts downstream.
  const values = {} as Record<LayoutNumericField, number>;
  const errors: LayoutDraftErrors = {};

  (Object.keys(CONSTRAINTS) as LayoutNumericField[]).forEach((key) => {
    const constraint = CONSTRAINTS[key];
    const raw = draft[key] ?? '';
    const parsed = parseNumberInput(raw);
    if (parsed === undefined || Number.isNaN(parsed)) {
      errors[key] = `${constraint.label} must be a number`;
      return;
    }
    if (parsed < constraint.min) {
      errors[key] = `${constraint.label} must be at least ${constraint.min}`;
      return;
    }
    values[key] = parsed;
  });

  return {
    values: Object.keys(errors).length ? undefined : values,
    errors: Object.keys(errors).length ? errors : undefined,
  };
};

export const mergeDraftValues = (
  base: ResolvedLayoutSettings,
  values?: Record<LayoutNumericField, number>
): ResolvedLayoutSettings => {
  if (!values) {
    return base;
  }

  return {
    ...base,
    panels: {
      ...base.panels,
      perPage: values.panelsPerPage ?? base.panels.perPage,
      spacing: values.panelsSpacing ?? base.panels.spacing,
      title: {
        ...base.panels.title,
        fontSize: values.panelsTitleFontSize ?? base.panels.title.fontSize,
      },
      width: values.panelsWidth ?? base.panels.width,
      height: values.panelsHeight ?? base.panels.height,
    },
    logo: {
      ...base.logo,
      width: values.logoWidth ?? base.logo.width,
      height: values.logoHeight ?? base.logo.height,
    },
    pageNumber: {
      ...base.pageNumber,
      fontSize: values.pageNumberFontSize ?? base.pageNumber.fontSize,
    },
    pageMargin: values.pageMargin ?? base.pageMargin,
    header: {
      ...base.header,
      lineHeight: values.headerLineHeight ?? base.header.lineHeight,
      padding: values.headerPadding ?? base.header.padding,
    },
    footer: {
      ...base.footer,
      padding: values.footerPadding ?? base.footer.padding,
      lineHeight: values.footerLineHeight ?? base.footer.lineHeight,
    },
  };
};

export const patchDraft = (draft: LayoutDraft, patch?: Partial<Record<LayoutNumericField, string>>) =>
  patch ? { ...draft, ...patch } : draft;
