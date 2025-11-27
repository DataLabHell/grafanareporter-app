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

import { TimeRange, dateMath, dateTime } from '@grafana/data';
import { PluginPage, config, getBackendSrv } from '@grafana/runtime';
import { TimeZone } from '@grafana/schema';
import { Alert, Button, Combobox, ComboboxOption, IconButton, Spinner, useStyles2 } from '@grafana/ui';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getReportStyles } from 'styles/ReportStyles';
import { PLUGIN_BASE_URL, ROUTES } from '../constants';
import pluginJson from '../plugin.json';
import { ensureReporterSettings, getReporterSettings, setReporterSettings } from '../state/pluginSettings';
import { LayoutSettings, ReportTheme, ReporterPluginSettings, resolveLayoutSettings } from '../types/reporting';
import { generateDashboardReport } from '../utils/reportGenerator';
import { AdvancedSettingsPanel } from './ReportRunner/AdvancedSettingsPanel';
import {
  DEFAULT_TIME_RANGE,
  buildManualVariablesFromParams,
  buildReportParams,
  coerceRawRange,
  convertDashboardVariablesToMap,
  formatVariablesText,
  normalizeRawTimeInput,
  parseLayoutOverrides,
  parseVariablesText,
} from './ReportRunner/queryUtils';
import {
  AdvancedSettingsSnapshot,
  DashboardDetailsResponse,
  DashboardSearchHit,
  ManualRunContext,
  ReportRunnerProps,
} from './ReportRunner/types';

const userThemePreference: ReportTheme = config.bootData?.user?.theme === 'light' ? 'light' : 'dark';

const ReportRunner = ({ settings }: ReportRunnerProps) => {
  const initialSettings = ensureReporterSettings(settings ?? getReporterSettings());
  const [pluginSettingsState, setPluginSettingsState] = useState<ReporterPluginSettings>(initialSettings);
  const [settingsReady, setSettingsReady] = useState<boolean>(Boolean(settings && Object.keys(settings).length));

  useEffect(() => {
    const next = ensureReporterSettings(settings ?? getReporterSettings());
    setPluginSettingsState(next);
    setReporterSettings(next);
    setSettingsReady(Boolean(settings && Object.keys(settings).length));
  }, [settings]);

  useEffect(() => {
    if (settings && Object.keys(settings).length) {
      return;
    }

    let cancelled = false;

    const loadSettings = async () => {
      try {
        const response = await getBackendSrv().get<{ jsonData?: ReporterPluginSettings }>(
          `/api/plugins/${pluginJson.id}/settings`
        );
        if (!cancelled) {
          const normalized = ensureReporterSettings(response?.jsonData);
          setPluginSettingsState(normalized);
          setReporterSettings(normalized);
          setSettingsReady(true);
        }
      } catch (error) {
        console.warn('Failed to load reporter settings', error);
        if (!cancelled) {
          setSettingsReady(true);
        }
      }
    };

    loadSettings();

    return () => {
      cancelled = true;
    };
  }, [settings]);

  const layoutDefaults = useMemo(() => resolveLayoutSettings(pluginSettingsState?.layout), [pluginSettingsState]);
  const location = useLocation();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'idle' | 'working' | 'success' | 'error'>('idle');
  const [messages, setMessages] = useState<string[]>([]);
  const [error, setError] = useState<string>();
  const [dashboards, setDashboards] = useState<DashboardSearchHit[]>([]);
  const [dashboardsError, setDashboardsError] = useState<string>();
  const [isFetchingDashboards, setIsFetchingDashboards] = useState<boolean>(false);
  const [selectedUid, setSelectedUid] = useState<string | undefined>();
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [advancedOpen, setAdvancedOpen] = useState<boolean>(false);
  const [advancedSettings, setAdvancedSettings] = useState<AdvancedSettingsSnapshot>({
    range: coerceRawRange(DEFAULT_TIME_RANGE),
    timezone: 'browser' as TimeZone | 'browser',
    theme: userThemePreference as ReportTheme,
    variablesText: '',
    layout: layoutDefaults,
  });
  const [hasLayoutOverride, setHasLayoutOverride] = useState(false);
  const lastAppliedQueryRef = useRef<string>('');

  useEffect(() => {
    if (!hasLayoutOverride) {
      setAdvancedSettings((prev) => ({
        ...prev,
        layout: {
          ...layoutDefaults,
          ...prev.layout,
        },
      }));
    }
  }, [layoutDefaults, hasLayoutOverride]);

  const [prefillFromDashboard, setPrefillFromDashboard] = useState<boolean>(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    let mounted = true;

    const fetchDashboards = async () => {
      setIsFetchingDashboards(true);
      setDashboardsError(undefined);
      try {
        const response = await getBackendSrv().get<DashboardSearchHit[]>('/api/search', {
          type: 'dash-db',
          limit: 500,
        });
        if (mounted) {
          setDashboards(response);
        }
      } catch (err) {
        if (mounted) {
          setDashboardsError('Failed to load dashboards. Refresh the page or check your permissions.');
        }
      } finally {
        if (mounted) {
          setIsFetchingDashboards(false);
        }
      }
    };

    fetchDashboards();

    return () => {
      mounted = false;
    };
  }, []);

  const runReport = useCallback(
    (context: ManualRunContext, themeOverride?: ReportTheme) => {
      if (!context.dashboardUid) {
        setStatus('error');
        setError('Please select a dashboard before generating the report.');
        return;
      }

      abortControllerRef.current?.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;

      setStatus('working');
      setMessages([]);
      setError(undefined);
      setIsGenerating(true);

      const baseSettings = pluginSettingsState ?? getReporterSettings();
      const settings: ReporterPluginSettings = { ...(baseSettings ?? {}) };
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
          layout: context.layout,
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
    [pluginSettingsState]
  );

  useEffect(() => {
    if (!settingsReady || !pluginSettingsState) {
      return;
    }

    const currentQuery = location.search ?? '';
    if (!currentQuery) {
      lastAppliedQueryRef.current = '';
      return;
    }

    if (currentQuery === lastAppliedQueryRef.current) {
      return;
    }

    const params = new URLSearchParams(currentQuery);
    const dashboardUid = params.get('uid') ?? undefined;

    if (!dashboardUid) {
      return;
    }

    const from = params.get('from') ?? undefined;
    const to = params.get('to') ?? undefined;
    const tz = (params.get('tz') ?? params.get('timezone')) as TimeZone | undefined;
    const title = params.get('title') ?? undefined;
    const themeParam = params.get('theme') as ReportTheme | null;
    const theme = themeParam && (themeParam === 'light' || themeParam === 'dark') ? themeParam : undefined;
    const layoutOverride = parseLayoutOverrides(params);
    const manualVariables = buildManualVariablesFromParams(params);

    const normalizedLayout = layoutOverride ? resolveLayoutSettings(layoutOverride) : layoutDefaults;

    const manualLayoutOverride = layoutOverride ? normalizedLayout : undefined;

    setSelectedUid(dashboardUid);
    setPrefillFromDashboard(false);

    const manualContext: ManualRunContext = {
      dashboardUid,
      dashboardTitle: title ?? undefined,
      timeRange: from || to ? { from: from ?? DEFAULT_TIME_RANGE.from, to: to ?? DEFAULT_TIME_RANGE.to } : undefined,
      timeZone: tz,
      variables: manualVariables,
      layout: manualLayoutOverride,
    };
    const normalizedRange = coerceRawRange(manualContext.timeRange);
    const normalizedContext: ManualRunContext = {
      ...manualContext,
      timeRange: normalizedRange,
    };

    setHasLayoutOverride(Boolean(layoutOverride));

    setAdvancedSettings({
      range: normalizedRange,
      timezone: normalizedContext.timeZone ?? 'browser',
      theme: theme ?? userThemePreference,
      variablesText: formatVariablesText(normalizedContext.variables),
      layout: normalizedLayout,
    });

    runReport(normalizedContext, theme ?? userThemePreference);
    lastAppliedQueryRef.current = currentQuery;
  }, [location.search, layoutDefaults, pluginSettingsState, runReport, settingsReady]);

  const dashboardsOptions = useMemo<Array<ComboboxOption<string>>>(
    () =>
      dashboards.map((item) => ({
        label: item.folderTitle ? `${item.folderTitle} / ${item.title}` : item.title,
        value: item.uid,
      })),
    [dashboards]
  );
  const themeOptions = useMemo<Array<ComboboxOption<ReportTheme>>>(
    () => [
      { label: 'Dark', value: 'dark' as ReportTheme },
      { label: 'Light', value: 'light' as ReportTheme },
    ],
    []
  );
  const timeZoneOptions = useMemo<Array<ComboboxOption<TimeZone | 'browser'>>>(() => {
    const base: Array<ComboboxOption<TimeZone | 'browser'>> = [
      { label: 'Browser (local)', value: 'browser' },
      { label: 'UTC', value: 'utc' as TimeZone },
    ];

    const ensureOption = (value?: TimeZone | 'browser') => {
      if (!value || value === 'browser') {
        return;
      }
      if (!base.some((option) => option.value === value)) {
        base.push({ label: value, value });
      }
    };

    ensureOption(config.bootData?.user?.timezone as TimeZone | undefined);
    ensureOption(advancedSettings.timezone);

    return base;
  }, [advancedSettings.timezone]);

  const selectValue = selectedUid ?? null;
  const disableControls = isGenerating;
  const timePickerValue = useMemo<TimeRange>(() => {
    const parsedFrom =
      dateMath.toDateTime(advancedSettings.range.from, {}) ??
      dateMath.toDateTime(DEFAULT_TIME_RANGE.from, {}) ??
      dateTime();
    const parsedTo =
      dateMath.toDateTime(advancedSettings.range.to, {}) ??
      dateMath.toDateTime(DEFAULT_TIME_RANGE.to, {}) ??
      dateTime();
    return {
      from: parsedFrom,
      to: parsedTo,
      raw: { ...advancedSettings.range },
    };
  }, [advancedSettings.range]);
  const onTimeRangeChange = (next: TimeRange) => {
    setAdvancedSettings((prev) => ({
      ...prev,
      range: {
        from: normalizeRawTimeInput(next.raw?.from, DEFAULT_TIME_RANGE.from),
        to: normalizeRawTimeInput(next.raw?.to, DEFAULT_TIME_RANGE.to),
      },
    }));
  };
  const handleTimezoneChange = (value: TimeZone | 'browser') =>
    setAdvancedSettings((prev) => ({ ...prev, timezone: value }));
  const handleThemeChange = (value: ReportTheme) => setAdvancedSettings((prev) => ({ ...prev, theme: value }));
  const handleVariablesChange = (value: string) => setAdvancedSettings((prev) => ({ ...prev, variablesText: value }));
  const handleLayoutChange = (next: Partial<LayoutSettings>) => {
    setHasLayoutOverride(true);
    setAdvancedSettings((prev) => ({
      ...prev,
      layout: resolveLayoutSettings({
        ...prev.layout,
        ...next,
      }),
    }));
  };

  const reportUrl = useMemo(() => {
    const basePath = `${window.location.origin}${PLUGIN_BASE_URL}/${ROUTES.Report}`;
    if (!selectedUid) {
      return basePath;
    }

    const params = buildReportParams(selectedUid, advancedSettings);
    const query = params.toString();
    return query ? `${basePath}?${query}` : basePath;
  }, [selectedUid, advancedSettings]);

  useEffect(() => {
    if (!selectedUid || !prefillFromDashboard) {
      return;
    }

    let cancelled = false;

    const updateDefaults = async () => {
      try {
        const response = await getBackendSrv().get<DashboardDetailsResponse>(`/api/dashboards/uid/${selectedUid}`);
        if (cancelled) {
          return;
        }

        const defaultTime = response.dashboard?.time;
        const defaultVariables = convertDashboardVariablesToMap(response.dashboard?.templating?.list);

        setAdvancedSettings({
          range: coerceRawRange(defaultTime),
          timezone: 'browser',
          theme: userThemePreference,
          variablesText: formatVariablesText(defaultVariables),
          layout: layoutDefaults,
        });
      } catch (error) {
        console.error('Failed to fetch dashboard defaults', error);
      } finally {
        if (!cancelled) {
          setPrefillFromDashboard(false);
        }
      }
    };

    updateDefaults();

    return () => {
      cancelled = true;
    };
  }, [selectedUid, prefillFromDashboard, layoutDefaults]);

  const onManualGenerate = () => {
    if (!selectedUid) {
      setError('Please select a dashboard before generating the report.');
      return;
    }

    const params = buildReportParams(selectedUid, advancedSettings);
    const nextQuery = params.toString();
    const currentQuery = location.search.startsWith('?') ? location.search.slice(1) : location.search;

    if (nextQuery !== currentQuery) {
      navigate(`${PLUGIN_BASE_URL}/${ROUTES.Report}?${nextQuery}`, { replace: true });
      return;
    }

    const selectedDashboard = dashboards.find((dash) => dash.uid === selectedUid);
    const manualVariables = parseVariablesText(advancedSettings.variablesText);

    runReport(
      {
        dashboardUid: selectedUid,
        dashboardTitle: selectedDashboard?.title,
        timeRange: coerceRawRange(advancedSettings.range),
        timeZone: advancedSettings.timezone || 'browser',
        variables: manualVariables,
        layout: advancedSettings.layout,
      },
      advancedSettings.theme || undefined
    );
    lastAppliedQueryRef.current = currentQuery;
  };

  const cancelReportGeneration = () => {
    if (!abortControllerRef.current) {
      return;
    }
    abortControllerRef.current.abort();
  };

  const styles = useStyles2(getReportStyles);

  return (
    <PluginPage>
      <div className={styles.container}>
        <div className={styles.headerRow}>
          <h2>Dashboard report generator</h2>
          <IconButton
            name="cog"
            tooltip="Open global settings"
            onClick={() => {
              window.location.assign(`/plugins/${pluginJson.id}`);
            }}
            aria-label="Open global settings"
          />
        </div>
        <div className={styles.controls}>
          <div className={styles.controlGroup}>
            <label className={styles.label}>Dashboard</label>
            <Combobox
              options={dashboardsOptions}
              value={selectValue}
              placeholder={isFetchingDashboards ? 'Loading dashboards…' : 'Select a dashboard'}
              disabled={disableControls || isFetchingDashboards}
              isClearable
              onChange={(option) => {
                const nextUid = option?.value ?? undefined;
                setSelectedUid(nextUid);
                setPrefillFromDashboard(Boolean(nextUid));
              }}
            />
          </div>
          <Button
            onClick={onManualGenerate}
            disabled={!selectedUid || disableControls}
            icon="document-info"
            type="button"
          >
            Generate report
          </Button>
        </div>

        <AdvancedSettingsPanel
          isOpen={advancedOpen}
          onToggle={() => setAdvancedOpen((open) => !open)}
          timePickerValue={timePickerValue}
          onTimeRangeChange={onTimeRangeChange}
          timezoneOptions={timeZoneOptions}
          selectedTimezone={advancedSettings.timezone}
          onTimezoneChange={handleTimezoneChange}
          themeOptions={themeOptions}
          selectedTheme={advancedSettings.theme}
          onThemeChange={handleThemeChange}
          variablesText={advancedSettings.variablesText}
          onVariablesChange={handleVariablesChange}
          reportUrl={reportUrl}
          layout={advancedSettings.layout}
          onLayoutChange={handleLayoutChange}
        />

        {dashboardsError && (
          <Alert severity="error" title="Failed to load dashboards">
            {dashboardsError}
          </Alert>
        )}

        {status === 'idle' && (
          <p>
            Select a dashboard above or pass a <code>uid</code> query parameter to start.
          </p>
        )}
        {status === 'working' && (
          <div className={styles.workingRow}>
            <span>
              <Spinner inline size={16} /> Generating report…
            </span>
            <Button variant="secondary" type="button" onClick={cancelReportGeneration} disabled={!isGenerating}>
              Cancel
            </Button>
          </div>
        )}
        {status === 'success' && (
          <Alert severity="success" title="Report generated">
            The PDF should download automatically.
          </Alert>
        )}
        {status === 'error' && (
          <Alert severity="error" title="Failed to generate report">
            {error}
          </Alert>
        )}

        <div className={styles.log}>
          {messages.length === 0
            ? 'Waiting for renderer…'
            : messages.map((message, index) => <div key={`${message}-${index}`}>{message}</div>)}
        </div>

        <p className={styles.helper}>
          Select a dashboard above or call this page with query parameters like{' '}
          <code>?uid=abcd1234&from=now-6h&to=now&tz=browser&var-region=us</code> to trigger report generation
          automatically.
        </p>
      </div>
    </PluginPage>
  );
};

export default ReportRunner;
