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
import { Button, useStyles2 } from '@grafana/ui';
import React, { useState } from 'react';
import { lastValueFrom } from 'rxjs';
import { getAppConfigStyles } from 'styles/appConfigStyles';
import {
  CustomElement,
  LayoutSettings,
  LogoLibraryItem,
  ReporterPluginSettings,
  ResolvedLayoutSettings,
  resolveLayoutSettings,
} from '../../types/reporting';
import { createLayoutDraft, mergeDraftValues, validateLayoutDraft } from '../../utils/layoutValidation';
import { createLogoId } from '../../utils/logoLibrary';
import LayoutSettingsForm from '../LayoutSettingsForm';
import LogoLibrary from '../LogoLibrary/LogoLibrary';
import { testIds } from '../testIds';

export interface AppConfigProps extends PluginConfigPageProps<AppPluginMeta<ReporterPluginSettings>> {}

const AppConfig = ({ plugin }: AppConfigProps) => {
  const s = useStyles2(getAppConfigStyles);
  const layout = resolveLayoutSettings(plugin.meta.jsonData?.layout);
  const savedLogos = plugin.meta.jsonData?.logos ?? [];

  // Migration: if there's no library yet but a logo is already configured, seed the library with the
  // current logo and select it, so the existing logo is preserved under the new library model.
  const [bootstrap] = useState(() => {
    if (savedLogos.length > 0) {
      return { logos: savedLogos, logoId: layout.logo.id };
    }
    if (layout.logo.url) {
      const id = createLogoId('current-logo', []);
      return { logos: [{ id, name: 'Current logo', dataUrl: layout.logo.url }], logoId: id };
    }
    return { logos: savedLogos, logoId: layout.logo.id };
  });

  const [state, setState] = useState<ResolvedLayoutSettings>({
    ...layout,
    logo: { ...layout.logo, id: bootstrap.logoId },
  });
  const [logos, setLogos] = useState<LogoLibraryItem[]>(bootstrap.logos);
  const [formError, setFormError] = useState<string>();

  const handleSelectDefaultLogo = (id: string | undefined) => {
    setState((prev) => ({
      ...prev,
      logo: {
        ...prev.logo,
        id: id ?? '',
        enabled: id ? true : prev.logo.enabled,
      },
    }));
  };

  const areCustomElementsEqual = (a?: CustomElement[], b?: CustomElement[]) => {
    const left = a ?? [];
    const right = b ?? [];
    if (left.length !== right.length) {
      return false;
    }
    return left.every((item, index) => {
      const other = right[index] ?? {};
      return (
        item.type === other.type &&
        item.content === (other as CustomElement).content &&
        item.placement === (other as CustomElement).placement &&
        item.alignment === (other as CustomElement).alignment &&
        item.fontFamily === (other as CustomElement).fontFamily &&
        item.fontSize === (other as CustomElement).fontSize &&
        item.fontColor === (other as CustomElement).fontColor
      );
    });
  };

  const areLogosEqual = (a: LogoLibraryItem[], b: LogoLibraryItem[]) =>
    a.length === b.length &&
    a.every((item, index) => {
      const other = b[index];
      return other && item.id === other.id && item.name === other.name && item.dataUrl === other.dataUrl;
    });

  const isSubmitDisabled =
    areLogosEqual(logos, savedLogos) &&
    state.logo.id === layout.logo.id &&
    state.orientation === layout.orientation &&
    state.pageMargin === layout.pageMargin &&
    state.header.lineHeight === layout.header.lineHeight &&
    state.header.padding === layout.header.padding &&
    state.footer.padding === layout.footer.padding &&
    state.footer.lineHeight === layout.footer.lineHeight &&
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
    state.pageNumber.alignment === layout.pageNumber.alignment &&
    state.pageNumber.language === layout.pageNumber.language &&
    state.pageNumber.fontFamily === layout.pageNumber.fontFamily &&
    state.pageNumber.fontColor === layout.pageNumber.fontColor &&
    state.pageNumber.fontSize === layout.pageNumber.fontSize &&
    areCustomElementsEqual(state.customElements, layout.customElements);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isSubmitDisabled) {
      return;
    }

    const draft = createLayoutDraft(state);
    const validation = validateLayoutDraft(draft);
    if (!validation.values) {
      const firstError = Object.values(validation.errors ?? {}).find(Boolean);
      setFormError(firstError ?? 'Fix the highlighted errors.');
      return;
    }
    setFormError(undefined);

    const nextLayout = mergeDraftValues(state, validation.values);
    const normalizedLayout: LayoutSettings = {
      ...nextLayout,
      logo: {
        ...nextLayout.logo,
        url: nextLayout.logo.url?.trim() ?? '',
      },
    };

    await updatePluginAndReload(plugin.meta.id, {
      enabled: plugin.meta.enabled,
      pinned: plugin.meta.pinned,
      jsonData: {
        ...plugin.meta.jsonData,
        layout: normalizedLayout,
        logos,
      },
    });
  };

  return (
    <div className={s.container}>
      <form onSubmit={onSubmit} className={s.form}>
        <LogoLibrary
          logos={logos}
          selectedId={state.logo.id || undefined}
          onChange={setLogos}
          onSelect={handleSelectDefaultLogo}
        />

        <LayoutSettingsForm
          layout={state}
          initialOpen={true}
          setLayout={setState}
          showLogoUpload={false}
          logoAvailable
          dataTestIds={{
            panelsPerPage: testIds.appConfig.panelsPerPage,
            panelsSpacing: testIds.appConfig.panelsSpacing,
            orientation: testIds.appConfig.orientation,
            logoEnabled: testIds.appConfig.logoEnabled,
            panelsTitles: testIds.appConfig.panelsTitles,
            pageNumbers: testIds.appConfig.pageNumbers,
            logo: testIds.appConfig.logo,
          }}
        />

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
