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

import { config } from '@grafana/runtime';
import { ReportTheme } from '../types/reporting';

export const resolveThemePreference = (preference: ReportTheme): Exclude<ReportTheme, 'user'> => {
  if (preference === 'user') {
    const userTheme = config.bootData?.user?.theme;
    return userTheme === 'light' ? 'light' : 'dark';
  }

  return preference;
};
