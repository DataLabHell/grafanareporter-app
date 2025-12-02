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
import { LayoutAlignment, LayoutPlacement, LayoutSettings, VariableValueMap } from '../../types/reporting';
import { LayoutNumericField } from '../../utils/layoutValidation';
import { AdvancedSettingsSnapshot } from './types';

export const DEFAULT_TIME_RANGE = {
  from: 'now-6h',
  to: 'now',
} as const;

const PARAMS = {
  orientation: 'orientation',
  reportTheme: 'reportTheme',
  pageMargin: 'pageMargin',
  panelsPerPage: 'panelsPerPage',
  panelsSpacing: 'panelsSpacing',
  panelsTitleEnabled: 'panelsTitleEnabled',
  panelsTitleFontSize: 'panelsTitleFontSize',
  panelsTitleFontFamily: 'panelsTitleFontFamily',
  panelsTitleFontColor: 'panelsTitleFontColor',
  panelsWidth: 'panelsWidth',
  panelsHeight: 'panelsHeight',
  logoEnabled: 'logoEnabled',
  logoPlacement: 'logoPlacement',
  logoAlignment: 'logoAlignment',
  logoWidth: 'logoWidth',
  logoHeight: 'logoHeight',
  pageNumberEnabled: 'pageNumberEnabled',
  pageNumberPlacement: 'pageNumberPlacement',
  pageNumberAlignment: 'pageNumberAlignment',
  pageNumberLanguage: 'pageNumberLanguage',
  pageNumberFontFamily: 'pageNumberFontFamily',
  pageNumberFontSize: 'pageNumberFontSize',
  pageNumberFontColor: 'pageNumberFontColor',
};

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

export interface ParsedLayoutOverrides {
  layout?: LayoutSettings;
  numericOverrides?: Partial<Record<LayoutNumericField, string>>;
}

export const parseLayoutOverrides = (params: URLSearchParams): ParsedLayoutOverrides => {
  const layout: LayoutSettings = {};
  const numericOverrides: Partial<Record<LayoutNumericField, string>> = {};
  const orientation = params.get(PARAMS.orientation);
  const logoEnabled = params.get(PARAMS.logoEnabled);
  const pageNumbers = params.get(PARAMS.pageNumberEnabled);
  const panelTitles = params.get(PARAMS.panelsTitleEnabled);
  const panelTitleFontFamily = params.get(PARAMS.panelsTitleFontFamily);
  const panelTitleFontColor = params.get(PARAMS.panelsTitleFontColor);
  const logoPlacement = params.get(PARAMS.logoPlacement);
  const logoAlignment = params.get(PARAMS.logoAlignment);
  const pagePlacement = params.get(PARAMS.pageNumberPlacement);
  const pageAlignment = params.get(PARAMS.pageNumberAlignment);
  const pageNumberLanguage = params.get(PARAMS.pageNumberLanguage);
  const pageNumberFontFamily = params.get(PARAMS.pageNumberFontFamily);
  const pageNumberFontColor = params.get(PARAMS.pageNumberFontColor);

  const numericPairs: Array<[LayoutNumericField, string | null]> = [
    ['panelsPerPage', params.get(PARAMS.panelsPerPage)],
    ['panelsSpacing', params.get(PARAMS.panelsSpacing)],
    ['panelsTitleFontSize', params.get(PARAMS.panelsTitleFontSize)],
    ['pageNumberFontSize', params.get(PARAMS.pageNumberFontSize)],
    ['panelsWidth', params.get(PARAMS.panelsWidth)],
    ['panelsHeight', params.get(PARAMS.panelsHeight)],
    ['pageMargin', params.get(PARAMS.pageMargin)],
    ['logoWidth', params.get(PARAMS.logoWidth)],
    ['logoHeight', params.get(PARAMS.logoHeight)],
  ];

  numericPairs.forEach(([field, value]) => {
    if (value !== null && value !== undefined) {
      numericOverrides[field] = value;
    }
  });

  if (orientation === 'portrait' || orientation === 'landscape') {
    layout.orientation = orientation;
  }

  if (panelTitles === 'true' || panelTitles === 'false') {
    layout.panels = {
      ...(layout.panels || {}),
      title: { ...(layout.panels?.title || {}), enabled: panelTitles === 'true' },
    };
  }
  if (panelTitleFontFamily) {
    layout.panels = {
      ...(layout.panels || {}),
      title: { ...(layout.panels?.title || {}), fontFamily: panelTitleFontFamily },
    };
  }
  if (panelTitleFontColor) {
    layout.panels = {
      ...(layout.panels || {}),
      title: { ...(layout.panels?.title || {}), fontColor: panelTitleFontColor },
    };
  }

  if (pageNumbers === 'true' || pageNumbers === 'false') {
    layout.pageNumber = { ...(layout.pageNumber || {}), enabled: pageNumbers === 'true' };
  }

  if (pageNumberLanguage) {
    layout.pageNumber = { ...(layout.pageNumber || {}), language: pageNumberLanguage };
  }

  if (pageNumberFontFamily) {
    layout.pageNumber = { ...(layout.pageNumber || {}), fontFamily: pageNumberFontFamily };
  }

  if (pageNumberFontColor) {
    layout.pageNumber = { ...(layout.pageNumber || {}), fontColor: pageNumberFontColor };
  }

  if (logoEnabled === 'true' || logoEnabled === 'false') {
    layout.logo = { ...(layout.logo || {}), enabled: logoEnabled === 'true' };
  }
  if (logoPlacement === 'header' || logoPlacement === 'footer') {
    layout.logo = { ...(layout.logo || {}), placement: logoPlacement as LayoutPlacement };
  }
  if (logoAlignment === 'left' || logoAlignment === 'center' || logoAlignment === 'right') {
    layout.logo = { ...(layout.logo || {}), alignment: logoAlignment as LayoutAlignment };
  }
  if (pagePlacement === 'header' || pagePlacement === 'footer') {
    layout.pageNumber = { ...(layout.pageNumber || {}), placement: pagePlacement as LayoutPlacement };
  }
  if (pageAlignment === 'left' || pageAlignment === 'center' || pageAlignment === 'right') {
    layout.pageNumber = { ...(layout.pageNumber || {}), alignment: pageAlignment as LayoutAlignment };
  }

  return {
    layout: Object.keys(layout).length ? layout : undefined,
    numericOverrides: Object.keys(numericOverrides).length ? numericOverrides : undefined,
  };
};

export const buildReportParams = (
  uid: string,
  settings: AdvancedSettingsSnapshot,
  options?: { includeLogoUrl?: boolean }
) => {
  const params = new URLSearchParams();
  params.set('uid', uid);
  const normalizedRange = coerceRawRange(settings.range);
  params.set('from', String(normalizedRange.from));
  params.set('to', String(normalizedRange.to));
  if (settings.timezone && settings.timezone !== 'browser') {
    params.set('tz', settings.timezone);
  }

  const panels = settings.layout.panels;
  const logo = settings.layout.logo;
  const pageNumber = settings.layout.pageNumber;

  if (settings.layout.orientation) {
    params.set(PARAMS.orientation, settings.layout.orientation);
  }

  if (settings.reportTheme) {
    params.set(PARAMS.reportTheme, settings.reportTheme);
  }

  if (panels.perPage !== undefined) {
    params.set(PARAMS.panelsPerPage, String(panels.perPage));
  }
  if (panels.spacing !== undefined) {
    params.set(PARAMS.panelsSpacing, String(panels.spacing));
  }

  if (panels.width !== undefined) {
    params.set(PARAMS.panelsWidth, String(panels.width));
  }
  if (panels.height !== undefined) {
    params.set(PARAMS.panelsHeight, String(panels.height));
  }

  const panelsTitlesEnabled = panels.title?.enabled;
  params.set(PARAMS.panelsTitleEnabled, panelsTitlesEnabled ? 'true' : 'false');

  if (panelsTitlesEnabled) {
    if (panels.title.fontSize !== undefined) {
      params.set(PARAMS.panelsTitleFontSize, String(panels.title.fontSize));
    }
    if (panels.title.fontFamily) {
      params.set(PARAMS.panelsTitleFontFamily, panels.title.fontFamily);
    }
    if (panels.title.fontColor) {
      params.set(PARAMS.panelsTitleFontColor, panels.title.fontColor);
    }
  }

  const logoEnabled = logo.enabled;
  params.set(PARAMS.logoEnabled, logoEnabled ? 'true' : 'false');

  if (logoEnabled) {
    if (logo.placement) {
      params.set(PARAMS.logoPlacement, logo.placement);
    }
    if (logo.alignment) {
      params.set(PARAMS.logoAlignment, logo.alignment);
    }
    if (logo.width !== undefined) {
      params.set(PARAMS.logoWidth, String(logo.width));
    }
    if (logo.height !== undefined) {
      params.set(PARAMS.logoHeight, String(logo.height));
    }
  }

  const pageNumbersEnabled = pageNumber.enabled;
  params.set(PARAMS.pageNumberEnabled, pageNumbersEnabled ? 'true' : 'false');

  if (pageNumbersEnabled) {
    if (pageNumber.placement) {
      params.set(PARAMS.pageNumberPlacement, pageNumber.placement);
    }
    if (pageNumber.alignment) {
      params.set(PARAMS.pageNumberAlignment, pageNumber.alignment);
    }
    if (pageNumber.language) {
      params.set(PARAMS.pageNumberLanguage, pageNumber.language);
    }
    if (pageNumber.fontSize !== undefined) {
      params.set(PARAMS.pageNumberFontSize, String(pageNumber.fontSize));
    }
    if (pageNumber.fontFamily) {
      params.set(PARAMS.pageNumberFontFamily, pageNumber.fontFamily);
    }
    if (pageNumber.fontColor) {
      params.set(PARAMS.pageNumberFontColor, pageNumber.fontColor);
    }
  }

  params.set(PARAMS.pageMargin, String(settings.layout.pageMargin));

  const vars = parseVariablesText(settings.variablesText);
  if (vars) {
    Object.entries(vars).forEach(([name, values]) => {
      values.forEach((entry) => params.append(`var-${name}`, entry.value));
    });
  }

  return params;
};
