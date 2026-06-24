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

import { ReporterPluginSettings, resolveLayoutSettings } from '../types/reporting';

let provisionedSettings: ReporterPluginSettings | undefined;
let globalSettings: ReporterPluginSettings | undefined;

const normalizeSettings = (settings?: ReporterPluginSettings | null): ReporterPluginSettings | undefined => {
  if (!settings || Object.keys(settings).length === 0) {
    return undefined;
  }

  return {
    ...settings,
    layout: settings.layout ? { ...settings.layout } : undefined,
    logos: settings.logos ? settings.logos.map((logo) => ({ ...logo })) : undefined,
  };
};

const mergeSettings = (...layers: Array<ReporterPluginSettings | undefined>): ReporterPluginSettings => {
  let mergedLayout: ReporterPluginSettings['layout'];
  let themePreference: ReporterPluginSettings['themePreference'];
  let logos: ReporterPluginSettings['logos'];

  for (const layer of layers) {
    if (!layer) {
      continue;
    }

    if (layer.themePreference !== undefined) {
      themePreference = layer.themePreference;
    } else if ((layer.layout as any)?.reportTheme !== undefined) {
      themePreference = (layer.layout as any).reportTheme;
    }

    if (layer.layout) {
      mergedLayout = {
        ...mergedLayout,
        ...layer.layout,
      };
    }

    // The logo library is replaced (not merged) by the most specific layer that defines it.
    if (layer.logos !== undefined) {
      logos = layer.logos;
    }
  }

  return {
    themePreference,
    layout: mergedLayout ? resolveLayoutSettings(mergedLayout) : undefined,
    logos,
  };
};

export const ensureReporterSettings = (settings?: ReporterPluginSettings | null): ReporterPluginSettings =>
  normalizeSettings(settings) ?? {};

export const setProvisionedSettings = (settings?: ReporterPluginSettings | null) => {
  provisionedSettings = normalizeSettings(settings);
};

export const setReporterSettings = (settings?: ReporterPluginSettings | null) => {
  globalSettings = normalizeSettings(settings);
};

export const getProvisionedSettings = () => provisionedSettings;

export const getReporterSettings = (overrides?: ReporterPluginSettings | null) =>
  mergeSettings(provisionedSettings, globalSettings, normalizeSettings(overrides));
