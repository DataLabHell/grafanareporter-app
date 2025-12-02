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
3. Save the dashboard. Clicking the link opens the reporter app with the current selections prefilled and triggers the report automatically because `uid` is present. The resulting PDF downloads immediately.

### Report Runner Page

1. Navigate to `/a/datalabhell-grafanareporter-app` (More apps → Grafana Reporter).
2. Choose a dashboard (or link there with `?uid=<dashboardUid>`) and press **Generate report**.
3. Expand **Advanced settings** to adjust timerange, timezone, theme, variables, and the global overrides for layout.
4. The live "Report URL" shows the exact link you can bookmark or share, it updates every time you change an option.

### Auto-run via URL

Pass the `uid` parameter to run immediately when the page loads. Everything else is optional. If omitted, the plugin uses the global defaults.

```
/a/datalabhell-grafanareporter-app?uid=abcd1234&from=now-6h&to=now&var-region=us&panelsPerPage=4
```

### Configuration Page

Either navigate to the reporter app and use the Cog icon or navigate through **Administration → Plugins and data → Plugins → Grafana-Reporter**.

This page is used to set global settings, which will be the defaults for every generated report. The single settings can be overridden by query parameters or directly in the **Advanced settings** of the report runner page.

Note! When using provisioning, the global defaults might get reset when restarting your deployment.

The overrides are defined like: **Provisioning → Global Settings → Advanced Settings per run**

## Query parameters

| Parameter               | Description                                                                               | Example                              | Comments                                         |
| ----------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------ | ------------------------------------------------ |
| `uid`                   | Dashboard UID (required for auto-run).                                                    | `uid=abcd1234`                       |                                                  |
| `from`, `to`            | Time range (`now-6h`, epoch ms, ISO strings).                                             | `from=now-24h&to=now`                |                                                  |
| `tz`                    | Timezone (`browser`, `utc`, `Europe/Vienna`).                                             | `tz=browser`                         |                                                  |
| `reportTheme`           | `dark` or `light`. Defaults to user preference.                                           | `reportTheme=light`                  |                                                  |
| `orientation`           | `portrait` or `landscape`.                                                                | `orientation=landscape`              |                                                  |
| `panelsPerPage`         | Positive integer controlling the grid.                                                    | `panelsPerPage=4`                    |                                                  |
| `panelsSpacing`         | Non-negative integer (points).                                                            | `panelsSpacing=16`                   |                                                  |
| `panelsTitleEnabled`    | `true`/`false`. Toggle panel titles (layout.panels.title.enabled).                        | `panelsTitleEnabled=true`            |                                                  |
| `panelsTitleFontSize`   | Panel title font size in points (requires `panelsTitleEnabled=true`).                     | `panelsTitleFontSize=14`             |                                                  |
| `panelsTitleFontFamily` | Panel title font family (requires `panelsTitleEnabled=true`).                             | `panelsTitleFontFamily=Arial`        |                                                  |
| `panelsTitleFontColor`  | Panel title font color (requires `panelsTitleEnabled=true`).                              | `panelsTitleFontColor=#000`          |                                                  |
| `panelsWidth`           | Panel render width in px (controls render call).                                          | `panelsWidth=1600`                   |                                                  |
| `panelsHeight`          | Panel render height in px (controls render call).                                         | `panelsHeight=900`                   |                                                  |
| `pageMargin`            | Page margins in points.                                                                   | `pageMargin=32`                      |                                                  |
| `logoEnabled`           | `true`/`false`. Toggle logo.                                                              | `logoEnabled=false`                  |                                                  |
| `logoPlacement`         | `header` or `footer`. Where the logo renders.                                             | `logoPlacement=header`               |                                                  |
| `logoAlignment`         | `left`/`center`/`right`. Logo horizontal alignment.                                       | `logoAlignment=center`               |                                                  |
| `logoWidth`             | Max logo width in points.                                                                 | `logoWidth=120`                      |                                                  |
| `logoHeight`            | Max logo height in points.                                                                | `logoHeight=36`                      |                                                  |
| `pageNumberEnabled`     | `true`/`false`. Show "Page X of Y".                                                       | `pageNumberEnabled=true`             |                                                  |
| `pageNumberPlacement`   | `header` or `footer`. Where "Page X of Y" renders (requires `pageNumberEnabled=true`).    | `pageNumberPlacement=footer`         |                                                  |
| `pageNumberAlignment`   | `left`/`center`/`right`. Alignment for "Page X of Y" (requires `pageNumberEnabled=true`). | `pageNumberAlignment=right`          |                                                  |
| `pageNumberLanguage`    | `en`/`de`. Language ("Page X of Y"/"Seite X von Y") (requires `pageNumberEnabled=true`).  | `pageNumberLanguage=de`              |                                                  |
| `var-<name>`            | Repeat for every dashboard variable value.                                                | `var-region=us&var-region=eu`        |                                                  |
| `customElements`        | Display custom elements like additional texts or images, see custom elements below.       | `custom0Type=text&custom0Content=Hi` | Experimental: repeat `custom0*`, `custom1*`, ... |
| `logoUrl`               | URL or base64 image. Configure this globally; query parameter support is not available.   |                                      | Configure in plugin settings or provisioning.    |

Custom elements

Custom elements are indexed (`custom0*`, `custom1*`, ...). Omit unused properties for each element:

| Parameter             | Description                                                       | Example                   |
| --------------------- | ----------------------------------------------------------------- | ------------------------- |
| `custom[i]Type`       | `text` or `image`. Type of the custom elements.                   | `custom0Type=text`        |
| `custom[i]Content`    | Content of the custom elements.                                   | `custom0Content=abc`      |
| `custom[i]Placement`  | `header` or `footer`. Where the custom element renders.           | `custom0Placement=footer` |
| `custom[i]Alignment`  | `left`/`center`/`right`. Custom element horizontal alignment.     | `custom0Alignment=center` |
| `custom[i]FontSize`   | Custom element font size in points (requires `custom0Type=text`). | `custom0FontSize=14`      |
| `custom[i]FontFamily` | Custom element font family (requires `custom0Type=text`).         | `custom0FontFamily=Arial` |
| `custom[i]FontColor`  | Custom element font color (requires `custom0Type=text`).          | `custom0FontColor=#000`   |
| `custom[i]Width`      | Custom element width in px (requires `custom0Type=image`).        | `custom0Width=120`        |
| `custom[i]Height`     | Custom element height in px (requires `custom0Type=image`).       | `custom0Height=36`        |

## Configuration

The plugin configuration page (Administration → Plugins → Grafana Reporter or the cog icon in the app header) stores global defaults:

- Panels per page / spacing / orientation.
- Logo image + toggle + placement/alignment (header or footer).
- Panel titles toggle.
- Page numbers toggle + placement/alignment (header or footer).

These defaults are applied everywhere unless overridden via the advanced settings UI or query parameters.

Override order (highest priority last): provisioned defaults → global plugin settings → per-run advanced settings/query parameters.

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
        orientation: 'portrait'
        reportTheme: 'light'
        pageMargin: 32
        brandingTextLineHeight: 12
        brandingSectionPadding: 6
        panels:
          perPage: 4
          spacing: 16
          title:
            enabled: true
            fontFamily: 'Arial, sans-serif'
            fontSize: 22
            fontColor: '#000000'
          width: 3200
          height: 1800
        logo:
          enabled: true
          url: '/public/plugins/datalabhell-grafanareporter-app/img/dlh-logo.svg'
          placement: 'footer'
          alignment: 'left'
          width: 120
          height: 36
        pageNumber:
          enabled: true
          placement: 'footer'
          alignment: 'right'
          language: 'en'
        customElements:
          - type: 'text'
            content: 'Generated by DataLabHell Grafana Reporter'
            placement: 'footer'
            alignment: 'center'
            fontFamily: 'Arial, sans-serif'
            fontSize: 10
            fontColor: '#000000'
```

Grafana writes that `jsonData` into the plugin settings, so users see those defaults immediately.

## Support & feedback

Issues and feature requests are welcome via the project repository. Contributions (bug fixes, docs, or new layout features) are gladly reviewed. Open a pull request or start a discussion describing the use case.

## Planned features

- Configurable parallel render calls to decrease report generation time
- More customization options
- Possibility to reset settings to originals
- custom text fields e.g. "internal use only" info in footer/header
- translation option for "page x of Y"
- central logo file upload and switch via url parameter so it is not getting too long
- use grafana buildin dropdowns, file upload... instead of custom components

## Current issues

- Variable text instead of value in panel title
