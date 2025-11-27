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
import { GrafanaTheme2 } from '@grafana/data';
import { Button, Field, Input, RadioButtonGroup, Switch, useStyles2 } from '@grafana/ui';
import React from 'react';
import { BrandingAlignment, BrandingPlacement, LayoutSettings, ReportOrientation } from '../../types/reporting';

interface Props {
  isOpen: boolean;
  onToggle: () => void;
  layout: LayoutSettings;
  onLayoutChange: (next: Partial<LayoutSettings>) => void;
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

export const GlobalOverridesPanel = ({ isOpen, onToggle, layout, onLayoutChange }: Props) => {
  const styles = useStyles2(getStyles);

  const handleNumericChange =
    (key: keyof LayoutSettings, options: { min?: number } = {}) =>
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const value = Number(event.target.value);
      if (!Number.isFinite(value)) {
        return;
      }
      const min = options.min ?? Number.NEGATIVE_INFINITY;
      if (value < min) {
        return;
      }
      onLayoutChange({ [key]: value } as Partial<LayoutSettings>);
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
          <Field label="Panels per page">
            <Input
              type="number"
              min={1}
              step={1}
              value={layout.panelsPerPage}
              onChange={handleNumericChange('panelsPerPage', { min: 1 })}
            />
          </Field>

          <Field label="Panel spacing (pt)">
            <Input
              type="number"
              min={0}
              step={1}
              value={layout.panelSpacing}
              onChange={handleNumericChange('panelSpacing', { min: 0 })}
            />
          </Field>

          <Field label="Panel render width (px)">
            <Input
              type="number"
              min={100}
              step={10}
              value={layout.renderWidth}
              onChange={handleNumericChange('renderWidth', { min: 100 })}
            />
          </Field>

          <Field label="Panel render height (px)">
            <Input
              type="number"
              min={100}
              step={10}
              value={layout.renderHeight}
              onChange={handleNumericChange('renderHeight', { min: 100 })}
            />
          </Field>

          <Field label="Page margin (pt)">
            <Input
              type="number"
              min={0}
              step={1}
              value={layout.pageMargin}
              onChange={handleNumericChange('pageMargin', { min: 0 })}
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
          <Field label="Panel title font size (pt)">
            <Input
              type="number"
              min={1}
              step={1}
              value={layout.panelTitleFontSize}
              onChange={handleNumericChange('panelTitleFontSize', { min: 1 })}
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

          <Field label="Logo max width (pt)">
            <Input
              type="number"
              min={1}
              step={1}
              value={layout.brandingLogoMaxWidth}
              onChange={handleNumericChange('brandingLogoMaxWidth', { min: 1 })}
            />
          </Field>

          <Field label="Logo max height (pt)">
            <Input
              type="number"
              min={1}
              step={1}
              value={layout.brandingLogoMaxHeight}
              onChange={handleNumericChange('brandingLogoMaxHeight', { min: 1 })}
            />
          </Field>

          <Field label="Page number text height (pt)">
            <Input
              type="number"
              min={1}
              step={1}
              value={layout.brandingTextLineHeight}
              onChange={handleNumericChange('brandingTextLineHeight', { min: 1 })}
            />
          </Field>

          <Field label="Branding padding (pt)">
            <Input
              type="number"
              min={0}
              step={1}
              value={layout.brandingSectionPadding}
              onChange={handleNumericChange('brandingSectionPadding', { min: 0 })}
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

const getStyles = (theme: GrafanaTheme2) => ({
  subheader: css`
    margin-top: ${theme.spacing(2)};
    padding: ${theme.spacing(1)} ${theme.spacing(0.5)};
    border-bottom: 1px solid ${theme.colors.border.weak};
    display: flex;
    justify-content: space-between;
    align-items: center;
    cursor: pointer;
    outline: none;
  `,
  title: css`
    font-weight: ${theme.typography.fontWeightMedium};
    margin-bottom: ${theme.spacing(0.5)};
  `,
  description: css`
    color: ${theme.colors.text.secondary};
    font-size: ${theme.typography.bodySmall.fontSize};
  `,
  overridePanel: css`
    display: flex;
    flex-direction: column;
    gap: ${theme.spacing(2)};
    padding-bottom: ${theme.spacing(2)};
  `,
  inlineRow: css`
    display: flex;
    align-items: center;
    gap: ${theme.spacing(1)};
  `,
  inlineControls: css`
    display: flex;
    flex-wrap: wrap;
    gap: ${theme.spacing(1)};
    align-items: center;
  `,
  fieldStack: css`
    display: flex;
    flex-direction: column;
    gap: ${theme.spacing(1)};
  `,
  muted: css`
    color: ${theme.colors.text.secondary};
    font-size: ${theme.typography.bodySmall.fontSize};
  `,
  logoPreview: css`
    margin-top: ${theme.spacing(1)};
    padding: ${theme.spacing(1)};
    border: 1px dashed ${theme.colors.border.medium};
    border-radius: ${theme.shape.radius.default};
    background: ${theme.colors.background.secondary};
    max-width: 200px;

    img {
      max-width: 100%;
      height: auto;
      display: block;
    }
  `,
});
