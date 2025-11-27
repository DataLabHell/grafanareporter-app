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

import { css } from '@emotion/css';
import { GrafanaTheme2, RawTimeRange, TimeRange, dateMath, dateTime } from '@grafana/data';
import { PluginPage, config, getBackendSrv } from '@grafana/runtime';
import { TimeZone } from '@grafana/schema';
import { Alert, Button, Combobox, ComboboxOption, IconButton, Spinner, useStyles2 } from '@grafana/ui';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { PLUGIN_BASE_URL, ROUTES } from '../constants';
import pluginJson from '../plugin.json';
import { ensureReporterSettings, getReporterSettings, setReporterSettings } from '../state/pluginSettings';
import {
  BrandingAlignment,
  BrandingPlacement,
  LayoutSettings,
  ReportTheme,
  ReporterPluginSettings,
  VariableValueMap,
  resolveLayoutSettings,
} from '../types/reporting';
import { DashboardTemplateVariable, DashboardModel } from '../types/grafana';
import { generateDashboardReport } from '../utils/reportGenerator';
import { AdvancedSettingsPanel } from './ReportRunner/AdvancedSettingsPanel';

interface DashboardSearchHit {
  uid: string;
  title: string;
  url: string;
  folderTitle?: string;
}

type DashboardDetailsResponse = {
  dashboard: Pick<DashboardModel, 'title' | 'time' | 'templating'>;
};

interface ManualRunContext {
  dashboardUid?: string;
  dashboardTitle?: string;
  timeRange?: RawTimeRange;
  timeZone?: TimeZone | 'browser';
  variables?: VariableValueMap;
  layout?: LayoutSettings;
}

const DEFAULT_TIME_RANGE = {
  from: 'now-6h',
  to: 'now',
} as const;

const userThemePreference: ReportTheme = config.bootData?.user?.theme === 'light' ? 'light' : 'dark';

interface ReportRunnerProps {
  settings?: ReporterPluginSettings;
}

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
  const [advancedSettings, setAdvancedSettings] = useState({
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

    const manualVariables: VariableValueMap = {};
    params.forEach((value, key) => {
      if (key.startsWith('var-')) {
        const variableName = key.slice(4);
        if (!variableName) {
          return;
        }
        const entry = { value, text: value };
        manualVariables[variableName] = manualVariables[variableName]
          ? [...manualVariables[variableName], entry]
          : [entry];
      }
    });

    const normalizedLayout = layoutOverride ? resolveLayoutSettings(layoutOverride) : layoutDefaults;

    const manualLayoutOverride = layoutOverride ? normalizedLayout : undefined;

    setSelectedUid(dashboardUid);
    setPrefillFromDashboard(false);

    const manualContext: ManualRunContext = {
      dashboardUid,
      dashboardTitle: title ?? undefined,
      timeRange: from || to ? { from: from ?? DEFAULT_TIME_RANGE.from, to: to ?? DEFAULT_TIME_RANGE.to } : undefined,
      timeZone: tz,
      variables: Object.keys(manualVariables).length ? manualVariables : undefined,
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

  const styles = useStyles2(getStyles);

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

const getStyles = (theme: GrafanaTheme2) => ({
  container: css`
    max-width: 700px;
  `,
  headerRow: css`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: ${theme.spacing(1)};
  `,
  controls: css`
    display: flex;
    flex-wrap: wrap;
    gap: ${theme.spacing(2)};
    margin-bottom: ${theme.spacing(2)};
    align-items: flex-end;
  `,
  controlGroup: css`
    flex: 1 1 280px;
    min-width: 260px;
  `,
  label: css`
    display: block;
    font-weight: ${theme.typography.fontWeightMedium};
    margin-bottom: ${theme.spacing(1)};
  `,
  log: css`
    background: ${theme.colors.background.secondary};
    border-radius: ${theme.shape.radius.default};
    padding: ${theme.spacing(2)};
    min-height: 180px;
    max-height: 260px;
    overflow-y: auto;
    font-family: monospace;
    font-size: ${theme.typography.bodySmall.fontSize};
    border: 1px solid ${theme.colors.border.weak};
  `,
  helper: css`
    margin-top: ${theme.spacing(3)};
  `,
  workingRow: css`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: ${theme.spacing(2)};
    margin: ${theme.spacing(2)} 0;
  `,
});

const coerceRawRange = (range?: RawTimeRange | { from?: string; to?: string }): RawTimeRange => ({
  from: normalizeRawTimeInput(range?.from, DEFAULT_TIME_RANGE.from),
  to: normalizeRawTimeInput(range?.to, DEFAULT_TIME_RANGE.to),
});

const parseVariablesText = (text: string): VariableValueMap | undefined => {
  const result: VariableValueMap = {};
  text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .forEach((line) => {
      const [name, valuesRaw = ''] = line.split('=');
      const variable = name?.trim();
      if (!variable) {
        return;
      }
      const values = valuesRaw
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean);
      if (values.length) {
        result[variable] = values.map((value) => ({ value, text: value }));
      }
    });

  return Object.keys(result).length ? result : undefined;
};

const formatVariablesText = (variables?: VariableValueMap) => {
  if (!variables) {
    return '';
  }

  return Object.entries(variables)
    .map(([name, entries]) => `${name}=${entries.map((entry) => entry.text ?? entry.value).join(',')}`)
    .join('\n');
};

const convertDashboardVariablesToMap = (
  variables?: DashboardTemplateVariable[]
): VariableValueMap | undefined => {
  if (!variables?.length) {
    return undefined;
  }

  const map: VariableValueMap = {};

  variables.forEach((variable) => {
    if (!variable?.name) {
      return;
    }

    const values = normalizeDashboardVariableValues(variable.current?.value, variable.current?.text);
    if (values.length) {
      map[variable.name] = values;
    }
  });

  return Object.keys(map).length ? map : undefined;
};

const normalizeDashboardVariableValues = (value: unknown, text?: unknown): VariableValueMap[keyof VariableValueMap] => {
  const valueArray = Array.isArray(value) ? value : value !== undefined ? [value] : [];
  const textArray = Array.isArray(text) ? text : text !== undefined ? [text] : [];
  const max = Math.max(valueArray.length, textArray.length);
  const normalized: VariableValueMap[keyof VariableValueMap] = [];

  for (let i = 0; i < max; i++) {
    let source = valueArray[i];
    const textCandidate = textArray[i];

    if (source === undefined) {
      source = textCandidate;
    }

    if (source === undefined || source === null || source === '') {
      continue;
    }

    if (typeof source === 'object') {
      const candidate = source as { value?: unknown; text?: unknown };
      if (candidate.value !== undefined && candidate.value !== null && candidate.value !== '') {
        normalized.push({
          value: String(candidate.value),
          text:
            candidate.text !== undefined && candidate.text !== null && candidate.text !== ''
              ? String(candidate.text)
              : textCandidate !== undefined && textCandidate !== null && textCandidate !== ''
              ? String(textCandidate)
              : undefined,
        });
        continue;
      }
      if (candidate.text !== undefined && candidate.text !== null && candidate.text !== '') {
        normalized.push({
          value: String(candidate.text),
          text: String(candidate.text),
        });
        continue;
      }
    }

    normalized.push({
      value: String(source),
      text:
        textCandidate !== undefined && textCandidate !== null && textCandidate !== ''
          ? String(textCandidate)
          : undefined,
    });
  }

  return normalized;
};

const normalizeRawTimeInput = (
  value: RawTimeRange['from'] | undefined,
  fallback: RawTimeRange['from'] | undefined
): string => {
  const convert = (input?: RawTimeRange['from']) => {
    if (typeof input === 'string' && input.trim() !== '') {
      return input;
    }
    if (input && typeof (input as any).toISOString === 'function') {
      return (input as any).toISOString();
    }
    if (typeof input === 'number' && !Number.isNaN(input)) {
      return String(input);
    }
    return undefined;
  };

  return convert(value) ?? convert(fallback) ?? DEFAULT_TIME_RANGE.from;
};

const parseLayoutOverrides = (params: URLSearchParams): LayoutSettings | undefined => {
  const layout: LayoutSettings = {};
  const panelsPerPageParam = params.get('panelsPerPage');
  const panelSpacingParam = params.get('panelSpacing');
  const orientation = params.get('orientation');
  const logo = params.get('logo');
  const pageNumbers = params.get('pageNumbers');
  const panelTitles = params.get('panelTitles');
  const panelTitleFontSizeParam = params.get('panelTitleFontSize');
  const logoPlacement = params.get('logoPlacement');
  const logoAlignment = params.get('logoAlignment');
  const pagePlacement = params.get('pagePlacement');
  const pageAlignment = params.get('pageAlignment');
  const logoUrl = params.get('logoUrl');
  const renderWidthParam = params.get('renderWidth');
  const renderHeightParam = params.get('renderHeight');
  const pageMarginParam = params.get('pageMargin');
  const brandingLogoMaxWidthParam = params.get('brandingLogoMaxWidth');
  const brandingLogoMaxHeightParam = params.get('brandingLogoMaxHeight');
  const brandingTextLineHeightParam = params.get('brandingTextLineHeight');
  const brandingSectionPaddingParam = params.get('brandingSectionPadding');

  if (panelsPerPageParam !== null) {
    const panelsPerPage = Number(panelsPerPageParam);
    if (Number.isFinite(panelsPerPage) && panelsPerPage > 0) {
      layout.panelsPerPage = panelsPerPage;
    }
  }
  if (panelSpacingParam !== null) {
    const panelSpacing = Number(panelSpacingParam);
    if (Number.isFinite(panelSpacing) && panelSpacing >= 0) {
      layout.panelSpacing = panelSpacing;
    }
  }
  if (orientation === 'portrait' || orientation === 'landscape') {
    layout.orientation = orientation;
  }

  if (logo === 'true' || logo === 'false') {
    layout.logoEnabled = logo === 'true';
  }
  if (pageNumbers === 'true' || pageNumbers === 'false') {
    layout.showPageNumbers = pageNumbers === 'true';
  }
  if (panelTitles === 'true' || panelTitles === 'false') {
    layout.showPanelTitles = panelTitles === 'true';
  }
  if (panelTitleFontSizeParam !== null) {
    const value = Number(panelTitleFontSizeParam);
    if (Number.isFinite(value) && value > 0) {
      layout.panelTitleFontSize = value;
    }
  }
  if (logoUrl) {
    layout.logoUrl = logoUrl;
  }
  if (logoPlacement === 'header' || logoPlacement === 'footer') {
    layout.logoPlacement = logoPlacement as BrandingPlacement;
  }
  if (logoAlignment === 'left' || logoAlignment === 'center' || logoAlignment === 'right') {
    layout.logoAlignment = logoAlignment as BrandingAlignment;
  }
  if (pagePlacement === 'header' || pagePlacement === 'footer') {
    layout.pageNumberPlacement = pagePlacement as BrandingPlacement;
  }
  if (pageAlignment === 'left' || pageAlignment === 'center' || pageAlignment === 'right') {
    layout.pageNumberAlignment = pageAlignment as BrandingAlignment;
  }
  if (renderWidthParam !== null) {
    const renderWidth = Number(renderWidthParam);
    if (Number.isFinite(renderWidth) && renderWidth > 0) {
      layout.renderWidth = renderWidth;
    }
  }
  if (renderHeightParam !== null) {
    const renderHeight = Number(renderHeightParam);
    if (Number.isFinite(renderHeight) && renderHeight > 0) {
      layout.renderHeight = renderHeight;
    }
  }
  if (pageMarginParam !== null) {
    const pageMargin = Number(pageMarginParam);
    if (Number.isFinite(pageMargin) && pageMargin >= 0) {
      layout.pageMargin = pageMargin;
    }
  }
  if (brandingLogoMaxWidthParam !== null) {
    const value = Number(brandingLogoMaxWidthParam);
    if (Number.isFinite(value) && value > 0) {
      layout.brandingLogoMaxWidth = value;
    }
  }
  if (brandingLogoMaxHeightParam !== null) {
    const value = Number(brandingLogoMaxHeightParam);
    if (Number.isFinite(value) && value > 0) {
      layout.brandingLogoMaxHeight = value;
    }
  }
  if (brandingTextLineHeightParam !== null) {
    const value = Number(brandingTextLineHeightParam);
    if (Number.isFinite(value) && value > 0) {
      layout.brandingTextLineHeight = value;
    }
  }
  if (brandingSectionPaddingParam !== null) {
    const value = Number(brandingSectionPaddingParam);
    if (Number.isFinite(value) && value >= 0) {
      layout.brandingSectionPadding = value;
    }
  }

  return Object.keys(layout).length ? layout : undefined;
};

type AdvancedSettingsSnapshot = {
  range: RawTimeRange;
  timezone: TimeZone | 'browser';
  theme: ReportTheme;
  variablesText: string;
  layout: Required<LayoutSettings>;
};

const buildReportParams = (uid: string, settings: AdvancedSettingsSnapshot) => {
  const params = new URLSearchParams();
  params.set('uid', uid);
  const normalizedRange = coerceRawRange(settings.range);
  params.set('from', String(normalizedRange.from));
  params.set('to', String(normalizedRange.to));
  if (settings.timezone && settings.timezone !== 'browser') {
    params.set('tz', settings.timezone);
  }
  if (settings.theme) {
    params.set('theme', settings.theme);
  }
  params.set('orientation', settings.layout.orientation);
  params.set('panelsPerPage', String(settings.layout.panelsPerPage));
  params.set('panelSpacing', String(settings.layout.panelSpacing));
  params.set('logo', settings.layout.logoEnabled ? 'true' : 'false');
  params.set('panelTitles', settings.layout.showPanelTitles ? 'true' : 'false');
  params.set('panelTitleFontSize', String(settings.layout.panelTitleFontSize));
  params.set('pageNumbers', settings.layout.showPageNumbers ? 'true' : 'false');
  params.set('logoPlacement', settings.layout.logoPlacement);
  params.set('logoAlignment', settings.layout.logoAlignment);
  params.set('pagePlacement', settings.layout.pageNumberPlacement);
  params.set('pageAlignment', settings.layout.pageNumberAlignment);
  params.set('renderWidth', String(settings.layout.renderWidth));
  params.set('renderHeight', String(settings.layout.renderHeight));
  params.set('pageMargin', String(settings.layout.pageMargin));
  params.set('brandingLogoMaxWidth', String(settings.layout.brandingLogoMaxWidth));
  params.set('brandingLogoMaxHeight', String(settings.layout.brandingLogoMaxHeight));
  params.set('brandingTextLineHeight', String(settings.layout.brandingTextLineHeight));
  params.set('brandingSectionPadding', String(settings.layout.brandingSectionPadding));
  const vars = parseVariablesText(settings.variablesText);
  if (vars) {
    Object.entries(vars).forEach(([name, values]) => {
      values.forEach((entry) => params.append(`var-${name}`, entry.value));
    });
  }

  return params;
};
