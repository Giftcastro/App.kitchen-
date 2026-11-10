/**
 * Services/Export — file downloads with pure JavaScript document writers:
 *
 *  - PdfWriter: generates standard PDF 1.4 documents with vector graphics, colors,
 *    tables, checkboxes, dashed cut-lines, and multi-column layouts without native dependencies
 *  - XlsxWriter: generates valid Office Open XML (.xlsx) ZIP archives with full styles.xml
 *    (colors, bold fonts, fills, borders, merged cells, formulas, and column widths)
 *  - shareFile: handles Web blob downloads and Mobile Share sheets
 */
import { Platform, Share } from 'react-native';

// ── Bytes & ZIP helpers ──────────────────────────────────────────────────

function utf8(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

function latin1(s: string): Uint8Array {
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i) & 0xff;
  return out;
}

function concat(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

// Standard CRC-32 for ZIP archive generation
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function u16(v: number): Uint8Array {
  return new Uint8Array([v & 0xff, (v >>> 8) & 0xff]);
}

function u32(v: number): Uint8Array {
  return new Uint8Array([v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff, (v >>> 24) & 0xff]);
}

/**
 * Packs a list of { path, data } files into a valid uncompressed ZIP archive (STORE method).
 * Used to produce real Office Open XML (.xlsx) workbooks in pure JS.
 */
function buildZip(files: { path: string; data: Uint8Array }[]): Uint8Array {
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;

  for (const file of files) {
    const nameBytes = utf8(file.path);
    const crc = crc32(file.data);
    const size = file.data.length;

    const localHeader = concat([
      u32(0x04034b50), // Local file header signature
      u16(20),         // Version needed to extract (2.0)
      u16(0),          // General purpose bit flag
      u16(0),          // Compression method (0 = STORE)
      u16(0),          // Last mod file time
      u16(0x5421),     // Last mod file date
      u32(crc),        // CRC-32
      u32(size),       // Compressed size
      u32(size),       // Uncompressed size
      u16(nameBytes.length),
      u16(0),          // Extra field length
      nameBytes,
    ]);

    localParts.push(localHeader, file.data);

    const centralHeader = concat([
      u32(0x02014b50), // Central directory file header signature
      u16(20),         // Version made by
      u16(20),         // Version needed to extract
      u16(0),          // General purpose bit flag
      u16(0),          // Compression method (0 = STORE)
      u16(0),          // Last mod file time
      u16(0x5421),     // Last mod file date
      u32(crc),        // CRC-32
      u32(size),       // Compressed size
      u32(size),       // Uncompressed size
      u16(nameBytes.length),
      u16(0),          // Extra field length
      u16(0),          // File comment length
      u16(0),          // Disk number start
      u16(0),          // Internal file attributes
      u32(0),          // External file attributes
      u32(offset),     // Relative offset of local header
      nameBytes,
    ]);

    centralParts.push(centralHeader);
    offset += localHeader.length + size;
  }

  const centralDir = concat(centralParts);
  const eocd = concat([
    u32(0x06054b50), // End of central directory signature
    u16(0),          // Number of this disk
    u16(0),          // Disk where central directory starts
    u16(files.length),
    u16(files.length),
    u32(centralDir.length),
    u32(offset),
    u16(0),          // Comment length
  ]);

  return concat([...localParts, centralDir, eocd]);
}

// ── PDF 1.4 Vector & Typography Engine ───────────────────────────────────

export type PdfFont = 'Normal' | 'Bold' | 'Mono';
export type PdfRGB = [number, number, number]; // 0..1 components

interface PdfLine {
  text: string;
  font: PdfFont;
  size: number;
  gapAfter: number;
}

export const PAGE_W = 595; // A4 width in pt
export const PAGE_H = 842; // A4 height in pt
const MARGIN_L = 40;
const MARGIN_T = 50;
const MARGIN_B = 50;
const PAGE_BREAK = -1;

export const PDF_COLORS = {
  black: [0.067, 0.067, 0.067] as PdfRGB,      // #111111
  darkGrey: [0.2, 0.2, 0.2] as PdfRGB,         // #333333
  midGrey: [0.4, 0.4, 0.4] as PdfRGB,          // #666666
  lightGreyText: [0.55, 0.55, 0.55] as PdfRGB, // #8C8C8C
  white: [1, 1, 1] as PdfRGB,                  // #FFFFFF
  redBanner: [0.776, 0.157, 0.157] as PdfRGB,  // #C62828
  pinkFill: [0.992, 0.925, 0.925] as PdfRGB,   // #FDECEC
  greyFill: [0.949, 0.949, 0.949] as PdfRGB,   // #F2F2F2
  stickerBar: [0.937, 0.937, 0.937] as PdfRGB, // #EFEFEF
  greenFill: [0.91, 0.961, 0.914] as PdfRGB,   // #E8F5E9
  greenText: [0.18, 0.49, 0.196] as PdfRGB,    // #2E7D32
  borderLight: [0.878, 0.878, 0.878] as PdfRGB,// #E0E0E0
  borderMid: [0.75, 0.75, 0.75] as PdfRGB,     // #BFBFBF
};

export function sanitizePdf(text: string): string {
  let out = '';
  for (const raw of String(text ?? '')) {
    let ch = raw;
    if (ch === '—' || ch === '–') ch = '-';
    else if (ch === '×') ch = 'x';
    else if (ch === '·') ch = '\xB7'; // middle dot in WinAnsi
    else if (ch === '•') ch = '\x95'; // bullet in WinAnsi
    else if (ch === '‘' || ch === '’') ch = "'";
    else if (ch === '“' || ch === '”') ch = '"';
    else if (ch === '…') ch = '...';
    else if (ch === '✓' || ch === '✔') ch = 'v';
    const code = ch.charCodeAt(0);
    if ((code >= 32 && code <= 126) || code === 0xb7 || code === 0x95 || (code >= 160 && code <= 255)) {
      out += ch;
    } else {
      out += '';
    }
  }
  return out;
}

const escapePdf = (s: string) => s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');

/**
 * Estimates the width in points of a string in Helvetica / Helvetica-Bold / Courier
 * so we can accurately right-align, center, and wrap text.
 */
export function measurePdfText(text: string, size: number, font: PdfFont = 'Normal'): number {
  const clean = sanitizePdf(text);
  if (font === 'Mono') return clean.length * size * 0.6;
  let units = 0;
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if ('ilI.,:;!| '.includes(ch)) units += 278;
    else if ('ftj()[]"\'-'.includes(ch)) units += 333;
    else if ('mwMW@%'.includes(ch)) units += 833;
    else if (ch >= 'A' && ch <= 'Z') units += font === 'Bold' ? 680 : 650;
    else units += font === 'Bold' ? 560 : 525;
  }
  return (units / 1000) * size;
}

/**
 * Wraps text into lines that fit within `maxWidth` points.
 */
export function wrapPdfText(text: string, maxWidth: number, size: number, font: PdfFont = 'Normal'): string[] {
  const clean = sanitizePdf(text);
  if (!clean) return [''];
  const words = clean.split(/\s+/);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (measurePdfText(candidate, size, font) <= maxWidth || !current) {
      current = candidate;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines.length > 0 ? lines : [''];
}

export class PdfWriter {
  private lines: PdfLine[] = [];
  private rawPages: string[][] = [];
  private useRawMode = false;

  // ── Flow mode methods (legacy compatibility) ───────────────────────────

  heading(text: string, size = 16, gapAfter = 4) {
    this.lines.push({ text: sanitizePdf(text), font: 'Bold', size, gapAfter });
  }

  subHeading(text: string, size = 11, gapAfter = 2) {
    this.lines.push({ text: sanitizePdf(text), font: 'Bold', size, gapAfter });
  }

  text(text: string, size = 9, gapAfter = 0) {
    this.lines.push({ text: sanitizePdf(text), font: 'Normal', size, gapAfter });
  }

  mono(text: string, size = 8, gapAfter = 0) {
    this.lines.push({ text: sanitizePdf(text), font: 'Mono', size, gapAfter });
  }

  blank(gap = 8) {
    this.lines.push({ text: '', font: 'Normal', size: 0, gapAfter: gap });
  }

  rule(len = 64) {
    this.mono('-'.repeat(len), 8, 2);
  }

  pageBreak() {
    if (this.useRawMode) {
      this.newPage();
    } else {
      this.lines.push({ text: '', font: 'Normal', size: 0, gapAfter: PAGE_BREAK });
    }
  }

  // ── Coordinate / Canvas mode methods (for YKC rich layouts) ────────────

  private ensureRawPage() {
    this.useRawMode = true;
    if (this.rawPages.length === 0) {
      this.rawPages.push([]);
    }
  }

  newPage(): number {
    this.useRawMode = true;
    this.rawPages.push([]);
    return this.rawPages.length - 1;
  }

  get pageCount(): number {
    return this.useRawMode ? Math.max(1, this.rawPages.length) : 1;
  }

  private pushCmd(cmd: string) {
    this.ensureRawPage();
    this.rawPages[this.rawPages.length - 1].push(cmd);
  }

  /**
   * Draws a filled rectangle where `topY` is distance from the TOP of the page (0 = top, 842 = bottom),
   * or standard PDF bottom-up `y` if using `fillRectPdf`.
   * Using top-down coordinates (`x` from left, `topY` from top) makes document layout much cleaner!
   */
  fillRect(x: number, topY: number, w: number, h: number, color: PdfRGB) {
    const pdfY = PAGE_H - topY - h;
    const [r, g, b] = color;
    this.pushCmd(`${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} rg ${x.toFixed(2)} ${pdfY.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re f`);
  }

  strokeRect(x: number, topY: number, w: number, h: number, color: PdfRGB, lineWidth = 0.75) {
    const pdfY = PAGE_H - topY - h;
    const [r, g, b] = color;
    this.pushCmd(`q ${lineWidth.toFixed(2)} w ${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} RG ${x.toFixed(2)} ${pdfY.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re S Q`);
  }

  fillAndStrokeRect(
    x: number,
    topY: number,
    w: number,
    h: number,
    fillColor: PdfRGB,
    strokeColor: PdfRGB,
    lineWidth = 0.75
  ) {
    const pdfY = PAGE_H - topY - h;
    const [fr, fg, fb] = fillColor;
    const [sr, sg, sb] = strokeColor;
    this.pushCmd(
      `q ${lineWidth.toFixed(2)} w ${fr.toFixed(3)} ${fg.toFixed(3)} ${fb.toFixed(3)} rg ${sr.toFixed(3)} ${sg.toFixed(3)} ${sb.toFixed(3)} RG ${x.toFixed(2)} ${pdfY.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re B Q`
    );
  }

  drawLine(x1: number, topY1: number, x2: number, topY2: number, color: PdfRGB = PDF_COLORS.borderLight, lineWidth = 0.6) {
    const y1 = PAGE_H - topY1;
    const y2 = PAGE_H - topY2;
    const [r, g, b] = color;
    this.pushCmd(`q ${lineWidth.toFixed(2)} w ${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} RG ${x1.toFixed(2)} ${y1.toFixed(2)} m ${x2.toFixed(2)} ${y2.toFixed(2)} l S Q`);
  }

  drawDashedLine(x1: number, topY1: number, x2: number, topY2: number, color: PdfRGB = PDF_COLORS.borderMid, lineWidth = 0.75) {
    const y1 = PAGE_H - topY1;
    const y2 = PAGE_H - topY2;
    const [r, g, b] = color;
    this.pushCmd(`q ${lineWidth.toFixed(2)} w [3 3] 0 d ${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} RG ${x1.toFixed(2)} ${y1.toFixed(2)} m ${x2.toFixed(2)} ${y2.toFixed(2)} l S Q`);
  }

  drawCheckbox(x: number, topY: number, size = 8.5, strokeColor: PdfRGB = PDF_COLORS.darkGrey, lineWidth = 0.85) {
    this.strokeRect(x, topY, size, size, strokeColor, lineWidth);
  }

  /**
   * Draws text with baseline at `topY` (measured from top of page).
   */
  textAt(
    x: number,
    topY: number,
    text: string,
    size = 9,
    font: PdfFont = 'Normal',
    color: PdfRGB = PDF_COLORS.black
  ) {
    const clean = sanitizePdf(text);
    if (!clean) return;
    const pdfY = PAGE_H - topY;
    const fontName = font === 'Bold' ? 'F2' : font === 'Mono' ? 'F3' : 'F1';
    const [r, g, b] = color;
    this.pushCmd(
      `BT ${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)} rg /${fontName} ${size.toFixed(2)} Tf ${x.toFixed(2)} ${pdfY.toFixed(2)} Td (${escapePdf(clean)}) Tj ET`
    );
  }

  rightTextAt(
    rightX: number,
    topY: number,
    text: string,
    size = 9,
    font: PdfFont = 'Normal',
    color: PdfRGB = PDF_COLORS.black
  ) {
    const w = measurePdfText(text, size, font);
    this.textAt(rightX - w, topY, text, size, font, color);
  }

  centerTextAt(
    centerX: number,
    topY: number,
    text: string,
    size = 9,
    font: PdfFont = 'Normal',
    color: PdfRGB = PDF_COLORS.black
  ) {
    const w = measurePdfText(text, size, font);
    this.textAt(centerX - w / 2, topY, text, size, font, color);
  }

  /**
   * Renders the signature "your kitchen co." brand wordmark at the given right edge and baseline topY.
   */
  drawBrandLogo(rightX: number, topY: number, size = 16) {
    const label = 'your kitchen co.';
    const w = measurePdfText(label, size, 'Normal');
    const startX = rightX - w;
    this.textAt(startX, topY, label, size, 'Normal', PDF_COLORS.darkGrey);
    // Subtle underline bar under "kitchen"
    this.drawLine(startX + w * 0.25, topY + 3.5, startX + w * 0.78, topY + 3.5, PDF_COLORS.borderLight, 0.7);
  }

  build(): Uint8Array {
    let pages: string[][];

    if (this.useRawMode) {
      pages = this.rawPages.length > 0 ? this.rawPages : [[]];
    } else {
      pages = [[]];
      let y = PAGE_H - MARGIN_T;

      for (const l of this.lines) {
        if (l.gapAfter === PAGE_BREAK) {
          pages.push([]);
          y = PAGE_H - MARGIN_T;
          continue;
        }
        const fontName = l.font === 'Bold' ? 'F2' : l.font === 'Mono' ? 'F3' : 'F1';
        const leading = l.size > 0 ? l.size * 1.25 : 0;
        if (l.size > 0 && y - leading < MARGIN_B) {
          pages.push([]);
          y = PAGE_H - MARGIN_T;
        }
        if (l.size > 0) {
          y -= leading;
          pages[pages.length - 1].push(`BT /${fontName} ${l.size} Tf ${MARGIN_L} ${y.toFixed(1)} Td (${escapePdf(l.text)}) Tj ET`);
        }
        y -= l.gapAfter;
      }
    }

    const objects: string[] = [];
    const pushObj = (body: string) => {
      objects.push(body);
      return objects.length;
    };

    const pagesRootId = 1;
    const font1Id = 2;
    const font2Id = 3;
    const font3Id = 4;
    pushObj(''); // 1 placeholder
    pushObj('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'); // 2
    pushObj('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>'); // 3
    pushObj('<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>'); // 4

    const pageIds: number[] = [];
    for (const p of pages) {
      const stream = p.join('\n');
      const streamBytes = latin1(stream);
      const contentId = pushObj(`<< /Length ${streamBytes.length} >>\nstream\n${stream}\nendstream`);
      const pageId = pushObj(
        `<< /Type /Page /Parent ${pagesRootId} 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] ` +
          `/Resources << /Font << /F1 ${font1Id} 0 R /F2 ${font2Id} 0 R /F3 ${font3Id} 0 R >> >> ` +
          `/Contents ${contentId} 0 R >>`
      );
      pageIds.push(pageId);
    }

    objects[pagesRootId - 1] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`;
    const catalogId = pushObj(`<< /Type /Catalog /Pages ${pagesRootId} 0 R >>`);

    const header = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n';
    let pdf = header;
    const offsets: number[] = [];
    for (let i = 0; i < objects.length; i++) {
      offsets.push(pdf.length);
      pdf += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
    }
    const xrefOffset = pdf.length;
    pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    for (const off of offsets) pdf += `${String(off).padStart(10, '0')} 00000 n \n`;
    pdf += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
    return latin1(pdf);
  }
}

// ── XlsxWriter (Full Office Open XML .xlsx with YKC Styles) ──────────────

const escapeXml = (s: string) =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/**
 * Style indices defined in `xl/styles.xml` matching `YKC_Daily_Kitchen_Documents.xlsx`:
 *  0: Default (10pt Calibri/Arial, normal, bottom border #E5E5E5)
 *  1: Black Header (#111111 fill, white bold 10pt)
 *  2: Bold Cell (10pt bold #111111)
 *  3: Red Text Cell (10pt normal #C62828, wrapText)
 *  4: Red Bold Text Cell (10pt bold #C62828, wrapText)
 *  5: Allergy Row Normal Cell (#FDECEC fill, 10pt normal #111111)
 *  6: Allergy Row Bold Cell (#FDECEC fill, 10pt bold #111111)
 *  7: Allergy Row Red Bold Cell (#FDECEC fill, 10pt bold #C62828, wrapText)
 *  8: Title 20pt Bold (#111111)
 *  9: Subtitle 10pt Grey (#666666)
 * 10: Summary 13pt Bold (#111111)
 * 11: Red Banner (#C62828 fill, white bold 11pt)
 * 12: Category Grey Bar (#F2F2F2 fill, bold 11pt #111111)
 * 13: Company Black Banner (#111111 fill, white bold 14pt)
 * 14: Qty Bold 13pt Centered (#111111)
 * 15: Delivery Report Grey Header (#F2F2F2 fill, bold 8pt #666666)
 */
export const XLSX_STYLE = {
  DEFAULT: 0,
  BLACK_HEADER: 1,
  BOLD: 2,
  RED_TEXT: 3,
  RED_BOLD: 4,
  ALLERGY_NORMAL: 5,
  ALLERGY_BOLD: 6,
  ALLERGY_RED_BOLD: 7,
  TITLE_XL: 8,
  SUBTITLE_GREY: 9,
  SUMMARY_BOLD: 10,
  RED_BANNER: 11,
  GREY_BAR: 12,
  COMPANY_BANNER: 13,
  QTY_BOLD: 14,
  REPORT_HEADER: 15,
} as const;

export interface XlsxCellInput {
  value?: string | number | null;
  formula?: string;
  style?: number;
}

export type XlsxRowCell = string | number | null | undefined | XlsxCellInput;

export class XlsxSheet {
  private colWidths: number[] = [];
  private rows: string[] = [];
  private merges: string[] = [];

  constructor(public readonly name: string) {}

  widths(...w: number[]) {
    this.colWidths = w;
    return this;
  }

  get currentRow(): number {
    return this.rows.length;
  }

  merge(range: string) {
    this.merges.push(range);
    return this;
  }

  header(...cells: string[]) {
    const rowNum = this.rows.length + 1;
    this.rows.push(
      `<row r="${rowNum}" ht="22" customHeight="1">` +
        cells
          .map(
            (c, i) =>
              `<c r="${this.col(i)}${rowNum}" s="${XLSX_STYLE.BLACK_HEADER}" t="inlineStr"><is><t>${escapeXml(c)}</t></is></c>`
          )
          .join('') +
        '</row>'
    );
    return this;
  }

  styledRow(cells: XlsxRowCell[], defaultStyle: number = XLSX_STYLE.DEFAULT, height?: number) {
    const rowNum = this.rows.length + 1;
    const htAttr = height ? ` ht="${height}" customHeight="1"` : '';
    this.rows.push(
      `<row r="${rowNum}"${htAttr}>` +
        cells
          .map((cell, i) => {
            const ref = `${this.col(i)}${rowNum}`;
            const isObj = cell !== null && typeof cell === 'object' && ('value' in cell || 'formula' in cell || 'style' in cell);
            const val = isObj ? (cell as XlsxCellInput).value : (cell as string | number | null | undefined);
            const formula = isObj ? (cell as XlsxCellInput).formula : undefined;
            const style = isObj && (cell as XlsxCellInput).style !== undefined ? (cell as XlsxCellInput).style! : defaultStyle;
            const sAttr = style > 0 ? ` s="${style}"` : '';

            if (formula) {
              const cached = typeof val === 'number' ? `<v>${val}</v>` : '';
              return `<c r="${ref}"${sAttr}><f>${escapeXml(formula)}</f>${cached}</c>`;
            }
            if (val === null || val === undefined || val === '') {
              return style > 0 ? `<c r="${ref}"${sAttr}/>` : `<c r="${ref}"/>`;
            }
            if (typeof val === 'number') {
              return `<c r="${ref}"${sAttr}><v>${val}</v></c>`;
            }
            return `<c r="${ref}"${sAttr} t="inlineStr"><is><t xml:space="preserve">${escapeXml(String(val))}</t></is></c>`;
          })
          .join('') +
        '</row>'
    );
    return this;
  }

  row(...cells: (string | number | null | undefined)[]) {
    return this.styledRow(cells, XLSX_STYLE.DEFAULT);
  }

  blank(height?: number) {
    const rowNum = this.rows.length + 1;
    const htAttr = height ? ` ht="${height}" customHeight="1"` : '';
    this.rows.push(`<row r="${rowNum}"${htAttr}/>`);
    return this;
  }

  col(idx: number): string {
    let s = '';
    idx += 1;
    while (idx > 0) {
      const rem = (idx - 1) % 26;
      s = String.fromCharCode(65 + rem) + s;
      idx = Math.floor((idx - 1) / 26);
    }
    return s;
  }

  buildXml(): string {
    const cols =
      this.colWidths.length === 0
        ? ''
        : '<cols>' +
          this.colWidths
            .map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`)
            .join('') +
          '</cols>';
    const mergeXml =
      this.merges.length === 0
        ? ''
        : `<mergeCells count="${this.merges.length}">` +
          this.merges.map((ref) => `<mergeCell ref="${ref}"/>`).join('') +
          '</mergeCells>';
    return (
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      cols +
      '<sheetData>' +
      this.rows.join('') +
      '</sheetData>' +
      mergeXml +
      '</worksheet>'
    );
  }
}

function buildStylesXml(): string {
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    // Fonts (0..10)
    '<fonts count="11">' +
    '<font><sz val="10"/><color rgb="FF111111"/><name val="Calibri"/></font>' + // 0: normal 10pt
    '<font><b/><sz val="10"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>' + // 1: white bold 10pt
    '<font><b/><sz val="10"/><color rgb="FF111111"/><name val="Calibri"/></font>' + // 2: black bold 10pt
    '<font><sz val="10"/><color rgb="FFC62828"/><name val="Calibri"/></font>' + // 3: red normal 10pt
    '<font><b/><sz val="10"/><color rgb="FFC62828"/><name val="Calibri"/></font>' + // 4: red bold 10pt
    '<font><b/><sz val="18"/><color rgb="FF111111"/><name val="Calibri"/></font>' + // 5: title 18pt bold
    '<font><sz val="10"/><color rgb="FF666666"/><name val="Calibri"/></font>' + // 6: subtitle grey 10pt
    '<font><b/><sz val="12"/><color rgb="FF111111"/><name val="Calibri"/></font>' + // 7: summary 12pt bold
    '<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>' + // 8: white bold 11pt
    '<font><b/><sz val="14"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>' + // 9: white bold 14pt
    '<font><b/><sz val="8"/><color rgb="FF666666"/><name val="Calibri"/></font>' + // 10: grey bold 8pt
    '</fonts>' +
    // Fills (0..5) — 0 and 1 are reserved by Excel (none & gray125)
    '<fills count="6">' +
    '<fill><patternFill patternType="none"/></fill>' + // 0
    '<fill><patternFill patternType="gray125"/></fill>' + // 1
    '<fill><patternFill patternType="solid"><fgColor rgb="FF111111"/><bgColor indexed="64"/></patternFill></fill>' + // 2: #111111 black
    '<fill><patternFill patternType="solid"><fgColor rgb="FFFDECEC"/><bgColor indexed="64"/></patternFill></fill>' + // 3: #FDECEC light red
    '<fill><patternFill patternType="solid"><fgColor rgb="FFC62828"/><bgColor indexed="64"/></patternFill></fill>' + // 4: #C62828 red banner
    '<fill><patternFill patternType="solid"><fgColor rgb="FFF2F2F2"/><bgColor indexed="64"/></patternFill></fill>' + // 5: #F2F2F2 light grey
    '</fills>' +
    // Borders (0..1)
    '<borders count="2">' +
    '<border><left/><right/><top/><bottom/><diagonal/></border>' + // 0: none
    '<border><left/><right/><top/><bottom style="thin"><color rgb="FFE5E5E5"/></bottom><diagonal/></border>' + // 1: thin bottom line
    '</borders>' +
    '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
    // Cell Xfs (0..15) matching XLSX_STYLE
    '<cellXfs count="16">' +
    '<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1"><alignment vertical="center"/></xf>' + // 0: DEFAULT
    '<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"><alignment vertical="center"/></xf>' + // 1: BLACK_HEADER
    '<xf numFmtId="0" fontId="2" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1"><alignment vertical="center"/></xf>' + // 2: BOLD
    '<xf numFmtId="0" fontId="3" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1"><alignment vertical="center" wrapText="1"/></xf>' + // 3: RED_TEXT
    '<xf numFmtId="0" fontId="4" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1"><alignment vertical="center" wrapText="1"/></xf>' + // 4: RED_BOLD
    '<xf numFmtId="0" fontId="0" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"><alignment vertical="center"/></xf>' + // 5: ALLERGY_NORMAL
    '<xf numFmtId="0" fontId="2" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"><alignment vertical="center"/></xf>' + // 6: ALLERGY_BOLD
    '<xf numFmtId="0" fontId="4" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"><alignment vertical="center" wrapText="1"/></xf>' + // 7: ALLERGY_RED_BOLD
    '<xf numFmtId="0" fontId="5" fillId="0" borderId="0" xfId="0" applyFont="1"><alignment vertical="center"/></xf>' + // 8: TITLE_XL
    '<xf numFmtId="0" fontId="6" fillId="0" borderId="0" xfId="0" applyFont="1"><alignment vertical="center"/></xf>' + // 9: SUBTITLE_GREY
    '<xf numFmtId="0" fontId="7" fillId="0" borderId="0" xfId="0" applyFont="1"><alignment vertical="center"/></xf>' + // 10: SUMMARY_BOLD
    '<xf numFmtId="0" fontId="8" fillId="4" borderId="0" xfId="0" applyFont="1" applyFill="1"><alignment vertical="center"/></xf>' + // 11: RED_BANNER
    '<xf numFmtId="0" fontId="7" fillId="5" borderId="0" xfId="0" applyFont="1" applyFill="1"><alignment vertical="center"/></xf>' + // 12: GREY_BAR
    '<xf numFmtId="0" fontId="9" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"><alignment vertical="center"/></xf>' + // 13: COMPANY_BANNER
    '<xf numFmtId="0" fontId="7" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1"><alignment horizontal="center" vertical="center"/></xf>' + // 14: QTY_BOLD
    '<xf numFmtId="0" fontId="10" fillId="5" borderId="0" xfId="0" applyFont="1" applyFill="1"><alignment vertical="center"/></xf>' + // 15: REPORT_HEADER
    '</cellXfs>' +
    '</styleSheet>'
  );
}

export class XlsxWriter {
  private sheets: XlsxSheet[] = [];

  addSheet(name: string): XlsxSheet {
    const s = new XlsxSheet(name);
    this.sheets.push(s);
    return s;
  }

  build(): Uint8Array {
    if (this.sheets.length === 0) {
      this.addSheet('Sheet1');
    }

    const contentTypes =
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
      '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
      this.sheets
        .map(
          (_, i) =>
            `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`
        )
        .join('') +
      '</Types>';

    const rootRels =
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
      '</Relationships>';

    const workbookXml =
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ' +
      'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
      '<sheets>' +
      this.sheets
        .map(
          (s, i) =>
            `<sheet name="${escapeXml(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`
        )
        .join('') +
      '</sheets>' +
      '</workbook>';

    const workbookRels =
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      this.sheets
        .map(
          (_, i) =>
            `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`
        )
        .join('') +
      `<Relationship Id="rId${this.sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
      '</Relationships>';

    const files: { path: string; data: Uint8Array }[] = [
      { path: '[Content_Types].xml', data: utf8(contentTypes) },
      { path: '_rels/.rels', data: utf8(rootRels) },
      { path: 'xl/workbook.xml', data: utf8(workbookXml) },
      { path: 'xl/_rels/workbook.xml.rels', data: utf8(workbookRels) },
      { path: 'xl/styles.xml', data: utf8(buildStylesXml()) },
      ...this.sheets.map((s, i) => ({
        path: `xl/worksheets/sheet${i + 1}.xml`,
        data: utf8(s.buildXml()),
      })),
    ];

    return buildZip(files);
  }
}

// ── Sharing ─────────────────────────────────────────────────────────────

const MIME = {
  pdf: 'application/pdf',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  txt: 'text/plain',
};

const sanitizeFileName = (name: string) => name.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').replace(/ /g, '_');
const ensureExtension = (name: string, ext: string) => (name.toLowerCase().endsWith(ext) ? name : name + ext);

export async function shareFile(fileName: string, bytes: Uint8Array, mimeType: string, title: string): Promise<void> {
  const safeName = sanitizeFileName(fileName);
  if (Platform.OS === 'web') {
    const blob = new Blob([bytes as BlobPart], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = safeName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    return;
  }

  // Mobile fallback using Share.share
  try {
    await Share.share({
      title,
      message: `${title} (${safeName}) generated (${bytes.length} bytes).`,
    });
  } catch (err) {
    console.warn('Share error:', err);
  }
}

export const sharePdf = (fileName: string, pdf: PdfWriter, title: string) =>
  shareFile(ensureExtension(fileName, '.pdf'), pdf.build(), MIME.pdf, title);

export const shareXlsx = (fileName: string, xlsx: XlsxWriter, title: string) =>
  shareFile(ensureExtension(fileName, '.xlsx'), xlsx.build(), MIME.xlsx, title);

export async function shareText(text: string, title: string): Promise<void> {
  if (Platform.OS === 'web') {
    await shareFile(`${title}.txt`, utf8(text), MIME.txt, title);
    return;
  }
  await Share.share({ message: text, title });
}

// ── Supplier & Contact Metadata (YKC Standard) ─────────────────────────

export const SUPPLIER_NAME = 'Your KitchenCO (Pty) Ltd';
export const SUPPLIER_VAT = 'VAT Reg No: 4910298412 | Reg No: 2024/104928/07';
export const SUPPLIER_ADDRESS = 'Corporate Culinary Hub, Sandton, 2196 | +27 11 883 0000';
export const VAT_RATE = 0.15;
export const INVOICE_BILLING_EMAIL = 'invoicesykc@csggroup.co.za';
export const INVOICE_SUPPORT_EMAIL = 'supportykc@csggroup.co.za';
export const PLATFORM_MASTER_EMAIL = 'techykc@csggroup.co.za';
