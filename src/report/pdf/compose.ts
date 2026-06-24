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

import { jsPDF } from 'jspdf';
import { ResolvedLayoutSettings } from '../../types/reporting';
import { throwIfAborted } from '../util/async';
import { renderBrandingArea } from './branding';
import { LogoAsset } from './logo';
import { determineGridColumns, fitRectangle, parseHexColor } from './primitives';

export interface PanelImage {
  title: string;
  dataUrl: string;
}

export interface ComposeReportPdfOptions {
  panelImages: PanelImage[];
  layout: ResolvedLayoutSettings;
  logo?: LogoAsset;
  headerHeight: number;
  footerHeight: number;
  renderWidth: number;
  renderHeight: number;
  signal?: AbortSignal;
}

/**
 * Lays the rendered panel images out across A4 pages and stamps the branding areas.
 * Returns the composed jsPDF document; saving/output is left to the caller.
 */
export const composeReportPdf = ({
  panelImages,
  layout,
  logo,
  headerHeight,
  footerHeight,
  renderWidth,
  renderHeight,
  signal,
}: ComposeReportPdfOptions): jsPDF => {
  const pdf = new jsPDF({
    orientation: layout.orientation,
    unit: 'pt',
    format: 'a4',
    compress: true,
  });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const pageMargin = layout.pageMargin;
  const panelsPerPage = Math.max(1, layout.panels.perPage);
  const panelsSpacing = Math.max(0, layout.panels.spacing);
  const gridColumns = determineGridColumns(panelsPerPage);
  const gridRows = Math.max(1, Math.ceil(panelsPerPage / gridColumns));
  const totalPages = Math.max(1, Math.ceil(panelImages.length / panelsPerPage));
  const panelsTitleEnabled = layout.panels.title.enabled;
  const panelsTitleFontSize = layout.panels.title.fontSize;
  const panelsTitleFontFamily = layout.panels.title.fontFamily;
  const panelsTitleFontStyle = layout.panels.title.fontStyle ?? 'normal';
  const panelsTitleFontColor = layout.panels.title.fontColor;
  const titleOffset = panelsTitleEnabled ? panelsTitleFontSize : 0;
  const contentOffset = panelsTitleEnabled ? panelsTitleFontSize + 4 : 0;

  // Walk through the rendered panels in chunks of `panelsPerPage`, laying them out on each PDF page.
  for (let pageIndex = 0; pageIndex < panelImages.length; pageIndex += panelsPerPage) {
    if (pageIndex > 0) {
      pdf.addPage(undefined, layout.orientation);
    }

    const pageItems = panelImages.slice(pageIndex, pageIndex + panelsPerPage);
    throwIfAborted(signal);
    const activeColumns = Math.min(gridColumns, Math.max(1, pageItems.length));
    const slotWidth = Math.max(10, (pageWidth - pageMargin * 2 - panelsSpacing * (activeColumns - 1)) / activeColumns);
    const slotHeight = Math.max(
      40,
      (pageHeight - pageMargin * 2 - headerHeight - footerHeight - panelsSpacing * (gridRows - 1)) / gridRows
    );
    for (const [slotIndex, image] of pageItems.entries()) {
      const rowIndex = Math.floor(slotIndex / activeColumns);
      const columnIndex = slotIndex % activeColumns;
      const xOffset = pageMargin + columnIndex * (slotWidth + panelsSpacing);
      const yOffset = pageMargin + headerHeight + rowIndex * (slotHeight + panelsSpacing);
      const contentHeight = Math.max(10, slotHeight - contentOffset);
      const maxImageWidth = slotWidth;
      const { width: imageWidth, height: imageHeight } = fitRectangle(
        maxImageWidth,
        contentHeight,
        renderWidth,
        renderHeight
      );
      const imageX = xOffset + (slotWidth - imageWidth) / 2;
      const imageY = yOffset + contentOffset + (contentHeight - imageHeight) / 2;

      if (panelsTitleEnabled) {
        pdf.setFont(panelsTitleFontFamily, panelsTitleFontStyle);
        pdf.setFontSize(panelsTitleFontSize);
        const rgb = parseHexColor(panelsTitleFontColor);
        if (rgb) {
          pdf.setTextColor(rgb.r, rgb.g, rgb.b);
        }
        pdf.text(image.title, xOffset, yOffset + titleOffset);
      }

      // we could implement additional downscaling of the PNG via canvas if needed
      pdf.addImage(image.dataUrl, 'PNG', imageX, imageY, imageWidth, imageHeight);
    }

    const pageNumber = Math.floor(pageIndex / panelsPerPage) + 1;

    renderBrandingArea(pdf, {
      placement: 'header',
      layoutSettings: layout,
      logo,
      areaHeight: headerHeight,
      pageWidth,
      pageHeight,
      pageNumber,
      totalPages,
    });

    renderBrandingArea(pdf, {
      placement: 'footer',
      layoutSettings: layout,
      logo,
      areaHeight: footerHeight,
      pageWidth,
      pageHeight,
      pageNumber,
      totalPages,
    });
  }

  return pdf;
};
