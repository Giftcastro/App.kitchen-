/**
 * Services/Export — file downloads with no third-party document library:
 *
 *  - PdfWriter    (SimplePdfWriter): plain PDF 1.4, A4, the three base-14
 *                 fonts (Helvetica, Helvetica-Bold, Courier), automatic page
 *                 breaks, correct xref table. Text is ASCII-sanitised the
 *                 same way MAUI does it (— – × · • … mapped, the rest '?').
 *  - XlsxWriter   (SimpleXlsxWriter): a real Office Open XML workbook —
 *                 inline strings, a bold style for header rows, numbers kept
 *                 numeric, column widths. Zipped here with STORE entries.
 *  - shareFile    (ExportService): on a phone the file goes to the cache
 *                 folder and the system share sheet (Save to Files / Drive /
 *                 email / print); on the web it downloads.
 *  - Invoice*     (InvoiceDocument): the ONE definition of an invoice, used
 *                 by the customer's Invoice page and the admin's daily batch.
 */
import { Platform, Share } from 'react-native';
import * as Sharing from 'expo-sharing';
import { cacheDirectory, EncodingType, writeAsStringAsync } from 'expo-file-system/legacy';
import type { Order } from '../models';
import { getCompany, getLocationById } from './directory';
import { fmtLongDate } from './scheduling';

// ── Bytes helpers ───────────────────────────────────────────────────────

function utf8(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

/** Latin-1 bytes; every char reaching here is already ASCII or a deliberate raw byte. */
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

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function toBase64(bytes: Uint8Array): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i];
    const b = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const c = i + 2 < bytes.length ? bytes[i + 2] : 0;
    const n = (a << 16) | (b << 8) | c;
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63];
    out += i + 1 < bytes.length ? B64[(n >> 6) & 63] : '=';
    out += i + 2 < bytes.length ? B64[n & 63] : '=';
  }
  return out;
}

/** C#'s {value,width:F2} — right-aligned fixed-point. */
const num = (value: number, width: number) => value.toFixed(2).padStart(width);

// ── PDF ────────────────────────────────────────────────────────────────

type PdfFont = 'Normal' | 'Bold' | 'Mono';
interface PdfLine {
  text: string;
  font: PdfFont;
  size: number;
  gapAfter: number;
}

const PAGE_W = 595;
const PAGE_H = 842;
const MARGIN_L = 40;
const MARGIN_T = 50;
const MARGIN_B = 50;
const PAGE_BREAK = -1;

function sanitizePdf(text: string): string {
  let out = '';
  for (const raw of text) {
    let ch = raw;
    if (ch === '—' || ch === '–') ch = '-';
    else if (ch === '×') ch = 'x';
    else if (ch === '·' || ch === '•') ch = '-';
    else if (ch === '‘' || ch === '’') ch = "'";
    else if (ch === '“' || ch === '”') ch = '"';
    else if (ch === ' ') ch = ' ';
    if (ch === '…') {
      out += '...';
      continue;
    }
    const code = ch.charCodeAt(0);
    if (ch.length !== 1 || code < 32 || code > 126) {
      out += '?';
      continue;
    }
    if (ch === '\\' || ch === '(' || ch === ')') out += '\\';
    out += ch;
  }
  return out;
}

/** "0.##" */
const fmtPdfNum = (n: number) => String(Math.round(n * 100) / 100);

export class PdfWriter {
  private lines: PdfLine[] = [];

  add(text: string, font: PdfFont, size: number, gapAfter: number): this {
    this.lines.push({ text: text ?? '', font, size, gapAfter });
    return this;
  }
  heading(text: string, size = 16, gapAfter = 6) {
    return this.add(text, 'Bold', size, gapAfter);
  }
  subHeading(text: string, size = 12, gapAfter = 4) {
    return this.add(text, 'Bold', size, gapAfter);
  }
  text(text: string, size = 10, gapAfter = 0) {
    return this.add(text, 'Normal', size, gapAfter);
  }
  mono(text: string, size = 9, gapAfter = 0) {
    return this.add(text, 'Mono', size, gapAfter);
  }
  blank(height = 8) {
    return this.add('', 'Normal', height / 1.35, 0);
  }
  rule(width = 70) {
    return this.mono('-'.repeat(width));
  }
  /** Forces the next line onto a new page (no-op at the very top of a page). */
  pageBreak() {
    return this.add('', 'Normal', PAGE_BREAK, 0);
  }
  monoBlock(block: string, size = 9) {
    for (const l of (block ?? '').replace(/\r\n/g, '\n').split('\n')) this.mono(l, size);
    return this;
  }

  build(): Uint8Array {
    const pages: string[][] = [];
    let current: string[] = [];
    let y = PAGE_H - MARGIN_T;

    for (const line of this.lines) {
      if (line.size === PAGE_BREAK) {
        if (current.length > 0) {
          pages.push(current);
          current = [];
          y = PAGE_H - MARGIN_T;
        }
        continue;
      }
      const lineHeight = line.size * 1.35;
      if (y - lineHeight < MARGIN_B) {
        pages.push(current);
        current = [];
        y = PAGE_H - MARGIN_T;
      }
      y -= lineHeight;
      const fontKey = line.font === 'Bold' ? 'F2' : line.font === 'Mono' ? 'F3' : 'F1';
      current.push(`BT /${fontKey} ${fmtPdfNum(line.size)} Tf ${fmtPdfNum(MARGIN_L)} ${y.toFixed(1)} Td (${sanitizePdf(line.text)}) Tj ET`);
      y -= line.gapAfter;
    }
    pages.push(current);

    const objects: string[] = [
      '<< /Type /Catalog /Pages 2 0 R >>',
      '',
      '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
      '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
      '<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>',
    ];
    const pageIds: number[] = [];
    for (const page of pages) {
      const content = page.join('\n') + '\n';
      const contentId = objects.length + 1;
      objects.push(`<< /Length ${content.length} >>\nstream\n${content}endstream`);
      pageIds.push(objects.length + 1);
      objects.push(
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Resources << /Font << /F1 3 0 R /F2 4 0 R /F3 5 0 R >> >> /Contents ${contentId} 0 R >>`
      );
    }
    objects[1] = `<< /Type /Pages /Kids [${pageIds.map(id => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`;

    const parts: Uint8Array[] = [];
    let position = 0;
    const write = (s: string) => {
      const b = latin1(s);
      parts.push(b);
      position += b.length;
    };
    write('%PDF-1.4\n');
    parts.push(new Uint8Array([0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a]));
    position += 6;

    const offsets: number[] = [];
    objects.forEach((obj, i) => {
      offsets.push(position);
      write(`${i + 1} 0 obj\n${obj}\nendobj\n`);
    });
    const xref = position;
    write(`xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`);
    for (const off of offsets) write(`${String(off).padStart(10, '0')} 00000 n \n`);
    write(`trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
    return concat(parts);
  }
}

// ── XLSX ───────────────────────────────────────────────────────────────

export type Cell = string | number | null | undefined;

export class XlsxSheet {
  rows: { cells: Cell[]; bold: boolean }[] = [];
  columnWidths: number[] = [];
  constructor(public name: string) {}
  header(...cells: Cell[]) {
    this.rows.push({ cells, bold: true });
    return this;
  }
  row(...cells: Cell[]) {
    this.rows.push({ cells, bold: false });
    return this;
  }
  blank() {
    this.rows.push({ cells: [], bold: false });
    return this;
  }
  widths(...widths: number[]) {
    this.columnWidths = widths;
    return this;
  }
}

const escXml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function columnName(index: number): string {
  let s = '';
  while (index > 0) {
    index--;
    s = String.fromCharCode(65 + (index % 26)) + s;
    index = Math.floor(index / 26);
  }
  return s;
}

const XML_HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';

export class XlsxWriter {
  private sheets: XlsxSheet[] = [];

  /** Excel sheet-name rules: max 31 chars, none of : \ / ? * [ ] */
  addSheet(name: string): XlsxSheet {
    let clean = '';
    for (const ch of name) clean += ':\\/?*[]'.includes(ch) ? ' ' : ch;
    clean = clean.trim().slice(0, 31);
    if (!clean) clean = `Sheet${this.sheets.length + 1}`;
    const sheet = new XlsxSheet(clean);
    this.sheets.push(sheet);
    return sheet;
  }

  get isEmpty() {
    return this.sheets.length === 0;
  }

  build(): Uint8Array {
    if (this.sheets.length === 0) this.addSheet('Sheet1');
    const n = this.sheets.length;
    const entries: [string, string][] = [];

    let types =
      XML_HEAD +
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>';
    for (let i = 0; i < n; i++)
      types += `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`;
    entries.push(['[Content_Types].xml', types + '</Types>']);

    entries.push([
      '_rels/.rels',
      XML_HEAD +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    ]);

    let workbook =
      XML_HEAD +
      '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>';
    this.sheets.forEach((s, i) => (workbook += `<sheet name="${escXml(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`));
    entries.push(['xl/workbook.xml', workbook + '</sheets></workbook>']);

    let rels = XML_HEAD + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">';
    for (let i = 0; i < n; i++)
      rels += `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`;
    rels += `<Relationship Id="rId${n + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;
    entries.push(['xl/_rels/workbook.xml.rels', rels]);

    entries.push([
      'xl/styles.xml',
      XML_HEAD +
        '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>',
    ]);

    this.sheets.forEach((s, i) => entries.push([`xl/worksheets/sheet${i + 1}.xml`, sheetXml(s)]));
    return zipStore(entries.map(([path, xml]) => [path, utf8(xml)]));
  }
}

function sheetXml(sheet: XlsxSheet): string {
  let x = XML_HEAD + '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">';
  if (sheet.columnWidths.length > 0) {
    x += '<cols>';
    sheet.columnWidths.forEach((w, i) => (x += `<col min="${i + 1}" max="${i + 1}" width="${fmtPdfNum(w)}" customWidth="1"/>`));
    x += '</cols>';
  }
  x += '<sheetData>';
  sheet.rows.forEach(({ cells, bold }, r) => {
    x += `<row r="${r + 1}">`;
    cells.forEach((value, c) => {
      if (value == null) return;
      const ref = `${columnName(c + 1)}${r + 1}`;
      const style = bold ? ' s="1"' : '';
      if (typeof value === 'number' && Number.isFinite(value)) x += `<c r="${ref}"${style}><v>${value}</v></c>`;
      else x += `<c r="${ref}" t="inlineStr"${style}><is><t xml:space="preserve">${escXml(String(value))}</t></is></c>`;
    });
    x += '</row>';
  });
  return x + '</sheetData></worksheet>';
}

// ── ZIP (STORE, no compression) ──────────────────────────────────────────

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function zipStore(files: [string, Uint8Array][]): Uint8Array {
  const parts: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  // Fixed DOS timestamp (1 Jan 2026 00:00) — Excel doesn't care, and output stays deterministic.
  const dosTime = 0;
  const dosDate = ((2026 - 1980) << 9) | (1 << 5) | 1;

  for (const [path, data] of files) {
    const name = utf8(path);
    const crc = crc32(data);
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true);
    local.setUint16(6, 0x0800, true); // UTF-8 names
    local.setUint16(8, 0, true); // STORE
    local.setUint16(10, dosTime, true);
    local.setUint16(12, dosDate, true);
    local.setUint32(14, crc, true);
    local.setUint32(18, data.length, true);
    local.setUint32(22, data.length, true);
    local.setUint16(26, name.length, true);
    local.setUint16(28, 0, true);
    parts.push(new Uint8Array(local.buffer), name, data);

    const cd = new DataView(new ArrayBuffer(46));
    cd.setUint32(0, 0x02014b50, true);
    cd.setUint16(4, 20, true);
    cd.setUint16(6, 20, true);
    cd.setUint16(8, 0x0800, true);
    cd.setUint16(10, 0, true);
    cd.setUint16(12, dosTime, true);
    cd.setUint16(14, dosDate, true);
    cd.setUint32(16, crc, true);
    cd.setUint32(20, data.length, true);
    cd.setUint32(24, data.length, true);
    cd.setUint16(28, name.length, true);
    cd.setUint32(42, offset, true);
    central.push(new Uint8Array(cd.buffer), name);

    offset += 30 + name.length + data.length;
  }

  const centralBytes = concat(central);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, files.length, true);
  end.setUint16(10, files.length, true);
  end.setUint32(12, centralBytes.length, true);
  end.setUint32(16, offset, true);
  return concat([...parts, centralBytes, new Uint8Array(end.buffer)]);
}

// ── Sharing ─────────────────────────────────────────────────────────────

const MIME = {
  pdf: 'application/pdf',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
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
  const uri = `${cacheDirectory}${safeName}`;
  await writeAsStringAsync(uri, toBase64(bytes), { encoding: EncodingType.Base64 });
  await Sharing.shareAsync(uri, { mimeType, dialogTitle: title, UTI: mimeType === MIME.pdf ? 'com.adobe.pdf' : undefined });
}

export const sharePdf = (fileName: string, pdf: PdfWriter, title: string) =>
  shareFile(ensureExtension(fileName, '.pdf'), pdf.build(), MIME.pdf, title);

export const shareXlsx = (fileName: string, xlsx: XlsxWriter, title: string) =>
  shareFile(ensureExtension(fileName, '.xlsx'), xlsx.build(), MIME.xlsx, title);

/** Plain text through the share sheet (or, on the web, the browser's share / a .txt download). */
export async function shareText(text: string, title: string): Promise<void> {
  if (Platform.OS === 'web') {
    const nav = typeof navigator !== 'undefined' ? (navigator as Navigator & { share?: (d: ShareData) => Promise<void> }) : undefined;
    if (nav?.share) {
      try {
        await nav.share({ title, text });
        return;
      } catch {
        // Cancelled or unsupported — fall through to a download.
      }
    }
    await shareFile(`${title}.txt`, utf8(text), 'text/plain', title);
    return;
  }
  await Share.share({ message: text, title });
}

/** "2026-10-02" */
export const dateStamp = (iso: string) => iso.slice(0, 10);
/** "2026-10-02_0915" */
export function nowStamp(d: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}`;
}

// ── Invoice ─────────────────────────────────────────────────────────────

export const SUPPLIER_NAME = 'Your Kitchen Co. (Pty) Ltd';
export const SUPPLIER_VAT = 'VAT Reg No: 4910298412';
export const SUPPLIER_ADDRESS = 'Corporate Culinary Hub, Sandton, 2196';
export const VAT_NOTE = 'VAT: Not applicable - zero-rated corporate catering.';

export interface InvoiceDocument {
  order: Order;
  companyName: string;
  locationName: string;
  locationAddress: string;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** "dd MMM yyyy HH:mm" */
export function fmtIssued(ts: string): string {
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())} ${MONTHS[d.getMonth()]} ${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** Order keeps only the final total; the meal subtotal is backed out of its known parts. */
export const mealSubtotal = (o: Order) => o.totalAmount - o.deliveryFee + o.subsidyAmount + o.discountAmount;

export async function loadInvoiceDocument(order: Order): Promise<InvoiceDocument> {
  const [company, location] = await Promise.all([
    order.companyId ? getCompany(order.companyId).catch(() => null) : Promise.resolve(null),
    order.locationId ? getLocationById(order.locationId).catch(() => null) : Promise.resolve(null),
  ]);
  return {
    order,
    companyName: company?.name ?? 'Individual Customer',
    locationName: location?.name ?? '-',
    locationAddress: location?.address || location?.name || '-',
  };
}

const lineLabel = (l: Order['lines'][number]) => `  ${l.quantity} x ${l.name}`;

export function invoiceText(doc: InvoiceDocument): string {
  const o = doc.order;
  const lines = [
    SUPPLIER_NAME.toUpperCase(),
    'INVOICE',
    `Invoice No:     ${o.taxInvoiceNumber}`,
    `Order No:       #${o.orderNumber}`,
    `Issued:         ${fmtIssued(o.orderDate)}`,
    SUPPLIER_VAT,
    SUPPLIER_ADDRESS,
    '',
    'CUSTOMER & DROP-OFF',
    `Name:           ${o.customerName}`,
    `Company:        ${doc.companyName}`,
    `Location:       ${doc.locationName}`,
    `Address:        ${doc.locationAddress}`,
  ];
  if (o.deliveryFloor.trim()) lines.push(`Floor / Desk:   ${o.deliveryFloor}`);
  lines.push(`Delivery Date:  ${fmtLongDate(o.deliveryDate)}`);
  lines.push(`Status:         ${o.status}`);
  lines.push('');
  lines.push('LINE ITEMS');
  for (const l of o.lines) {
    lines.push(lineLabel(l).padEnd(44) + `R ${num(l.unitPrice * l.quantity, 10)}`);
    if (l.notes) lines.push(`  Note: ${l.notes}`);
    if (l.allergyNotes) lines.push(`  ALLERGY: ${l.allergyNotes}`);
  }
  lines.push('');
  lines.push('Meal Subtotal:'.padEnd(44) + `R ${num(mealSubtotal(o), 10)}`);
  if (o.subsidyAmount > 0) lines.push('Company Subsidy:'.padEnd(44) + `-R ${num(o.subsidyAmount, 9)}`);
  if (o.discountAmount > 0) lines.push('Corporate Discount:'.padEnd(44) + `-R ${num(o.discountAmount, 9)}`);
  lines.push('Delivery Fee:'.padEnd(44) + `R ${num(o.deliveryFee, 10)}`);
  lines.push('-'.repeat(56));
  lines.push('TOTAL PAID (ZAR):'.padEnd(44) + `R ${num(o.totalAmount, 10)}`);
  lines.push('');
  lines.push(VAT_NOTE);
  return lines.join('\n');
}

/** Appends an invoice to a PDF (one per page when batching — pass pageBreakBefore). */
export function writeInvoice(pdf: PdfWriter, doc: InvoiceDocument, pageBreakBefore = false): void {
  const o = doc.order;
  if (pageBreakBefore) pdf.pageBreak();

  pdf.heading(SUPPLIER_NAME, 15, 2);
  pdf.text(SUPPLIER_VAT, 9);
  pdf.text(SUPPLIER_ADDRESS, 9, 10);

  pdf.heading('INVOICE', 20, 2);
  pdf.text(`Invoice No: ${o.taxInvoiceNumber}    Order No: #${o.orderNumber}    Issued: ${fmtIssued(o.orderDate)}`, 10, 12);

  pdf.subHeading('CUSTOMER & DROP-OFF', 11, 2);
  pdf.text(`Name: ${o.customerName}`, 10);
  pdf.text(`Company: ${doc.companyName}`, 10);
  pdf.text(`Location: ${doc.locationName}`, 10);
  pdf.text(`Address: ${doc.locationAddress}`, 10);
  if (o.deliveryFloor.trim()) pdf.text(`Floor / Desk: ${o.deliveryFloor}`, 10);
  pdf.text(`Delivery Date: ${fmtLongDate(o.deliveryDate)}    Status: ${o.status}`, 10, 12);

  pdf.subHeading('LINE ITEMS', 11, 2);
  for (const l of o.lines) {
    pdf.mono(lineLabel(l).padEnd(52) + `R ${num(l.unitPrice * l.quantity, 10)}`, 10);
    if (l.notes) pdf.mono(`  Note: ${l.notes}`, 9);
    if (l.allergyNotes) pdf.mono(`  ALLERGY: ${l.allergyNotes}`, 9);
  }
  pdf.blank();

  pdf.mono('Meal Subtotal:'.padEnd(52) + `R ${num(mealSubtotal(o), 10)}`, 10);
  if (o.subsidyAmount > 0) pdf.mono('Company Subsidy:'.padEnd(52) + `-R ${num(o.subsidyAmount, 9)}`, 10);
  if (o.discountAmount > 0) pdf.mono('Corporate Discount:'.padEnd(52) + `-R ${num(o.discountAmount, 9)}`, 10);
  pdf.mono('Delivery Fee:'.padEnd(52) + `R ${num(o.deliveryFee, 10)}`, 10);
  pdf.rule(64);
  pdf.add('TOTAL PAID (ZAR):'.padEnd(52) + `R ${num(o.totalAmount, 10)}`, 'Mono', 11, 10);
  pdf.text(VAT_NOTE, 9);
}
