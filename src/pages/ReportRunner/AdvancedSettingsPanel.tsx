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

import { TimeRange } from '@grafana/data';
import { TimeZone } from '@grafana/schema';
import {
  Button,
  ClipboardButton,
  Combobox,
  ComboboxOption,
  Field,
  RadioButtonGroup,
  TextArea,
  TimeRangeInput,
  useStyles2,
} from '@grafana/ui';
import React, { ChangeEvent, KeyboardEvent } from 'react';
import { getAdvancedConfigStyles } from 'styles/advancedConfigStyles';
import { LayoutSettings, ReportTheme } from '../../types/reporting';
import { LayoutDraft, LayoutDraftErrors, LayoutNumericField } from '../../utils/layoutValidation';
import { GlobalOverridesPanel } from './GlobalOverridesPanel';

interface Props {
  isOpen: boolean;
  timePickerValue: TimeRange;
  onTimeRangeChange: (range: TimeRange) => void;
  timezoneOptions: Array<ComboboxOption<TimeZone | 'browser'>>;
  selectedTimezone: TimeZone | 'browser';
  onTimezoneChange: (value: TimeZone | 'browser') => void;
  themeOptions: Array<ComboboxOption<ReportTheme>>;
  selectedTheme: ReportTheme;
  onThemeChange: (value: ReportTheme) => void;
  variablesText: string;
  onVariablesChange: (value: string) => void;
  reportUrl: string;
  layout: LayoutSettings;
  layoutDraft: LayoutDraft;
  layoutErrors?: LayoutDraftErrors;
  onLayoutChange: (next: Partial<LayoutSettings>) => void;
  onLayoutInputChange: (field: LayoutNumericField, value: string) => void;
  isGlobalOverridesOpen: boolean;
  onGlobalOverridesToggle: () => void;
  onToggle: () => void;
}

export const AdvancedSettingsPanel = ({
  isOpen,
  onToggle,
  timePickerValue,
  onTimeRangeChange,
  timezoneOptions,
  selectedTimezone,
  onTimezoneChange,
  themeOptions,
  selectedTheme,
  onThemeChange,
  variablesText,
  onVariablesChange,
  reportUrl,
  layout,
  layoutDraft,
  layoutErrors,
  onLayoutChange,
  onLayoutInputChange,
  isGlobalOverridesOpen,
  onGlobalOverridesToggle,
}: Props) => {
  const styles = useStyles2(getAdvancedConfigStyles);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onToggle();
    }
  };

  const handleTimezoneChange = (option: ComboboxOption<TimeZone | 'browser'> | null) => {
    onTimezoneChange((option?.value as TimeZone | 'browser') ?? 'browser');
  };

  const handleThemeChange = (value: string) => {
    onThemeChange((value as ReportTheme) ?? selectedTheme);
  };

  return (
    <>
      <div className={styles.header} role="button" tabIndex={0} onClick={onToggle} onKeyDown={handleKeyDown}>
        <div>
          <div className={styles.title}>Advanced settings</div>
          <div className={styles.description}>Use this section to customize the report request.</div>
        </div>
        <Button
          variant="secondary"
          icon={isOpen ? 'angle-down' : 'angle-right'}
          type="button"
          fill="text"
          aria-label="Toggle advanced settings"
          onClick={(event) => {
            event.stopPropagation();
            onToggle();
          }}
        />
      </div>

      {isOpen && (
        <div className={styles.panel}>
          <Field label="Time range">
            <TimeRangeInput value={timePickerValue} onChange={onTimeRangeChange} timeZone={selectedTimezone} />
          </Field>

          <Field label="Timezone">
            <Combobox options={timezoneOptions} value={selectedTimezone} onChange={handleTimezoneChange} />
          </Field>

          <Field label="Rendered panel theme">
            <RadioButtonGroup options={themeOptions} value={selectedTheme} onChange={handleThemeChange} />
          </Field>

          <Field label="Variables" description="One per line, e.g. iterator=value1,value2">
            <TextArea
              rows={4}
              value={variablesText}
              onChange={(event: ChangeEvent<HTMLTextAreaElement>) => onVariablesChange(event.target.value)}
            />
          </Field>

          <GlobalOverridesPanel
            isOpen={isGlobalOverridesOpen}
            onToggle={onGlobalOverridesToggle}
            layout={layout}
            layoutDraft={layoutDraft}
            layoutErrors={layoutErrors}
            onLayoutChange={onLayoutChange}
            onLayoutInputChange={onLayoutInputChange}
          />

          <div className={styles.urlPreview}>
            <div className={styles.urlLabel}>Report URL</div>
            <div className={styles.urlRow}>
              <code className={styles.urlText}>{reportUrl}</code>
              <ClipboardButton getText={() => reportUrl} aria-label="Copy report URL" icon="copy" variant="secondary">
                Copy
              </ClipboardButton>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
