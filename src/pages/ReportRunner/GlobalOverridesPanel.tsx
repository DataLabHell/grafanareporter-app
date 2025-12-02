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
import { LayoutSettings, alignmentOptions, orientationOptions, placementOptions } from '../../types/reporting';
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

  const handlePanelTitlesToggle = (event: React.ChangeEvent<HTMLInputElement>) => {
    const enabled = event.target.checked;
    onLayoutChange({
      panels: {
        ...(layout.panels || {}),
        title: { ...(layout.panels?.title || {}), enabled },
      },
    });
  };

  const handleLogoToggle = (event: React.ChangeEvent<HTMLInputElement>) => {
    onLayoutChange({ logo: { ...(layout.logo || {}), enabled: event.target.checked } });
  };

  const handlePageNumbersToggle = (event: React.ChangeEvent<HTMLInputElement>) => {
    onLayoutChange({ pageNumber: { ...(layout.pageNumber || {}), enabled: event.target.checked } });
  };

  const handleLogoPlacementChange = (value: string | null) => {
    if (value === 'header' || value === 'footer') {
      onLayoutChange({ logo: { ...(layout.logo || {}), placement: value } });
    }
  };

  const handlePagePlacementChange = (value: string | null) => {
    if (value === 'header' || value === 'footer') {
      onLayoutChange({ pageNumber: { ...(layout.pageNumber || {}), placement: value } });
    }
  };

  const handleLogoAlignmentChange = (value: string | null) => {
    if (value === 'left' || value === 'center' || value === 'right') {
      onLayoutChange({ logo: { ...(layout.logo || {}), alignment: value } });
    }
  };

  const handlePageAlignmentChange = (value: string | null) => {
    if (value === 'left' || value === 'center' || value === 'right') {
      onLayoutChange({ pageNumber: { ...(layout.pageNumber || {}), alignment: value } });
    }
  };

  const logoAvailable = Boolean(layout.logo?.url);

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
            label="Panels spacing (pt)"
            invalid={Boolean(layoutErrors?.panelsSpacing)}
            error={layoutErrors?.panelsSpacing}
          >
            <Input
              type="number"
              min={0}
              step={1}
              value={layoutDraft.panelsSpacing}
              onChange={handleNumericInput('panelsSpacing')}
            />
          </Field>

          <Field
            label="Panels render width (px)"
            invalid={Boolean(layoutErrors?.panelsWidth)}
            error={layoutErrors?.panelsWidth}
          >
            <Input
              type="number"
              min={100}
              step={10}
              value={layoutDraft.panelsWidth}
              onChange={handleNumericInput('panelsWidth')}
            />
          </Field>

          <Field
            label="Panels render height (px)"
            invalid={Boolean(layoutErrors?.panelsHeight)}
            error={layoutErrors?.panelsHeight}
          >
            <Input
              type="number"
              min={100}
              step={10}
              value={layoutDraft.panelsHeight}
              onChange={handleNumericInput('panelsHeight')}
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
            <Switch value={layout.panels?.title?.enabled} onChange={handlePanelTitlesToggle} />
          </Field>
          {layout.panels?.title?.enabled && (
            <Field
              label="Panel title font size (pt)"
              invalid={Boolean(layoutErrors?.panelsTitleFontSize)}
              error={layoutErrors?.panelsTitleFontSize}
            >
              <Input
                type="number"
                min={1}
                step={1}
                value={layoutDraft.panelsTitleFontSize}
                onChange={handleNumericInput('panelsTitleFontSize')}
              />
            </Field>
          )}

          <Field label="Page numbers">
            <Switch value={layout.pageNumber?.enabled} onChange={handlePageNumbersToggle} />
          </Field>

          {layout.pageNumber?.enabled && (
            <Field label="Page number placement">
              <div className={styles.inlineControls}>
                <RadioButtonGroup
                  options={placementOptions.map((option) => ({
                    ...option,
                    disabled:
                      layout.logo &&
                      layout.logo.enabled &&
                      layout.logo?.placement === option.value &&
                      layout.logo?.alignment === layout.pageNumber?.alignment,
                  }))}
                  value={layout.pageNumber?.placement}
                  onChange={handlePagePlacementChange}
                />
                <RadioButtonGroup
                  options={alignmentOptions.map((option) => ({
                    ...option,
                    disabled:
                      layout.logo &&
                      layout.logo.enabled &&
                      layout.logo?.placement === layout.pageNumber?.placement &&
                      layout.logo?.alignment === option.value,
                  }))}
                  value={layout.pageNumber?.alignment}
                  onChange={handlePageAlignmentChange}
                />
              </div>
            </Field>
          )}

          <Field label="Logo max width (pt)" invalid={Boolean(layoutErrors?.logoWidth)} error={layoutErrors?.logoWidth}>
            <Input
              type="number"
              min={1}
              step={1}
              value={layoutDraft.logoWidth}
              onChange={handleNumericInput('logoWidth')}
            />
          </Field>

          <Field
            label="Logo max height (pt)"
            invalid={Boolean(layoutErrors?.logoHeight)}
            error={layoutErrors?.logoHeight}
          >
            <Input
              type="number"
              min={1}
              step={1}
              value={layoutDraft.logoHeight}
              onChange={handleNumericInput('logoHeight')}
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
                  value={Boolean(layout.logo?.enabled) && logoAvailable}
                  onChange={handleLogoToggle}
                  disabled={!logoAvailable}
                />
                <span className={styles.muted}>
                  {logoAvailable ? 'Use plugin logo.' : 'No logo configured in plugin settings.'}
                </span>
              </div>
              {logoAvailable && (
                <>
                  <div className={styles.logoPreview}>
                    <img src={layout.logo?.url} alt="Logo preview" />
                  </div>
                  <div className={styles.inlineControls}>
                    <RadioButtonGroup
                      options={placementOptions.map((option) => ({
                        ...option,
                        disabled:
                          layout.pageNumber?.enabled &&
                          layout.pageNumber?.placement === option.value &&
                          layout.pageNumber?.alignment === layout.logo?.alignment,
                      }))}
                      value={layout.logo?.placement}
                      onChange={handleLogoPlacementChange}
                    />
                    <RadioButtonGroup
                      options={alignmentOptions.map((option) => ({
                        ...option,
                        disabled:
                          layout.pageNumber?.enabled &&
                          layout.pageNumber?.placement === layout.logo?.placement &&
                          layout.pageNumber?.alignment === option.value,
                      }))}
                      value={layout.logo?.alignment}
                      onChange={handleLogoAlignmentChange}
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
