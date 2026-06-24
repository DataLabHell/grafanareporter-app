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

import { getBackendSrv } from '@grafana/runtime';
import { useEffect, useMemo, useState } from 'react';
import pluginJson from '../../../plugin.json';
import { ensureReporterSettings, getReporterSettings, setReporterSettings } from '../../../state/pluginSettings';
import { ReporterPluginSettings, resolveLayoutSettings } from '../../../types/reporting';

/**
 * Loads the plugin's global settings from the Grafana API once on mount, seeds the
 * shared settings store, and derives the resolved layout defaults from them.
 */
export const useReporterSettings = () => {
  const [pluginSettings, setPluginSettings] = useState<ReporterPluginSettings>(() => getReporterSettings());
  const [settingsReady, setSettingsReady] = useState<boolean>(false);

  useEffect(() => {
    let cancelled = false;

    const loadSettings = async () => {
      try {
        const response = await getBackendSrv().get<{ jsonData?: ReporterPluginSettings }>(
          `/api/plugins/${pluginJson.id}/settings`
        );
        if (cancelled) {
          return;
        }
        const normalized = ensureReporterSettings(response?.jsonData);
        setReporterSettings(normalized);
        setPluginSettings(getReporterSettings());
      } catch (error) {
        console.warn('Failed to load reporter settings', error);
      } finally {
        if (!cancelled) {
          setSettingsReady(true);
        }
      }
    };

    loadSettings();

    return () => {
      cancelled = true;
    };
  }, []);

  const layoutDefaults = useMemo(
    () => resolveLayoutSettings(getReporterSettings(pluginSettings).layout),
    [pluginSettings]
  );

  return { pluginSettings, settingsReady, layoutDefaults };
};
