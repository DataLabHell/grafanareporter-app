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

import { test, expect } from './fixtures';

test('should be possible to save app configuration', async ({ appConfigPage, page }) => {
  const saveButton = page.getByRole('button', { name: /Save API settings/i });

  // reset the configured secret
  await page.getByRole('button', { name: /reset/i }).click();

  // enter some valid values
  await page.getByRole('textbox', { name: 'API Key' }).fill('secret-api-key');
  await page.getByRole('textbox', { name: 'API Url' }).clear();
  await page.getByRole('textbox', { name: 'API Url' }).fill('http://www.my-awsome-grafana-app.com/api');

  // listen for the server response on the saved form
  const saveResponse = appConfigPage.waitForSettingsResponse();

  await saveButton.click();
  await expect(saveResponse).toBeOK();
});
