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

import { PanelModel } from '../../types/grafana';
import { flattenPanels, getPanelRenderId, groupPanelsByRows } from './flatten';

describe('getPanelRenderId', () => {
  it('prefers the canonical numeric id over a synthetic renderId', () => {
    expect(getPanelRenderId({ id: 7, renderId: '7clone1' })).toBe(7);
  });

  it('falls back to renderId when id is absent', () => {
    expect(getPanelRenderId({ renderId: '7clone1' } as PanelModel)).toBe('7clone1');
  });
});

describe('flattenPanels', () => {
  it('clones repeated panels per variable value and assigns scoped vars + clone ids', () => {
    const row: PanelModel = {
      id: 10,
      type: 'row',
      repeat: 'iterator',
      panels: [{ id: 1, title: 'Repeated', type: 'stat' }],
    };
    const flattened = flattenPanels([row], { iterator: [{ value: 'a' }, { value: 'b' }] });
    expect(flattened.map((p) => p.renderId)).toEqual(['1clone1', '1clone2']);
    expect(flattened.map((p) => p.scopedVars?.iterator?.value)).toEqual(['a', 'b']);
  });

  it('recurses into the nested panels of both collapsed and expanded rows', () => {
    const panels: PanelModel[] = [
      { id: 1, type: 'row', collapsed: true, panels: [{ id: 2, type: 'stat' }] },
      { id: 3, type: 'row', collapsed: false, panels: [{ id: 4, type: 'stat' }] },
    ];
    const flattened = flattenPanels(panels, {});
    const ids = flattened.filter((p) => p.type !== 'row').map((p) => p.id);
    expect(ids).toEqual(expect.arrayContaining([2, 4]));
  });

  it('does not absorb following flat siblings into a collapsed row during grouping', () => {
    // Grafana <=12.1 emitted row children as flat siblings; a collapsed row must not adopt them.
    const panels: PanelModel[] = [
      { id: 1, type: 'row', collapsed: true },
      { id: 2, type: 'stat' },
    ];
    const grouped = groupPanelsByRows(panels);
    const row = grouped.find((p) => p.id === 1);
    expect(row?.panels ?? []).toHaveLength(0);
    // the sibling stays top-level
    expect(grouped.some((p) => p.id === 2)).toBe(true);
  });

  it('emits non-repeated panels once with their id as render id', () => {
    const flattened = flattenPanels([{ id: 5, type: 'timeseries' }], {});
    expect(flattened).toHaveLength(1);
    expect(flattened[0].renderId).toBe(5);
  });
});

describe('groupPanelsByRows', () => {
  it('attaches rowPanelId children to their parent row (Grafana >=12.2 model)', () => {
    const panels: PanelModel[] = [
      { id: 1, type: 'row' },
      { id: 2, type: 'stat', rowPanelId: 1 },
    ];
    const grouped = groupPanelsByRows(panels);
    const row = grouped.find((p) => p.id === 1);
    expect(row?.panels?.map((p) => p.id)).toEqual([2]);
  });
});
