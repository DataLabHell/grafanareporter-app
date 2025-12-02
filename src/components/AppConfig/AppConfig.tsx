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
  alignmentOptions,
  LayoutAlignment,
  LayoutPlacement,
  LayoutSettings,
  orientationOptions,
  placementOptions,
  ReporterPluginSettings,
  ReportOrientation,
  resolveLayoutSettings,
} from '../../types/reporting';
import { testIds } from '../testIds';

export interface AppConfigProps extends PluginConfigPageProps<AppPluginMeta<ReporterPluginSettings>> {}

type LayoutFormState = {
  orientation: ReportOrientation;
  pageMargin: number;
  brandingTextLineHeight: number;
  brandingSectionPadding: number;
  panels: {
    perPage: number;
    spacing: number;
    width: number;
    height: number;
    title: {
      enabled: boolean;
      fontSize: number;
      fontFamily: string;
      fontColor: string;
    };
  };
  logo: {
    enabled: boolean;
    url: string;
    placement: LayoutPlacement;
    alignment: LayoutAlignment;
    width: number;
    height: number;
  };
  pageNumber: {
    enabled: boolean;
    placement: LayoutPlacement;
    alignment: LayoutAlignment;
  };
};

const validateNumericFields = (state: LayoutFormState) => {
  const fields: Array<[number, string, number]> = [
    [state.panels.perPage, 'Panels per page', 1],
    [state.panels.spacing, 'Panels spacing', 0],
    [state.panels.title.fontSize, 'Panels title font size', 1],
    [state.panels.width, 'Panels render width', 100],
    [state.panels.height, 'Panels render height', 100],
    [state.pageMargin, 'Page margin', 0],
    [state.logo.width, 'Logo max width', 1],
    [state.logo.height, 'Logo max height', 1],
    [state.brandingTextLineHeight, 'Text height', 1],
    [state.brandingSectionPadding, 'Branding padding', 0],
  ];

  for (const [value, label, min] of fields) {
    if (!Number.isFinite(value)) {
      return { error: `${label} must be a number` };
    }
    if (value < min) {
      return { error: `${label} must be at least ${min}` };
    }
  }

  return {
    panels: {
      perPage: state.panels.perPage,
      spacing: state.panels.spacing,
      width: state.panels.width,
      height: state.panels.height,
      titleFontSize: state.panels.title.fontSize,
    },
    pageMargin: state.pageMargin,
    logo: {
      width: state.logo.width,
      height: state.logo.height,
    },
    brandingTextLineHeight: state.brandingTextLineHeight,
    brandingSectionPadding: state.brandingSectionPadding,
  };
};

const AppConfig = ({ plugin }: AppConfigProps) => {
  const s = useStyles2(getAppConfigStyles);
  const layout = resolveLayoutSettings(plugin.meta.jsonData?.layout);
  const [state, setState] = useState<LayoutFormState>({
    orientation: layout.orientation,
    pageMargin: layout.pageMargin,
    brandingTextLineHeight: layout.brandingTextLineHeight,
    brandingSectionPadding: layout.brandingSectionPadding,
    panels: {
      perPage: layout.panels?.perPage ?? 0,
      spacing: layout.panels?.spacing ?? 0,
      width: layout.panels?.width ?? 0,
      height: layout.panels?.height ?? 0,
      title: {
        enabled: layout.panels?.title?.enabled ?? true,
        fontSize: layout.panels?.title?.fontSize ?? 0,
        fontFamily: layout.panels?.title?.fontFamily ?? '',
        fontColor: layout.panels?.title?.fontColor ?? '',
      },
    },
    logo: {
      enabled: layout.logo?.enabled ?? false,
      url: layout.logo?.url ?? '',
      placement: layout.logo?.placement ?? 'footer',
      alignment: layout.logo?.alignment ?? 'left',
      width: layout.logo?.width ?? 0,
      height: layout.logo?.height ?? 0,
    },
    pageNumber: {
      enabled: layout.pageNumber?.enabled ?? false,
      placement: layout.pageNumber?.placement ?? 'footer',
      alignment: layout.pageNumber?.alignment ?? 'right',
    },
  });
  const [formError, setFormError] = useState<string>();

  const setPanelsField =
    (field: keyof Omit<LayoutFormState['panels'], 'title'>) => (event: React.ChangeEvent<HTMLInputElement>) => {
      const value = Number(event.target.value);
      setState((prev) => ({
        ...prev,
        panels: {
          ...prev.panels,
          [field]: value,
        },
      }));
    };

  const setLogoField = (field: keyof LayoutFormState['logo']) => (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = field === 'url' ? event.target.value : Number(event.target.value);
    setState((prev) => ({
      ...prev,
      logo: {
        ...prev.logo,
        [field]: value,
      },
    }));
  };

  const setPanelsTitleField =
    (field: keyof LayoutFormState['panels']['title']) => (event: React.ChangeEvent<HTMLInputElement>) => {
      const value =
        field === 'enabled'
          ? event.target.checked
          : field === 'fontSize'
          ? Number(event.target.value)
          : event.target.value;
      setState((prev) => ({
        ...prev,
        panels: {
          ...prev.panels,
          title: {
            ...prev.panels.title,
            [field]: value as any,
          },
        },
      }));
    };

  const setNumberField =
    (field: keyof Pick<LayoutFormState, 'pageMargin' | 'brandingTextLineHeight' | 'brandingSectionPadding'>) =>
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const value = Number(event.target.value);
      setState((prev) => ({
        ...prev,
        [field]: value,
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
      logo: { ...prev.logo, url: value },
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
          logo: { ...prev.logo, url: reader.result as string },
        }));
      }
    };
    reader.readAsDataURL(file);
  };

  const handleClearLogo = () => {
    setState((prev) => ({
      ...prev,
      logo: { ...prev.logo, url: '', enabled: false },
    }));
  };

  const handleLogoEnabledToggle = (event: React.ChangeEvent<HTMLInputElement>) => {
    setState((prev) => ({
      ...prev,
      logo: { ...prev.logo, enabled: event.target.checked },
    }));
  };

  const handlePlacementChange = (key: 'logoPlacement' | 'pageNumberPlacement') => (value: string | null) => {
    if (value === 'header' || value === 'footer') {
      setState((prev) => ({
        ...prev,
        ...(key === 'logoPlacement'
          ? { logo: { ...prev.logo, placement: value } }
          : { pageNumber: { ...prev.pageNumber, placement: value } }),
      }));
    }
  };

  const handleAlignmentChange = (key: 'logoAlignment' | 'pageNumberAlignment') => (value: string | null) => {
    if (value === 'left' || value === 'center' || value === 'right') {
      setState((prev) => ({
        ...prev,
        ...(key === 'logoAlignment'
          ? { logo: { ...prev.logo, alignment: value } }
          : { pageNumber: { ...prev.pageNumber, alignment: value } }),
      }));
    }
  };

  const handlePageNumberToggle = (event: React.ChangeEvent<HTMLInputElement>) => {
    setState((prev) => ({
      ...prev,
      pageNumber: { ...prev.pageNumber, enabled: event.target.checked },
    }));
  };

  const handlePanelTitleToggle = (event: React.ChangeEvent<HTMLInputElement>) => {
    setState((prev) => ({
      ...prev,
      panels: { ...prev.panels, title: { ...prev.panels.title, enabled: event.target.checked } },
    }));
  };

  const isSubmitDisabled =
    state.orientation === layout.orientation &&
    state.pageMargin === layout.pageMargin &&
    state.brandingTextLineHeight === layout.brandingTextLineHeight &&
    state.brandingSectionPadding === layout.brandingSectionPadding &&
    state.panels.perPage === layout.panels.perPage &&
    state.panels.spacing === layout.panels.spacing &&
    state.panels.width === layout.panels.width &&
    state.panels.height === layout.panels.height &&
    state.panels.title.enabled === layout.panels.title.enabled &&
    state.panels.title.fontSize === layout.panels.title.fontSize &&
    state.panels.title.fontFamily === layout.panels.title.fontFamily &&
    state.panels.title.fontColor === layout.panels.title.fontColor &&
    state.logo.enabled === layout.logo.enabled &&
    state.logo.url === layout.logo.url &&
    state.logo.placement === layout.logo.placement &&
    state.logo.alignment === layout.logo.alignment &&
    state.logo.width === layout.logo.width &&
    state.logo.height === layout.logo.height &&
    state.pageNumber.enabled === layout.pageNumber.enabled &&
    state.pageNumber.placement === layout.pageNumber.placement &&
    state.pageNumber.alignment === layout.pageNumber.alignment;

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

    const nextLayout: LayoutSettings = {
      orientation: state.orientation,
      pageMargin: state.pageMargin,
      brandingTextLineHeight: parsed.brandingTextLineHeight,
      brandingSectionPadding: parsed.brandingSectionPadding,
      panels: {
        perPage: parsed.panels.perPage,
        spacing: parsed.panels.spacing,
        width: parsed.panels.width,
        height: parsed.panels.height,
        title: {
          enabled: state.panels.title.enabled,
          fontFamily: state.panels.title.fontFamily,
          fontSize: parsed.panels.titleFontSize,
          fontColor: state.panels.title.fontColor,
        },
      },
      logo: {
        enabled: state.logo.enabled,
        url: state.logo.url?.trim() ?? '',
        placement: state.logo.placement,
        alignment: state.logo.alignment,
        width: parsed.logo.width,
        height: parsed.logo.height,
      },
      pageNumber: {
        enabled: state.pageNumber.enabled,
        placement: state.pageNumber.placement,
        alignment: state.pageNumber.alignment,
      },
      customElements: layout.customElements ?? [],
    };

    await updatePluginAndReload(plugin.meta.id, {
      enabled: plugin.meta.enabled,
      pinned: plugin.meta.pinned,
      jsonData: {
        ...plugin.meta.jsonData,
        layout: nextLayout,
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
              value={state.panels.perPage}
              onChange={setPanelsField('perPage')}
              data-testid={testIds.appConfig.panelsPerPage}
            />
          </Field>

          <Field label="Panels spacing (pt)" description="Vertical space between panels on the same page.">
            <Input
              type="number"
              min={0}
              step={1}
              value={state.panels.spacing}
              onChange={setPanelsField('spacing')}
              data-testid={testIds.appConfig.panelsSpacing}
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
            <Input type="number" min={0} step={1} value={state.pageMargin} onChange={setNumberField('pageMargin')} />
          </Field>
        </FieldSet>

        <FieldSet label="Panel Settings">
          <Field label="Panel render width (px)">
            <Input type="number" min={100} step={10} value={state.panels.width} onChange={setPanelsField('width')} />
          </Field>
          <Field label="Panel render height (px)">
            <Input type="number" min={100} step={10} value={state.panels.height} onChange={setPanelsField('height')} />
          </Field>
        </FieldSet>

        <FieldSet label="Branding">
          <Field label="Display logo">
            <Switch
              value={state.logo.enabled}
              onChange={handleLogoEnabledToggle}
              disabled={!state.logo.url}
              data-testid={testIds.appConfig.logoEnabled}
            />
          </Field>

          {state.logo.url && state.logo.enabled && (
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
                      value={state.logo.url}
                      onChange={handleLogoUrlChange}
                      data-testid={testIds.appConfig.logo}
                    />
                    <label className={s.fileInput}>
                      <span>Select image</span>
                      <input type="file" accept="image/*" onChange={handleLogoFileChange} />
                    </label>
                    {state.logo.url && (
                      <Button variant="secondary" type="button" onClick={handleClearLogo}>
                        Clear
                      </Button>
                    )}
                  </div>
                  {state.logo.url && (
                    <div className={s.logoPreview}>
                      <img src={state.logo.url} alt="Logo preview" />
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
                        state.pageNumber.enabled &&
                        state.pageNumber.placement === option.value &&
                        state.pageNumber.alignment === state.logo.alignment,
                    }))}
                    value={state.logo.placement}
                    onChange={handlePlacementChange('logoPlacement')}
                  />
                  <RadioButtonGroup
                    options={alignmentOptions.map((option) => ({
                      ...option,
                      disabled:
                        state.pageNumber.enabled &&
                        state.pageNumber.placement === state.logo.placement &&
                        state.pageNumber.alignment === option.value,
                    }))}
                    value={state.logo.alignment}
                    onChange={handleAlignmentChange('logoAlignment')}
                  />
                </div>
              </Field>
              <Field label="Logo max width (pt)">
                <Input type="number" min={1} step={1} value={state.logo.width} onChange={setLogoField('width')} />
              </Field>
              <Field label="Logo max height (pt)">
                <Input type="number" min={1} step={1} value={state.logo.height} onChange={setLogoField('height')} />
              </Field>
            </div>
          )}

          <Field label="Page Number text height (pt)">
            <Input
              type="number"
              min={1}
              step={1}
              value={state.brandingTextLineHeight}
              onChange={setNumberField('brandingTextLineHeight')}
            />
          </Field>
          <Field label="Branding padding (pt)" description="Space around the branding section.">
            <Input
              type="number"
              min={0}
              step={1}
              value={state.brandingSectionPadding}
              onChange={setNumberField('brandingSectionPadding')}
            />
          </Field>

          <Field label="Display panel titles" description="Toggle panel title labels in the PDF.">
            <Switch
              value={state.panels.title.enabled}
              onChange={handlePanelTitleToggle}
              data-testid={testIds.appConfig.panelsTitles}
            />
          </Field>
          <Field label="Panel title font size (pt)">
            <Input
              type="number"
              min={1}
              step={1}
              value={state.panels.title.fontSize}
              onChange={setPanelsTitleField('fontSize')}
            />
          </Field>

          <Field label="Display page numbers" description={'Render "Page X of Y".'}>
            <Switch
              value={state.pageNumber.enabled}
              onChange={handlePageNumberToggle}
              data-testid={testIds.appConfig.pageNumbers}
            />
          </Field>

          {state.pageNumber.enabled && (
            <Field label="Page number placement">
              <div className={s.inlineControls}>
                <RadioButtonGroup
                  options={placementOptions.map((option) => ({
                    ...option,
                    disabled:
                      state.logo.url &&
                      state.logo.enabled &&
                      state.logo.placement === option.value &&
                      state.logo.alignment === state.pageNumber.alignment,
                  }))}
                  value={state.pageNumber.placement}
                  onChange={handlePlacementChange('pageNumberPlacement')}
                />
                <RadioButtonGroup
                  options={alignmentOptions.map((option) => ({
                    ...option,
                    disabled:
                      state.logo.url &&
                      state.logo.enabled &&
                      state.logo.placement === state.pageNumber.placement &&
                      state.logo.alignment === option.value,
                  }))}
                  value={state.pageNumber.alignment}
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
