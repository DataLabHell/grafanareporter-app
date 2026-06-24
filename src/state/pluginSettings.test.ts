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

import {
  ensureReporterSettings,
  getReporterSettings,
  setProvisionedSettings,
  setReporterSettings,
} from './pluginSettings';

describe('pluginSettings store', () => {
  beforeEach(() => {
    // Reset the module-level layers between tests.
    setProvisionedSettings(undefined);
    setReporterSettings(undefined);
  });

  describe('ensureReporterSettings', () => {
    it('returns an empty object for nullish or empty input', () => {
      expect(ensureReporterSettings(undefined)).toEqual({});
      expect(ensureReporterSettings({})).toEqual({});
    });

    it('clones the layout it is given', () => {
      const layout = { orientation: 'landscape' as const };
      const result = ensureReporterSettings({ layout });
      expect(result.layout).toEqual(layout);
      expect(result.layout).not.toBe(layout);
    });
  });

  describe('getReporterSettings layering', () => {
    it('lets global settings override provisioned ones', () => {
      setProvisionedSettings({ layout: { orientation: 'portrait' } });
      setReporterSettings({ layout: { orientation: 'landscape' } });
      expect(getReporterSettings().layout?.orientation).toBe('landscape');
    });

    it('lets per-call overrides win over both layers', () => {
      setProvisionedSettings({ layout: { orientation: 'portrait' } });
      setReporterSettings({ layout: { orientation: 'landscape' } });
      expect(getReporterSettings({ layout: { orientation: 'portrait' } }).layout?.orientation).toBe('portrait');
    });

    it('derives themePreference from a layout.reportTheme when not set explicitly', () => {
      setReporterSettings({ layout: { reportTheme: 'light' } as any });
      expect(getReporterSettings().themePreference).toBe('light');
    });

    it('resolves the merged layout to full defaults', () => {
      setReporterSettings({ layout: { orientation: 'landscape' } });
      const resolved = getReporterSettings().layout;
      expect(resolved?.orientation).toBe('landscape');
      // unspecified fields fall back to resolved defaults
      expect(resolved?.panels?.perPage).toBeGreaterThan(0);
    });
  });
});
