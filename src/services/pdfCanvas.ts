/**
 * PdfCanvas — a drawn A4 PDF (positioned text, boxes, rounded labels, rules)
 * for the kitchen documents that need real layout: delivery notes, meal
 * stickers and the production sheet. PdfWriter (export.ts) stays the simple
 * flowing-text writer for invoices.
 *
 * Coordinates are points from the TOP-left of the page; text y is its
 * baseline. Text is WinAnsi (Latin-1 plus … — – ' ' " " •), measured with the
 * Helvetica AFM widths so it can be right-aligned, centred, wrapped and fitted.
 */

export const A4_W = 595;
export const A4_H = 842;

export type CanvasFont = 'Regular' | 'Bold' | 'Italic';

export interface TextOpts {
  font?: CanvasFont;
  size?: number;
  color?: string;
  align?: 'left' | 'right' | 'center';
}

export interface BoxOpts {
  fill?: string;
  stroke?: string;
  lineWidth?: number;
  radius?: number;
}

// Helvetica / Helvetica-Bold advance widths for ASCII 32..126 (1/1000 em). Oblique = Regular.
const REGULAR = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584,
  584, 556, 1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278,
  278, 278, 469, 556, 333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500,
  500, 334, 260, 334, 584,
];
const BOLD = [
  278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 333, 333, 584, 584,
  584, 611, 975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 333,
  278, 333, 584, 556, 333, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556, 278, 889, 611, 611, 611, 611, 389, 556, 333, 611, 556, 778, 556, 556,
  500, 389, 280, 389, 584,
];

/** Characters outside Latin-1 that WinAnsiEncoding still has, with their byte and width. */
const WIN_ANSI_EXTRA: Record<string, [number, number]> = {
  '…': [0x85, 1000],
  '–': [0x96, 556],
  '—': [0x97, 1000],
  '‘': [0x91, 222],
  '’': [0x92, 222],
  '“': [0x93, 333],
  '”': [0x94, 333],
  '•': [0x95, 350],
  '€': [0x80, 556],
};

const FONT_KEY: Record<CanvasFont, string> = { Regular: 'F1', Bold: 'F2', Italic: 'F3' };

/** Text -> WinAnsi byte string (one char per byte) with the em-width of each char. */
function encode(text: string, font: CanvasFont): { bytes: string; width: number } {
  const table = font === 'Bold' ? BOLD : REGULAR;
  let bytes = '';
  let width = 0;
  for (const raw of text ?? '') {
    const ch = raw === '\n' || raw === '\t' ? ' ' : raw;
    const code = ch.charCodeAt(0);
    if (ch.length === 1 && code >= 32 && code <= 126) {
      bytes += ch;
      width += table[code - 32];
    } else if (ch.length === 1 && code >= 160 && code <= 255) {
      bytes += ch;
      width += code === 160 ? 278 : 556;
    } else if (WIN_ANSI_EXTRA[ch]) {
      bytes += String.fromCharCode(WIN_ANSI_EXTRA[ch][0]);
      width += WIN_ANSI_EXTRA[ch][1];
    } else {
      bytes += '?';
      width += table['?'.charCodeAt(0) - 32];
    }
  }
  return { bytes, width };
}

const escapePdf = (bytes: string) => bytes.replace(/[\\()]/g, m => '\\' + m);
const n = (v: number) => String(Math.round(v * 100) / 100);

function rgb(hex: string): string {
  const h = hex.replace('#', '');
  const c = (i: number) => n(parseInt(h.slice(i, i + 2), 16) / 255);
  return `${c(0)} ${c(2)} ${c(4)}`;
}

export class PdfCanvas {
  private pages: string[][] = [[]];

  private get ops() {
    return this.pages[this.pages.length - 1];
  }

  newPage() {
    this.pages.push([]);
    return this;
  }

  /** Width of text in points. */
  measure(text: string, size: number, font: CanvasFont = 'Regular'): number {
    return (encode(text, font).width * size) / 1000;
  }

  /** Text cut down (with …) until it fits maxWidth. */
  fit(text: string, size: number, maxWidth: number, font: CanvasFont = 'Regular'): string {
    if (this.measure(text, size, font) <= maxWidth) return text;
    let s = text;
    while (s.length > 0 && this.measure(s + '…', size, font) > maxWidth) s = s.slice(0, -1);
    return s.trimEnd() + '…';
  }

  /** The largest size from `size` down to `minSize` at which text fits; null if none does. */
  fitSize(text: string, size: number, minSize: number, maxWidth: number, font: CanvasFont = 'Regular'): number | null {
    for (let s = size; s >= minSize; s -= 0.25) if (this.measure(text, s, font) <= maxWidth) return s;
    return null;
  }

  /** Word-wraps text into lines no wider than maxWidth (a single over-long word is fitted with …). */
  wrap(text: string, size: number, maxWidth: number, font: CanvasFont = 'Regular'): string[] {
    const lines: string[] = [];
    for (const para of (text ?? '').split('\n')) {
      let line = '';
      for (const word of para.split(/\s+/).filter(Boolean)) {
        const next = line ? `${line} ${word}` : word;
        if (this.measure(next, size, font) <= maxWidth || !line) line = next;
        else {
          lines.push(line);
          line = word;
        }
      }
      lines.push(line);
    }
    return lines.map(l => this.fit(l, size, maxWidth, font));
  }

  text(x: number, y: number, text: string, opts: TextOpts = {}) {
    const font = opts.font ?? 'Regular';
    const size = opts.size ?? 10;
    const { bytes, width } = encode(text, font);
    const w = (width * size) / 1000;
    const left = opts.align === 'right' ? x - w : opts.align === 'center' ? x - w / 2 : x;
    this.ops.push(`${rgb(opts.color ?? '#111111')} rg BT /${FONT_KEY[font]} ${n(size)} Tf ${n(left)} ${n(A4_H - y)} Td (${escapePdf(bytes)}) Tj ET`);
    return this;
  }

  rect(x: number, y: number, w: number, h: number, opts: BoxOpts = {}) {
    const { fill, stroke, lineWidth = 0.75, radius = 0 } = opts;
    if (!fill && !stroke) return this;
    const style: string[] = [];
    if (fill) style.push(`${rgb(fill)} rg`);
    if (stroke) style.push(`${rgb(stroke)} RG ${n(lineWidth)} w`);
    const bottom = A4_H - y - h;
    let path: string;
    if (radius > 0) {
      const r = Math.min(radius, w / 2, h / 2);
      const k = r * 0.5523;
      const [l, b, rt, t] = [x, bottom, x + w, bottom + h];
      path = [
        `${n(l + r)} ${n(b)} m`,
        `${n(rt - r)} ${n(b)} l`,
        `${n(rt - r + k)} ${n(b)} ${n(rt)} ${n(b + r - k)} ${n(rt)} ${n(b + r)} c`,
        `${n(rt)} ${n(t - r)} l`,
        `${n(rt)} ${n(t - r + k)} ${n(rt - r + k)} ${n(t)} ${n(rt - r)} ${n(t)} c`,
        `${n(l + r)} ${n(t)} l`,
        `${n(l + r - k)} ${n(t)} ${n(l)} ${n(t - r + k)} ${n(l)} ${n(t - r)} c`,
        `${n(l)} ${n(b + r)} l`,
        `${n(l)} ${n(b + r - k)} ${n(l + r - k)} ${n(b)} ${n(l + r)} ${n(b)} c`,
        'h',
      ].join(' ');
    } else {
      path = `${n(x)} ${n(bottom)} ${n(w)} ${n(h)} re`;
    }
    this.ops.push(`q ${style.join(' ')} ${path} ${fill && stroke ? 'B' : fill ? 'f' : 'S'} Q`);
    return this;
  }

  line(x1: number, y1: number, x2: number, y2: number, color = '#111111', lineWidth = 0.75) {
    this.ops.push(`q ${rgb(color)} RG ${n(lineWidth)} w ${n(x1)} ${n(A4_H - y1)} m ${n(x2)} ${n(A4_H - y2)} l S Q`);
    return this;
  }

  /** An empty tick box, size x size, top-left at (x, y). */
  checkbox(x: number, y: number, size = 10, color = '#333333') {
    return this.rect(x, y, size, size, { stroke: color, lineWidth: 0.8 });
  }

  /** A drawn tick mark inside a size x size square at (x, y). */
  tick(x: number, y: number, size = 8, color = '#FFFFFF') {
    this.ops.push(
      `q ${rgb(color)} RG 1.3 w 1 J 1 j ${n(x + size * 0.1)} ${n(A4_H - y - size * 0.55)} m ${n(x + size * 0.4)} ${n(A4_H - y - size * 0.85)} l ${n(x + size * 0.95)} ${n(A4_H - y - size * 0.15)} l S Q`
    );
    return this;
  }

  get pageCount() {
    return this.pages.length;
  }

  /** Runs fn on every page (for running footers), after the content is laid out. */
  forEachPage(fn: (pageIndex: number, pageCount: number) => void) {
    const saved = this.pages;
    saved.forEach((ops, i) => {
      this.pages = [ops];
      fn(i, saved.length);
    });
    this.pages = saved;
    return this;
  }

  build(): Uint8Array {
    const objects: string[] = [
      '<< /Type /Catalog /Pages 2 0 R >>',
      '',
      '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
      '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
      '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Oblique /Encoding /WinAnsiEncoding >>',
    ];
    const pageIds: number[] = [];
    for (const page of this.pages) {
      const content = page.join('\n') + '\n';
      const contentId = objects.length + 1;
      objects.push(`<< /Length ${content.length} >>\nstream\n${content}endstream`);
      pageIds.push(objects.length + 1);
      objects.push(
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${A4_W} ${A4_H}] /Resources << /Font << /F1 3 0 R /F2 4 0 R /F3 5 0 R >> >> /Contents ${contentId} 0 R >>`
      );
    }
    objects[1] = `<< /Type /Pages /Kids [${pageIds.map(id => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`;

    let out = '%PDF-1.4\n%\xe2\xe3\xcf\xd3\n';
    const offsets: number[] = [];
    objects.forEach((obj, i) => {
      offsets.push(out.length);
      out += `${i + 1} 0 obj\n${obj}\nendobj\n`;
    });
    const xref = out.length;
    out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    for (const off of offsets) out += `${String(off).padStart(10, '0')} 00000 n \n`;
    out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;

    const bytes = new Uint8Array(out.length);
    for (let i = 0; i < out.length; i++) bytes[i] = out.charCodeAt(i) & 0xff;
    return bytes;
  }
}
