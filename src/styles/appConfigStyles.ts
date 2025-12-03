import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { createNarrowFormStyles } from './commonStyles';

export const getAppConfigStyles = (theme: GrafanaTheme2) => {
  const base = createNarrowFormStyles(theme);
  return {
    ...base,
    actions: css`
      margin-top: ${theme.spacing(3)};
    `,
    error: css`
      color: ${theme.colors.error.text};
      margin-bottom: ${theme.spacing(1)};
    `,
    fileInput: css`
      position: relative;
      overflow: hidden;
      display: inline-flex;
      align-items: center;
      padding: ${theme.spacing(1)} ${theme.spacing(1.5)};
      border: 1px solid ${theme.colors.border.weak};
      border-radius: ${theme.shape.radius.default};
      cursor: pointer;
      background: ${theme.colors.background.secondary};
      font-size: ${theme.typography.bodySmall.fontSize};
      flex-wrap: nowrap;

      input[type='file'] {
        position: absolute;
        inset: 0;
        opacity: 0;
        cursor: pointer;
      }
    `,
    inlineControls: css`
      display: flex;
      flex-wrap: wrap;
      gap: ${theme.spacing(1)};
      align-items: center;
    `,
    logoField: css`
      display: flex;
      flex-direction: column;
      gap: ${theme.spacing(1)};
    `,
    logoRow: css`
      display: flex;
      gap: ${theme.spacing(1)};
      align-items: center;
    `,
    logoPreview: css`
      margin-top: ${theme.spacing(1)};
      padding: ${theme.spacing(1)};
      border-radius: ${theme.shape.radius.default};
      border: 1px dashed ${theme.colors.border.medium};
      background: ${theme.colors.background.secondary};
      max-width: 240px;

      img {
        max-width: 100%;
        height: auto;
        display: block;
      }
    `,
  };
};
