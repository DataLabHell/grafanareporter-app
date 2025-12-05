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

import React, { useMemo } from 'react';
import { CustomTextElement, DEFAULT_FONT_FAMILY, FontStyle, LayoutSettings } from '../types/reporting';
import { deriveNumericValues, mergeLayoutPatch, numericFieldToPatch } from '../utils/layoutForm';
import { LayoutDraftErrors, LayoutNumericField } from '../utils/layoutValidation';
import LayoutFormFields from './LayoutFormFields';

type LayoutSetter<TLayout extends LayoutSettings> = React.Dispatch<React.SetStateAction<TLayout>>;

interface Props<TLayout extends LayoutSettings = LayoutSettings> {
  layout: TLayout;
  setLayout: LayoutSetter<TLayout>;
  numericValues?: Partial<Record<LayoutNumericField, string | number>>;
  onNumericChange?: (field: LayoutNumericField, value: string) => void;
  errors?: LayoutDraftErrors;
  showLogoUpload?: boolean;
  logoAvailable?: boolean;
  initialOpen?: boolean;
  dataTestIds?: {
    panelsPerPage?: string;
    panelsSpacing?: string;
    orientation?: string;
    reportTheme?: string;
    logoEnabled?: string;
    panelsTitles?: string;
    pageNumbers?: string;
    logo?: string;
  };
}

export const LayoutSettingsForm = <TLayout extends LayoutSettings = LayoutSettings>({
  layout,
  setLayout,
  numericValues,
  onNumericChange,
  errors,
  showLogoUpload = false,
  logoAvailable = true,
  initialOpen = false,
  dataTestIds,
}: Props<TLayout>) => {
  const applyLayoutPatch = (patch: Partial<LayoutSettings>) => {
    setLayout((prev) => mergeLayoutPatch(prev, patch) as TLayout);
  };

  const handleOrientationChange = (value: string) => {
    if (value === 'portrait' || value === 'landscape') {
      applyLayoutPatch({ orientation: value });
    }
  };

  const handleReportThemeChange = (value: string) => {
    if (value === 'dark' || value === 'light') {
      applyLayoutPatch({ reportTheme: value });
    }
  };

  const handleLogoToggle = (checked: boolean) => {
    applyLayoutPatch({ logo: { ...(layout.logo || {}), enabled: checked } });
  };

  const handlePageNumberToggle = (checked: boolean) => {
    applyLayoutPatch({ pageNumber: { ...(layout.pageNumber || {}), enabled: checked } });
  };

  const handlePanelTitleToggle = (checked: boolean) => {
    applyLayoutPatch({
      panels: { ...(layout.panels || {}), title: { ...(layout.panels?.title || {}), enabled: checked } },
    });
  };

  const handlePanelTitleFontFamilyChange = (value: string) => {
    applyLayoutPatch({
      panels: { ...(layout.panels || {}), title: { ...(layout.panels?.title || {}), fontFamily: value } },
    });
  };

  const handlePanelTitleFontColorChange = (value: string) => {
    applyLayoutPatch({
      panels: { ...(layout.panels || {}), title: { ...(layout.panels?.title || {}), fontColor: value } },
    });
  };

  const handlePanelTitleFontStyleChange = (value: FontStyle | undefined) => {
    applyLayoutPatch({
      panels: { ...(layout.panels || {}), title: { ...(layout.panels?.title || {}), fontStyle: value } },
    });
  };

  const handlePageNumberFontFamilyChange = (value: string) => {
    applyLayoutPatch({
      pageNumber: { ...(layout.pageNumber || {}), fontFamily: value },
    });
  };

  const handlePageNumberFontColorChange = (value: string) => {
    applyLayoutPatch({
      pageNumber: { ...(layout.pageNumber || {}), fontColor: value },
    });
  };

  const handlePageNumberFontStyleChange = (value: FontStyle | undefined) => {
    applyLayoutPatch({
      pageNumber: { ...(layout.pageNumber || {}), fontStyle: value },
    });
  };

  const handlePageNumberLanguageChange = (value: string) => {
    applyLayoutPatch({
      pageNumber: { ...(layout.pageNumber || {}), language: value },
    });
  };

  const handlePlacementChange = (key: 'logoPlacement' | 'pageNumberPlacement') => (value: string | null) => {
    if (value === 'header' || value === 'footer') {
      applyLayoutPatch(
        key === 'logoPlacement'
          ? { logo: { ...(layout.logo || {}), placement: value } }
          : { pageNumber: { ...(layout.pageNumber || {}), placement: value } }
      );
    }
  };

  const handleAlignmentChange = (key: 'logoAlignment' | 'pageNumberAlignment') => (value: string | null) => {
    if (value === 'left' || value === 'center' || value === 'right') {
      applyLayoutPatch(
        key === 'logoAlignment'
          ? { logo: { ...(layout.logo || {}), alignment: value } }
          : { pageNumber: { ...(layout.pageNumber || {}), alignment: value } }
      );
    }
  };

  const handleLogoUrlChange = (value: string) => {
    applyLayoutPatch({ logo: { ...(layout.logo || {}), url: value } });
  };

  const handleLogoFileChange = (file: File | null) => {
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        applyLayoutPatch({ logo: { ...(layout.logo || {}), url: reader.result as string } });
      }
    };
    reader.readAsDataURL(file);
  };

  const handleClearLogo = () => {
    applyLayoutPatch({ logo: { ...(layout.logo || {}), url: '' } });
  };

  const handleAddCustomElement = () => {
    const next: CustomTextElement = {
      type: 'text',
      content: '',
      placement: 'header',
      alignment: 'left',
      fontFamily: layout.pageNumber?.fontFamily || DEFAULT_FONT_FAMILY,
      fontStyle: layout.pageNumber?.fontStyle,
      fontSize: layout.pageNumber?.fontSize || 10,
      fontColor: layout.pageNumber?.fontColor || '#000000',
    };
    applyLayoutPatch({ customElements: [...(layout.customElements || []), next] });
  };

  const handleUpdateCustomElement = (index: number, patch: Partial<CustomTextElement>) => {
    const next = (layout.customElements || []).map((el, idx) => (idx === index ? { ...el, ...patch } : el));
    applyLayoutPatch({ customElements: next });
  };

  const handleRemoveCustomElement = (index: number) => {
    applyLayoutPatch({ customElements: (layout.customElements || []).filter((_, idx) => idx !== index) });
  };

  const derivedNumericValues = useMemo(() => numericValues ?? deriveNumericValues(layout), [layout, numericValues]);

  const handleNumericChange =
    onNumericChange ||
    ((field: LayoutNumericField, value: string) => {
      const numeric = Number(value);
      if (!Number.isFinite(numeric)) {
        return;
      }
      applyLayoutPatch(numericFieldToPatch(field, numeric));
    });

  return (
    <LayoutFormFields
      layout={layout}
      numericValues={derivedNumericValues}
      errors={errors}
      initialOpen={initialOpen}
      onNumericChange={handleNumericChange}
      onOrientationChange={handleOrientationChange}
      onReportThemeChange={handleReportThemeChange}
      onLogoToggle={handleLogoToggle}
      onPageNumberToggle={handlePageNumberToggle}
      onPanelTitleToggle={handlePanelTitleToggle}
      onPanelTitleFontFamilyChange={handlePanelTitleFontFamilyChange}
      onPanelTitleFontStyleChange={handlePanelTitleFontStyleChange}
      onPanelTitleFontColorChange={handlePanelTitleFontColorChange}
      onPageNumberFontFamilyChange={handlePageNumberFontFamilyChange}
      onPageNumberFontStyleChange={handlePageNumberFontStyleChange}
      onPageNumberFontColorChange={handlePageNumberFontColorChange}
      onPageNumberLanguageChange={handlePageNumberLanguageChange}
      customElements={layout.customElements}
      onAddCustomElement={handleAddCustomElement}
      onUpdateCustomElement={handleUpdateCustomElement}
      onRemoveCustomElement={handleRemoveCustomElement}
      onLogoPlacementChange={(value) => handlePlacementChange('logoPlacement')(value)}
      onPagePlacementChange={(value) => handlePlacementChange('pageNumberPlacement')(value)}
      onLogoAlignmentChange={(value) => handleAlignmentChange('logoAlignment')(value)}
      onPageAlignmentChange={(value) => handleAlignmentChange('pageNumberAlignment')(value)}
      onLogoUrlChange={showLogoUpload ? handleLogoUrlChange : undefined}
      onLogoFileChange={showLogoUpload ? handleLogoFileChange : undefined}
      onClearLogo={showLogoUpload ? handleClearLogo : undefined}
      showLogoUpload={showLogoUpload}
      logoAvailable={logoAvailable}
      dataTestIds={dataTestIds}
    />
  );
};

export default LayoutSettingsForm;
