# Grafana Reporter Technical Guide

This document captures setup, provisioning, and runtime options for the Grafana Reporter plugin. For background, status and motivation see the repository-level `README.md`.

## Requirements

- Grafana 10.4+ (tested through 12.3.0).
- Access to the dashboards you want to export.
- Grafana rendering (`/render`) reachable from the browser. For best results deploy [grafana-image-renderer](https://github.com/grafana/grafana-image-renderer) alongside Grafana and configure:
  - `GF_RENDERING_SERVER_URL=http://grafana-renderer:8081/render`
  - `GF_RENDERING_CALLBACK_URL=http://grafana:3000/`
- Allow unsigned plugins (`GF_PLUGINS_ALLOW_LOADING_UNSIGNED_PLUGINS=datalabhell-grafanareporter-app`) unless you sign the plugin yourself.

## Usage

### Dashboard link

1. Open any dashboard and go to **Settings → Links → New link**.
2. Set the URL to `/a/datalabhell-grafanareporter-app?uid=${__dashboard.uid}`. Add the `link` type, set `title`, `icon`(e.g. `doc`) and include any options you want to pass to the reporter directly (current time range, variables values).
3. Save the dashboard. Clicking the link opens the reporter app with the current selections prefilled and triggers the report automatically because `uid` is present. Rhe resulting PDF downloads immediately.

### Report Runner page

1. Navigate to `/a/datalabhell-grafanareporter-app` (More apps → Grafana Reporter).
2. Choose a dashboard (or link there with `?uid=<dashboardUid>`) and press **Generate report**.
3. Expand **Advanced settings** to adjust timerange, timezone, theme, variables, and the global overrides for layout.
4. The live "Report URL" shows the exact link you can bookmark or share, it updates every time you change an option.

### Auto-run via URL

Pass the `uid` parameter to run immediately when the page loads. Everything else is optional. If omitted, the plugin uses the global defaults.

```
/a/datalabhell-grafanareporter-app?uid=abcd1234&from=now-6h&to=now&var-region=us&panelsPerPage=4
```

## Query parameters

| Parameter       | Description                                           | Example                       |
| --------------- | ----------------------------------------------------- | ----------------------------- |
| `uid`           | Dashboard UID (required for auto-run).                | `uid=abcd1234`                |
| `from`, `to`    | Time range (`now-6h`, epoch ms, ISO strings).         | `from=now-24h&to=now`         |
| `tz`            | Timezone (`browser`, `utc`, `Europe/Vienna`).         | `tz=browser`                  |
| `theme`         | `dark` or `light`. Defaults to user preference.       | `theme=light`                 |
| `orientation`   | `portrait` or `landscape`.                            | `orientation=landscape`       |
| `panelsPerPage` | Positive integer controlling the grid.                | `panelsPerPage=4`             |
| `panelSpacing`  | Non-negative integer (points).                        | `panelSpacing=16`             |
| `logo`          | `true`/`false`. Toggle logo.                          | `logo=false`                  |
| `logoPlacement` | `header` or `footer`. Where the logo renders.         | `logoPlacement=header`        |
| `logoAlignment` | `left`/`center`/`right`. Logo horizontal alignment.   | `logoAlignment=center`        |
| `panelTitles`   | `true`/`false`. Show panel titles above screenshots.  | `panelTitles=false`           |
| `pageNumbers`   | `true`/`false`. Show "Page X of Y".                   | `pageNumbers=true`            |
| `pagePlacement` | `header` or `footer`. Where "Page X of Y" renders.    | `pagePlacement=footer`        |
| `pageAlignment` | `left`/`center`/`right`. Alignment for "Page X of Y". | `pageAlignment=right`         |
| `var-<name>`    | Repeat for every dashboard variable value.            | `var-region=us&var-region=eu` |

## Configuration

The plugin configuration page (Administration → Plugins → Grafana Reporter or the cog icon in the app header) stores global defaults:

- Panels per page / spacing / orientation.
- Logo image + toggle + placement/alignment (header or footer).
- Panel titles toggle.
- Page numbers toggle + placement/alignment (header or footer).

These defaults are applied everywhere unless overridden via the advanced settings UI or query parameters.

To preseed defaults in provisioning, add a file under `/etc/grafana/provisioning/plugins/`. Host logo assets inside the plugin (for example under `/public/plugins/datalabhell-grafanareporter-app/img/`) so they’re served from the same origin and can be embedded in PDFs without CORS issues:

```yaml
apiVersion: 1

apps:
  - type: datalabhell-grafanareporter-app
    org_id: 1
    org_name: Main Org.
    disabled: false
    jsonData:
      layout:
        panelsPerPage: 2
        panelSpacing: 16
        orientation: 'portrait'
        logoUrl: '/public/plugins/datalabhell-grafanareporter-app/img/dlh-logo.svg'
        logoEnabled: true
        logoPlacement: 'footer'
        logoAlignment: 'left'
        showPanelTitles: true
        showPageNumbers: true
        pageNumberPlacement: 'footer'
        pageNumberAlignment: 'right'
```

Grafana writes that `jsonData` into the plugin settings, so users see those defaults immediately.

## Support & feedback

Issues and feature requests are welcome via the project repository. Contributions (bug fixes, docs, or new layout features) are gladly reviewed. Open a pull request or start a discussion describing the use case.


## Planned features

- Configurable parallell render calls to decrease report generation time
- More customization options
- Possibility to reset settings to originals
