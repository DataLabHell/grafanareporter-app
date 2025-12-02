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

import { AppPluginMeta, PluginConfigPageProps } from '@grafana/data';
import { getBackendSrv } from '@grafana/runtime';
import { Button, Field, FieldSet, Input, RadioButtonGroup, Switch, useStyles2 } from '@grafana/ui';
import React, { useState } from 'react';
import { lastValueFrom } from 'rxjs';
import { getAppConfigStyles } from 'styles/appConfigStyles';
import {
  BrandingAlignment,
  BrandingPlacement,
  ReporterPluginSettings,
  ReportOrientation,
  resolveLayoutSettings,
} from '../../types/reporting';
import { createLayoutDraft, LayoutDraft, LayoutNumericField, validateLayoutDraft } from '../../utils/layoutValidation';
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

const layoutNumericFields: LayoutNumericField[] = [
  'panelsPerPage',
  'panelSpacing',
  'panelTitleFontSize',
  'renderWidth',
  'renderHeight',
  'pageMargin',
  'brandingLogoMaxWidth',
  'brandingLogoMaxHeight',
  'brandingTextLineHeight',
  'brandingSectionPadding',
];

type LayoutFormState = LayoutDraft & {
  orientation: ReportOrientation;
  logoUrl: string;
  logoEnabled: boolean;
  showPageNumbers: boolean;
  showPanelTitles: boolean;
  logoPlacement: BrandingPlacement;
  logoAlignment: BrandingAlignment;
  pageNumberPlacement: BrandingPlacement;
  pageNumberAlignment: BrandingAlignment;
};

type NumericValidationResult =
  | { error: string }
  | {
      panelsPerPage: number;
      panelSpacing: number;
      panelTitleFontSize: number;
      renderWidth: number;
      renderHeight: number;
      pageMargin: number;
      brandingLogoMaxWidth: number;
      brandingLogoMaxHeight: number;
      brandingTextLineHeight: number;
      brandingSectionPadding: number;
    };

const pickLayoutDraft = (form: LayoutFormState): LayoutDraft => ({
  panelsPerPage: form.panelsPerPage,
  panelSpacing: form.panelSpacing,
  panelTitleFontSize: form.panelTitleFontSize,
  renderWidth: form.renderWidth,
  renderHeight: form.renderHeight,
  pageMargin: form.pageMargin,
  brandingLogoMaxWidth: form.brandingLogoMaxWidth,
  brandingLogoMaxHeight: form.brandingLogoMaxHeight,
  brandingTextLineHeight: form.brandingTextLineHeight,
  brandingSectionPadding: form.brandingSectionPadding,
});

const validateNumericFields = (state: LayoutFormState): NumericValidationResult => {
  const validation = validateLayoutDraft(pickLayoutDraft(state));

  if (!validation.values) {
    const message = validation.errors ? Object.values(validation.errors).find(Boolean) : undefined;
    return { error: message ?? 'Invalid layout values' };
  }

  const values = validation.values;
  return {
    panelsPerPage: values.panelsPerPage,
    panelSpacing: values.panelSpacing,
    panelTitleFontSize: values.panelTitleFontSize,
    renderWidth: values.renderWidth,
    renderHeight: values.renderHeight,
    pageMargin: values.pageMargin,
    brandingLogoMaxWidth: values.brandingLogoMaxWidth,
    brandingLogoMaxHeight: values.brandingLogoMaxHeight,
    brandingTextLineHeight: values.brandingTextLineHeight,
    brandingSectionPadding: values.brandingSectionPadding,
  };
};

const AppConfig = ({ plugin }: AppConfigProps) => {
  const s = useStyles2(getAppConfigStyles);
  const layout = resolveLayoutSettings(plugin.meta.jsonData?.layout);
  const [state, setState] = useState<LayoutFormState>({
    ...createLayoutDraft(layout),
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
  const [formError, setFormError] = useState<string>();

  const onNumberChange = (key: keyof LayoutFormState) => (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setState((prev) => ({
      ...prev,
      [key]: value,
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

  const numericUnchanged = layoutNumericFields.every((key) => state[key] === String(layout[key] ?? ''));

  const isSubmitDisabled =
    numericUnchanged &&
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

    const parsed = validateNumericFields(state);
    if ('error' in parsed) {
      setFormError(parsed.error);
      return;
    }
    setFormError(undefined);

    await updatePluginAndReload(plugin.meta.id, {
      enabled: plugin.meta.enabled,
      pinned: plugin.meta.pinned,
      jsonData: {
        ...plugin.meta.jsonData,
        layout: {
          panelsPerPage: parsed.panelsPerPage,
          panelSpacing: parsed.panelSpacing,
          panelTitleFontSize: parsed.panelTitleFontSize,
          orientation: state.orientation,
          logoUrl: state.logoUrl?.trim() ?? '',
          logoEnabled: state.logoEnabled,
          showPageNumbers: state.showPageNumbers,
          showPanelTitles: state.showPanelTitles,
          logoPlacement: state.logoPlacement,
          logoAlignment: state.logoAlignment,
          pageNumberPlacement: state.pageNumberPlacement,
          pageNumberAlignment: state.pageNumberAlignment,
          renderWidth: parsed.renderWidth,
          renderHeight: parsed.renderHeight,
          pageMargin: parsed.pageMargin,
          brandingLogoMaxWidth: parsed.brandingLogoMaxWidth,
          brandingLogoMaxHeight: parsed.brandingLogoMaxHeight,
          brandingTextLineHeight: parsed.brandingTextLineHeight,
          brandingSectionPadding: parsed.brandingSectionPadding,
        },
      },
    });
  };

  return (
    <div className={s.container}>
      <form onSubmit={onSubmit} className={s.form}>
        <FieldSet label="Default Report Layout">
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

          <Field label="Page margin (pt)">
            <Input type="number" min={0} step={1} value={state.pageMargin} onChange={onNumberChange('pageMargin')} />
          </Field>
        </FieldSet>

        <FieldSet label="Panel Settings">
          <Field label="Panel render width (px)">
            <Input
              type="number"
              min={100}
              step={10}
              value={state.renderWidth}
              onChange={onNumberChange('renderWidth')}
            />
          </Field>
          <Field label="Panel render height (px)">
            <Input
              type="number"
              min={100}
              step={10}
              value={state.renderHeight}
              onChange={onNumberChange('renderHeight')}
            />
          </Field>
        </FieldSet>

        <FieldSet label="Branding">
          <Field label="Display logo">
            <Switch
              value={state.logoEnabled}
              onChange={handleLogoEnabledToggle}
              disabled={!state.logoUrl}
              data-testid={testIds.appConfig.logoEnabled}
            />
          </Field>

          {state.logoUrl && state.logoEnabled && (
            <div>
              <Field
                label="Logo"
                description="Paste an image URL or upload a file to display in the PDF."
                data-testid={testIds.appConfig.logo}
              >
                <div className={s.logoField}>
                  <div className={s.logoRow}>
                    <Input
                      placeholder="https://example.com/logo.png or data:image/png;base64..."
                      value={state.logoUrl}
                      onChange={handleLogoUrlChange}
                      data-testid={testIds.appConfig.logo}
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
              <Field label="Logo max width (pt)">
                <Input
                  type="number"
                  min={1}
                  step={1}
                  value={state.brandingLogoMaxWidth}
                  onChange={onNumberChange('brandingLogoMaxWidth')}
                />
              </Field>
              <Field label="Logo max height (pt)">
                <Input
                  type="number"
                  min={1}
                  step={1}
                  value={state.brandingLogoMaxHeight}
                  onChange={onNumberChange('brandingLogoMaxHeight')}
                />
              </Field>
            </div>
          )}

          <Field label="Page Number text height (pt)">
            <Input
              type="number"
              min={1}
              step={1}
              value={state.brandingTextLineHeight}
              onChange={onNumberChange('brandingTextLineHeight')}
            />
          </Field>
          <Field label="Branding padding (pt)" description="Space around the branding section.">
            <Input
              type="number"
              min={0}
              step={1}
              value={state.brandingSectionPadding}
              onChange={onNumberChange('brandingSectionPadding')}
            />
          </Field>

          <Field label="Display panel titles" description="Toggle panel title labels in the PDF.">
            <Switch
              value={state.showPanelTitles}
              onChange={handlePanelTitleToggle}
              data-testid={testIds.appConfig.panelTitles}
            />
          </Field>
          <Field label="Panel title font size (pt)">
            <Input
              type="number"
              min={1}
              step={1}
              value={state.panelTitleFontSize}
              onChange={onNumberChange('panelTitleFontSize')}
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
          {formError && <div className={s.error}>{formError}</div>}
          <Button type="submit" data-testid={testIds.appConfig.submit} disabled={isSubmitDisabled}>
            Save settings
          </Button>
        </div>
      </form>
    </div>
  );
};

export default AppConfig;

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
