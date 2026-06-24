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

import { TypedVariableModel } from '@grafana/data';
import { DashboardTemplateVariable } from '../../types/grafana';
import { VariableValue } from '../../types/reporting';

export const toArray = (input: any) => {
  if (input === undefined || input === null) {
    return [];
  }
  return Array.isArray(input) ? input : [input];
};

export const isAllValue = (entry: VariableValue) => {
  const value = entry.value?.toString().toLowerCase();
  const text = entry.text?.toString().toLowerCase();
  return value === '$__all' || value === '__all' || text === 'all';
};

// Normalizes mixed Grafana variable shapes into consistent value/text pairs.
export const normalizeVariableEntries = (value: any, text?: any): VariableValue[] => {
  const values = toArray(value);
  const texts = toArray(text);
  const max = Math.max(values.length, texts.length);
  const normalized: VariableValue[] = [];

  for (let i = 0; i < max; i++) {
    let source = values[i];
    const textCandidate = texts[i];

    if (source === undefined) {
      source = textCandidate;
    }

    if (source === undefined || source === null || source === '') {
      continue;
    }

    if (typeof source === 'object') {
      const candidateValue = (source as any).value;
      const candidateText = (source as any).text;
      if (candidateValue !== undefined && candidateValue !== null && candidateValue !== '') {
        normalized.push({
          value: String(candidateValue),
          text:
            candidateText !== undefined && candidateText !== null && candidateText !== ''
              ? String(candidateText)
              : textCandidate !== undefined && textCandidate !== null && textCandidate !== ''
              ? String(textCandidate)
              : undefined,
        });
        continue;
      }
      if (candidateText !== undefined && candidateText !== null && candidateText !== '') {
        normalized.push({
          value: String(candidateText),
          text: String(candidateText),
        });
        continue;
      }
    }

    normalized.push({
      value: String(source),
      text:
        textCandidate !== undefined && textCandidate !== null && textCandidate !== ''
          ? String(textCandidate)
          : undefined,
    });
  }

  return normalized;
};

export interface NormalizedVariableOption extends VariableValue {
  selected: boolean;
}

// Normalizes option entries into value/text pairs.
export const normalizeVariableOptions = (options?: Array<{ value?: any; text?: any; selected?: boolean }>) => {
  if (!options?.length) {
    return [] as NormalizedVariableOption[];
  }

  const normalized: NormalizedVariableOption[] = [];

  for (const option of options) {
    const source = option.value ?? option.text;
    if (source === undefined || source === null || source === '') {
      continue;
    }
    normalized.push({
      value: String(source),
      text: option.text !== undefined && option.text !== null && option.text !== '' ? String(option.text) : undefined,
      selected: Boolean(option.selected),
    });
  }

  return normalized;
};

// Extracts current/option values from a dashboard/template variable.
export const extractVariableValues = (
  variable: Partial<DashboardTemplateVariable> | Partial<TypedVariableModel>
): VariableValue[] => {
  const current = normalizeVariableEntries((variable as any)?.current?.value, (variable as any)?.current?.text);
  const options = normalizeVariableOptions((variable as any)?.options);
  const allSelected = current.some(isAllValue);

  const toValuePairs = (entries: NormalizedVariableOption[]): VariableValue[] =>
    entries.map(({ value, text }) => ({ value, text }));

  if (allSelected && options.length) {
    const withoutAll = options.filter((option) => !isAllValue(option));
    if (withoutAll.length) {
      return toValuePairs(withoutAll);
    }
  }

  if (current.length) {
    return current;
  }

  const selectedOptions = options.filter((option) => option.selected);
  if (selectedOptions.length) {
    return toValuePairs(selectedOptions);
  }

  return toValuePairs(options);
};
