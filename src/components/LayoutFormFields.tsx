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

import {
  Button,
  CollapsableSection,
  ColorPickerInput,
  Field,
  FieldSet,
  Input,
  RadioButtonGroup,
  Select,
  Switch,
  useStyles2,
} from '@grafana/ui';
import React, { useRef } from 'react';
import { getAppConfigStyles } from 'styles/appConfigStyles';
import {
  DEFAULT_FONT_FAMILY,
  fontStyleOptions,
  FontStyle,
  LayoutAlignment,
  LayoutPlacement,
  LayoutSettings,
  alignmentOptions,
  fontFamilyOptions,
  orientationOptions,
  placementOptions,
  themeOptions,
  CustomTextElement,
} from '../types/reporting';
import { LAYOUT_FIELD_LABELS, LAYOUT_NUMERIC_FIELD_LABELS } from '../utils/layoutFields';
import { LAYOUT_NUMERIC_CONSTRAINTS, LayoutDraftErrors, LayoutNumericField } from '../utils/layoutValidation';

interface Props {
  layout: LayoutSettings;
  numericValues: Partial<Record<LayoutNumericField, string | number>>;
  errors?: LayoutDraftErrors;
  initialOpen?: boolean;
  onNumericChange: (field: LayoutNumericField, value: string) => void;
  onOrientationChange: (value: string) => void;
  onReportThemeChange: (value: string) => void;
  onLogoToggle: (checked: boolean) => void;
  onPageNumberToggle: (checked: boolean) => void;
  onPanelTitleToggle: (checked: boolean) => void;
  onPanelTitleFontFamilyChange?: (value: string) => void;
  onPanelTitleFontStyleChange?: (value: FontStyle | undefined) => void;
  onPanelTitleFontColorChange?: (value: string) => void;
  onPageNumberFontFamilyChange?: (value: string) => void;
  onPageNumberFontStyleChange?: (value: FontStyle | undefined) => void;
  onPageNumberFontColorChange?: (value: string) => void;
  onPageNumberLanguageChange?: (value: string) => void;
  onLogoPlacementChange: (value: LayoutPlacement) => void;
  onPagePlacementChange: (value: LayoutPlacement) => void;
  onLogoAlignmentChange: (value: LayoutAlignment) => void;
  onPageAlignmentChange: (value: LayoutAlignment) => void;
  onLogoUrlChange?: (value: string) => void;
  onLogoFileChange?: (file: File | null) => void;
  onClearLogo?: () => void;
  logoAvailable?: boolean;
  showLogoUpload?: boolean;
  customElements?: CustomTextElement[];
  onAddCustomElement?: () => void;
  onUpdateCustomElement?: (index: number, patch: Partial<CustomTextElement>) => void;
  onRemoveCustomElement?: (index: number) => void;
  dataTestIds?: {
    panelsPerPage?: string;
    panelsSpacing?: string;
    orientation?: string;
    logoEnabled?: string;
    panelsTitles?: string;
    pageNumbers?: string;
    logo?: string;
    reportTheme?: string;
  };
}

const NumericInput = ({
  field,
  step = 1,
  values,
  errors,
  onChange,
}: {
  field: LayoutNumericField;
  step?: number;
  values: Props['numericValues'];
  errors?: LayoutDraftErrors;
  onChange: Props['onNumericChange'];
}) => {
  const meta = LAYOUT_NUMERIC_CONSTRAINTS?.[field];
  const label = LAYOUT_NUMERIC_FIELD_LABELS[field]?.label;
  return (
    <Field
      label={label}
      invalid={Boolean(errors?.[field])}
      error={errors?.[field]}
      description={LAYOUT_NUMERIC_FIELD_LABELS[field]?.description}
    >
      <Input
        type="number"
        min={meta?.min}
        step={step}
        value={values[field] ?? ''}
        onChange={(event: React.ChangeEvent<HTMLInputElement>) => onChange(field, event.currentTarget.value)}
      />
    </Field>
  );
};

const toFontOption = (value?: string) => {
  if (!value) {
    return undefined;
  }
  return fontFamilyOptions.find((option) => option.value === value) ?? { label: value, value };
};

const toFontStyleOption = (value?: string) => {
  if (!value) {
    return undefined;
  }
  return fontStyleOptions.find((option) => option.value === value) ?? { label: value, value: value as any };
};

export const LayoutFormFields = ({
  layout,
  numericValues,
  errors,
  initialOpen = false,
  onNumericChange,
  onOrientationChange,
  onLogoToggle,
  onPageNumberToggle,
  onPanelTitleToggle,
  onPanelTitleFontFamilyChange,
  onPanelTitleFontStyleChange,
  onPanelTitleFontColorChange,
  onPageNumberFontFamilyChange,
  onPageNumberFontStyleChange,
  onPageNumberFontColorChange,
  onPageNumberLanguageChange,
  onLogoPlacementChange,
  onPagePlacementChange,
  onLogoAlignmentChange,
  onPageAlignmentChange,
  onReportThemeChange,
  onLogoUrlChange,
  onLogoFileChange,
  onClearLogo,
  logoAvailable = true,
  showLogoUpload = false,
  customElements,
  onAddCustomElement,
  onUpdateCustomElement,
  onRemoveCustomElement,
  dataTestIds,
}: Props) => {
  const logoEnabled = Boolean(layout.logo?.enabled);
  const pageNumbersEnabled = Boolean(layout.pageNumber?.enabled);
  const titlesEnabled = Boolean(layout.panels?.title?.enabled);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const s = useStyles2(getAppConfigStyles);

  return (
    <>
      <CollapsableSection label={LAYOUT_FIELD_LABELS.sections.defaultLayout} isOpen={initialOpen}>
        <FieldSet>
          <Field label={LAYOUT_FIELD_LABELS.orientation.label}>
            <RadioButtonGroup
              options={orientationOptions}
              value={layout.orientation}
              onChange={onOrientationChange}
              data-testid={dataTestIds?.orientation}
            />
          </Field>

          <Field label={LAYOUT_FIELD_LABELS.reportTheme.label}>
            <RadioButtonGroup
              options={themeOptions}
              value={layout.reportTheme}
              onChange={onReportThemeChange}
              data-testid={dataTestIds?.reportTheme}
            />
          </Field>

          <NumericInput field="panelsPerPage" values={numericValues} errors={errors} onChange={onNumericChange} />

          <NumericInput field="pageMargin" values={numericValues} errors={errors} onChange={onNumericChange} />
        </FieldSet>
      </CollapsableSection>

      <CollapsableSection label={LAYOUT_FIELD_LABELS.sections.headerFooter} isOpen={initialOpen}>
        <FieldSet>
          <NumericInput field="headerPadding" values={numericValues} errors={errors} onChange={onNumericChange} />

          <NumericInput field="headerLineHeight" values={numericValues} errors={errors} onChange={onNumericChange} />

          <NumericInput field="footerPadding" values={numericValues} errors={errors} onChange={onNumericChange} />

          <NumericInput field="footerLineHeight" values={numericValues} errors={errors} onChange={onNumericChange} />
        </FieldSet>
      </CollapsableSection>

      <CollapsableSection label={LAYOUT_FIELD_LABELS.sections.panelSettings} isOpen={initialOpen}>
        <FieldSet>
          <NumericInput field="panelsPerPage" values={numericValues} errors={errors} onChange={onNumericChange} />

          <NumericInput field="panelsSpacing" values={numericValues} errors={errors} onChange={onNumericChange} />

          <NumericInput field="panelsWidth" values={numericValues} errors={errors} onChange={onNumericChange} />

          <NumericInput field="panelsHeight" values={numericValues} errors={errors} onChange={onNumericChange} />

          <Field
            label={LAYOUT_FIELD_LABELS.panelTitles.label}
            description={LAYOUT_FIELD_LABELS.panelTitles.description}
          >
            <Switch
              value={titlesEnabled}
              onChange={(event: React.ChangeEvent<HTMLInputElement>) => onPanelTitleToggle(event.currentTarget.checked)}
              data-testid={dataTestIds?.panelsTitles}
            />
          </Field>
          {titlesEnabled && (
            <>
              <NumericInput
                field="panelsTitleFontSize"
                values={numericValues}
                errors={errors}
                onChange={onNumericChange}
              />
              <Field
                label={LAYOUT_FIELD_LABELS.panelsTitleFontFamily.label}
                description={LAYOUT_FIELD_LABELS.panelsTitleFontFamily.description}
              >
                <Select
                  options={fontFamilyOptions}
                  placeholder={`Default (${DEFAULT_FONT_FAMILY})`}
                  value={toFontOption(layout.panels?.title?.fontFamily)}
                  onChange={(option) => onPanelTitleFontFamilyChange?.((option?.value as string) ?? '')}
                  allowClear
                />
              </Field>
              <Field
                label={LAYOUT_FIELD_LABELS.panelsTitleFontStyle.label}
                description={LAYOUT_FIELD_LABELS.panelsTitleFontStyle.description}
              >
                <Select
                  options={fontStyleOptions}
                  placeholder="Default (normal)"
                  value={toFontStyleOption(layout.panels?.title?.fontStyle)}
                  onChange={(option) => onPanelTitleFontStyleChange?.(option?.value as FontStyle | undefined)}
                  allowClear
                />
              </Field>
              <Field
                label={LAYOUT_FIELD_LABELS.panelsTitleFontColor.label}
                description={LAYOUT_FIELD_LABELS.panelsTitleFontColor.description}
              >
                <ColorPickerInput
                  value={layout.panels?.title?.fontColor ?? ''}
                  onChange={(color) => onPanelTitleFontColorChange?.(color)}
                  returnColorAs="hex"
                />
              </Field>
            </>
          )}
        </FieldSet>
      </CollapsableSection>

      <CollapsableSection label={LAYOUT_FIELD_LABELS.sections.logo} isOpen={initialOpen}>
        <FieldSet>
          <Field label={LAYOUT_FIELD_LABELS.logoToggle.label}>
            <Switch
              value={logoEnabled}
              onChange={(event: React.ChangeEvent<HTMLInputElement>) => onLogoToggle(event.currentTarget.checked)}
              disabled={!logoAvailable}
            />
          </Field>

          {logoAvailable && logoEnabled && (
            <div>
              {showLogoUpload && (
                <>
                  <Field label={LAYOUT_FIELD_LABELS.logo.label} description={LAYOUT_FIELD_LABELS.logo.description}>
                    <div className={s.logoField}>
                      <div className={s.logoRow}>
                        <Input
                          placeholder="https://example.com/logo.png or data:image/png;base64..."
                          value={layout.logo?.url ?? ''}
                          onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                            onLogoUrlChange?.(event.currentTarget.value)
                          }
                        />
                        <Button
                          variant="secondary"
                          type="button"
                          icon="upload"
                          onClick={() => fileInputRef.current?.click()}
                        >
                          Select image
                        </Button>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          style={{ display: 'none' }}
                          onChange={(event) => onLogoFileChange?.(event.currentTarget.files?.[0] ?? null)}
                        />
                        {layout.logo?.url && (
                          <Button variant="secondary" type="button" icon="times" onClick={() => onClearLogo?.()}>
                            Clear
                          </Button>
                        )}
                      </div>
                      {layout.logo?.url && (
                        <div className={s.logoPreview}>
                          <img src={layout.logo.url} alt="Logo preview" />
                        </div>
                      )}
                    </div>
                  </Field>

                  <Field label={LAYOUT_FIELD_LABELS.logoPlacement.label}>
                    <div>
                      <RadioButtonGroup
                        options={placementOptions}
                        value={layout.logo?.placement}
                        onChange={(value) => value && onLogoPlacementChange(value)}
                      />
                      <RadioButtonGroup
                        options={alignmentOptions}
                        value={layout.logo?.alignment}
                        onChange={(value) => value && onLogoAlignmentChange(value)}
                      />
                    </div>
                  </Field>
                  <NumericInput field="logoWidth" values={numericValues} errors={errors} onChange={onNumericChange} />
                  <NumericInput field="logoHeight" values={numericValues} errors={errors} onChange={onNumericChange} />
                </>
              )}
            </div>
          )}
        </FieldSet>
      </CollapsableSection>

      <CollapsableSection label={LAYOUT_FIELD_LABELS.sections.pageNumber} isOpen={initialOpen}>
        <FieldSet>
          <Field
            label={LAYOUT_FIELD_LABELS.pageNumbers.label}
            description={LAYOUT_FIELD_LABELS.pageNumbers.description}
          >
            <Switch
              value={pageNumbersEnabled}
              onChange={(event: React.ChangeEvent<HTMLInputElement>) => onPageNumberToggle(event.currentTarget.checked)}
              data-testid={dataTestIds?.pageNumbers}
            />
          </Field>

          {pageNumbersEnabled && (
            <>
              <Field label={LAYOUT_FIELD_LABELS.pageNumberPlacement.label}>
                <div>
                  <RadioButtonGroup
                    options={placementOptions}
                    value={layout.pageNumber?.placement}
                    onChange={(value) => value && onPagePlacementChange(value)}
                  />
                  <RadioButtonGroup
                    options={alignmentOptions}
                    value={layout.pageNumber?.alignment}
                    onChange={(value) => value && onPageAlignmentChange(value)}
                  />
                </div>
              </Field>
              <NumericInput
                field="pageNumberFontSize"
                values={numericValues}
                errors={errors}
                onChange={onNumericChange}
              />
              <Field
                label={LAYOUT_FIELD_LABELS.pageNumberFontFamily.label}
                description={LAYOUT_FIELD_LABELS.pageNumberFontFamily.description}
              >
                <Select
                  options={fontFamilyOptions}
                  placeholder={`Default (${DEFAULT_FONT_FAMILY})`}
                  value={toFontOption(layout.pageNumber?.fontFamily)}
                  onChange={(option) => onPageNumberFontFamilyChange?.((option?.value as string) ?? '')}
                  allowClear
                />
              </Field>
              <Field
                label={LAYOUT_FIELD_LABELS.pageNumberFontStyle.label}
                description={LAYOUT_FIELD_LABELS.pageNumberFontStyle.description}
              >
                <Select
                  options={fontStyleOptions}
                  placeholder="Default (normal)"
                  value={toFontStyleOption(layout.pageNumber?.fontStyle)}
                  onChange={(option) => onPageNumberFontStyleChange?.(option?.value as FontStyle | undefined)}
                  allowClear
                />
              </Field>
              <Field
                label={LAYOUT_FIELD_LABELS.pageNumberFontColor.label}
                description={LAYOUT_FIELD_LABELS.pageNumberFontColor.description}
              >
                <ColorPickerInput
                  value={layout.pageNumber?.fontColor ?? ''}
                  onChange={(color) => onPageNumberFontColorChange?.(color)}
                  returnColorAs="hex"
                />
              </Field>
              <Field
                label={LAYOUT_FIELD_LABELS.pageNumberLanguage.label}
                description={LAYOUT_FIELD_LABELS.pageNumberLanguage.description}
              >
                <Input
                  placeholder="en"
                  value={layout.pageNumber?.language ?? ''}
                  onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                    onPageNumberLanguageChange?.(event.currentTarget.value)
                  }
                />
              </Field>
            </>
          )}
        </FieldSet>
      </CollapsableSection>

      <CollapsableSection label={LAYOUT_FIELD_LABELS.sections.customElements} isOpen={initialOpen}>
        <FieldSet>
          {(customElements ?? []).map((element, index) => (
            <div
              key={`custom-element-${index}`}
              style={{
                border: '1px solid var(--input-border-color,#c7d0d9)',
                borderRadius: 4,
                padding: 8,
                marginBottom: 8,
              }}
            >
              <Field
                label={LAYOUT_FIELD_LABELS.customTextContent.label}
                description={LAYOUT_FIELD_LABELS.customTextContent.description}
              >
                <Input
                  placeholder="Custom text"
                  value={element.content}
                  onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                    onUpdateCustomElement?.(index, { content: event.currentTarget.value })
                  }
                />
              </Field>
              <Field label={LAYOUT_FIELD_LABELS.customTextPlacement.label}>
                <RadioButtonGroup
                  options={placementOptions}
                  value={element.placement}
                  onChange={(value) => value && onUpdateCustomElement?.(index, { placement: value })}
                />
              </Field>
              <Field label={LAYOUT_FIELD_LABELS.customTextAlignment.label}>
                <RadioButtonGroup
                  options={alignmentOptions}
                  value={element.alignment}
                  onChange={(value) => value && onUpdateCustomElement?.(index, { alignment: value })}
                />
              </Field>
              <Field
                label={LAYOUT_FIELD_LABELS.customTextFontFamily.label}
                description={LAYOUT_FIELD_LABELS.customTextFontFamily.description}
              >
                <Select
                  options={fontFamilyOptions}
                  placeholder={`Default (${DEFAULT_FONT_FAMILY})`}
                  value={toFontOption(element.fontFamily)}
                  onChange={(option) => onUpdateCustomElement?.(index, { fontFamily: (option?.value as string) ?? '' })}
                  allowClear
                />
              </Field>
              <Field
                label={LAYOUT_FIELD_LABELS.customTextFontStyle.label}
                description={LAYOUT_FIELD_LABELS.customTextFontStyle.description}
              >
                <Select
                  options={fontStyleOptions}
                  placeholder="Default (normal)"
                  value={toFontStyleOption(element.fontStyle)}
                  onChange={(option) =>
                    onUpdateCustomElement?.(index, { fontStyle: option?.value as FontStyle | undefined })
                  }
                  allowClear
                />
              </Field>
              <Field
                label={LAYOUT_FIELD_LABELS.customTextFontSize.label}
                description={LAYOUT_FIELD_LABELS.customTextFontSize.description}
              >
                <Input
                  type="number"
                  min={1}
                  value={element.fontSize ?? ''}
                  onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                    onUpdateCustomElement?.(index, { fontSize: Number(event.currentTarget.value) })
                  }
                />
              </Field>
              <Field
                label={LAYOUT_FIELD_LABELS.customTextFontColor.label}
                description={LAYOUT_FIELD_LABELS.customTextFontColor.description}
              >
                <ColorPickerInput
                  value={element.fontColor ?? ''}
                  onChange={(color) => onUpdateCustomElement?.(index, { fontColor: color })}
                  returnColorAs="hex"
                />
              </Field>
              <Button
                variant="destructive"
                type="button"
                icon="trash-alt"
                onClick={() => onRemoveCustomElement?.(index)}
              >
                Remove
              </Button>
            </div>
          ))}
          <Button variant="secondary" type="button" icon="plus" onClick={() => onAddCustomElement?.()}>
            Add custom text
          </Button>
        </FieldSet>
      </CollapsableSection>
    </>
  );
};

export default LayoutFormFields;
