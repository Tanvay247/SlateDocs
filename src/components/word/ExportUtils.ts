import type { Editor } from '@tiptap/react';
import type { PageMargin, PageOrientation } from './WordApp';

/* ============================================================
   Page dimension helpers (shared with PageCanvas)
   ============================================================ */

const A4_W = 816; // A4 width at 96 DPI (px)
const A4_H = 1056; // A4 height at 96 DPI (px)

function getMarginsPx(m: PageMargin) {
  switch (m) {
    case 'Narrow':   return { top: 48, bottom: 48, left: 48, right: 48 };
    case 'Moderate': return { top: 96, bottom: 96, left: 72, right: 72 };
    case 'Wide':     return { top: 96, bottom: 96, left: 192, right: 192 };
    default:         return { top: 96, bottom: 96, left: 96, right: 96 };
  }
}

function getPageDimsPx(orientation: PageOrientation) {
  const isLandscape = orientation === 'Landscape';
  return {
    pageW: isLandscape ? A4_H : A4_W,
    pageH: isLandscape ? A4_W : A4_H,
  };
}

/** Convert px (at 96 DPI) to mm. 1 inch = 25.4 mm, 1 inch = 96 px */
function pxToMm(px: number): number {
  return (px / 96) * 25.4;
}

/* ============================================================
   PDF Export
   ============================================================ */

export interface PDFExportOptions {
  pageMargin?: PageMargin;
  pageOrientation?: PageOrientation;
}

/**
 * Export the Tiptap editor content as a PDF using jsPDF + html2canvas.
 * Renders the HTML into a print-ready layout respecting the user's
 * page margin and orientation settings.
 */
export async function exportAsPDF(
  editor: Editor,
  filename: string = 'document',
  options: PDFExportOptions = {},
) {
  const { default: jsPDF } = await import('jspdf');
  const { default: html2canvas } = await import('html2canvas');

  const margin = options.pageMargin ?? 'Normal';
  const orientation = options.pageOrientation ?? 'Portrait';
  const margins = getMarginsPx(margin);
  const { pageW, pageH } = getPageDimsPx(orientation);
  const contentWidth = pageW - margins.left - margins.right;

  // Clone the editor DOM directly into an offscreen container for rendering
  const container = editor.view.dom.cloneNode(true) as HTMLElement;
  container.className = 'ProseMirror'; // Apply prosemirror.css styles

  // Adjust page-break-spacers so each spacer matches the remaining space on that page,
  // preventing text lines and content from straddling page slice boundaries in the PDF.
  container.querySelectorAll('.page-break-spacer').forEach(el => {
    const spacer = el as HTMLElement;
    spacer.style.display = 'block';
    spacer.style.visibility = 'visible';
    spacer.style.width = '100%';
    const storedRemaining = spacer.getAttribute('data-remaining-on-page');
    if (storedRemaining) {
      spacer.style.height = `${parseFloat(storedRemaining)}px`;
    } else {
      const rawH = parseFloat(spacer.style.height) || 0;
      const interGap = margins.bottom + 40 + margins.top; // 40 is PAGE_GAP
      spacer.style.height = `${Math.max(0, rawH - interGap)}px`;
    }
  });

  // Apply print-ready styles — use setProperty to NOT overwrite user inline styles
  Object.assign(container.style, {
    fontFamily: "'Geist Sans', 'Segoe UI', Arial, sans-serif",
    color: '#000',
    background: '#fff',
    width: `${contentWidth}px`,
    padding: '0',
    boxSizing: 'border-box',
    overflowWrap: 'break-word',
    wordWrap: 'break-word',
    wordBreak: 'break-word',
    position: 'absolute',
    left: '-9999px',
    top: '0',
  });

  // Default styles — only set if no inline style already present
  function setDefaultStyle(el: HTMLElement, prop: string, value: string) {
    if (!el.style.getPropertyValue(prop)) {
      el.style.setProperty(prop, value);
    }
  }

  // Default heading styles (preserve user overrides)
  container.querySelectorAll('h1').forEach(el => {
    const htmlEl = el as HTMLElement;
    setDefaultStyle(htmlEl, 'font-size', '2.25rem');
    setDefaultStyle(htmlEl, 'font-weight', '800');
    setDefaultStyle(htmlEl, 'margin-bottom', '1.5rem');
    setDefaultStyle(htmlEl, 'margin-top', '1rem');
    setDefaultStyle(htmlEl, 'color', '#000');
  });
  container.querySelectorAll('h2').forEach(el => {
    const htmlEl = el as HTMLElement;
    setDefaultStyle(htmlEl, 'font-size', '1.5rem');
    setDefaultStyle(htmlEl, 'font-weight', '700');
    setDefaultStyle(htmlEl, 'margin-bottom', '1rem');
    setDefaultStyle(htmlEl, 'margin-top', '1rem');
    setDefaultStyle(htmlEl, 'color', '#000');
  });
  container.querySelectorAll('h3').forEach(el => {
    const htmlEl = el as HTMLElement;
    setDefaultStyle(htmlEl, 'font-size', '1.25rem');
    setDefaultStyle(htmlEl, 'font-weight', '600');
    setDefaultStyle(htmlEl, 'margin-bottom', '0.75rem');
    setDefaultStyle(htmlEl, 'color', '#000');
  });

  // Default paragraph styles
  container.querySelectorAll('p').forEach(el => {
    const htmlEl = el as HTMLElement;
    setDefaultStyle(htmlEl, 'margin-bottom', '0.75rem');
    setDefaultStyle(htmlEl, 'font-size', '11pt');
    setDefaultStyle(htmlEl, 'line-height', '1.5');
    setDefaultStyle(htmlEl, 'color', '#334155');
  });

  // Explicitly style lists so Tailwind preflight doesn't strip bullets/numbers
  container.querySelectorAll('ul').forEach(el => {
    const htmlEl = el as HTMLElement;
    setDefaultStyle(htmlEl, 'list-style-type', 'disc');
    setDefaultStyle(htmlEl, 'padding-left', '1.5rem');
    setDefaultStyle(htmlEl, 'margin-bottom', '1rem');
  });
  container.querySelectorAll('ol').forEach(el => {
    const htmlEl = el as HTMLElement;
    setDefaultStyle(htmlEl, 'list-style-type', 'decimal');
    setDefaultStyle(htmlEl, 'padding-left', '1.5rem');
    setDefaultStyle(htmlEl, 'margin-bottom', '1rem');
  });
  container.querySelectorAll('li').forEach(el => {
    const htmlEl = el as HTMLElement;
    setDefaultStyle(htmlEl, 'margin-bottom', '0.25rem');
  });

  // Style blockquotes
  container.querySelectorAll('blockquote').forEach(el => {
    const htmlEl = el as HTMLElement;
    setDefaultStyle(htmlEl, 'border-left', '3px solid #cbd5e1');
    setDefaultStyle(htmlEl, 'padding-left', '1rem');
    setDefaultStyle(htmlEl, 'margin-left', '0');
    setDefaultStyle(htmlEl, 'color', '#64748b');
    setDefaultStyle(htmlEl, 'font-style', 'italic');
  });

  // Style code blocks
  container.querySelectorAll('pre').forEach(el => {
    const htmlEl = el as HTMLElement;
    setDefaultStyle(htmlEl, 'background-color', '#f1f5f9');
    setDefaultStyle(htmlEl, 'padding', '1rem');
    setDefaultStyle(htmlEl, 'border-radius', '0.25rem');
    setDefaultStyle(htmlEl, 'overflow-x', 'auto');
    setDefaultStyle(htmlEl, 'white-space', 'pre-wrap');
    setDefaultStyle(htmlEl, 'font-family', 'Courier New, monospace');
    setDefaultStyle(htmlEl, 'font-size', '13px');
  });
  container.querySelectorAll('code').forEach(el => {
    const htmlEl = el as HTMLElement;
    setDefaultStyle(htmlEl, 'font-family', 'Courier New, monospace');
    setDefaultStyle(htmlEl, 'font-size', '13px');
  });

  // Style tables
  container.querySelectorAll('table').forEach(el => {
    const htmlEl = el as HTMLElement;
    setDefaultStyle(htmlEl, 'border-collapse', 'collapse');
    setDefaultStyle(htmlEl, 'width', '100%');
    setDefaultStyle(htmlEl, 'margin', '1rem 0');
  });
  container.querySelectorAll('td, th').forEach(el => {
    const htmlEl = el as HTMLElement;
    setDefaultStyle(htmlEl, 'border', '1px solid #cbd5e1');
    setDefaultStyle(htmlEl, 'padding', '0.5rem');
    setDefaultStyle(htmlEl, 'font-size', '14px');
  });
  container.querySelectorAll('th').forEach(el => {
    const htmlEl = el as HTMLElement;
    setDefaultStyle(htmlEl, 'background-color', '#f1f5f9');
    setDefaultStyle(htmlEl, 'font-weight', '700');
  });

  // Style images
  container.querySelectorAll('img').forEach(el => {
    (el as HTMLElement).style.maxWidth = '100%';
    (el as HTMLElement).style.height = 'auto';
  });

  // Append to DOM for rendering
  document.body.appendChild(container);

  try {
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      onclone: (clonedDoc) => {
        // Sanitize oklch/oklab/color-mix CSS that html2canvas can't parse
        try {
          const sheets = clonedDoc.styleSheets;
          for (let i = sheets.length - 1; i >= 0; i--) {
            try {
              const rules = sheets[i].cssRules;
              for (let j = rules.length - 1; j >= 0; j--) {
                const ruleText = rules[j].cssText;
                if (
                  ruleText.includes('oklch(') ||
                  ruleText.includes('oklab(') ||
                  ruleText.includes('color-mix(')
                ) {
                  sheets[i].deleteRule(j);
                }
              }
            } catch {
              // Cross-origin stylesheet — skip
            }
          }
        } catch {
          // Can't access stylesheets — safe to ignore
        }
      },
    });

    // Page dimensions in mm
    const pageWMm = pxToMm(pageW);
    const pageHMm = pxToMm(pageH);
    const leftMm = pxToMm(margins.left);
    const topMm = pxToMm(margins.top);
    const contentWMm = pxToMm(contentWidth);
    const contentHMm = pxToMm(pageH - margins.top - margins.bottom);

    const isLandscape = orientation === 'Landscape';

    const pdf = new jsPDF({
      orientation: isLandscape ? 'landscape' : 'portrait',
      unit: 'mm',
      format: [pageWMm, pageHMm],
    });

    // Scale canvas to fit content width in mm
    const imgWidthMm = contentWMm;

    // Height of one page's content area in canvas pixels
    const pageSliceHeight = Math.max(1, Math.floor((contentHMm / contentWMm) * canvas.width));
    const totalCanvasPages = Math.max(1, Math.ceil(canvas.height / pageSliceHeight));

    for (let page = 0; page < totalCanvasPages; page++) {
      if (page > 0) {
        pdf.addPage([pageWMm, pageHMm], isLandscape ? 'landscape' : 'portrait');
      }

      const sliceY = page * pageSliceHeight;
      const currentSliceH = Math.min(pageSliceHeight, canvas.height - sliceY);

      // Create a per-page canvas slice
      const sliceCanvas = document.createElement('canvas');
      sliceCanvas.width = canvas.width;
      sliceCanvas.height = currentSliceH;
      const sliceCtx = sliceCanvas.getContext('2d')!;

      // Fill with white background
      sliceCtx.fillStyle = '#ffffff';
      sliceCtx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);

      // Draw the relevant slice
      sliceCtx.drawImage(
        canvas,
        0, sliceY,                      // source x, y
        canvas.width, currentSliceH,    // source w, h
        0, 0,                           // dest x, y
        canvas.width, currentSliceH     // dest w, h
      );

      const sliceData = sliceCanvas.toDataURL('image/jpeg', 0.95);
      const sliceHeightMm = (currentSliceH / canvas.width) * imgWidthMm;

      pdf.addImage(sliceData, 'JPEG', leftMm, topMm, imgWidthMm, sliceHeightMm);
    }

    const safeFilename = filename.replace(/[^a-zA-Z0-9_\-\s]/g, '').trim() || 'document';
    pdf.save(`${safeFilename}.pdf`);
  } finally {
    document.body.removeChild(container);
  }
}

/* ============================================================
   DOCX Export
   ============================================================ */

export interface DOCXExportOptions {
  pageMargin?: PageMargin;
  pageOrientation?: PageOrientation;
}

/** Decode base64 to Uint8Array in standard environments */
function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = typeof window !== 'undefined'
    ? window.atob(base64)
    : Buffer.from(base64, 'base64').toString('binary');
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/** Fetch image data or decode data URL safely with fallback */
async function resolveImageData(src: string): Promise<Uint8Array | null> {
  if (!src) return null;
  try {
    if (src.startsWith('data:')) {
      const commaIdx = src.indexOf(',');
      if (commaIdx !== -1) {
        const base64 = src.slice(commaIdx + 1);
        return base64ToUint8Array(base64);
      }
    }
    const res = await fetch(src, { mode: 'cors' });
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    return new Uint8Array(buf);
  } catch {
    return null;
  }
}

/**
 * Export the Tiptap editor content as a DOCX file using the `docx` library.
 * Converts Tiptap JSON → docx Paragraphs/TextRuns.
 */
export async function exportAsDOCX(
  editor: Editor,
  filename: string = 'document',
  options: DOCXExportOptions = {},
) {
  const docx = await import('docx');
  const {
    Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
    ExternalHyperlink, Table, TableRow, TableCell, WidthType, PageOrientation,
    LevelFormat, ImageRun,
  } = docx;

  const margin = options.pageMargin ?? 'Normal';
  const orientation = options.pageOrientation ?? 'Portrait';
  const marginsPx = getMarginsPx(margin);
  const { pageW, pageH } = getPageDimsPx(orientation);

  // Convert px to twips (1 inch = 96px = 1440 twips)
  const pxToTwips = (px: number) => Math.round((px / 96) * 1440);

  const json = editor.getJSON();
  const paragraphs: any[] = [];

  function getAlignment(attrs: any): any {
    if (!attrs?.textAlign) return undefined;
    const map: Record<string, any> = {
      left: AlignmentType.LEFT,
      center: AlignmentType.CENTER,
      right: AlignmentType.RIGHT,
      justify: AlignmentType.JUSTIFIED,
    };
    return map[attrs.textAlign];
  }

  function applyTextTransform(text: string, transform: string | undefined): string {
    if (!transform || transform === 'none') return text;
    switch (transform) {
      case 'uppercase': return text.toUpperCase();
      case 'lowercase': return text.toLowerCase();
      case 'capitalize': return text.replace(/\b\w/g, c => c.toUpperCase());
      default: return text;
    }
  }

  function getImageType(src?: string): 'png' | 'jpg' | 'gif' | 'bmp' {
    if (!src) return 'png';
    if (/data:image\/jpe?g/i.test(src) || /\.(jpe?g)(\?.*)?$/i.test(src)) return 'jpg';
    if (/data:image\/gif/i.test(src) || /\.gif(\?.*)?$/i.test(src)) return 'gif';
    if (/data:image\/bmp/i.test(src) || /\.bmp(\?.*)?$/i.test(src)) return 'bmp';
    return 'png';
  }

  async function processInlineContent(content: any[], defaultBold: boolean = false): Promise<any[]> {
    const runs: any[] = [];
    if (!content) return runs;

    for (const item of content) {
      if (item.type === 'text') {
        const marks = item.marks || [];
        const isBold = defaultBold || marks.some((m: any) => m.type === 'bold');
        const isItalic = marks.some((m: any) => m.type === 'italic');
        const isUnderline = marks.some((m: any) => m.type === 'underline');
        const isStrike = marks.some((m: any) => m.type === 'strike');
        const isSubscript = marks.some((m: any) => m.type === 'subscript');
        const isSuperscript = marks.some((m: any) => m.type === 'superscript');
        const linkMark = marks.find((m: any) => m.type === 'link');
        const textStyleMark = marks.find((m: any) => m.type === 'textStyle');
        const highlightMark = marks.find((m: any) => m.type === 'highlight');
        const textTransformMark = marks.find((m: any) => m.type === 'textTransform');

        let fontSize: number | undefined;
        let fontFamily: string | undefined;
        let color: string | undefined;

        if (textStyleMark?.attrs) {
          // Font size (stored as "Xpt")
          if (textStyleMark.attrs.fontSize) {
            const sizeStr = String(textStyleMark.attrs.fontSize);
            const parsed = parseFloat(sizeStr);
            if (!isNaN(parsed)) {
              // Convert pt to half-points (docx uses half-points)
              fontSize = Math.round(parsed * 2);
            }
          }
          // Font family
          if (textStyleMark.attrs.fontFamily) {
            fontFamily = textStyleMark.attrs.fontFamily;
          }
          // Text color
          if (textStyleMark.attrs.color) {
            color = textStyleMark.attrs.color.replace('#', '');
          }
        }

        // Apply text transform
        const transformValue = textTransformMark?.attrs?.transform;
        const text = applyTextTransform(item.text, transformValue);

        // Highlight (shading)
        let shading: any;
        if (highlightMark?.attrs?.color) {
          shading = {
            fill: highlightMark.attrs.color.replace('#', ''),
          };
        }

        const textRunOptions: any = {
          text,
          bold: isBold || undefined,
          italics: isItalic || undefined,
          underline: isUnderline ? {} : undefined,
          strike: isStrike || undefined,
          subScript: isSubscript || undefined,
          superScript: isSuperscript || undefined,
          size: fontSize,
          font: fontFamily,
          color,
          shading,
        };

        if (linkMark) {
          runs.push(
            new ExternalHyperlink({
              children: [new TextRun({ ...textRunOptions, style: 'Hyperlink' })],
              link: linkMark.attrs.href,
            })
          );
        } else {
          runs.push(new TextRun(textRunOptions));
        }
      } else if (item.type === 'hardBreak') {
        runs.push(new TextRun({ break: 1 }));
      } else if (item.type === 'image') {
        const src = item.attrs?.src;
        const imgData = src ? await resolveImageData(src) : null;
        if (imgData) {
          const width = Math.min(500, parseInt(item.attrs?.width, 10) || 300);
          const height = parseInt(item.attrs?.height, 10) || 200;
          runs.push(
            new ImageRun({
              data: imgData,
              transformation: { width, height },
            })
          );
        } else {
          const altText = item.attrs?.alt || item.attrs?.src || '[Image]';
          runs.push(new TextRun({ text: `[${altText}]`, italics: true, color: '888888' }));
        }
      }
    }

    return runs;
  }

  function getBlockSpacing(attrs: any): any {
    const spacing: any = {};
    if (attrs?.lineHeight) {
      const lh = parseFloat(attrs.lineHeight);
      if (!isNaN(lh)) {
        // Convert line-height multiplier to twips (1 line = 240 twips)
        spacing.line = Math.round(lh * 240);
      }
    }
    return Object.keys(spacing).length > 0 ? spacing : undefined;
  }

  function getBlockIndent(attrs: any): any {
    if (attrs?.indent && attrs.indent > 0) {
      return { left: attrs.indent * 720 }; // 720 twips = 0.5 inch per level
    }
    return undefined;
  }

  async function processNode(node: any, level: number = 0) {
    if (!node) return;

    switch (node.type) {
      case 'paragraph': {
        const children = await processInlineContent(node.content || []);
        if (children.length === 0) {
          children.push(new TextRun({ text: '' }));
        }
        paragraphs.push(
          new Paragraph({
            children,
            alignment: getAlignment(node.attrs),
            spacing: getBlockSpacing(node.attrs),
            indent: getBlockIndent(node.attrs),
          })
        );
        break;
      }

      case 'heading': {
        const headingLevel = node.attrs?.level || 1;
        const headingMap: Record<number, any> = {
          1: HeadingLevel.HEADING_1,
          2: HeadingLevel.HEADING_2,
          3: HeadingLevel.HEADING_3,
          4: HeadingLevel.HEADING_4,
          5: HeadingLevel.HEADING_5,
          6: HeadingLevel.HEADING_6,
        };
        const children = await processInlineContent(node.content || []);
        if (children.length === 0) {
          children.push(new TextRun({ text: '' }));
        }
        paragraphs.push(
          new Paragraph({
            children,
            heading: headingMap[headingLevel] || HeadingLevel.HEADING_1,
            alignment: getAlignment(node.attrs),
            spacing: getBlockSpacing(node.attrs),
            indent: getBlockIndent(node.attrs),
          })
        );
        break;
      }

      case 'image': {
        const src = node.attrs?.src;
        const imgData = src ? await resolveImageData(src) : null;
        if (imgData) {
          const width = Math.min(500, parseInt(node.attrs?.width, 10) || 400);
          const height = parseInt(node.attrs?.height, 10) || 300;
          paragraphs.push(
            new Paragraph({
              children: [
                new ImageRun({
                  data: imgData,
                  transformation: { width, height },
                  type: getImageType(src),
                }),
              ],
              alignment: getAlignment(node.attrs),
            })
          );
        } else {
          const altText = node.attrs?.alt || node.attrs?.src || '[Image]';
          paragraphs.push(
            new Paragraph({
              children: [new TextRun({ text: `[${altText}]`, italics: true, color: '888888' })],
            })
          );
        }
        break;
      }

      case 'bulletList': {
        if (node.content) {
          await processListItems(node, 'bullet', level);
        }
        break;
      }

      case 'orderedList': {
        if (node.content) {
          await processListItems(node, 'ordered', level);
        }
        break;
      }

      case 'blockquote': {
        if (node.content) {
          for (const child of node.content) {
            if (child.type === 'paragraph') {
              const children = await processInlineContent(child.content || []);
              if (children.length === 0) {
                children.push(new TextRun({ text: '' }));
              }
              paragraphs.push(
                new Paragraph({
                  children,
                  indent: { left: 720 },
                })
              );
            } else {
              await processNode(child, level);
            }
          }
        }
        break;
      }

      case 'codeBlock': {
        const text = node.content?.map((c: any) => c.text || '').join('') || '';
        paragraphs.push(
          new Paragraph({
            children: [
              new TextRun({
                text,
                font: 'Courier New',
                size: 20,
              }),
            ],
          })
        );
        break;
      }

      case 'horizontalRule': {
        paragraphs.push(
          new Paragraph({
            children: [new TextRun({ text: '' })],
            border: {
              bottom: { style: 'single' as any, size: 6, color: '999999' },
            },
          })
        );
        break;
      }

      case 'taskList': {
        if (node.content) {
          for (const taskItem of node.content) {
            const checked = taskItem.attrs?.checked ? '\u2611' : '\u2610';
            const inlineChildren: any[] = [];
            if (taskItem.content) {
              for (const child of taskItem.content) {
                if (child.type === 'paragraph') {
                  const runs = await processInlineContent(child.content || []);
                  inlineChildren.push(...runs);
                }
              }
            }
            paragraphs.push(
              new Paragraph({
                children: [
                  new TextRun({ text: `${checked} ` }),
                  ...inlineChildren,
                ],
                indent: level > 0 ? { left: level * 720 } : undefined,
              })
            );

            // Handle nested lists inside task items
            if (taskItem.content) {
              for (const child of taskItem.content) {
                if (['bulletList', 'orderedList', 'taskList'].includes(child.type)) {
                  await processNode(child, level + 1);
                }
              }
            }
          }
        }
        break;
      }

      case 'table': {
        if (node.content) {
          const rows: InstanceType<typeof TableRow>[] = [];
          for (const rowNode of node.content) {
            if (rowNode.type === 'tableRow' && rowNode.content) {
              const cells: InstanceType<typeof TableCell>[] = [];
              for (const cellNode of rowNode.content) {
                if (cellNode.type === 'tableCell' || cellNode.type === 'tableHeader') {
                  const isHeader = cellNode.type === 'tableHeader';
                  const cellParagraphs: InstanceType<typeof Paragraph>[] = [];
                  if (cellNode.content) {
                    for (const child of cellNode.content) {
                      if (child.type === 'paragraph') {
                        const children = await processInlineContent(child.content || [], isHeader);
                        if (children.length === 0) {
                          children.push(new TextRun({ text: '', bold: isHeader }));
                        }
                        cellParagraphs.push(
                          new Paragraph({
                            children,
                            alignment: getAlignment(child.attrs),
                            spacing: getBlockSpacing(child.attrs),
                          })
                        );
                      } else if (child.type === 'bulletList' || child.type === 'orderedList') {
                        const listType = child.type === 'bulletList' ? 'bullet' : 'ordered';
                        if (child.content) {
                          for (const li of child.content) {
                            for (const lic of li.content || []) {
                              if (lic.type === 'paragraph') {
                                const runs = await processInlineContent(lic.content || [], isHeader);
                                cellParagraphs.push(
                                  new Paragraph({
                                    children: runs.length > 0 ? runs : [new TextRun({ text: '', bold: isHeader })],
                                    bullet: listType === 'bullet' ? { level: 0 } : undefined,
                                    numbering: listType === 'ordered'
                                      ? { reference: 'default-numbering', level: 0 }
                                      : undefined,
                                    alignment: getAlignment(lic.attrs),
                                    spacing: getBlockSpacing(lic.attrs),
                                  })
                                );
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                  if (cellParagraphs.length === 0) {
                    cellParagraphs.push(new Paragraph({ children: [new TextRun({ text: '', bold: isHeader })] }));
                  }
                  cells.push(
                    new TableCell({
                      children: cellParagraphs,
                      width: { size: 0, type: WidthType.AUTO },
                      shading: isHeader ? { fill: 'F1F5F9' } : undefined,
                    })
                  );
                }
              }
              if (cells.length > 0) {
                rows.push(new TableRow({ children: cells }));
              }
            }
          }

          if (rows.length > 0) {
            paragraphs.push(
              new Table({
                rows,
                width: { size: 100, type: WidthType.PERCENTAGE },
              })
            );
          }
        }
        break;
      }

      default:
        if (node.content) {
          for (const child of node.content) {
            await processNode(child, level);
          }
        }
        break;
    }
  }

  /** Process list items with proper nesting support */
  async function processListItems(listNode: any, listType: 'bullet' | 'ordered', level: number) {
    if (!listNode.content) return;

    for (const listItem of listNode.content) {
      if (!listItem.content) continue;

      for (const child of listItem.content) {
        if (child.type === 'paragraph') {
          const children = await processInlineContent(child.content || []);
          if (children.length === 0) {
            children.push(new TextRun({ text: '' }));
          }
          paragraphs.push(
            new Paragraph({
              children,
              bullet: listType === 'bullet' ? { level } : undefined,
              numbering: listType === 'ordered'
                ? { reference: 'default-numbering', level }
                : undefined,
            })
          );
        } else if (child.type === 'bulletList') {
          await processListItems(child, 'bullet', level + 1);
        } else if (child.type === 'orderedList') {
          await processListItems(child, 'ordered', level + 1);
        } else if (child.type === 'taskList') {
          await processNode(child, level + 1);
        } else {
          await processNode(child, level);
        }
      }
    }
  }

  // Process all top-level nodes sequentially
  if (json.content) {
    for (const node of json.content) {
      await processNode(node);
    }
  }

  // If document is empty, add at least one empty paragraph
  if (paragraphs.length === 0) {
    paragraphs.push(new Paragraph({ children: [new TextRun({ text: '' })] }));
  }

  const isLandscape = orientation === 'Landscape';

  const doc = new Document({
    numbering: {
      config: [
        {
          reference: 'default-numbering',
          levels: [
            { level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.START },
            { level: 1, format: LevelFormat.LOWER_LETTER, text: '%2.', alignment: AlignmentType.START },
            { level: 2, format: LevelFormat.LOWER_ROMAN, text: '%3.', alignment: AlignmentType.START },
            { level: 3, format: LevelFormat.DECIMAL, text: '%4.', alignment: AlignmentType.START },
            { level: 4, format: LevelFormat.LOWER_LETTER, text: '%5.', alignment: AlignmentType.START },
          ],
        },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            size: {
              width: pxToTwips(pageW),
              height: pxToTwips(pageH),
              orientation: isLandscape ? PageOrientation.LANDSCAPE : PageOrientation.PORTRAIT,
            },
            margin: {
              top: pxToTwips(marginsPx.top),
              right: pxToTwips(marginsPx.right),
              bottom: pxToTwips(marginsPx.bottom),
              left: pxToTwips(marginsPx.left),
            },
          },
        },
        children: paragraphs,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);

  // Native browser download — avoids file-saver CJS interop issues
  const safeFilename = filename.replace(/[^a-zA-Z0-9_\-\s]/g, '').trim() || 'document';
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${safeFilename}.docx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
