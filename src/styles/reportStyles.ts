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
import { createNarrowFormStyles } from './commonStyles';

export const getReportStyles = (theme: GrafanaTheme2) => {
  const base = createNarrowFormStyles(theme);
  return {
    ...base,

    controls: css`
      display: flex;
      flex-wrap: wrap;
      gap: ${theme.spacing(2)};
      margin-bottom: ${theme.spacing(2)};
      align-items: flex-end;
    `,
    controlGroup: css`
      flex: 1 1 280px;
      min-width: 260px;
      display: flex;
      flex-direction: column;
      gap: ${theme.spacing(0.5)};
    `,
    headerRow: css`
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: ${theme.spacing(1)};
    `,
    helper: css`
      margin-top: ${theme.spacing(3)};
    `,
    label: css`
      display: block;
      font-weight: ${theme.typography.fontWeightMedium};
      margin-bottom: ${theme.spacing(1)};
    `,
    log: css`
      background: ${theme.colors.background.secondary};
      border-radius: ${theme.shape.radius.default};
      padding: ${theme.spacing(2)};
      min-height: 180px;
      max-height: 260px;
      overflow-y: auto;
      font-family: monospace;
      font-size: ${theme.typography.bodySmall.fontSize};
      border: 1px solid ${theme.colors.border.weak};
    `,
    workingRow: css`
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: ${theme.spacing(2)};
      margin: ${theme.spacing(2)} 0;
    `,
  };
};
