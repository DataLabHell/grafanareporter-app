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

import React, { useEffect, useState } from 'react';
import { css } from '@emotion/css';
import { GrafanaTheme2, PluginExtensionPanelContext } from '@grafana/data';
import { Alert, Button, Spinner, useStyles2 } from '@grafana/ui';
import { getReporterSettings } from '../../state/pluginSettings';
import { generateDashboardReport } from '../../utils/reportGenerator';

interface Props {
  context?: PluginExtensionPanelContext;
  onDismiss?: () => void;
}

const ReportGenerationModal = ({ context, onDismiss }: Props) => {
  const s = useStyles2(getStyles);
  const [messages, setMessages] = useState<string[]>([]);
  const [status, setStatus] = useState<'working' | 'success' | 'error'>('working');
  const [error, setError] = useState<string | undefined>();
  const [fileName, setFileName] = useState<string | undefined>();

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        const result = await generateDashboardReport({
          panelContext: context,
          settings: getReporterSettings(),
          onProgress: (message) => {
            if (!cancelled) {
              setMessages((prev) => [...prev, message]);
            }
          },
        });

        if (!cancelled) {
          setFileName(result.fileName);
          setStatus('success');
          setMessages((prev) => [...prev, `Saved as ${result.fileName}`]);
        }
      } catch (err) {
        if (!cancelled) {
          setStatus('error');
          setError(err instanceof Error ? err.message : 'An unexpected error occurred.');
        }
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [context]);

  return (
    <div className={s.container}>
      {status === 'working' && (
        <div className={s.statusRow}>
          <Spinner inline size={16} />
          <span>Generating dashboard report…</span>
        </div>
      )}

      {status === 'success' && (
        <Alert severity="success" title="Report generated" className={s.alert}>
          {fileName ? `The PDF "${fileName}" should download automatically.` : 'The PDF should download automatically.'}
        </Alert>
      )}

      {status === 'error' && (
        <Alert severity="error" title="Failed to generate report" className={s.alert}>
          {error ?? 'An unknown error occurred during rendering.'}
        </Alert>
      )}

      <div className={s.log}>
        {messages.length === 0 && <div className={s.placeholder}>Waiting for renderer…</div>}
        {messages.map((message, index) => (
          <div key={`${message}-${index}`} className={s.logLine}>
            {message}
          </div>
        ))}
      </div>

      <div className={s.actions}>
        <Button variant="secondary" onClick={onDismiss ?? (() => undefined)} disabled={status === 'working'}>
          Close
        </Button>
      </div>
    </div>
  );
};

export default ReportGenerationModal;

const getStyles = (theme: GrafanaTheme2) => ({
  container: css`
    min-width: 460px;
  `,
  statusRow: css`
    display: flex;
    align-items: center;
    gap: ${theme.spacing(1)};
    margin-bottom: ${theme.spacing(2)};
  `,
  log: css`
    background: ${theme.colors.background.secondary};
    border-radius: ${theme.shape.radius.default};
    padding: ${theme.spacing(2)};
    min-height: 140px;
    max-height: 220px;
    overflow-y: auto;
    font-size: ${theme.typography.bodySmall.fontSize};
    margin-bottom: ${theme.spacing(2)};
  `,
  logLine: css`
    &:not(:last-child) {
      margin-bottom: ${theme.spacing(0.5)};
    }
  `,
  placeholder: css`
    color: ${theme.colors.text.secondary};
  `,
  actions: css`
    display: flex;
    justify-content: flex-end;
  `,
  alert: css`
    margin-bottom: ${theme.spacing(2)};
  `,
});
