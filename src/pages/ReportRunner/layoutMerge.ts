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

import { LayoutSettings, ResolvedLayoutSettings } from '../../types/reporting';

/**
 * Deep-merges a base layout with overrides so defaults (e.g. provisioned logo url,
 * header/footer spacing) survive partial overrides. Used both when applying query-param
 * overrides and when assembling the layout for a run.
 */
export const mergeResolvedLayouts = (
  base: ResolvedLayoutSettings,
  override?: LayoutSettings | ResolvedLayoutSettings
): ResolvedLayoutSettings => {
  if (!override) {
    return base;
  }

  const panels = override.panels || {};
  const titleOverride = panels.title || {};
  const logoOverride = override.logo || {};
  const pageNumberOverride = override.pageNumber || {};

  const mergedTitleEnabled = titleOverride.enabled !== undefined ? titleOverride.enabled : base.panels.title.enabled;

  return {
    ...base,
    ...override,
    panels: {
      ...base.panels,
      ...panels,
      title: {
        ...base.panels.title,
        ...titleOverride,
        enabled: mergedTitleEnabled,
      },
    },
    logo: {
      ...base.logo,
      ...logoOverride,
    },
    pageNumber: {
      ...base.pageNumber,
      ...pageNumberOverride,
    },
    pageMargin: override.pageMargin ?? base.pageMargin,
    header: {
      ...base.header,
      ...(override.header || {}),
    },
    footer: {
      ...base.footer,
      ...(override.footer || {}),
    },
  };
};
