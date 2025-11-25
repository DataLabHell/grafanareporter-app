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

// Grafana 12.1 repeats panels inline: the row metadata is baked into the panel itself via repeat.
export const panelsGrafana121: PanelModel[] = [
  {
    id: 3,
    title: 'Static panel',
    type: 'stat',
  },
  {
    id: 1,
    type: 'stat',
    title: 'Iterator $iterator',
    repeat: 'iterator',
  },
];

// Grafana 12.3 emits an explicit row and moves the repeated panel outside of it, referencing rowPanelId.
export const panelsGrafana123: PanelModel[] = [
  {
    id: 3,
    title: 'Static panel',
    type: 'stat',
  },
  {
    id: 2,
    type: 'row',
    title: 'Iterator $iterator',
    repeat: 'iterator',
    collapsed: true,
  },
  {
    id: 1,
    type: 'stat',
    title: 'Iterator $iterator',
    rowPanelId: 2,
  },
];
