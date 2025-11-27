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

export const createNarrowFormStyles = (theme: GrafanaTheme2) => ({
  // uncomment display, flex-direction and gap to enable full layout width
  container: css`
    max-width: 700px;
    display: flex;
    flex-direction: column;
    gap: ${theme.spacing(2)};
  `,
  form: css`
    display: flex;
    flex-direction: column;
    gap: ${theme.spacing(2)};
  `,
  inlineControls: css`
    display: flex;
    flex-wrap: wrap;
    gap: ${theme.spacing(1)};
    align-items: center;
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
