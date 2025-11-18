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

export interface LayoutSettings {
  orientation?: ReportOrientation;
  panelsPerPage?: number;
  panelSpacing?: number;
  showPanelTitles?: boolean;
  showPageNumbers?: boolean;
  logoUrl?: string;
  logoEnabled?: boolean;
  logoPlacement?: BrandingPlacement;
  logoAlignment?: BrandingAlignment;
  pageNumberPlacement?: BrandingPlacement;
  pageNumberAlignment?: BrandingAlignment;
}

export interface ReporterPluginSettings {
  themePreference?: ReportTheme;
  layout?: LayoutSettings;
}

export const DEFAULT_LAYOUT_SETTINGS: Required<LayoutSettings> = {
  panelsPerPage: 2,
  panelSpacing: 16,
  orientation: 'portrait',
  logoUrl: `/public/plugins/${pluginJson.id}/img/dlh-logo.svg`,
  logoEnabled: true,
  logoPlacement: 'footer',
  logoAlignment: 'left',
  showPanelTitles: true,
  showPageNumbers: true,
  pageNumberPlacement: 'footer',
  pageNumberAlignment: 'right',
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
});
