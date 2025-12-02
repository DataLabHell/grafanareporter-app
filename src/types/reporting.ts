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

export type BrandingPlacement = 'header' | 'footer';
export type BrandingAlignment = 'left' | 'center' | 'right';

export type BrandingItemType = 'logo' | 'pageNumber' | 'text';

export interface BrandingItemBase {
  id: string;
  type: BrandingItemType;
  placement: BrandingPlacement;
  alignment: BrandingAlignment;
}

export interface BrandingLogoItem extends BrandingItemBase {
  type: 'logo';
  logoUrl: string;
  maxWidth?: number;
  maxHeight?: number;
}

export interface BrandingPageNumberItem extends BrandingItemBase {
  type: 'pageNumber';
  label?: string;
}

export interface BrandingTextItem extends BrandingItemBase {
  type: 'text';
  text: string;
  fontSize?: number;
}

export type BrandingItem = BrandingLogoItem | BrandingPageNumberItem | BrandingTextItem;

export interface VariableValue {
  value: string;
  text?: string;
}

export type VariableValueMap = Record<string, VariableValue[]>;

export interface LayoutSettings {
  orientation?: ReportOrientation;
  panelsPerPage?: number;
  panelSpacing?: number;
  showPanelTitles?: boolean;
  panelTitleFontSize?: number;
  showPageNumbers?: boolean;
  logoUrl?: string;
  logoEnabled?: boolean;
  logoPlacement?: BrandingPlacement;
  logoAlignment?: BrandingAlignment;
  pageNumberPlacement?: BrandingPlacement;
  pageNumberAlignment?: BrandingAlignment;
  renderWidth?: number;
  renderHeight?: number;
  pageMargin?: number;
  brandingLogoMaxWidth?: number;
  brandingLogoMaxHeight?: number;
  brandingTextLineHeight?: number;
  brandingSectionPadding?: number;
}

export interface ReporterPluginSettings {
  themePreference?: ReportTheme;
  layout?: LayoutSettings;
}

export const DEFAULT_LAYOUT_SETTINGS: Required<LayoutSettings> = {
  brandingLogoMaxHeight: 36,
  brandingLogoMaxWidth: 120,
  brandingSectionPadding: 6,
  brandingTextLineHeight: 12,
  logoAlignment: 'left',
  logoEnabled: true,
  logoPlacement: 'footer',
  logoUrl: `/public/plugins/${pluginJson.id}/img/dlh-logo.svg`,
  orientation: 'portrait',
  pageMargin: 32,
  pageNumberAlignment: 'right',
  pageNumberPlacement: 'footer',
  panelSpacing: 16,
  panelsPerPage: 2,
  panelTitleFontSize: 14,
  renderHeight: 900,
  renderWidth: 1600,
  showPageNumbers: true,
  showPanelTitles: true,
};

export const resolveLayoutSettings = (layout?: LayoutSettings): Required<LayoutSettings> => ({
  orientation: layout?.orientation ?? DEFAULT_LAYOUT_SETTINGS.orientation,
  panelsPerPage:
    layout?.panelsPerPage && layout.panelsPerPage > 0 ? layout.panelsPerPage : DEFAULT_LAYOUT_SETTINGS.panelsPerPage,
  panelSpacing:
    layout?.panelSpacing !== undefined && layout.panelSpacing >= 0
      ? layout.panelSpacing
      : DEFAULT_LAYOUT_SETTINGS.panelSpacing,
  showPanelTitles: layout?.showPanelTitles ?? DEFAULT_LAYOUT_SETTINGS.showPanelTitles,
  panelTitleFontSize:
    typeof layout?.panelTitleFontSize === 'number' && layout.panelTitleFontSize > 0
      ? layout.panelTitleFontSize
      : DEFAULT_LAYOUT_SETTINGS.panelTitleFontSize,
  showPageNumbers: layout?.showPageNumbers ?? DEFAULT_LAYOUT_SETTINGS.showPageNumbers,
  logoUrl: layout?.logoUrl?.trim() ?? DEFAULT_LAYOUT_SETTINGS.logoUrl,
  logoEnabled:
    layout?.logoEnabled !== undefined
      ? layout.logoEnabled
      : layout?.logoUrl?.trim()
      ? true
      : DEFAULT_LAYOUT_SETTINGS.logoEnabled,
  logoPlacement: layout?.logoPlacement ?? DEFAULT_LAYOUT_SETTINGS.logoPlacement,
  logoAlignment: layout?.logoAlignment ?? DEFAULT_LAYOUT_SETTINGS.logoAlignment,
  pageNumberPlacement: layout?.pageNumberPlacement ?? DEFAULT_LAYOUT_SETTINGS.pageNumberPlacement,
  pageNumberAlignment: layout?.pageNumberAlignment ?? DEFAULT_LAYOUT_SETTINGS.pageNumberAlignment,
  renderWidth:
    typeof layout?.renderWidth === 'number' && layout.renderWidth > 0 ? layout.renderWidth : DEFAULT_LAYOUT_SETTINGS.renderWidth,
  renderHeight:
    typeof layout?.renderHeight === 'number' && layout.renderHeight > 0
      ? layout.renderHeight
      : DEFAULT_LAYOUT_SETTINGS.renderHeight,
  pageMargin:
    typeof layout?.pageMargin === 'number' && layout.pageMargin >= 0 ? layout.pageMargin : DEFAULT_LAYOUT_SETTINGS.pageMargin,
  brandingLogoMaxWidth:
    typeof layout?.brandingLogoMaxWidth === 'number' && layout.brandingLogoMaxWidth > 0
      ? layout.brandingLogoMaxWidth
      : DEFAULT_LAYOUT_SETTINGS.brandingLogoMaxWidth,
  brandingLogoMaxHeight:
    typeof layout?.brandingLogoMaxHeight === 'number' && layout.brandingLogoMaxHeight > 0
      ? layout.brandingLogoMaxHeight
      : DEFAULT_LAYOUT_SETTINGS.brandingLogoMaxHeight,
  brandingTextLineHeight:
    typeof layout?.brandingTextLineHeight === 'number' && layout.brandingTextLineHeight > 0
      ? layout.brandingTextLineHeight
      : DEFAULT_LAYOUT_SETTINGS.brandingTextLineHeight,
  brandingSectionPadding:
    typeof layout?.brandingSectionPadding === 'number' && layout.brandingSectionPadding >= 0
      ? layout.brandingSectionPadding
      : DEFAULT_LAYOUT_SETTINGS.brandingSectionPadding,
});
