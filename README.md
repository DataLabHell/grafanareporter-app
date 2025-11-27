# Grafana Reporter

Grafana Reporter is a pure Grafana app plugin that renders any dashboard directly to PDF using Grafana's `/render` endpoint. It runs entirely in the browser (no backend service or custom Chromium build) so datasource authentication and RBAC follow the user's session. The project is heavily inspired by [mahendrapaipuri/grafana-dashboard-reporter-app](https://github.com/mahendrapaipuri/grafana-dashboard-reporter-app) but focuses on a backend-less, user-scoped workflow.

## Why another plugin?

Existing dashboard-to-PDF projects often require service accounts or bundled Chromium binaries. Those approaches break SSO/impersonation, add extra infrastructure or rely on backend automation. Grafana Reporter stays lightweight:

- **No extra renderer**: we use Grafana's official [grafana-image-renderer](https://github.com/grafana/grafana-image-renderer) service, nothing else to deploy.
- **User-scoped auth**: exports happen in the browser session, so datasource permissions match the active user (no service accounts).
- **Front-end only**: no backend APIs or storage, configuration lives in Grafana's plugin settings.

## What it does

- Adds a "Reporter" app (`/a/datalabhell-grafanareporter-app`) that can be linked to from dashboards via `?uid=<dashboardUid>`.
- Lets users tweak layout (panels per page/spacing/orientation), branding (logo + placement/alignment, page numbers), timezone, theme, and variables per report.
- Generates pixel-perfect PDFs by calling `/render/d-solo/...` for every panel and composing with [jsPDF](https://github.com/parallax/jsPDF).

## Status & docs

This plugin is **incubating**. APIs and defaults may change. See [`src/README.md`](src/README.md) for setup instructions, provisioning examples, query parameters and other technical details.
