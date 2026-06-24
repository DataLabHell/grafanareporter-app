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

import { jsPDF, TextOptionsLight } from 'jspdf';
import { LayoutAlignment, LayoutPlacement, ResolvedLayoutSettings } from '../../types/reporting';
import { fitRectangle, parseHexColor } from './primitives';
import { LogoAsset } from './logo';

export const getBrandingReservedHeight = (
  placement: LayoutPlacement,
  layout: ResolvedLayoutSettings,
  logo?: LogoAsset
) => {
  const logoDimensions =
    layout.logo.enabled && layout.logo.placement === placement && logo
      ? fitRectangle(layout.logo.width, layout.logo.height, logo.width, logo.height)
      : undefined;
  const showNumbers = layout.pageNumber.enabled && layout.pageNumber.placement === placement;

  let maxHeight = logoDimensions?.height ?? 0;

  const textLineHeight = placement === 'footer' ? layout.footer.lineHeight : layout.header.lineHeight;
  if (showNumbers) {
    maxHeight = Math.max(maxHeight, textLineHeight);
  }

  layout.customElements
    .filter((element) => element.type === 'text' && element.placement === placement)
    .forEach((element) => {
      if (element.fontSize !== undefined) {
        maxHeight = Math.max(maxHeight, element.fontSize);
      } else {
        maxHeight = Math.max(maxHeight, textLineHeight);
      }
    });

  if (maxHeight <= 0) {
    return 0;
  }

  const padding = placement === 'header' ? layout.header.padding : layout.footer.padding;
  return maxHeight + padding * 2;
};

export const renderBrandingArea = (
  pdf: jsPDF,
  options: {
    placement: LayoutPlacement;
    layoutSettings: ResolvedLayoutSettings;
    logo?: LogoAsset;
    areaHeight: number;
    pageWidth: number;
    pageHeight: number;
    pageNumber: number;
    totalPages: number;
  }
) => {
  const { placement, layoutSettings, logo, areaHeight, pageWidth, pageHeight, pageNumber, totalPages } = options;

  if (!areaHeight) {
    return;
  }

  const logoDimensions =
    layoutSettings.logo.enabled && layoutSettings.logo.placement === placement && logo
      ? fitRectangle(layoutSettings.logo.width, layoutSettings.logo.height, logo.width, logo.height)
      : undefined;
  const showNumbers = layoutSettings.pageNumber.enabled && layoutSettings.pageNumber.placement === placement;

  if (!logoDimensions && !showNumbers) {
    // We may still render custom elements; continue.
  }

  const padding = placement === 'header' ? layoutSettings.header.padding : layoutSettings.footer.padding;
  const areaTop = placement === 'header' ? padding : pageHeight - areaHeight + padding;
  const centerY = areaTop + (areaHeight - padding * 2) / 2;

  if (logoDimensions && logo) {
    const logoX = getAlignedX(layoutSettings.logo.alignment, logoDimensions.width, pageWidth, layoutSettings.pageMargin);
    const logoY = centerY - logoDimensions.height / 2;
    pdf.addImage(logo.dataUrl, 'PNG', logoX, logoY, logoDimensions.width, logoDimensions.height);
  }

  if (showNumbers) {
    const language = layoutSettings.pageNumber.language;
    let label = '';
    if (language === 'de') {
      label = `Seite ${pageNumber} von ${totalPages}`;
    } else {
      label = `Page ${pageNumber} of ${totalPages}`;
    }
    const textLineHeight = placement === 'footer' ? layoutSettings.footer.lineHeight : layoutSettings.header.lineHeight;
    const textY = centerY + textLineHeight / 3;
    pdf.setFont(layoutSettings.pageNumber.fontFamily, layoutSettings.pageNumber.fontStyle ?? 'normal');
    pdf.setFontSize(layoutSettings.pageNumber.fontSize);
    const pageNumberColor = parseHexColor(layoutSettings.pageNumber.fontColor);
    if (pageNumberColor) {
      pdf.setTextColor(pageNumberColor.r, pageNumberColor.g, pageNumberColor.b);
    }
    const { textX, textOptions } = getAlignedTextPosition(
      layoutSettings.pageNumber.alignment,
      pageWidth,
      layoutSettings.pageMargin
    );
    pdf.text(label, textX, textY, textOptions);
  }

  layoutSettings.customElements
    .filter((element) => element.type === 'text' && element.placement === placement)
    .forEach((element) => {
      const fontSize =
        element.fontSize ??
        (placement === 'footer' ? layoutSettings.footer.lineHeight : layoutSettings.header.lineHeight);
      pdf.setFont(
        element.fontFamily ?? layoutSettings.pageNumber.fontFamily,
        element.fontStyle ?? layoutSettings.pageNumber.fontStyle ?? 'normal'
      );
      pdf.setFontSize(fontSize);
      const color = parseHexColor(element.fontColor ?? layoutSettings.pageNumber.fontColor);
      if (color) {
        pdf.setTextColor(color.r, color.g, color.b);
      }
      const textY = centerY + fontSize / 3;
      const { textX, textOptions } = getAlignedTextPosition(element.alignment, pageWidth, layoutSettings.pageMargin);
      pdf.text(element.content, textX, textY, textOptions);
    });
};

const getAlignedX = (alignment: LayoutAlignment, contentWidth: number, pageWidth: number, pageMargin: number) => {
  if (alignment === 'center') {
    return pageWidth / 2 - contentWidth / 2;
  }
  if (alignment === 'right') {
    return pageWidth - pageMargin - contentWidth;
  }
  return pageMargin;
};

const getAlignedTextPosition = (
  alignment: LayoutAlignment,
  pageWidth: number,
  pageMargin: number
): {
  textX: number;
  textOptions?: TextOptionsLight;
} => {
  if (alignment === 'center') {
    return {
      textX: pageWidth / 2,
      textOptions: { align: 'center' },
    };
  }

  if (alignment === 'right') {
    return {
      textX: pageWidth - pageMargin,
      textOptions: { align: 'right' },
    };
  }

  return {
    textX: pageMargin,
  };
};
