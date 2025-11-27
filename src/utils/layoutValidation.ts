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

export type LayoutNumericField =
  | 'panelsPerPage'
  | 'panelSpacing'
  | 'panelTitleFontSize'
  | 'renderWidth'
  | 'renderHeight'
  | 'pageMargin'
  | 'brandingLogoMaxWidth'
  | 'brandingLogoMaxHeight'
  | 'brandingTextLineHeight'
  | 'brandingSectionPadding';

export type LayoutDraft = Record<LayoutNumericField, string>;
export type LayoutDraftErrors = Partial<Record<LayoutNumericField, string>>;

const CONSTRAINTS: Record<LayoutNumericField, { label: string; min: number }> = {
  panelsPerPage: { label: 'Panels per page', min: 1 },
  panelSpacing: { label: 'Panel spacing', min: 0 },
  panelTitleFontSize: { label: 'Panel title font size', min: 1 },
  renderWidth: { label: 'Panel render width', min: 100 },
  renderHeight: { label: 'Panel render height', min: 100 },
  pageMargin: { label: 'Page margin', min: 0 },
  brandingLogoMaxWidth: { label: 'Logo max width', min: 1 },
  brandingLogoMaxHeight: { label: 'Logo max height', min: 1 },
  brandingTextLineHeight: { label: 'Text height', min: 1 },
  brandingSectionPadding: { label: 'Branding padding', min: 0 },
};

export const LAYOUT_NUMERIC_CONSTRAINTS: Readonly<typeof CONSTRAINTS> = CONSTRAINTS;

export const createLayoutDraft = (layout: Required<LayoutSettings>): LayoutDraft => ({
  panelsPerPage: String(layout.panelsPerPage),
  panelSpacing: String(layout.panelSpacing),
  panelTitleFontSize: String(layout.panelTitleFontSize),
  renderWidth: String(layout.renderWidth),
  renderHeight: String(layout.renderHeight),
  pageMargin: String(layout.pageMargin),
  brandingLogoMaxWidth: String(layout.brandingLogoMaxWidth),
  brandingLogoMaxHeight: String(layout.brandingLogoMaxHeight),
  brandingTextLineHeight: String(layout.brandingTextLineHeight),
  brandingSectionPadding: String(layout.brandingSectionPadding),
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
  base: Required<LayoutSettings>,
  values?: Record<LayoutNumericField, number>
): Required<LayoutSettings> => {
  if (!values) {
    return base;
  }

  return {
    ...base,
    ...values,
  };
};

export const patchDraft = (draft: LayoutDraft, patch?: Partial<Record<LayoutNumericField, string>>) =>
  patch ? { ...draft, ...patch } : draft;
