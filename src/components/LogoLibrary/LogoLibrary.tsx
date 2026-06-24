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
import { Button, Field, Icon, Input, useStyles2 } from '@grafana/ui';
import React, { useRef, useState } from 'react';
import { blobToDataUrl } from '../../report/util/blob';
import { LogoLibraryItem } from '../../types/reporting';
import {
  MAX_LOGO_BYTES,
  createLogoId,
  dataUrlByteSize,
  deriveLogoNameFromUrl,
  formatBytes,
  isImageMimeType,
  validateLogoDataUrl,
} from '../../utils/logoLibrary';

interface Props {
  logos: LogoLibraryItem[];
  /** Id of the logo currently selected as the default (mirrors layout.logo.id). */
  selectedId?: string;
  onChange: (logos: LogoLibraryItem[]) => void;
  onSelect?: (id: string | undefined) => void;
}

export const LogoLibrary = ({ logos, selectedId, onChange, onSelect }: Props) => {
  const styles = useStyles2(getStyles);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string>();
  const [urlInput, setUrlInput] = useState('');
  const [fetching, setFetching] = useState(false);

  const handleFile = (file: File | null) => {
    setError(undefined);
    if (!file) {
      return;
    }
    if (!isImageMimeType(file.type)) {
      setError('Please select an image file.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const validationError = validateLogoDataUrl(result);
      if (validationError) {
        setError(validationError);
        return;
      }
      const item: LogoLibraryItem = {
        id: createLogoId(file.name, logos),
        name: file.name.replace(/\.[a-z0-9]+$/i, ''),
        dataUrl: result,
      };
      onChange([...logos, item]);
    };
    reader.onerror = () => setError('Failed to read the selected file.');
    reader.readAsDataURL(file);
  };

  const handleAddFromUrl = async () => {
    setError(undefined);
    const url = urlInput.trim();
    if (!url) {
      return;
    }
    setFetching(true);
    try {
      // Backend-less: the download happens in the browser, so cross-origin hosts must allow CORS.
      // We store the result as a data URI so report-time embedding never depends on the remote host.
      const response = await fetch(url, { credentials: 'same-origin' });
      if (!response.ok) {
        throw new Error(`Request failed (${response.status})`);
      }
      const blob = await response.blob();
      const dataUrl = await blobToDataUrl(blob);
      const validationError = validateLogoDataUrl(dataUrl);
      if (validationError) {
        setError(validationError);
        return;
      }
      onChange([...logos, { id: createLogoId(url, logos), name: deriveLogoNameFromUrl(url), dataUrl }]);
      setUrlInput('');
    } catch (err) {
      setError('Could not fetch the image (the host may block cross-origin requests). Download it and upload instead.');
    } finally {
      setFetching(false);
    }
  };

  const handleRename = (id: string, name: string) => {
    onChange(logos.map((logo) => (logo.id === id ? { ...logo, name } : logo)));
  };

  const handleRemove = (id: string) => {
    onChange(logos.filter((logo) => logo.id !== id));
    if (selectedId === id) {
      onSelect?.(undefined);
    }
  };

  return (
    <Field
      label="Logo library"
      description="Upload logos once and reference them in reports by selection. Reports link to a logo by its short id, so the report URL stays small."
    >
      <div className={styles.container}>
        <div className={styles.actions}>
          <Button type="button" variant="secondary" icon="upload" onClick={() => fileInputRef.current?.click()}>
            Upload logo
          </Button>
          <span className={styles.hint}>PNG, JPG or SVG · up to {formatBytes(MAX_LOGO_BYTES)}</span>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={(event) => {
              handleFile(event.currentTarget.files?.[0] ?? null);
              // Reset so selecting the same file again re-triggers onChange.
              event.currentTarget.value = '';
            }}
          />
        </div>

        <div className={styles.urlRow}>
          <Input
            value={urlInput}
            placeholder="https://example.com/logo.png"
            aria-label="Logo image URL"
            onChange={(event: React.ChangeEvent<HTMLInputElement>) => setUrlInput(event.currentTarget.value)}
            onKeyDown={(event: React.KeyboardEvent<HTMLInputElement>) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                handleAddFromUrl();
              }
            }}
          />
          <Button
            type="button"
            variant="secondary"
            icon="link"
            disabled={!urlInput.trim() || fetching}
            onClick={handleAddFromUrl}
          >
            {fetching ? 'Fetching…' : 'Add from URL'}
          </Button>
        </div>

        {error && <div className={styles.error}>{error}</div>}

        {logos.length === 0 ? (
          <div className={styles.empty}>No logos uploaded yet.</div>
        ) : (
          <ul className={styles.list}>
            {logos.map((logo) => {
              const isSelected = selectedId === logo.id;
              return (
                <li key={logo.id} className={styles.item}>
                  <div className={styles.thumb}>
                    <img src={logo.dataUrl} alt={`${logo.name} preview`} />
                  </div>
                  <div className={styles.meta}>
                    <Input
                      value={logo.name}
                      aria-label="Logo name"
                      onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                        handleRename(logo.id, event.currentTarget.value)
                      }
                    />
                    {logo.dataUrl.startsWith('data:') ? (
                      <span className={styles.size}>{formatBytes(dataUrlByteSize(logo.dataUrl))}</span>
                    ) : (
                      <span className={styles.size}>Linked image</span>
                    )}
                  </div>
                  <div className={styles.itemActions}>
                    {onSelect && (
                      <Button
                        type="button"
                        size="sm"
                        variant={isSelected ? 'primary' : 'secondary'}
                        icon={isSelected ? 'check' : undefined}
                        onClick={() => onSelect(isSelected ? undefined : logo.id)}
                      >
                        {isSelected ? 'Default' : 'Set default'}
                      </Button>
                    )}
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      fill="outline"
                      aria-label={`Remove ${logo.name}`}
                      onClick={() => handleRemove(logo.id)}
                    >
                      <Icon name="trash-alt" />
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Field>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
  }),
  actions: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1.5),
  }),
  urlRow: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    maxWidth: 520,
  }),
  hint: css({
    color: theme.colors.text.secondary,
    fontSize: theme.typography.bodySmall.fontSize,
  }),
  error: css({
    color: theme.colors.error.text,
    fontSize: theme.typography.bodySmall.fontSize,
  }),
  empty: css({
    color: theme.colors.text.secondary,
    fontStyle: 'italic',
  }),
  list: css({
    listStyle: 'none',
    margin: 0,
    padding: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
  }),
  item: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(2),
    padding: theme.spacing(1),
    border: `1px solid ${theme.colors.border.weak}`,
    borderRadius: theme.shape.radius.default,
  }),
  thumb: css({
    width: 64,
    height: 40,
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: theme.colors.background.secondary,
    borderRadius: theme.shape.radius.default,
    overflow: 'hidden',
    '& img': {
      maxWidth: '100%',
      maxHeight: '100%',
    },
  }),
  meta: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(0.5),
    flex: 1,
    minWidth: 0,
  }),
  size: css({
    color: theme.colors.text.secondary,
    fontSize: theme.typography.bodySmall.fontSize,
  }),
  itemActions: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    flexShrink: 0,
  }),
});

export default LogoLibrary;
