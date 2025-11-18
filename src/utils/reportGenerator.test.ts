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

import { __testables } from './reportGenerator';
import { DEFAULT_LAYOUT_SETTINGS, resolveLayoutSettings, LayoutSettings } from '../types/reporting';
import { PanelModel } from '../types/grafana';

describe('reportGenerator helpers', () => {
  describe('flattenPanels', () => {
    it('duplicates repeated panels for each variable value and sets scoped vars', () => {
      const row: PanelModel = {
        id: 10,
        type: 'row',
        repeat: 'iterator',
        panels: [
          {
            id: 1,
            title: 'Repeated panel',
            type: 'stat',
          },
        ],
      };

      const flattened = __testables.flattenPanels([row], { iterator: ['a', 'b'] });

      expect(flattened).toHaveLength(2);
      expect(flattened.map((panel) => panel.renderId)).toEqual(['1clone1', '1clone2']);
      expect(flattened.map((panel) => panel.scopedVars?.iterator?.value)).toEqual(['a', 'b']);
    });
  });

  describe('resolveReportLayout', () => {
    it('prefers overrides but falls back to base defaults', () => {
      const base: LayoutSettings = {
        panelsPerPage: 4,
        panelSpacing: 8,
        logoEnabled: false,
        showPageNumbers: true,
        logoPlacement: 'header',
      };
      const override: LayoutSettings = {
        panelSpacing: 24,
        showPageNumbers: false,
      };

      const layout = __testables.resolveReportLayout(base, override);

      expect(layout.panelsPerPage).toBe(4);
      expect(layout.panelSpacing).toBe(24);
      expect(layout.showPageNumbers).toBe(false);
      expect(layout.logoPlacement).toBe('header');
    });

    it('falls back to DEFAULT_LAYOUT_SETTINGS when nothing provided', () => {
      const resolved = __testables.resolveReportLayout(undefined, undefined);
      expect(resolved.panelsPerPage).toBe(DEFAULT_LAYOUT_SETTINGS.panelsPerPage);
      expect(resolved.logoUrl).toBe(DEFAULT_LAYOUT_SETTINGS.logoUrl);
    });
  });

  describe('determineGridColumns', () => {
    it('uses a single column for less than 4 panels and two columns otherwise', () => {
      expect(__testables.determineGridColumns(1)).toBe(1);
      expect(__testables.determineGridColumns(3)).toBe(1);
      expect(__testables.determineGridColumns(4)).toBe(2);
      expect(__testables.determineGridColumns(6)).toBe(2);
    });
  });

  describe('buildVariablePairs', () => {
    it('builds var-* key pairs for every variable value', () => {
      const pairs = __testables.buildVariablePairs({
        region: ['us', 'eu'],
        env: ['prod'],
      });

      expect(pairs).toEqual([
        { key: 'var-region', value: 'us' },
        { key: 'var-region', value: 'eu' },
        { key: 'var-env', value: 'prod' },
      ]);
    });
  });

  describe('normalizeVariableValues', () => {
    it('coerces mixed structures into strings', () => {
      const values = __testables.normalizeVariableValues([
        { value: '123' },
        { text: 'abc' },
        'raw',
        42,
        undefined,
      ]);

      expect(values).toEqual(['123', 'abc', 'raw', '42']);
    });
  });

  describe('getBrandingReservedHeight', () => {
    it('reserves space when logo or page numbers are configured for the placement', () => {
      const layout = resolveLayoutSettings({
        logoEnabled: true,
        logoPlacement: 'header',
        logoUrl: 'data:image/png;base64,abc',
        showPageNumbers: true,
        pageNumberPlacement: 'header',
      });

      const logoHeight = __testables.getBrandingReservedHeight('header', layout, {
        dataUrl: 'data:image/png;base64,abc',
        width: 100,
        height: 30,
      });
      const footerHeight = __testables.getBrandingReservedHeight('footer', layout);

      expect(logoHeight).toBeGreaterThan(0);
      expect(footerHeight).toBe(0);
    });
  });
});
