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
import { AppPluginMeta, GrafanaTheme2, PluginConfigPageProps } from '@grafana/data';
import { getBackendSrv } from '@grafana/runtime';
import { Button, Field, FieldSet, Input, RadioButtonGroup, Switch, useStyles2 } from '@grafana/ui';
import React, { useState } from 'react';
import { lastValueFrom } from 'rxjs';
import {
  BrandingAlignment,
  BrandingPlacement,
  ReporterPluginSettings,
  ReportOrientation,
  resolveLayoutSettings,
} from '../../types/reporting';
import { testIds } from '../testIds';

export interface AppConfigProps extends PluginConfigPageProps<AppPluginMeta<ReporterPluginSettings>> {}

const orientationOptions = [
  { label: 'Portrait', value: 'portrait' as ReportOrientation },
  { label: 'Landscape', value: 'landscape' as ReportOrientation },
];

const placementOptions = [
  { label: 'Header', value: 'header' as BrandingPlacement },
  { label: 'Footer', value: 'footer' as BrandingPlacement },
];

const alignmentOptions = [
  { label: 'Left', value: 'left' as BrandingAlignment },
  { label: 'Center', value: 'center' as BrandingAlignment },
  { label: 'Right', value: 'right' as BrandingAlignment },
];

const AppConfig = ({ plugin }: AppConfigProps) => {
  const s = useStyles2(getStyles);
  const layout = resolveLayoutSettings(plugin.meta.jsonData?.layout);
  const [state, setState] = useState({
    panelsPerPage: layout.panelsPerPage,
    panelSpacing: layout.panelSpacing,
    orientation: layout.orientation,
    logoUrl: layout.logoUrl,
    logoEnabled: layout.logoEnabled,
    showPageNumbers: layout.showPageNumbers,
    showPanelTitles: layout.showPanelTitles,
    logoPlacement: layout.logoPlacement,
    logoAlignment: layout.logoAlignment,
    pageNumberPlacement: layout.pageNumberPlacement,
    pageNumberAlignment: layout.pageNumberAlignment,
  });

  const onNumberChange = (key: 'panelsPerPage' | 'panelSpacing') => (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(event.target.value, 10);
    setState((prev) => ({
      ...prev,
      [key]: Number.isFinite(value) ? value : prev[key],
    }));
  };

  const onOrientationChange = (value: string) => {
    if (value === 'portrait' || value === 'landscape') {
      setState((prev) => ({
        ...prev,
        orientation: value,
      }));
    }
  };

  const handleLogoUrlChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setState((prev) => ({
      ...prev,
      logoUrl: value,
    }));
  };

  const handleLogoFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setState((prev) => ({
          ...prev,
          logoUrl: reader.result as string,
        }));
      }
    };
    reader.readAsDataURL(file);
  };

  const handleClearLogo = () => {
    setState((prev) => ({
      ...prev,
      logoUrl: '',
      logoEnabled: false,
    }));
  };

  const handleLogoEnabledToggle = (event: React.ChangeEvent<HTMLInputElement>) => {
    setState((prev) => ({
      ...prev,
      logoEnabled: event.target.checked,
    }));
  };

  const handlePlacementChange = (key: 'logoPlacement' | 'pageNumberPlacement') => (value: string | null) => {
    if (value === 'header' || value === 'footer') {
      setState((prev) => ({
        ...prev,
        [key]: value,
      }));
    }
  };

  const handleAlignmentChange = (key: 'logoAlignment' | 'pageNumberAlignment') => (value: string | null) => {
    if (value === 'left' || value === 'center' || value === 'right') {
      setState((prev) => ({
        ...prev,
        [key]: value,
      }));
    }
  };

  const handlePageNumberToggle = (event: React.ChangeEvent<HTMLInputElement>) => {
    setState((prev) => ({
      ...prev,
      showPageNumbers: event.target.checked,
    }));
  };

  const handlePanelTitleToggle = (event: React.ChangeEvent<HTMLInputElement>) => {
    setState((prev) => ({
      ...prev,
      showPanelTitles: event.target.checked,
    }));
  };

  const isSubmitDisabled =
    state.panelsPerPage === layout.panelsPerPage &&
    state.panelSpacing === layout.panelSpacing &&
    state.orientation === layout.orientation &&
    state.logoUrl === layout.logoUrl &&
    state.logoEnabled === layout.logoEnabled &&
    state.showPageNumbers === layout.showPageNumbers &&
    state.showPanelTitles === layout.showPanelTitles &&
    state.logoPlacement === layout.logoPlacement &&
    state.logoAlignment === layout.logoAlignment &&
    state.pageNumberPlacement === layout.pageNumberPlacement &&
    state.pageNumberAlignment === layout.pageNumberAlignment;

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isSubmitDisabled) {
      return;
    }

    await updatePluginAndReload(plugin.meta.id, {
      enabled: plugin.meta.enabled,
      pinned: plugin.meta.pinned,
      jsonData: {
        ...plugin.meta.jsonData,
        layout: {
          panelsPerPage: Math.max(1, state.panelsPerPage),
          panelSpacing: Math.max(0, state.panelSpacing),
          orientation: state.orientation,
          logoUrl: state.logoUrl?.trim() ?? '',
          logoEnabled: state.logoEnabled,
          showPageNumbers: state.showPageNumbers,
          showPanelTitles: state.showPanelTitles,
          logoPlacement: state.logoPlacement,
          logoAlignment: state.logoAlignment,
          pageNumberPlacement: state.pageNumberPlacement,
          pageNumberAlignment: state.pageNumberAlignment,
        },
      },
    });
  };

  return (
    <form onSubmit={onSubmit}>
      <FieldSet label="Default report layout">
        <Field label="Panels per page" description="Controls how many panels are rendered on each PDF page.">
          <Input
            type="number"
            min={1}
            step={1}
            value={state.panelsPerPage}
            onChange={onNumberChange('panelsPerPage')}
            data-testid={testIds.appConfig.panelsPerPage}
          />
        </Field>

        <Field label="Panel spacing (pt)" description="Vertical space between panels on the same page.">
          <Input
            type="number"
            min={0}
            step={1}
            value={state.panelSpacing}
            onChange={onNumberChange('panelSpacing')}
            data-testid={testIds.appConfig.panelSpacing}
          />
        </Field>

        <Field label="Orientation">
          <RadioButtonGroup
            options={orientationOptions}
            value={state.orientation}
            onChange={onOrientationChange}
            data-testid={testIds.appConfig.orientation}
          />
        </Field>
      </FieldSet>

      <FieldSet label="Footer, Header & branding">
        <Field
          label="Footer logo"
          description="Paste an image URL or upload a file to display in the PDF."
          data-testid={testIds.appConfig.footerLogo}
        >
          <div className={s.logoField}>
            <div className={s.logoRow}>
              <Input
                placeholder="https://example.com/logo.png or data:image/png;base64..."
                value={state.logoUrl}
                onChange={handleLogoUrlChange}
                data-testid={testIds.appConfig.footerLogo}
              />
              <label className={s.fileInput}>
                <span>Select image</span>
                <input type="file" accept="image/*" onChange={handleLogoFileChange} />
              </label>
              {state.logoUrl && (
                <Button variant="secondary" type="button" onClick={handleClearLogo}>
                  Clear
                </Button>
              )}
            </div>
            {state.logoUrl && (
              <div className={s.logoPreview}>
                <img src={state.logoUrl} alt="Logo preview" />
              </div>
            )}
          </div>
        </Field>

        <Field label="Display logo">
          <Switch
            value={state.logoEnabled}
            onChange={handleLogoEnabledToggle}
            disabled={!state.logoUrl}
            data-testid={testIds.appConfig.logoEnabled}
          />
        </Field>

        {state.logoUrl && state.logoEnabled && (
          <Field label="Logo placement">
            <div className={s.inlineControls}>
              <RadioButtonGroup
                options={placementOptions.map((option) => ({
                  ...option,
                  disabled:
                    state.showPageNumbers &&
                    state.pageNumberPlacement === option.value &&
                    state.pageNumberAlignment === state.logoAlignment,
                }))}
                value={state.logoPlacement}
                onChange={handlePlacementChange('logoPlacement')}
              />
              <RadioButtonGroup
                options={alignmentOptions.map((option) => ({
                  ...option,
                  disabled:
                    state.showPageNumbers &&
                    state.pageNumberPlacement === state.logoPlacement &&
                    state.pageNumberAlignment === option.value,
                }))}
                value={state.logoAlignment}
                onChange={handleAlignmentChange('logoAlignment')}
              />
            </div>
          </Field>
        )}

        <Field label="Display panel titles" description="Toggle panel title labels in the PDF.">
          <Switch
            value={state.showPanelTitles}
            onChange={handlePanelTitleToggle}
            data-testid={testIds.appConfig.panelTitles}
          />
        </Field>

        <Field label="Display page numbers" description={'Render "Page X of Y".'}>
          <Switch
            value={state.showPageNumbers}
            onChange={handlePageNumberToggle}
            data-testid={testIds.appConfig.pageNumbers}
          />
        </Field>

        {state.showPageNumbers && (
          <Field label="Page number placement">
            <div className={s.inlineControls}>
              <RadioButtonGroup
                options={placementOptions.map((option) => ({
                  ...option,
                  disabled:
                    state.logoUrl &&
                    state.logoEnabled &&
                    state.logoPlacement === option.value &&
                    state.logoAlignment === state.pageNumberAlignment,
                }))}
                value={state.pageNumberPlacement}
                onChange={handlePlacementChange('pageNumberPlacement')}
              />
              <RadioButtonGroup
                options={alignmentOptions.map((option) => ({
                  ...option,
                  disabled:
                    state.logoUrl &&
                    state.logoEnabled &&
                    state.logoPlacement === state.pageNumberPlacement &&
                    state.logoAlignment === option.value,
                }))}
                value={state.pageNumberAlignment}
                onChange={handleAlignmentChange('pageNumberAlignment')}
              />
            </div>
          </Field>
        )}
      </FieldSet>

      <div className={s.actions}>
        <Button type="submit" data-testid={testIds.appConfig.submit} disabled={isSubmitDisabled}>
          Save settings
        </Button>
      </div>
    </form>
  );
};

export default AppConfig;

const getStyles = (theme: GrafanaTheme2) => ({
  actions: css`
    margin-top: ${theme.spacing(3)};
  `,
  logoField: css`
    display: flex;
    flex-direction: column;
    gap: ${theme.spacing(1)};
  `,
  inlineControls: css`
    display: flex;
    flex-wrap: wrap;
    gap: ${theme.spacing(1)};
    align-items: center;
  `,
  logoRow: css`
    display: flex;
    flex-wrap: wrap;
    gap: ${theme.spacing(1)};
    align-items: center;

    input[type='text'] {
      flex: 1;
      min-width: 220px;
    }
  `,
  fileInput: css`
    position: relative;
    overflow: hidden;
    display: inline-flex;
    align-items: center;
    padding: ${theme.spacing(1)} ${theme.spacing(1.5)};
    border: 1px solid ${theme.colors.border.weak};
    border-radius: ${theme.shape.radius.default};
    cursor: pointer;
    background: ${theme.colors.background.secondary};
    font-size: ${theme.typography.bodySmall.fontSize};

    input[type='file'] {
      position: absolute;
      inset: 0;
      opacity: 0;
      cursor: pointer;
    }
  `,
  logoPreview: css`
    margin-top: ${theme.spacing(1)};
    padding: ${theme.spacing(1)};
    border-radius: ${theme.shape.radius.default};
    border: 1px dashed ${theme.colors.border.medium};
    background: ${theme.colors.background.secondary};
    max-width: 240px;

    img {
      max-width: 100%;
      height: auto;
      display: block;
    }
  `,
});

const updatePluginAndReload = async (pluginId: string, data: Partial<AppPluginMeta<ReporterPluginSettings>>) => {
  try {
    await updatePlugin(pluginId, data);
    window.location.reload();
  } catch (error) {
    console.error('Failed to update plugin configuration', error);
  }
};

const updatePlugin = async (pluginId: string, data: Partial<AppPluginMeta>) => {
  const response = await getBackendSrv().fetch({
    url: `/api/plugins/${pluginId}/settings`,
    method: 'POST',
    data,
  });

  return lastValueFrom(response);
};
