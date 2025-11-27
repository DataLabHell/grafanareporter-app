import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { createNarrowFormStyles } from './commonStyles';

export const getAdvancedConfigStyles = (theme: GrafanaTheme2) => {
  const base = createNarrowFormStyles(theme);
  return {
    ...base,
    description: css`
      color: ${theme.colors.text.secondary};
      font-size: ${theme.typography.bodySmall.fontSize};
    `,
    fieldStack: css`
      display: flex;
      flex-direction: column;
      gap: ${theme.spacing(1)};
    `,
    header: css`
      margin: ${theme.spacing(3)} 0 ${theme.spacing(2)};
      padding: ${theme.spacing(2)} ${theme.spacing(1)};
      border-bottom: 1px solid ${theme.colors.border.weak};
      display: flex;
      justify-content: space-between;
      align-items: center;
      cursor: pointer;
      outline: none;
    `,
    inlineRow: css`
      display: flex;
      align-items: center;
      gap: ${theme.spacing(1)};
    `,
    muted: css`
      color: ${theme.colors.text.secondary};
      font-size: ${theme.typography.bodySmall.fontSize};
    `,
    overridePanel: css`
      display: flex;
      flex-direction: column;
      gap: ${theme.spacing(2)};
      padding-bottom: ${theme.spacing(2)};
    `,
    panel: css`
      display: flex;
      flex-direction: column;
      gap: ${theme.spacing(2)};
      margin-bottom: ${theme.spacing(3)};
    `,
    title: css`
      font-weight: ${theme.typography.fontWeightMedium};
      margin-bottom: ${theme.spacing(0.5)};
    `,
    urlLabel: css`
      font-weight: ${theme.typography.fontWeightMedium};
    `,
    urlPreview: css`
      display: flex;
      flex-direction: column;
      gap: ${theme.spacing(0.5)};
    `,

    urlRow: css`
      display: flex;
      align-items: center;
      gap: ${theme.spacing(1)};
    `,
    urlText: css`
      flex: 1;
      background: ${theme.colors.background.secondary};
      border-radius: ${theme.shape.radius.default};
      padding: ${theme.spacing(1)};
      word-break: break-word;
      white-space: pre-wrap;
      max-height: 90px;
      overflow-y: auto;
    `,
    subheader: css`
      margin-top: ${theme.spacing(2)};
      padding: ${theme.spacing(1)} ${theme.spacing(0.5)};
      border-bottom: 1px solid ${theme.colors.border.weak};
      display: flex;
      justify-content: space-between;
      align-items: center;
      cursor: pointer;
      outline: none;
    `,
  };
};
