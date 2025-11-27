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

import { RawTimeRange } from '@grafana/data';
import { DashboardTemplateVariable } from '../../types/grafana';
import { BrandingAlignment, BrandingPlacement, LayoutSettings, VariableValueMap } from '../../types/reporting';
import { AdvancedSettingsSnapshot } from './types';

export const DEFAULT_TIME_RANGE = {
  from: 'now-6h',
  to: 'now',
} as const;

export const normalizeRawTimeInput = (
  value: RawTimeRange['from'] | undefined,
  fallback: RawTimeRange['from'] | undefined
): string => {
  const convert = (input?: RawTimeRange['from']) => {
    if (typeof input === 'string' && input.trim() !== '') {
      return input;
    }
    if (input && typeof (input as any).toISOString === 'function') {
      return (input as any).toISOString();
    }
    if (typeof input === 'number' && !Number.isNaN(input)) {
      return String(input);
    }
    return undefined;
  };

  return convert(value) ?? convert(fallback) ?? DEFAULT_TIME_RANGE.from;
};

export const coerceRawRange = (range?: RawTimeRange | { from?: string; to?: string }): RawTimeRange => ({
  from: normalizeRawTimeInput(range?.from, DEFAULT_TIME_RANGE.from),
  to: normalizeRawTimeInput(range?.to, DEFAULT_TIME_RANGE.to),
});

export const parseVariablesText = (text: string): VariableValueMap | undefined => {
  const result: VariableValueMap = {};
  text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .forEach((line) => {
      const [name, valuesRaw = ''] = line.split('=');
      const variable = name?.trim();
      if (!variable) {
        return;
      }
      const values = valuesRaw
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean);
      if (values.length) {
        result[variable] = values.map((value) => ({ value, text: value }));
      }
    });

  return Object.keys(result).length ? result : undefined;
};

export const formatVariablesText = (variables?: VariableValueMap) => {
  if (!variables) {
    return '';
  }

  return Object.entries(variables)
    .map(([name, entries]) => `${name}=${entries.map((entry) => entry.text ?? entry.value).join(',')}`)
    .join('\n');
};

export const convertDashboardVariablesToMap = (
  variables?: DashboardTemplateVariable[]
): VariableValueMap | undefined => {
  if (!variables?.length) {
    return undefined;
  }

  const map: VariableValueMap = {};

  variables.forEach((variable) => {
    if (!variable?.name) {
      return;
    }

    const values = normalizeDashboardVariableValues(variable.current?.value, variable.current?.text);
    if (values.length) {
      map[variable.name] = values;
    }
  });

  return Object.keys(map).length ? map : undefined;
};

export const normalizeDashboardVariableValues = (
  value: unknown,
  text?: unknown
): VariableValueMap[keyof VariableValueMap] => {
  const valueArray = Array.isArray(value) ? value : value !== undefined ? [value] : [];
  const textArray = Array.isArray(text) ? text : text !== undefined ? [text] : [];
  const max = Math.max(valueArray.length, textArray.length);
  const normalized: VariableValueMap[keyof VariableValueMap] = [];

  for (let i = 0; i < max; i++) {
    let source = valueArray[i];
    const textCandidate = textArray[i];

    if (source === undefined) {
      source = textCandidate;
    }

    if (source === undefined || source === null || source === '') {
      continue;
    }

    if (typeof source === 'object') {
      const candidate = source as { value?: unknown; text?: unknown };
      if (candidate.value !== undefined && candidate.value !== null && candidate.value !== '') {
        normalized.push({
          value: String(candidate.value),
          text:
            candidate.text !== undefined && candidate.text !== null && candidate.text !== ''
              ? String(candidate.text)
              : textCandidate !== undefined && textCandidate !== null && textCandidate !== ''
              ? String(textCandidate)
              : undefined,
        });
        continue;
      }
      if (candidate.text !== undefined && candidate.text !== null && candidate.text !== '') {
        normalized.push({
          value: String(candidate.text),
          text: String(candidate.text),
        });
        continue;
      }
    }

    normalized.push({
      value: String(source),
      text:
        textCandidate !== undefined && textCandidate !== null && textCandidate !== ''
          ? String(textCandidate)
          : undefined,
    });
  }

  return normalized;
};

export const buildManualVariablesFromParams = (params: URLSearchParams): VariableValueMap | undefined => {
  const manualVariables: VariableValueMap = {};
  params.forEach((value, key) => {
    if (!key.startsWith('var-')) {
      return;
    }
    const variableName = key.slice(4);
    if (!variableName) {
      return;
    }
    const entry = { value, text: value };
    manualVariables[variableName] = manualVariables[variableName] ? [...manualVariables[variableName], entry] : [entry];
  });

  return Object.keys(manualVariables).length ? manualVariables : undefined;
};

export const parseLayoutOverrides = (params: URLSearchParams): LayoutSettings | undefined => {
  const layout: LayoutSettings = {};
  const panelsPerPageParam = params.get('panelsPerPage');
  const panelSpacingParam = params.get('panelSpacing');
  const orientation = params.get('orientation');
  const logo = params.get('logo');
  const pageNumbers = params.get('pageNumbers');
  const panelTitles = params.get('panelTitles');
  const panelTitleFontSizeParam = params.get('panelTitleFontSize');
  const logoPlacement = params.get('logoPlacement');
  const logoAlignment = params.get('logoAlignment');
  const pagePlacement = params.get('pagePlacement');
  const pageAlignment = params.get('pageAlignment');
  const logoUrl = params.get('logoUrl');
  const renderWidthParam = params.get('renderWidth');
  const renderHeightParam = params.get('renderHeight');
  const pageMarginParam = params.get('pageMargin');
  const brandingLogoMaxWidthParam = params.get('brandingLogoMaxWidth');
  const brandingLogoMaxHeightParam = params.get('brandingLogoMaxHeight');
  const brandingTextLineHeightParam = params.get('brandingTextLineHeight');
  const brandingSectionPaddingParam = params.get('brandingSectionPadding');

  if (panelsPerPageParam !== null) {
    const panelsPerPage = Number(panelsPerPageParam);
    if (Number.isFinite(panelsPerPage) && panelsPerPage > 0) {
      layout.panelsPerPage = panelsPerPage;
    }
  }
  if (panelSpacingParam !== null) {
    const panelSpacing = Number(panelSpacingParam);
    if (Number.isFinite(panelSpacing) && panelSpacing >= 0) {
      layout.panelSpacing = panelSpacing;
    }
  }
  if (orientation === 'portrait' || orientation === 'landscape') {
    layout.orientation = orientation;
  }

  if (logo === 'true' || logo === 'false') {
    layout.logoEnabled = logo === 'true';
  }
  if (pageNumbers === 'true' || pageNumbers === 'false') {
    layout.showPageNumbers = pageNumbers === 'true';
  }
  if (panelTitles === 'true' || panelTitles === 'false') {
    layout.showPanelTitles = panelTitles === 'true';
  }
  if (panelTitleFontSizeParam !== null) {
    const value = Number(panelTitleFontSizeParam);
    if (Number.isFinite(value) && value > 0) {
      layout.panelTitleFontSize = value;
    }
  }
  if (logoUrl) {
    layout.logoUrl = logoUrl;
  }
  if (logoPlacement === 'header' || logoPlacement === 'footer') {
    layout.logoPlacement = logoPlacement as BrandingPlacement;
  }
  if (logoAlignment === 'left' || logoAlignment === 'center' || logoAlignment === 'right') {
    layout.logoAlignment = logoAlignment as BrandingAlignment;
  }
  if (pagePlacement === 'header' || pagePlacement === 'footer') {
    layout.pageNumberPlacement = pagePlacement as BrandingPlacement;
  }
  if (pageAlignment === 'left' || pageAlignment === 'center' || pageAlignment === 'right') {
    layout.pageNumberAlignment = pageAlignment as BrandingAlignment;
  }
  if (renderWidthParam !== null) {
    const renderWidth = Number(renderWidthParam);
    if (Number.isFinite(renderWidth) && renderWidth > 0) {
      layout.renderWidth = renderWidth;
    }
  }
  if (renderHeightParam !== null) {
    const renderHeight = Number(renderHeightParam);
    if (Number.isFinite(renderHeight) && renderHeight > 0) {
      layout.renderHeight = renderHeight;
    }
  }
  if (pageMarginParam !== null) {
    const pageMargin = Number(pageMarginParam);
    if (Number.isFinite(pageMargin) && pageMargin >= 0) {
      layout.pageMargin = pageMargin;
    }
  }
  if (brandingLogoMaxWidthParam !== null) {
    const value = Number(brandingLogoMaxWidthParam);
    if (Number.isFinite(value) && value > 0) {
      layout.brandingLogoMaxWidth = value;
    }
  }
  if (brandingLogoMaxHeightParam !== null) {
    const value = Number(brandingLogoMaxHeightParam);
    if (Number.isFinite(value) && value > 0) {
      layout.brandingLogoMaxHeight = value;
    }
  }
  if (brandingTextLineHeightParam !== null) {
    const value = Number(brandingTextLineHeightParam);
    if (Number.isFinite(value) && value > 0) {
      layout.brandingTextLineHeight = value;
    }
  }
  if (brandingSectionPaddingParam !== null) {
    const value = Number(brandingSectionPaddingParam);
    if (Number.isFinite(value) && value >= 0) {
      layout.brandingSectionPadding = value;
    }
  }

  return Object.keys(layout).length ? layout : undefined;
};

export const buildReportParams = (uid: string, settings: AdvancedSettingsSnapshot) => {
  const params = new URLSearchParams();
  params.set('uid', uid);
  const normalizedRange = coerceRawRange(settings.range);
  params.set('from', String(normalizedRange.from));
  params.set('to', String(normalizedRange.to));
  if (settings.timezone && settings.timezone !== 'browser') {
    params.set('tz', settings.timezone);
  }
  if (settings.theme) {
    params.set('theme', settings.theme);
  }
  params.set('orientation', settings.layout.orientation);
  params.set('panelsPerPage', String(settings.layout.panelsPerPage));
  params.set('panelSpacing', String(settings.layout.panelSpacing));
  params.set('logo', settings.layout.logoEnabled ? 'true' : 'false');
  params.set('panelTitles', settings.layout.showPanelTitles ? 'true' : 'false');
  params.set('panelTitleFontSize', String(settings.layout.panelTitleFontSize));
  params.set('pageNumbers', settings.layout.showPageNumbers ? 'true' : 'false');
  params.set('logoPlacement', settings.layout.logoPlacement);
  params.set('logoAlignment', settings.layout.logoAlignment);
  params.set('pagePlacement', settings.layout.pageNumberPlacement);
  params.set('pageAlignment', settings.layout.pageNumberAlignment);
  params.set('renderWidth', String(settings.layout.renderWidth));
  params.set('renderHeight', String(settings.layout.renderHeight));
  params.set('pageMargin', String(settings.layout.pageMargin));
  params.set('brandingLogoMaxWidth', String(settings.layout.brandingLogoMaxWidth));
  params.set('brandingLogoMaxHeight', String(settings.layout.brandingLogoMaxHeight));
  params.set('brandingTextLineHeight', String(settings.layout.brandingTextLineHeight));
  params.set('brandingSectionPadding', String(settings.layout.brandingSectionPadding));
  const vars = parseVariablesText(settings.variablesText);
  if (vars) {
    Object.entries(vars).forEach(([name, values]) => {
      values.forEach((entry) => params.append(`var-${name}`, entry.value));
    });
  }

  return params;
};
