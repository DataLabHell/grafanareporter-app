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

import { SelectableValue, TimeRange, dateMath, dateTime } from '@grafana/data';
import { PluginPage, config, getBackendSrv } from '@grafana/runtime';
import { TimeZone } from '@grafana/schema';
import { Alert, Button, IconButton, Select, Spinner, useStyles2 } from '@grafana/ui';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getReportStyles } from 'styles/reportStyles';
import { PLUGIN_BASE_URL, ROUTES } from '../constants';
import pluginJson from '../plugin.json';
import { ensureReporterSettings, getReporterSettings, setReporterSettings } from '../state/pluginSettings';
import { LayoutSettings, ReportTheme, ReporterPluginSettings, resolveLayoutSettings } from '../types/reporting';
import {
  LAYOUT_NUMERIC_CONSTRAINTS,
  LayoutDraft,
  LayoutDraftErrors,
  LayoutNumericField,
  createLayoutDraft,
  mergeDraftValues,
  validateLayoutDraft,
} from '../utils/layoutValidation';
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
} from './ReportRunner/types';

const LAYOUT_ERROR_MESSAGE = 'Fix the highlighted layout overrides before generating the report.';

const userThemePreference: ReportTheme = config.bootData?.user?.theme === 'light' ? 'light' : 'dark';

const ReportRunner = () => {
  const [pluginSettingsState, setPluginSettingsState] = useState<ReporterPluginSettings>(() => getReporterSettings());
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
        setPluginSettingsState(getReporterSettings());
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
  const [isGlobalOverridesOpen, setIsGlobalOverridesOpen] = useState(false);
  const [advancedSettings, setAdvancedSettings] = useState<AdvancedSettingsSnapshot>({
    range: coerceRawRange(DEFAULT_TIME_RANGE),
    timezone: 'browser' as TimeZone | 'browser',
    theme: userThemePreference as ReportTheme,
    variablesText: '',
    layout: layoutDefaults,
  });
  const [layoutDraft, setLayoutDraft] = useState<LayoutDraft>(() => createLayoutDraft(layoutDefaults));
  const [layoutErrors, setLayoutErrors] = useState<LayoutDraftErrors>({});
  const [hasLayoutOverride, setHasLayoutOverride] = useState(false);
  const lastAppliedQueryRef = useRef<string>('');

  type LayoutErrorsUpdater = LayoutDraftErrors | undefined | ((prev: LayoutDraftErrors) => LayoutDraftErrors);

  const clearLayoutErrorBanner = useCallback(() => {
    if (status === 'error' && error === LAYOUT_ERROR_MESSAGE) {
      setStatus('idle');
      setError(undefined);
    }
  }, [error, status]);

  const triggerLayoutErrorBanner = () => {
    setAdvancedOpen(true);
    setIsGlobalOverridesOpen(true);
    setStatus('error');
    setError(LAYOUT_ERROR_MESSAGE);
  };

  const applyLayoutErrors = useCallback(
    (updater: LayoutErrorsUpdater) => {
      setLayoutErrors((prev) => {
        const next =
          typeof updater === 'function'
            ? (updater as (prev: LayoutDraftErrors) => LayoutDraftErrors)(prev)
            : updater ?? {};
        const hasErrors = Object.values(next ?? {}).some(Boolean);
        if (hasErrors) {
          triggerLayoutErrorBanner();
        } else {
          clearLayoutErrorBanner();
        }
        return next;
      });
    },
    [clearLayoutErrorBanner]
  );

  useEffect(() => {
    if (!hasLayoutOverride) {
      setAdvancedSettings((prev) => ({
        ...prev,
        layout: {
          ...layoutDefaults,
          ...prev.layout,
        },
      }));
      setLayoutDraft(createLayoutDraft(layoutDefaults));
      applyLayoutErrors({});
    }
  }, [layoutDefaults, hasLayoutOverride, applyLayoutErrors]);

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
    (context: ManualRunContext, layoutOverride?: LayoutSettings, themeOverride?: ReportTheme) => {
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

      const baseSettings = pluginSettingsState ?? getReporterSettings();
      const mergedLayout = resolveLayoutSettings({
        ...(baseSettings?.layout ?? {}),
        ...(layoutOverride ?? {}),
      });
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
    [pluginSettingsState, isGenerating]
  );

  useEffect(() => {
    if (!settingsReady || !pluginSettingsState) {
      return;
    }

    const rawSearch = location.search ?? '';
    const currentQuery = rawSearch.startsWith('?') ? rawSearch.slice(1) : rawSearch;
    if (!rawSearch) {
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
    const { layout: parsedLayoutOverride, numericOverrides } = parseLayoutOverrides(params);
    const manualVariables = buildManualVariablesFromParams(params);
    // Mark this query as processed so the auto-run effect does not trigger a second run on re-render.
    lastAppliedQueryRef.current = currentQuery;

    const normalizedLayout = parsedLayoutOverride
      ? resolveLayoutSettings({ ...layoutDefaults, ...parsedLayoutOverride })
      : layoutDefaults;
    const draftFromLayout = createLayoutDraft(normalizedLayout);
    const mergedDraft = numericOverrides ? { ...draftFromLayout, ...numericOverrides } : draftFromLayout;
    setLayoutDraft(mergedDraft);

    setSelectedUid(dashboardUid);
    setPrefillFromDashboard(false);

    const manualContext: ManualRunContext = {
      dashboardUid,
      dashboardTitle: title ?? undefined,
      timeRange: from || to ? { from: from ?? DEFAULT_TIME_RANGE.from, to: to ?? DEFAULT_TIME_RANGE.to } : undefined,
      timeZone: tz,
      variables: manualVariables,
    };
    const normalizedRange = coerceRawRange(manualContext.timeRange);
    const normalizedContext: ManualRunContext = {
      ...manualContext,
      timeRange: normalizedRange,
    };

    const validation = validateLayoutDraft(mergedDraft);
    const hasOverrides = Boolean(parsedLayoutOverride) || Boolean(numericOverrides);
    setHasLayoutOverride(hasOverrides);

    if (validation.errors) {
      applyLayoutErrors(validation.errors);
      setAdvancedSettings({
        range: normalizedRange,
        timezone: normalizedContext.timeZone ?? 'browser',
        theme: theme ?? userThemePreference,
        variablesText: formatVariablesText(normalizedContext.variables),
        layout: normalizedLayout,
      });
      return;
    }

    const layoutForRun = mergeDraftValues(normalizedLayout, validation.values);
    applyLayoutErrors({});
    setAdvancedOpen(false);
    setIsGlobalOverridesOpen(false);
    setAdvancedSettings({
      range: normalizedRange,
      timezone: normalizedContext.timeZone ?? 'browser',
      theme: theme ?? userThemePreference,
      variablesText: formatVariablesText(normalizedContext.variables),
      layout: layoutForRun,
    });
    const layoutOverrideForRun = hasOverrides ? layoutForRun : undefined;

    runReport(normalizedContext, layoutOverrideForRun, theme ?? userThemePreference);
    lastAppliedQueryRef.current = currentQuery;
  }, [location.search, layoutDefaults, pluginSettingsState, runReport, settingsReady, applyLayoutErrors]);

  const dashboardsOptions = useMemo<Array<SelectableValue<string>>>(
    () =>
      dashboards.map((item) => ({
        label: item.folderTitle ? `${item.folderTitle} / ${item.title}` : item.title,
        value: item.uid,
      })),
    [dashboards]
  );
  const themeOptions = useMemo<Array<SelectableValue<ReportTheme>>>(
    () => [
      { label: 'Dark', value: 'dark' as ReportTheme },
      { label: 'Light', value: 'light' as ReportTheme },
    ],
    []
  );
  const timeZoneOptions = useMemo<Array<SelectableValue<TimeZone | 'browser'>>>(() => {
    const base: Array<SelectableValue<TimeZone | 'browser'>> = [
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

  const selectedDashboardOption = useMemo(
    () => dashboardsOptions.find((option) => option.value === selectedUid) ?? null,
    [dashboardsOptions, selectedUid]
  );
  const disableControls = isGenerating;
  const timePickerValue = useMemo<TimeRange>(() => {
    const parsedFrom =
      dateMath.parse(advancedSettings.range.from, false) ??
      dateMath.parse(DEFAULT_TIME_RANGE.from, false) ??
      dateTime();
    const parsedTo =
      dateMath.parse(advancedSettings.range.to, true) ?? dateMath.parse(DEFAULT_TIME_RANGE.to, true) ?? dateTime();
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
  const handleLayoutInputChange = (field: LayoutNumericField, value: string) => {
    setHasLayoutOverride(true);
    setLayoutDraft((prev) => ({
      ...prev,
      [field]: value,
    }));
    const constraint = LAYOUT_NUMERIC_CONSTRAINTS[field];
    const trimmed = value.trim();
    const numeric = Number(trimmed);
    const min = constraint?.min ?? Number.NEGATIVE_INFINITY;
    const label = constraint?.label ?? 'Value';

    if (!trimmed) {
      applyLayoutErrors((prev) => ({
        ...prev,
        [field]: `${label} must be a number`,
      }));
      return;
    }
    if (!Number.isFinite(numeric)) {
      applyLayoutErrors((prev) => ({
        ...prev,
        [field]: `${label} must be a number`,
      }));
      return;
    }
    if (numeric < min) {
      applyLayoutErrors((prev) => ({
        ...prev,
        [field]: `${label} must be at least ${min}`,
      }));
      return;
    }

    applyLayoutErrors((prev) => ({
      ...prev,
      [field]: undefined,
    }));

    setAdvancedSettings((prev) => ({
      ...prev,
      layout: {
        ...prev.layout,
        [field]: numeric,
      },
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
        setLayoutDraft(createLayoutDraft(layoutDefaults));
        applyLayoutErrors({});
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
  }, [selectedUid, prefillFromDashboard, layoutDefaults, applyLayoutErrors]);

  const onManualGenerate = () => {
    if (isGenerating) {
      return;
    }

    if (!selectedUid) {
      setError('Please select a dashboard before generating the report.');
      return;
    }

    const validation = validateLayoutDraft(layoutDraft);
    if (!validation.values) {
      applyLayoutErrors(validation.errors ?? {});
      return;
    }

    applyLayoutErrors({});
    const layoutForRun = mergeDraftValues(advancedSettings.layout, validation.values);
    const snapshot: AdvancedSettingsSnapshot = {
      ...advancedSettings,
      layout: layoutForRun,
    };
    setAdvancedSettings(snapshot);
    setLayoutDraft(createLayoutDraft(layoutForRun));

    const params = buildReportParams(selectedUid, snapshot);
    const nextQuery = params.toString();
    const currentQuery = location.search.startsWith('?') ? location.search.slice(1) : location.search;

    if (nextQuery !== currentQuery) {
      // Update URL to reflect overrides; let the auto-run effect handle the run once.
      navigate(`${PLUGIN_BASE_URL}/${ROUTES.Report}?${nextQuery}`, { replace: true });
      return;
    }

    // Immediately reflect a new generation attempt.
    setStatus('working');
    setMessages([]);
    setError(undefined);
    setIsGenerating(true);

    const selectedDashboard = dashboards.find((dash) => dash.uid === selectedUid);
    const manualVariables = parseVariablesText(snapshot.variablesText);

    runReport(
      {
        dashboardUid: selectedUid,
        dashboardTitle: selectedDashboard?.title,
        timeRange: coerceRawRange(snapshot.range),
        timeZone: snapshot.timezone || 'browser',
        variables: manualVariables,
      },
      layoutForRun,
      snapshot.theme || undefined
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
            <Select
              options={dashboardsOptions}
              value={selectedDashboardOption}
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
          layoutDraft={layoutDraft}
          layoutErrors={layoutErrors}
          onLayoutChange={handleLayoutChange}
          onLayoutInputChange={handleLayoutInputChange}
          isGlobalOverridesOpen={isGlobalOverridesOpen}
          onGlobalOverridesToggle={() => setIsGlobalOverridesOpen((open) => !open)}
        />

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
