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

import { Button, useStyles2 } from '@grafana/ui';
import React from 'react';
import { getAdvancedConfigStyles } from 'styles/advancedConfigStyles';
import { LayoutSettings } from '../../types/reporting';
import { LayoutDraft, LayoutDraftErrors, LayoutNumericField } from '../../utils/layoutValidation';
import LayoutSettingsForm from '../../components/LayoutSettingsForm';

interface Props {
  isOpen: boolean;
  onToggle: () => void;
  layout: LayoutSettings;
  setLayout: React.Dispatch<React.SetStateAction<LayoutSettings>>;
  layoutDraft: LayoutDraft;
  layoutErrors?: LayoutDraftErrors;
  onLayoutInputChange: (field: LayoutNumericField, value: string) => void;
}

export const GlobalOverridesPanel = ({
  isOpen,
  onToggle,
  layout,
  setLayout,
  layoutDraft,
  layoutErrors,
  onLayoutInputChange,
}: Props) => {
  const styles = useStyles2(getAdvancedConfigStyles);

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
          <LayoutSettingsForm
            layout={layout}
            initialOpen={false}
            setLayout={setLayout}
            numericValues={layoutDraft}
            errors={layoutErrors}
            onNumericChange={onLayoutInputChange}
            logoAvailable
            showLogoUpload={false}
          />
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
