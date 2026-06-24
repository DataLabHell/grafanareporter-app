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

import { DEFAULT_LAYOUT_SETTINGS } from '../../types/reporting';
import { AdvancedSettingsSnapshot } from './types';
import {
  buildManualVariablesFromParams,
  buildReportParams,
  convertDashboardVariablesToMap,
  coerceRawRange,
  formatVariablesText,
  isUrlSafeImageRef,
  normalizeRawTimeInput,
  parseLayoutOverrides,
  parseVariablesText,
} from './queryUtils';

describe('parseVariablesText / formatVariablesText', () => {
  it('parses multi-line name=values text into a variable map', () => {
    expect(parseVariablesText('region=us,eu\nenv=prod')).toEqual({
      region: [{ value: 'us', text: 'us' }, { value: 'eu', text: 'eu' }],
      env: [{ value: 'prod', text: 'prod' }],
    });
  });

  it('round-trips through formatVariablesText', () => {
    const text = 'region=us,eu\nenv=prod';
    expect(formatVariablesText(parseVariablesText(text))).toBe(text);
  });

  it('returns undefined for blank input', () => {
    expect(parseVariablesText('   ')).toBeUndefined();
  });
});

describe('buildManualVariablesFromParams', () => {
  it('collects repeated var- params into arrays', () => {
    const params = new URLSearchParams('var-region=us&var-region=eu&other=x');
    expect(buildManualVariablesFromParams(params)).toEqual({
      region: [{ value: 'us', text: 'us' }, { value: 'eu', text: 'eu' }],
    });
  });

  it('returns undefined when no var- params are present', () => {
    expect(buildManualVariablesFromParams(new URLSearchParams('a=b'))).toBeUndefined();
  });
});

describe('coerceRawRange / normalizeRawTimeInput', () => {
  it('falls back to defaults for empty input', () => {
    expect(coerceRawRange(undefined)).toEqual({ from: 'now-6h', to: 'now' });
  });

  it('keeps explicit string ranges', () => {
    expect(coerceRawRange({ from: 'now-24h', to: 'now-1h' })).toEqual({ from: 'now-24h', to: 'now-1h' });
  });

  it('stringifies numeric epochs', () => {
    expect(normalizeRawTimeInput(1700000000000 as any, 'now')).toBe('1700000000000');
  });
});

describe('parseLayoutOverrides', () => {
  it('parses enum + boolean layout params and collects numeric overrides as strings', () => {
    const params = new URLSearchParams('orientation=landscape&panelsTitleEnabled=false&panelsPerPage=4&logoPlacement=header');
    const { layout, numericOverrides } = parseLayoutOverrides(params);
    expect(layout?.orientation).toBe('landscape');
    expect(layout?.panels?.title?.enabled).toBe(false);
    expect(layout?.logo?.placement).toBe('header');
    expect(numericOverrides?.panelsPerPage).toBe('4');
  });

  it('returns undefined layout/overrides when nothing relevant is present', () => {
    expect(parseLayoutOverrides(new URLSearchParams('uid=abc'))).toEqual({
      layout: undefined,
      numericOverrides: undefined,
    });
  });
});

describe('buildReportParams', () => {
  const snapshot: AdvancedSettingsSnapshot = {
    range: { from: 'now-6h', to: 'now' },
    timezone: 'utc',
    reportTheme: 'light',
    variablesText: 'region=us',
    layout: DEFAULT_LAYOUT_SETTINGS,
  };

  it('serializes uid, range, timezone, theme and variables', () => {
    const params = buildReportParams('abcd1234', snapshot);
    expect(params.get('uid')).toBe('abcd1234');
    expect(params.get('from')).toBe('now-6h');
    expect(params.get('tz')).toBe('utc');
    expect(params.get('reportTheme')).toBe('light');
    expect(params.getAll('var-region')).toEqual(['us']);
  });

  it('round-trips layout enums back through parseLayoutOverrides', () => {
    const params = buildReportParams('abcd1234', snapshot);
    const { layout } = parseLayoutOverrides(params);
    expect(layout?.orientation).toBe(DEFAULT_LAYOUT_SETTINGS.orientation);
    expect(layout?.logo?.placement).toBe(DEFAULT_LAYOUT_SETTINGS.logo.placement);
  });
});

describe('isUrlSafeImageRef', () => {
  it('accepts http(s) urls', () => {
    expect(isUrlSafeImageRef('https://example.com/logo.png')).toBe(true);
    expect(isUrlSafeImageRef('/public/plugins/x/img/logo.svg')).toBe(true);
  });

  it('rejects base64 data URIs and empty values (keeps them out of the URL)', () => {
    expect(isUrlSafeImageRef('data:image/png;base64,AAAA')).toBe(false);
    expect(isUrlSafeImageRef('  DATA:image/svg+xml,<svg/>')).toBe(false);
    expect(isUrlSafeImageRef('')).toBe(false);
    expect(isUrlSafeImageRef(undefined)).toBe(false);
  });
});

describe('convertDashboardVariablesToMap', () => {
  it('reads current values off dashboard template variables', () => {
    expect(
      convertDashboardVariablesToMap([{ name: 'region', current: { value: ['us', 'eu'], text: ['US', 'EU'] } }] as any)
    ).toEqual({
      region: [{ value: 'us', text: 'US' }, { value: 'eu', text: 'EU' }],
    });
  });

  it('returns undefined for an empty list', () => {
    expect(convertDashboardVariablesToMap([])).toBeUndefined();
  });
});
