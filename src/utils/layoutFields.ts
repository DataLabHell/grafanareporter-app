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

import { LAYOUT_NUMERIC_CONSTRAINTS, LayoutNumericField } from './layoutValidation';

export const LAYOUT_FIELD_LABELS = {
  sections: {
    defaultLayout: 'Default Report Layout',
    headerFooter: 'Header & Footer',
    panelSettings: 'Panels Settings',
    logo: 'Logo Settings',
    pageNumber: 'Page Numbers',
    customElements: 'Custom Elements',
  },
  orientation: {
    label: 'Orientation',
    description: 'Choose portrait or landscape for the PDF pages.',
  },
  reportTheme: {
    label: 'Report Theme',
    description: 'Controls the rendering theme for captured panels.',
  },
  panelsPerPage: {
    label: LAYOUT_NUMERIC_CONSTRAINTS.panelsPerPage.label,
    description: LAYOUT_NUMERIC_CONSTRAINTS.panelsPerPage.description,
  },
  panelsSpacing: {
    label: `${LAYOUT_NUMERIC_CONSTRAINTS.panelsSpacing.label} (pt)`,
    description: LAYOUT_NUMERIC_CONSTRAINTS.panelsSpacing.description,
  },
  pageMargin: { label: `${LAYOUT_NUMERIC_CONSTRAINTS.pageMargin.label} (pt)` },
  panelsWidth: { label: `${LAYOUT_NUMERIC_CONSTRAINTS.panelsWidth.label} (px)` },
  panelsHeight: { label: `${LAYOUT_NUMERIC_CONSTRAINTS.panelsHeight.label} (px)` },
  logoToggle: { label: 'Display logo', description: 'Toggle logo on or off in the PDF.' },
  logo: { label: 'Logo', description: 'Paste an image URL or upload a file to display in the PDF.' },
  logoPlacement: { label: 'Logo placement', description: 'Choose header or footer for the logo.' },
  logoWidth: { label: `${LAYOUT_NUMERIC_CONSTRAINTS.logoWidth.label} (pt)` },
  logoHeight: { label: `${LAYOUT_NUMERIC_CONSTRAINTS.logoHeight.label} (pt)` },
  headerLineHeight: {
    label: `${LAYOUT_NUMERIC_CONSTRAINTS.headerLineHeight.label} (pt)`,
    description: 'Text height for header content.',
  },
  headerPadding: {
    label: `${LAYOUT_NUMERIC_CONSTRAINTS.headerPadding.label} (pt)`,
    description: 'Spacing between header text and the page edge.',
  },
  footerPadding: {
    label: `${LAYOUT_NUMERIC_CONSTRAINTS.footerPadding.label} (pt)`,
    description: 'Spacing between footer text and the page edge.',
  },
  footerLineHeight: {
    label: `${LAYOUT_NUMERIC_CONSTRAINTS.footerLineHeight.label} (pt)`,
    description: 'Text height for footer content.',
  },
  panelTitles: {
    label: 'Display panel titles',
    description: 'Toggle panel title labels in the PDF.',
  },
  panelsTitleFontSize: { label: `${LAYOUT_NUMERIC_CONSTRAINTS.panelsTitleFontSize.label} (pt)` },
  panelsTitleFontFamily: { label: 'Panel title font family', description: 'CSS font-family for panel titles.' },
  panelsTitleFontColor: { label: 'Panel title font color', description: 'Text color for panel titles (e.g. #000000).' },
  pageNumbers: {
    label: 'Display page numbers',
    description: 'Render "Page X of Y".',
  },
  pageNumberPlacement: { label: 'Page number placement', description: 'Choose header or footer for page numbers.' },
  pageNumberFontSize: { label: `${LAYOUT_NUMERIC_CONSTRAINTS.pageNumberFontSize.label} (pt)` },
  pageNumberFontFamily: { label: 'Page number font family', description: 'CSS font-family for page numbers.' },
  pageNumberFontColor: { label: 'Page number font color', description: 'Text color for page numbers (e.g. #000000).' },
  pageNumberLanguage: { label: 'Page number language', description: 'Locale used for page labels (e.g. en, de).' },
  customTextContent: { label: 'Custom text', description: 'Content to render in the PDF.' },
  customTextPlacement: { label: 'Placement', description: 'Choose header or footer for the custom text.' },
  customTextAlignment: { label: 'Alignment', description: 'Horizontal alignment for the custom text.' },
  customTextFontFamily: { label: 'Font family', description: 'CSS font-family for custom text.' },
  customTextFontSize: { label: 'Font size (pt)', description: 'Text size for custom text.' },
  customTextFontColor: { label: 'Font color', description: 'Text color for custom text (e.g. #000000).' },
};

export const LAYOUT_NUMERIC_FIELD_LABELS: Record<LayoutNumericField, { label: string; description?: string }> = {
  panelsPerPage: LAYOUT_FIELD_LABELS.panelsPerPage,
  panelsSpacing: LAYOUT_FIELD_LABELS.panelsSpacing,
  panelsTitleFontSize: LAYOUT_FIELD_LABELS.panelsTitleFontSize,
  panelsWidth: LAYOUT_FIELD_LABELS.panelsWidth,
  panelsHeight: LAYOUT_FIELD_LABELS.panelsHeight,
  pageMargin: LAYOUT_FIELD_LABELS.pageMargin,
  logoWidth: LAYOUT_FIELD_LABELS.logoWidth,
  logoHeight: LAYOUT_FIELD_LABELS.logoHeight,
  headerLineHeight: LAYOUT_FIELD_LABELS.headerLineHeight,
  headerPadding: LAYOUT_FIELD_LABELS.headerPadding,
  footerPadding: LAYOUT_FIELD_LABELS.footerPadding,
  footerLineHeight: LAYOUT_FIELD_LABELS.footerLineHeight,
  pageNumberFontSize: LAYOUT_FIELD_LABELS.pageNumberFontSize,
};
