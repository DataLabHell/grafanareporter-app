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

import pluginJson from '../plugin.json';

export type ReportTheme = 'light' | 'dark' | 'user';
export type ReportOrientation = 'portrait' | 'landscape';

export type LayoutPlacement = 'header' | 'footer';
export type LayoutAlignment = 'left' | 'center' | 'right';
export type FontStyle = 'normal' | 'bold' | 'italic' | 'bolditalic';

export type BrandingItemType = 'logo' | 'pageNumber' | 'text';

export const orientationOptions = [
  { label: 'Portrait', icon: 'gf-portrait', value: 'portrait' as ReportOrientation },
  { label: 'Landscape', icon: 'gf-landscape', value: 'landscape' as ReportOrientation },
];

// Use icons from the supported Grafana set (see iconography overview).
export const themeOptions = [
  { label: 'Dark', icon: 'circle-mono', value: 'dark' as ReportTheme },
  { label: 'Light', icon: 'circle', value: 'light' as ReportTheme },
];

export const placementOptions = [
  { label: 'Header', value: 'header' as LayoutPlacement },
  { label: 'Footer', value: 'footer' as LayoutPlacement },
];

export const alignmentOptions = [
  { label: 'Left', value: 'left' as LayoutAlignment },
  { label: 'Center', value: 'center' as LayoutAlignment },
  { label: 'Right', value: 'right' as LayoutAlignment },
];

export const fontFamilyOptions = [
  { label: 'Helvetica', value: 'helvetica' },
  { label: 'Times', value: 'times' },
  { label: 'Courier', value: 'courier' },
];

export const DEFAULT_FONT_FAMILY = 'helvetica';
export const fontStyleOptions: Array<{ label: string; value: FontStyle }> = [
  { label: 'Normal', value: 'normal' },
  { label: 'Bold', value: 'bold' },
  { label: 'Italic', value: 'italic' },
  { label: 'Bold Italic', value: 'bolditalic' },
];

export interface VariableValue {
  value: string;
  text?: string;
}

export type VariableValueMap = Record<string, VariableValue[]>;

export interface PanelTitleSettings {
  enabled?: boolean;
  fontFamily?: string;
  fontSize?: number;
  fontColor?: string;
  fontStyle?: FontStyle;
}

export interface PanelsLayoutSettings {
  perPage?: number;
  spacing?: number;
  title?: PanelTitleSettings;
  width?: number;
  height?: number;
}

export interface LogoSettings {
  enabled?: boolean;
  url?: string;
  placement?: LayoutPlacement;
  alignment?: LayoutAlignment;
  width?: number;
  height?: number;
}

export interface PageNumberSettings {
  enabled?: boolean;
  placement?: LayoutPlacement;
  alignment?: LayoutAlignment;
  language?: string;
  fontFamily?: string;
  fontSize?: number;
  fontColor?: string;
  fontStyle?: FontStyle;
}

export interface CustomTextElement {
  type: 'text';
  content: string;
  placement: LayoutPlacement;
  alignment: LayoutAlignment;
  fontFamily?: string;
  fontSize?: number;
  fontColor?: string;
  fontStyle?: FontStyle;
}

export type CustomElement = CustomTextElement;

export interface LayoutSettings {
  reportTheme?: ReportTheme;
  orientation?: ReportOrientation;
  panels?: PanelsLayoutSettings;
  logo?: LogoSettings;
  pageNumber?: PageNumberSettings;
  customElements?: CustomElement[];
  pageMargin?: number;
  renderConcurrency?: number;
  header?: {
    padding?: number;
    lineHeight?: number;
  };
  footer?: {
    padding?: number;
    lineHeight?: number;
  };
}

export type ResolvedLayoutSettings = Required<LayoutSettings> & {
  panels: Required<PanelsLayoutSettings> & { title: Required<PanelTitleSettings> };
  logo: Required<LogoSettings>;
  pageNumber: Required<PageNumberSettings>;
  header: { padding: number; lineHeight: number };
  footer: { padding: number; lineHeight: number };
};

export interface ReporterPluginSettings {
  themePreference?: ReportTheme;
  layout?: LayoutSettings;
}

export const DEFAULT_LAYOUT_SETTINGS: ResolvedLayoutSettings = {
  reportTheme: 'dark',
  orientation: 'portrait',
  renderConcurrency: 2,
  panels: {
    perPage: 2,
    spacing: 16,
    title: {
      enabled: true,
      fontFamily: DEFAULT_FONT_FAMILY,
      fontStyle: 'normal',
      fontSize: 14,
      fontColor: '#000000',
    },
    width: 3200,
    height: 1800,
  },
  logo: {
    enabled: true,
    url: `/public/plugins/${pluginJson.id}/img/dlh-logo.svg`,
    placement: 'footer',
    alignment: 'left',
    width: 120,
    height: 36,
  },
  pageNumber: {
    enabled: true,
    placement: 'footer',
    alignment: 'right',
    language: 'en',
    fontFamily: DEFAULT_FONT_FAMILY,
    fontStyle: 'normal',
    fontSize: 10,
    fontColor: '#000000',
  },
  customElements: [],
  pageMargin: 32,
  header: {
    padding: 6,
    lineHeight: 12,
  },
  footer: {
    padding: 6,
    lineHeight: 12,
  },
};

// Helper function to validate and fallback number values for wrong provisioning or manual config file edits
const fallbackNumber = (value: number | undefined, predicate: (n: number) => boolean, fallback: number) =>
  typeof value === 'number' && predicate(value) ? value : fallback;

export const resolveLayoutSettings = (layout?: LayoutSettings | null): ResolvedLayoutSettings => {
  const panels = layout?.panels;
  const logo = layout?.logo;
  const pageNumber = layout?.pageNumber;
  const header = layout?.header;
  const footer = layout?.footer;

  return {
    reportTheme: layout?.reportTheme ?? DEFAULT_LAYOUT_SETTINGS.reportTheme,
    orientation: layout?.orientation ?? DEFAULT_LAYOUT_SETTINGS.orientation,
    panels: {
      perPage: fallbackNumber(panels?.perPage, (n) => n > 0, DEFAULT_LAYOUT_SETTINGS.panels.perPage),
      spacing: fallbackNumber(panels?.spacing, (n) => n >= 0, DEFAULT_LAYOUT_SETTINGS.panels.spacing),
      title: {
        enabled: panels?.title?.enabled ?? DEFAULT_LAYOUT_SETTINGS.panels.title.enabled,
        fontFamily: panels?.title?.fontFamily ?? DEFAULT_LAYOUT_SETTINGS.panels.title.fontFamily,
        fontStyle: panels?.title?.fontStyle ?? DEFAULT_LAYOUT_SETTINGS.panels.title.fontStyle,
        fontSize: fallbackNumber(panels?.title?.fontSize, (n) => n > 0, DEFAULT_LAYOUT_SETTINGS.panels.title.fontSize),
        fontColor: panels?.title?.fontColor ?? DEFAULT_LAYOUT_SETTINGS.panels.title.fontColor,
      },
      width: fallbackNumber(panels?.width, (n) => n > 0, DEFAULT_LAYOUT_SETTINGS.panels.width),
      height: fallbackNumber(panels?.height, (n) => n > 0, DEFAULT_LAYOUT_SETTINGS.panels.height),
    },
    logo: {
      enabled: logo?.enabled ?? Boolean(logo?.url ?? DEFAULT_LAYOUT_SETTINGS.logo.url),
      url: logo?.url?.trim() || DEFAULT_LAYOUT_SETTINGS.logo.url,
      placement: logo?.placement ?? DEFAULT_LAYOUT_SETTINGS.logo.placement,
      alignment: logo?.alignment ?? DEFAULT_LAYOUT_SETTINGS.logo.alignment,
      width: fallbackNumber(logo?.width, (n) => n > 0, DEFAULT_LAYOUT_SETTINGS.logo.width),
      height: fallbackNumber(logo?.height, (n) => n > 0, DEFAULT_LAYOUT_SETTINGS.logo.height),
    },
    pageNumber: {
      enabled: pageNumber?.enabled ?? DEFAULT_LAYOUT_SETTINGS.pageNumber.enabled,
      placement: pageNumber?.placement ?? DEFAULT_LAYOUT_SETTINGS.pageNumber.placement,
      alignment: pageNumber?.alignment ?? DEFAULT_LAYOUT_SETTINGS.pageNumber.alignment,
      language: pageNumber?.language ?? DEFAULT_LAYOUT_SETTINGS.pageNumber.language,
      fontFamily: pageNumber?.fontFamily ?? DEFAULT_LAYOUT_SETTINGS.pageNumber.fontFamily,
      fontStyle: pageNumber?.fontStyle ?? DEFAULT_LAYOUT_SETTINGS.pageNumber.fontStyle,
      fontSize: fallbackNumber(pageNumber?.fontSize, (n) => n > 0, DEFAULT_LAYOUT_SETTINGS.pageNumber.fontSize),
      fontColor: pageNumber?.fontColor ?? DEFAULT_LAYOUT_SETTINGS.pageNumber.fontColor,
    },
    customElements:
      layout?.customElements?.map((element) =>
        element.type === 'text'
          ? { ...element, fontStyle: element.fontStyle ?? DEFAULT_LAYOUT_SETTINGS.pageNumber.fontStyle }
          : element
      ) ?? DEFAULT_LAYOUT_SETTINGS.customElements,
    pageMargin: fallbackNumber(layout?.pageMargin, (n) => n >= 0, DEFAULT_LAYOUT_SETTINGS.pageMargin),
    renderConcurrency: fallbackNumber(
      layout?.renderConcurrency,
      (n) => n > 0,
      DEFAULT_LAYOUT_SETTINGS.renderConcurrency
    ),
    header: {
      padding: fallbackNumber(header?.padding, (n) => n >= 0, DEFAULT_LAYOUT_SETTINGS.header.padding),
      lineHeight: fallbackNumber(header?.lineHeight, (n) => n > 0, DEFAULT_LAYOUT_SETTINGS.header.lineHeight),
    },
    footer: {
      padding: fallbackNumber(footer?.padding, (n) => n >= 0, DEFAULT_LAYOUT_SETTINGS.footer.padding),
      lineHeight: fallbackNumber(footer?.lineHeight, (n) => n > 0, DEFAULT_LAYOUT_SETTINGS.footer.lineHeight),
    },
  };
};
