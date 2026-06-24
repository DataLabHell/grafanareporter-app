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
import { Alert, Button, Field, IconButton, Select, Spinner, useStyles2 } from '@grafana/ui';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getReportStyles } from 'styles/reportStyles';
import { PLUGIN_BASE_URL, ROUTES } from '../constants';
import pluginJson from '../plugin.json';
import { LayoutSettings, ReportTheme, resolveLayoutSettings } from '../types/reporting';
import { mergeLayoutPatch, numericFieldToPatch } from '../utils/layoutForm';
import {
  LAYOUT_NUMERIC_CONSTRAINTS,
  LayoutDraft,
  LayoutDraftErrors,
  LayoutNumericField,
  createLayoutDraft,
  mergeDraftValues,
  validateLayoutDraft,
} from '../utils/layoutValidation';
import { AdvancedSettingsPanel } from './ReportRunner/AdvancedSettingsPanel';
import { useDashboardSearch } from './ReportRunner/hooks/useDashboardSearch';
import { useReportGeneration } from './ReportRunner/hooks/useReportGeneration';
import { useReporterSettings } from './ReportRunner/hooks/useReporterSettings';
import { mergeResolvedLayouts } from './ReportRunner/layoutMerge';
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
import { AdvancedSettingsSnapshot, DashboardDetailsResponse, ManualRunContext } from './ReportRunner/types';

const LAYOUT_ERROR_MESSAGE = 'Fix the highlighted layout overrides before generating the report.';

const userThemePreference: ReportTheme = config.bootData?.user?.theme === 'light' ? 'light' : 'dark';

const ReportRunner = () => {
  const { pluginSettings, settingsReady, layoutDefaults } = useReporterSettings();
  const { dashboards, dashboardsError, isFetchingDashboards } = useDashboardSearch();
  const {
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
  } = useReportGeneration(pluginSettings);

  const location = useLocation();
  const navigate = useNavigate();
  const [formError, setFormError] = useState<string>();
  const [selectedUid, setSelectedUid] = useState<string | undefined>();
  const [advancedOpen, setAdvancedOpen] = useState<boolean>(false);
  const [isGlobalOverridesOpen, setIsGlobalOverridesOpen] = useState(false);
  const [advancedSettings, setAdvancedSettings] = useState<AdvancedSettingsSnapshot>({
    range: coerceRawRange(DEFAULT_TIME_RANGE),
    timezone: 'browser' as TimeZone | 'browser',
    reportTheme: userThemePreference as ReportTheme,
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
  }, [error, status, setStatus, setError]);

  const triggerLayoutErrorBanner = useCallback(() => {
    setAdvancedOpen(true);
    setIsGlobalOverridesOpen(true);
    setStatus('error');
    setError(LAYOUT_ERROR_MESSAGE);
  }, [setStatus, setError]);

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
    [clearLayoutErrorBanner, triggerLayoutErrorBanner]
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

  useEffect(() => {
    if (!settingsReady || !pluginSettings) {
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
    const themeParam = params.get('reportTheme') as ReportTheme | null;
    const theme = themeParam && (themeParam === 'light' || themeParam === 'dark') ? themeParam : undefined;
    const { layout: parsedLayoutOverride, numericOverrides } = parseLayoutOverrides(params);
    const manualVariables = buildManualVariablesFromParams(params);
    // Mark this query as processed so the auto-run effect does not trigger a second run on re-render.
    lastAppliedQueryRef.current = currentQuery;

    const normalizedLayout = mergeResolvedLayouts(layoutDefaults, parsedLayoutOverride);
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
        reportTheme: theme ?? userThemePreference,
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
      reportTheme: theme ?? userThemePreference,
      variablesText: formatVariablesText(normalizedContext.variables),
      layout: layoutForRun,
    });
    const layoutOverrideForRun = hasOverrides ? layoutForRun : undefined;

    runReport(normalizedContext, layoutOverrideForRun, theme ?? userThemePreference);
    lastAppliedQueryRef.current = currentQuery;
  }, [location.search, layoutDefaults, pluginSettings, runReport, settingsReady, applyLayoutErrors]);

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
  const handleThemeChange = (value: ReportTheme) => setAdvancedSettings((prev) => ({ ...prev, reportTheme: value }));
  const logoOptions = useMemo<Array<SelectableValue<string>>>(
    () => (pluginSettings.logos ?? []).map((logo) => ({ label: logo.name, value: logo.id })),
    [pluginSettings.logos]
  );
  const handleLogoSelect = (id: string | undefined) => {
    setLayoutFromForm((prev) => ({
      ...prev,
      logo: { ...(prev.logo || {}), id: id ?? '', enabled: id ? true : prev.logo?.enabled },
    }));
  };
  const handleVariablesChange = (value: string) => setAdvancedSettings((prev) => ({ ...prev, variablesText: value }));
  const setLayoutFromForm: React.Dispatch<React.SetStateAction<LayoutSettings>> = (updater) => {
    setHasLayoutOverride(true);
    setAdvancedSettings((prev) => {
      const nextLayout =
        typeof updater === 'function' ? (updater as (prev: LayoutSettings) => LayoutSettings)(prev.layout) : updater;
      return {
        ...prev,
        layout: resolveLayoutSettings(nextLayout),
      };
    });
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

    setLayoutFromForm((prevLayout) => mergeLayoutPatch(prevLayout, numericFieldToPatch(field, numeric)));
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
          reportTheme: userThemePreference,
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
      setFormError('Select a dashboard first.');
      return;
    }
    setFormError(undefined);

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
      snapshot.reportTheme || undefined
    );
    lastAppliedQueryRef.current = currentQuery;
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
          <div className={styles.controlGroupRow}>
            <Field className={styles.inlineField} label="Dashboard" invalid={Boolean(formError)} error={formError}>
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
                  if (nextUid) {
                    setFormError(undefined);
                  }
                }}
              />
            </Field>
            <Button
              onClick={() => {
                if (!selectedUid) {
                  setFormError('Select a dashboard first.');
                  return;
                }
                setFormError(undefined);
                onManualGenerate();
              }}
              disabled={!selectedUid || disableControls}
              icon="document-info"
              type="button"
            >
              Generate report
            </Button>
          </div>
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
            <Button variant="secondary" type="button" onClick={cancel} disabled={!isGenerating}>
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
          selectedTheme={advancedSettings.reportTheme}
          onThemeChange={handleThemeChange}
          logoOptions={logoOptions}
          selectedLogoId={advancedSettings.layout.logo?.id || undefined}
          onLogoSelect={handleLogoSelect}
          variablesText={advancedSettings.variablesText}
          onVariablesChange={handleVariablesChange}
          reportUrl={reportUrl}
          layout={advancedSettings.layout}
          setLayout={setLayoutFromForm}
          layoutDraft={layoutDraft}
          layoutErrors={layoutErrors}
          onLayoutInputChange={handleLayoutInputChange}
          isGlobalOverridesOpen={isGlobalOverridesOpen}
          onGlobalOverridesToggle={() => setIsGlobalOverridesOpen((open) => !open)}
          disabled={!selectedUid}
          onRequireDashboard={() => setFormError('Select a dashboard first.')}
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
