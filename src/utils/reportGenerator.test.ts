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

import { PanelModel } from '../types/grafana';
import { LayoutSettings, resolveLayoutSettings } from '../types/reporting';
import { mergeLayoutPatch } from './layoutForm';
import { panelsGrafana121, panelsGrafana123 } from './__fixtures__/dashboardPanels';
import { __testables } from './reportGenerator';

jest.mock('jspdf', () => {
  const mockInstance = {
    addImage: jest.fn(),
    save: jest.fn(),
    text: jest.fn(),
    setFont: jest.fn(),
    setFontSize: jest.fn(),
    setTextColor: jest.fn(),
    getTextDimensions: jest.fn(() => ({ w: 0, h: 0 })),
    internal: { pageSize: { getWidth: () => 100, getHeight: () => 100 } },
    output: jest.fn(),
  };

  return {
    jsPDF: jest.fn(() => mockInstance),
    TextOptionsLight: {},
  };
});

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

      const flattened = __testables.flattenPanels([row], { iterator: [{ value: 'a' }, { value: 'b' }] });

      expect(flattened).toHaveLength(2);
      expect(flattened.map((panel) => panel.renderId)).toEqual(['1clone1', '1clone2']);
      expect(flattened.map((panel) => panel.scopedVars?.iterator?.value)).toEqual(['a', 'b']);
    });
  });

  describe('layout resolution', () => {
    it('merges base settings with manual overrides', () => {
      const base: LayoutSettings = {
        panels: {
          perPage: 4,
          spacing: 8,
        },
        logo: {
          enabled: true,
          placement: 'header',
          url: 'base-logo',
        },
        pageNumber: {
          enabled: true,
        },
      };
      const override: LayoutSettings = {
        panels: {
          spacing: 24,
        },
        pageNumber: {
          enabled: false,
        },
      };

      const resolved = resolveLayoutSettings(mergeLayoutPatch(base, override));
      expect(resolved.panels.perPage).toBe(4);
      expect(resolved.panels.spacing).toBe(24);
      expect(resolved.pageNumber.enabled).toBe(false);
      expect(resolved.logo.placement).toBe('header');
      expect(resolved.logo.url).toBe('base-logo');
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
        region: [
          { value: 'us', text: 'US' },
          { value: 'eu', text: 'EU' },
        ],
        env: [{ value: 'prod' }],
      });

      expect(pairs).toEqual([
        { key: 'var-region', value: 'us' },
        { key: 'var-region', value: 'eu' },
        { key: 'var-env', value: 'prod' },
      ]);
    });
  });

  describe('normalizeVariableEntries', () => {
    it('coerces mixed structures into value/text pairs', () => {
      const values = __testables.normalizeVariableEntries(
        [{ value: '123' }, { text: 'abc' }, 'raw', 42, undefined],
        ['text-123', 'text-abc']
      );

      expect(values).toEqual([
        { value: '123', text: 'text-123' },
        { value: 'abc', text: 'abc' },
        { value: 'raw', text: undefined },
        { value: '42', text: undefined },
      ]);
    });
  });

  describe('getBrandingReservedHeight', () => {
    it('reserves space when logo or page numbers are configured for the placement', () => {
      const layout = resolveLayoutSettings({
        logo: {
          enabled: true,
          placement: 'header',
          url: 'data:image/png;base64,abc',
        },
        pageNumber: {
          enabled: true,
          placement: 'header',
        },
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

  describe('getPanelTitle', () => {
    it('prefers variable display text when rendering titles', () => {
      const templateSrv = {
        replace: jest.fn().mockReturnValue('Iterator Friendly'),
      };
      const scopedVars = {
        iterator: {
          value: ['1', '2'],
          text: 'Friendly',
        },
      };

      const title = __testables.getPanelTitle(
        { id: 1, title: 'Iterator $iterator', type: 'stat' },
        templateSrv as any,
        scopedVars
      );

      expect(templateSrv.replace).toHaveBeenCalledWith('Iterator $iterator', scopedVars, 'text');
      expect(title).toBe('Iterator Friendly');
    });
  });

  describe('real Grafana panel payloads', () => {
    const variableMap = {
      iterator: [
        { value: '1', text: 'Iterator 1' },
        { value: '2', text: 'Iterator 2' },
      ],
    };

    const assertPanelPayload = (panels: PanelModel[]) => {
      const grouped = __testables.groupPanelsByRows(panels);
      const flattened = __testables.flattenPanels(grouped, variableMap);

      const repeated = flattened.filter((panel) => panel.title?.includes('Iterator'));
      expect(repeated).toHaveLength(variableMap.iterator.length);
      expect(new Set(repeated.map((panel) => panel.renderId)).size).toBe(variableMap.iterator.length);
      expect(repeated.every((panel) => String(panel.renderId).includes('clone'))).toBe(true);
      expect(repeated.map((panel) => panel.scopedVars?.iterator?.value)).toEqual(
        variableMap.iterator.map((entry) => entry.value)
      );
    };

    it('flattens Grafana 12.1 style panels with sequential rows', () => {
      assertPanelPayload(panelsGrafana121);
    });

    it('flattens Grafana 12.3 style panels that rely on rowPanelId', () => {
      assertPanelPayload(panelsGrafana123);
    });
  });
});
