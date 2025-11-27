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

import { Button, Field, Input, RadioButtonGroup, Switch, useStyles2 } from '@grafana/ui';
import React from 'react';
import { getAdvancedConfigStyles } from 'styles/advancedConfigStyles';
import { BrandingAlignment, BrandingPlacement, LayoutSettings, ReportOrientation } from '../../types/reporting';
import { LayoutDraft, LayoutDraftErrors, LayoutNumericField } from '../../utils/layoutValidation';

interface Props {
  isOpen: boolean;
  onToggle: () => void;
  layout: LayoutSettings;
  layoutDraft: LayoutDraft;
  layoutErrors?: LayoutDraftErrors;
  onLayoutChange: (next: Partial<LayoutSettings>) => void;
  onLayoutInputChange: (field: LayoutNumericField, value: string) => void;
}

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

export const GlobalOverridesPanel = ({
  isOpen,
  onToggle,
  layout,
  layoutDraft,
  layoutErrors,
  onLayoutChange,
  onLayoutInputChange,
}: Props) => {
  const styles = useStyles2(getAdvancedConfigStyles);

  const handleNumericInput = (key: LayoutNumericField) => (event: React.ChangeEvent<HTMLInputElement>) => {
    onLayoutInputChange(key, event.target.value);
  };

  const handleOrientationChange = (value: string) => {
    if (value === 'portrait' || value === 'landscape') {
      onLayoutChange({ orientation: value });
    }
  };

  const handleLayoutToggle =
    (key: keyof Pick<LayoutSettings, 'logoEnabled' | 'showPageNumbers' | 'showPanelTitles'>) =>
    (event: React.ChangeEvent<HTMLInputElement>) => {
      onLayoutChange({ [key]: event.target.checked } as Partial<LayoutSettings>);
    };

  const handlePlacementChange =
    (key: keyof Pick<LayoutSettings, 'logoPlacement' | 'pageNumberPlacement'>) => (value: string | null) => {
      if (value === 'header' || value === 'footer') {
        onLayoutChange({ [key]: value } as Partial<LayoutSettings>);
      }
    };

  const handleAlignmentChange =
    (key: keyof Pick<LayoutSettings, 'logoAlignment' | 'pageNumberAlignment'>) => (value: string | null) => {
      if (value === 'left' || value === 'center' || value === 'right') {
        onLayoutChange({ [key]: value } as Partial<LayoutSettings>);
      }
    };

  const logoAvailable = Boolean(layout.logoUrl);

  return (
    <>
      <div
        className={styles.subheader}
        role="button"
        tabIndex={0}
        onClick={onToggle}
        onKeyDown={(event) => toggleOnKey(event, onToggle)}
      >
        <div>
          <div className={styles.title}>Global settings override</div>
          <div className={styles.description}>Override plugin defaults for this report.</div>
        </div>
        <Button
          variant="secondary"
          icon={isOpen ? 'angle-down' : 'angle-right'}
          type="button"
          fill="text"
          aria-label="Toggle global overrides"
          onClick={(event) => {
            event.stopPropagation();
            onToggle();
          }}
        />
      </div>

      {isOpen && (
        <div className={styles.overridePanel}>
          <Field
            label="Panels per page"
            invalid={Boolean(layoutErrors?.panelsPerPage)}
            error={layoutErrors?.panelsPerPage}
          >
            <Input
              type="number"
              min={1}
              step={1}
              value={layoutDraft.panelsPerPage}
              onChange={handleNumericInput('panelsPerPage')}
            />
          </Field>

          <Field
            label="Panel spacing (pt)"
            invalid={Boolean(layoutErrors?.panelSpacing)}
            error={layoutErrors?.panelSpacing}
          >
            <Input
              type="number"
              min={0}
              step={1}
              value={layoutDraft.panelSpacing}
              onChange={handleNumericInput('panelSpacing')}
            />
          </Field>

          <Field
            label="Panel render width (px)"
            invalid={Boolean(layoutErrors?.renderWidth)}
            error={layoutErrors?.renderWidth}
          >
            <Input
              type="number"
              min={100}
              step={10}
              value={layoutDraft.renderWidth}
              onChange={handleNumericInput('renderWidth')}
            />
          </Field>

          <Field
            label="Panel render height (px)"
            invalid={Boolean(layoutErrors?.renderHeight)}
            error={layoutErrors?.renderHeight}
          >
            <Input
              type="number"
              min={100}
              step={10}
              value={layoutDraft.renderHeight}
              onChange={handleNumericInput('renderHeight')}
            />
          </Field>

          <Field label="Page margin (pt)" invalid={Boolean(layoutErrors?.pageMargin)} error={layoutErrors?.pageMargin}>
            <Input
              type="number"
              min={0}
              step={1}
              value={layoutDraft.pageMargin}
              onChange={handleNumericInput('pageMargin')}
            />
          </Field>

          <Field label="Report orientation">
            <RadioButtonGroup
              options={orientationOptions}
              value={layout.orientation}
              onChange={handleOrientationChange}
            />
          </Field>

          <Field label="Panel titles">
            <Switch value={layout.showPanelTitles} onChange={handleLayoutToggle('showPanelTitles')} />
          </Field>
          <Field
            label="Panel title font size (pt)"
            invalid={Boolean(layoutErrors?.panelTitleFontSize)}
            error={layoutErrors?.panelTitleFontSize}
          >
            <Input
              type="number"
              min={1}
              step={1}
              value={layoutDraft.panelTitleFontSize}
              onChange={handleNumericInput('panelTitleFontSize')}
            />
          </Field>

          <Field label="Page numbers">
            <Switch value={layout.showPageNumbers} onChange={handleLayoutToggle('showPageNumbers')} />
          </Field>

          {layout.showPageNumbers && (
            <Field label="Page number placement">
              <div className={styles.inlineControls}>
                <RadioButtonGroup
                  options={placementOptions.map((option) => ({
                    ...option,
                    disabled:
                      layout.logoEnabled &&
                      layout.logoPlacement === option.value &&
                      layout.logoAlignment === layout.pageNumberAlignment,
                  }))}
                  value={layout.pageNumberPlacement}
                  onChange={handlePlacementChange('pageNumberPlacement')}
                />
                <RadioButtonGroup
                  options={alignmentOptions.map((option) => ({
                    ...option,
                    disabled:
                      layout.logoEnabled &&
                      layout.logoPlacement === layout.pageNumberPlacement &&
                      layout.logoAlignment === option.value,
                  }))}
                  value={layout.pageNumberAlignment}
                  onChange={handleAlignmentChange('pageNumberAlignment')}
                />
              </div>
            </Field>
          )}

          <Field
            label="Logo max width (pt)"
            invalid={Boolean(layoutErrors?.brandingLogoMaxWidth)}
            error={layoutErrors?.brandingLogoMaxWidth}
          >
            <Input
              type="number"
              min={1}
              step={1}
              value={layoutDraft.brandingLogoMaxWidth}
              onChange={handleNumericInput('brandingLogoMaxWidth')}
            />
          </Field>

          <Field
            label="Logo max height (pt)"
            invalid={Boolean(layoutErrors?.brandingLogoMaxHeight)}
            error={layoutErrors?.brandingLogoMaxHeight}
          >
            <Input
              type="number"
              min={1}
              step={1}
              value={layoutDraft.brandingLogoMaxHeight}
              onChange={handleNumericInput('brandingLogoMaxHeight')}
            />
          </Field>

          <Field
            label="Page number text height (pt)"
            invalid={Boolean(layoutErrors?.brandingTextLineHeight)}
            error={layoutErrors?.brandingTextLineHeight}
          >
            <Input
              type="number"
              min={1}
              step={1}
              value={layoutDraft.brandingTextLineHeight}
              onChange={handleNumericInput('brandingTextLineHeight')}
            />
          </Field>

          <Field
            label="Branding padding (pt)"
            invalid={Boolean(layoutErrors?.brandingSectionPadding)}
            error={layoutErrors?.brandingSectionPadding}
          >
            <Input
              type="number"
              min={0}
              step={1}
              value={layoutDraft.brandingSectionPadding}
              onChange={handleNumericInput('brandingSectionPadding')}
            />
          </Field>

          <Field label="Logo">
            <div className={styles.fieldStack}>
              <div className={styles.inlineRow}>
                <Switch
                  value={layout.logoEnabled && logoAvailable}
                  onChange={handleLayoutToggle('logoEnabled')}
                  disabled={!logoAvailable}
                />
                <span className={styles.muted}>
                  {logoAvailable ? 'Use plugin logo.' : 'No logo configured in plugin settings.'}
                </span>
              </div>
              {logoAvailable && (
                <>
                  <div className={styles.logoPreview}>
                    <img src={layout.logoUrl} alt="Logo preview" />
                  </div>
                  <div className={styles.inlineControls}>
                    <RadioButtonGroup
                      options={placementOptions.map((option) => ({
                        ...option,
                        disabled:
                          layout.showPageNumbers &&
                          layout.pageNumberPlacement === option.value &&
                          layout.pageNumberAlignment === layout.logoAlignment,
                      }))}
                      value={layout.logoPlacement}
                      onChange={handlePlacementChange('logoPlacement')}
                    />
                    <RadioButtonGroup
                      options={alignmentOptions.map((option) => ({
                        ...option,
                        disabled:
                          layout.showPageNumbers &&
                          layout.pageNumberPlacement === layout.logoPlacement &&
                          layout.pageNumberAlignment === option.value,
                      }))}
                      value={layout.logoAlignment}
                      onChange={handleAlignmentChange('logoAlignment')}
                    />
                  </div>
                </>
              )}
            </div>
          </Field>
        </div>
      )}
    </>
  );
};

const toggleOnKey = (event: React.KeyboardEvent<HTMLDivElement>, handler: () => void) => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    handler();
  }
};

export default GlobalOverridesPanel;
