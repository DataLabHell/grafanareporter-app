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

import { ScopedVars } from '@grafana/data';
import { getTemplateSrv } from '@grafana/runtime';
import { PanelModel } from '../../types/grafana';

export const getPanelTitle = (
  panel: PanelModel,
  templateSrv: ReturnType<typeof getTemplateSrv>,
  scopedContext?: ScopedVars
) => {
  const fallbackTitle = `Panel ${panel.id ?? ''}`.trim() || 'Panel';
  const baseTitle = panel.title ?? fallbackTitle;

  try {
    const replaced = templateSrv.replace(baseTitle, scopedContext ?? panel.scopedVars, 'text');
    return replaced?.trim() || baseTitle;
  } catch {
    return baseTitle;
  }
};
