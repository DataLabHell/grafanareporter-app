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

import { useCallback, useRef, useState } from 'react';
import { getReporterSettings } from '../../../state/pluginSettings';
import {
  ReportTheme,
  ReporterPluginSettings,
  ResolvedLayoutSettings,
  resolveLayoutSettings,
} from '../../../types/reporting';
import { generateDashboardReport } from '../../../utils/reportGenerator';
import { coerceRawRange } from '../queryUtils';
import { mergeResolvedLayouts } from '../layoutMerge';
import { ManualRunContext } from '../types';

export type ReportStatus = 'idle' | 'working' | 'success' | 'error';

/**
 * Owns the lifecycle of a single report run: status/progress state, cancellation,
 * and the orchestration call into generateDashboardReport. The base layout is merged
 * with any per-run override before the run.
 */
export const useReportGeneration = (pluginSettings: ReporterPluginSettings) => {
  const [status, setStatus] = useState<ReportStatus>('idle');
  const [messages, setMessages] = useState<string[]>([]);
  const [error, setError] = useState<string>();
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const runReport = useCallback(
    (context: ManualRunContext, layoutOverride?: ResolvedLayoutSettings, themeOverride?: ReportTheme) => {
      if (!context.dashboardUid) {
        setStatus('error');
        setError('Please select a dashboard before generating the report.');
        return;
      }

      // Cancel any previous run only if something is currently running.
      if (isGenerating && abortControllerRef.current && !abortControllerRef.current.signal.aborted) {
        abortControllerRef.current.abort();
      }
      const controller = new AbortController();
      abortControllerRef.current = controller;

      setStatus('working');
      setMessages([]);
      setError(undefined);
      setIsGenerating(true);

      const baseSettings = getReporterSettings(pluginSettings);
      const baseLayout = resolveLayoutSettings(baseSettings?.layout);
      const mergedLayout = mergeResolvedLayouts(baseLayout, layoutOverride);
      const settings: ReporterPluginSettings = { ...(baseSettings ?? {}), layout: mergedLayout };
      if (themeOverride) {
        settings.themePreference = themeOverride;
      }

      generateDashboardReport({
        settings,
        onProgress: (message) => setMessages((prev) => [...prev, message]),
        manualContext: {
          dashboardUid: context.dashboardUid,
          dashboardTitle: context.dashboardTitle,
          timeRange: coerceRawRange(context.timeRange),
          timeZone: context.timeZone ?? 'browser',
          variables: context.variables,
        },
        signal: controller.signal,
      })
        .then(() => setStatus('success'))
        .catch((err) => {
          if (err instanceof DOMException && err.name === 'AbortError') {
            setStatus('idle');
            setMessages((prev) => [...prev, 'Report generation cancelled.']);
            return;
          }
          setStatus('error');
          setError(err instanceof Error ? err.message : 'An unexpected error occurred while generating the report.');
        })
        .finally(() => {
          setIsGenerating(false);
          if (abortControllerRef.current === controller) {
            abortControllerRef.current = null;
          }
        });
    },
    [pluginSettings, isGenerating]
  );

  const cancel = useCallback(() => {
    abortControllerRef.current?.abort();
  }, []);

  return {
    status,
    setStatus,
    messages,
    setMessages,
    error,
    setError,
    isGenerating,
    setIsGenerating,
    runReport,
    cancel,
  };
};
