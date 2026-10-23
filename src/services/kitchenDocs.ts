/**
 * The kitchen's day-of-delivery paperwork, laid out like the client's own
 * templates (YKC_Production_Sheet.xlsx, YKC_Delivery_Notes.pdf,
 * YKC_Meal_Stickers.pdf):
 *
 *  - Production sheet (Excel + PDF): "1. COOK" — allergies first, then every
 *    dish per menu category with its special requests; "2. PACK" — one row
 *    per meal (= one sticker) per client, ticked as stickers go on.
 *  - Delivery notes: one A4 note per client drop — dish totals with OK boxes
 *    and a sign-on-delivery block.
 *  - Meal stickers: 21-up A4 label sheets (63.5 x 38.1 mm, 3 x 7), numbered
 *    n / total per client.
 *  - Delivery report: per drop, each person's order and when it was delivered.
 *  - Customer delivery note: one person's order, printed only on request
 *    (a query or expense claim) — not part of the daily print.
 *
 * Everything here is pure layout over AdminOrderRows; kitchenExports.ts
 * loads the addresses / category order and shares the files.
 */
import type { AdminOrderRow } from './adminOrders';
import { INDIVIDUAL } from './adminOrders';
import { XlsxWriter, type XlsxSheet } from './export';
import { fromIso } from './scheduling';
import { A4_H, A4_W, PdfCanvas, type CanvasFont } from './pdfCanvas';

export const KITCHEN_BRAND = 'your kitchen co.';
export const KITCHEN_SUPPORT_EMAIL = 'supportykc@csggroup.co.za';

const RED = '#C62828';
const PINK = '#FDECEC';
const INK = '#111111';
const GREY_TEXT = '#666666';
const BAND = '#F2F2F2';

// ── Data ────────────────────────────────────────────────────────────────

/** One meal = one sticker = one PACK row. */
export interface Meal {
  person: string;
  dish: string;
  category: string;
  orderNo: string;
  /** "DAIRY ALLERGY", or '' */
  allergy: string;
  /** Special request that isn't just the allergy text, or '' */
  note: string;
}

/** Everything going to one client drop-off on one day. */
export interface Drop {
  client: string;
  address: string;
  meals: Meal[];
}

export interface KitchenDay {
  date: string;
  drops: Drop[];
}

/** "Sample Bongani" -> "Sample B."; e-mail-only customers show their mailbox name. */
export function shortName(full: string): string {
  const clean = (full ?? '').includes('@') ? full.split('@')[0] : (full ?? '').trim();
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length < 2) return clean || 'Guest';
  return `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.`;
}

/** "Dairy" -> "DAIRY ALLERGY"; "severe nut allergy" -> "SEVERE NUT ALLERGY". */
export function allergyLabel(text: string): string {
  const t = (text ?? '').trim().replace(/\s+/g, ' ').toUpperCase();
  if (!t) return '';
  return /ALLERG|INTOLERAN|ANAPHYLA|COELIAC|CELIAC/.test(t) ? t : `${t} ALLERGY`;
}

/** "31/08/2026" */
export function fmtSlashDate(iso: string): string {
  const d = fromIso(iso);
  const p = (v: number) => String(v).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
}

const cmp = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: 'base' });

/** Pack / sticker order: allergies, then special requests, then the rest — each by category, dish, name. */
function packOrder(a: Meal, b: Meal): number {
  const rank = (m: Meal) => (m.allergy ? 0 : m.note ? 1 : 2);
  return rank(a) - rank(b) || cmp(a.category, b.category) || cmp(a.dish, b.dish) || cmp(a.person, b.person);
}

/** One client drop-off (company + delivery location) on one day, as its orders. */
interface DropRows {
  client: string;
  address: string;
  rows: AdminOrderRow[];
}

/**
 * Groups the orders per delivery day and client drop (company + delivery
 * location), drops by client name. A company with several sites on one day
 * gets "Company - Site" names; individuals file under their location.
 * `addresses` maps locationId to a printable address.
 */
function groupDrops(rows: AdminOrderRow[], addresses: Record<string, string>): { date: string; drops: DropRows[] }[] {
  const days = new Map<string, Map<string, AdminOrderRow[]>>();
  for (const row of rows) {
    const date = row.order.deliveryDate;
    const key = `${row.companyName}|${row.order.locationId}`;
    if (!days.has(date)) days.set(date, new Map());
    const drops = days.get(date)!;
    if (!drops.has(key)) drops.set(key, []);
    drops.get(key)!.push(row);
  }

  return [...days.keys()].sort().map(date => {
    const groups = [...days.get(date)!.values()];
    const sitesPerCompany = new Map<string, number>();
    for (const g of groups) sitesPerCompany.set(g[0].companyName, (sitesPerCompany.get(g[0].companyName) ?? 0) + 1);
    const drops = groups.map(group => {
      const row = group[0];
      return {
        client:
          row.companyName === INDIVIDUAL
            ? row.locationName
            : (sitesPerCompany.get(row.companyName) ?? 0) > 1
              ? `${row.companyName} - ${row.locationName}`
              : row.companyName,
        address: addresses[row.order.locationId] || row.locationName,
        rows: group,
      };
    });
    return { date, drops: drops.sort((a, b) => cmp(a.client, b.client)) };
  });
}

/** Explodes the orders into single meals, grouped per delivery day and client drop. */
export function buildKitchenDays(rows: AdminOrderRow[], addresses: Record<string, string>): KitchenDay[] {
  return groupDrops(rows, addresses).map(({ date, drops }) => ({
    date,
    drops: drops.map(d => ({
      client: d.client,
      address: d.address,
      meals: d.rows
        .flatMap(row =>
          row.order.lines.flatMap(line => {
            const allergy = allergyLabel(line.allergyNotes);
            const note = (line.notes ?? '').trim();
            const meal: Meal = {
              person: shortName(row.order.customerName),
              dish: line.name,
              category: line.category || 'Other',
              orderNo: row.order.orderNumber,
              allergy,
              note: note && note !== (line.allergyNotes ?? '').trim() ? note : '',
            };
            return Array.from({ length: Math.max(1, line.quantity) }, () => ({ ...meal }));
          })
        )
        .sort(packOrder),
    })),
  }));
}

/** One dish on the COOK list, with the people who asked for something special. */
interface CookDish {
  dish: string;
  qty: number;
  specials: { text: string; allergy: boolean }[];
}
interface CookCategory {
  name: string;
  total: number;
  dishes: CookDish[];
}
interface CookList {
  meals: number;
  allergies: { dish: string; text: string }[];
  categories: CookCategory[];
}

/** The COOK view of a day: allergy meals, then dishes per category (menu order), biggest first. */
function buildCookList(day: KitchenDay, categoryOrder: string[]): CookList {
  const order = categoryOrder.map(c => c.toLowerCase());
  const rankOf = (name: string) => {
    const i = order.indexOf(name.toLowerCase());
    return i < 0 ? order.length : i;
  };
  const all = day.drops.flatMap(d => d.meals.map(m => ({ ...m, client: d.client })));
  const byCategory = new Map<string, Map<string, CookDish>>();
  for (const m of all) {
    if (!byCategory.has(m.category)) byCategory.set(m.category, new Map());
    const dishes = byCategory.get(m.category)!;
    if (!dishes.has(m.dish)) dishes.set(m.dish, { dish: m.dish, qty: 0, specials: [] });
    const d = dishes.get(m.dish)!;
    d.qty++;
    if (m.allergy) d.specials.push({ text: `${m.allergy} - ${m.person}`, allergy: true });
    if (m.note) d.specials.push({ text: `${m.note} - ${m.person}`, allergy: false });
  }
  const categories = [...byCategory.entries()]
    .map(([name, dishes]) => {
      const list = [...dishes.values()]
        .map(d => ({ ...d, specials: [...d.specials.filter(s => s.allergy), ...d.specials.filter(s => !s.allergy)] }))
        .sort((a, b) => b.qty - a.qty || cmp(a.dish, b.dish));
      return { name, total: list.reduce((s, d) => s + d.qty, 0), dishes: list };
    })
    .sort((a, b) => rankOf(a.name) - rankOf(b.name) || cmp(a.name, b.name));
  return {
    meals: all.length,
    allergies: all.filter(m => m.allergy).map(m => ({ dish: m.dish, text: `${m.allergy} - ${m.person} (${m.client})` })),
    categories,
  };
}

const specialsText = (d: CookDish) => (d.specials.length ? `${d.specials.length} special:\n${d.specials.map(s => `• ${s.text}`).join('\n')}` : '');
const packNotes = (m: Meal) => [m.allergy, m.note].filter(Boolean).join(' · ');

// ── Production sheet: Excel ─────────────────────────────────────────────

/** Rough wrapped-line count for a cell `width` characters wide at the given font size. */
function cellLines(text: string, width: number, size: number): number {
  const perLine = Math.max(8, Math.floor((width * 11) / size) - 4);
  return (text || ' ').split('\n').reduce((n, l) => n + Math.max(1, Math.ceil(l.length / perLine)), 0);
}
const rowHeight = (lines: number, lineHeight: number) => Math.round((lines * lineHeight + 4) * 100) / 100;

export function productionSheetXlsx(days: KitchenDay[], categoryOrder: string[], scope: string): XlsxWriter {
  const x = new XlsxWriter();
  const S = {
    title: x.style({ bold: true, size: 20, color: INK }),
    sub: x.style({ size: 11, color: GREY_TEXT }),
    stat: x.style({ bold: true, size: 13, color: INK }),
    redBand: x.style({ bold: true, size: 12, color: '#FFFFFF', fill: RED }),
    redBandFill: x.style({ fill: RED }),
    allergyTick: x.style({ size: 14, color: INK, fill: PINK, align: 'center', valign: 'top' }),
    allergyQty: x.style({ bold: true, size: 14, color: INK, fill: PINK, align: 'center', valign: 'top' }),
    allergyDish: x.style({ bold: true, size: 12, color: INK, fill: PINK, valign: 'top', wrap: true }),
    allergyNote: x.style({ bold: true, size: 12, color: RED, fill: PINK, valign: 'top', wrap: true }),
    headCenter: x.style({ bold: true, size: 11, color: '#FFFFFF', fill: INK, align: 'center' }),
    headLeft: x.style({ bold: true, size: 11, color: '#FFFFFF', fill: INK, align: 'left' }),
    catFill: x.style({ fill: BAND }),
    catQty: x.style({ bold: true, size: 12, color: INK, fill: BAND, align: 'center', valign: 'top' }),
    catName: x.style({ bold: true, size: 12, color: INK, fill: BAND }),
    tick: x.style({ size: 14, color: INK, align: 'center', valign: 'top', borderBottom: '#CCCCCC' }),
    qty: x.style({ bold: true, size: 14, color: INK, align: 'center', valign: 'top', borderBottom: '#CCCCCC' }),
    dish: x.style({ size: 12, color: INK, valign: 'top', wrap: true, borderBottom: '#CCCCCC' }),
    noteAllergy: x.style({ bold: true, size: 10, color: RED, valign: 'top', wrap: true, borderBottom: '#CCCCCC' }),
    noteRed: x.style({ size: 10, color: RED, valign: 'top', wrap: true, borderBottom: '#CCCCCC' }),
    noteNone: x.style({ size: 11, valign: 'top', wrap: true, borderBottom: '#CCCCCC' }),
    signLabel: x.style({ bold: true, size: 11, color: INK }),
    signLine: x.style({ size: 11, color: INK }),
    clientBand: x.style({ bold: true, size: 13, color: '#FFFFFF', fill: INK }),
    clientFill: x.style({ fill: INK }),
    packHeadCenter: x.style({ bold: true, size: 9, color: GREY_TEXT, fill: BAND, align: 'center' }),
    packHead: x.style({ bold: true, size: 9, color: GREY_TEXT, fill: BAND, align: 'left' }),
    packNameA: x.style({ bold: true, size: 11, color: INK, fill: PINK, valign: 'top', wrap: true }),
    packCellA: x.style({ size: 11, color: INK, fill: PINK, valign: 'top', wrap: true }),
    packNoteA: x.style({ bold: true, size: 11, color: RED, fill: PINK, valign: 'top', wrap: true }),
    packName: x.style({ bold: true, size: 11, color: INK, valign: 'top', wrap: true, borderBottom: '#CCCCCC' }),
    packCell: x.style({ size: 11, color: INK, valign: 'top', wrap: true, borderBottom: '#CCCCCC' }),
    packNote: x.style({ size: 11, color: RED, valign: 'top', wrap: true, borderBottom: '#CCCCCC' }),
  };
  const multi = days.length > 1;
  const short = (iso: string) => {
    const d = fromIso(iso);
    return `${String(d.getDate()).padStart(2, '0')} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getMonth()]}`;
  };

  for (const day of days) {
    const cook = buildCookList(day, categoryOrder);
    const c: XlsxSheet = x.addSheet(multi ? `COOK ${short(day.date)}` : '1. COOK').widths(5, 7, 46, 52);
    c.styled(['WHAT TO COOK'], S.title, 24.5);
    c.styled([`${fmtSlashDate(day.date)}  ·  ${scope}`], S.sub, 15);
    c.styled([`Meals: ${cook.meals}     Allergies: ${cook.allergies.length}`], S.stat, 16.2);
    if (cook.allergies.length > 0) {
      c.styled(['!! ALLERGIES - COOK FIRST, SEAL & LABEL SEPARATELY (already in the list below)'], [S.redBand, S.redBandFill, S.redBandFill, S.redBandFill], 15);
      for (const a of cook.allergies) {
        const h = Math.max(cellLines(a.dish, 46, 12), cellLines(a.text, 52, 12));
        c.styled(['☐', 1, a.dish, a.text], [S.allergyTick, S.allergyQty, S.allergyDish, S.allergyNote], rowHeight(h, 15));
      }
    }
    c.styled(['✓', 'QTY', 'DISH', 'NOTES'], [S.headCenter, S.headCenter, S.headLeft, S.headLeft], 15);
    c.printLayout(c.rows.length);
    for (const cat of cook.categories) {
      c.styled(['', cat.total, cat.name.toUpperCase(), ''], [S.catFill, S.catQty, S.catName, S.catFill], 15);
      for (const d of cat.dishes) {
        const notes = specialsText(d);
        const h = Math.max(cellLines(d.dish, 46, 12) * 15, cellLines(notes, 52, 10) * 15.5);
        const noteStyle = !notes ? S.noteNone : d.specials.some(s => s.allergy) ? S.noteAllergy : S.noteRed;
        c.styled(['☐', d.qty, d.dish, notes], [S.tick, S.qty, S.dish, noteStyle], Math.max(17.35, Math.round((h + 3) * 100) / 100));
      }
    }
    c.blank();
    c.styled(['Head chef:', '', '______________________________     Time done: __________'], [S.signLabel, 0, S.signLine], 15);

    const p: XlsxSheet = x.addSheet(multi ? `PACK ${short(day.date)}` : '2. PACK').widths(5, 18, 44, 22, 34).printLayout(0);
    p.styled(['WHAT TO PACK'], S.title, 24.5);
    p.styled([`${fmtSlashDate(day.date)}  ·  one row = one meal = one sticker  ·  tick when the sticker is on`], S.sub, 15);
    for (const drop of day.drops) {
      p.styled(
        [`${drop.client.toUpperCase()}   ·   ${drop.meals.length} meals   ·   ${drop.address}`],
        [S.clientBand, S.clientFill, S.clientFill, S.clientFill, S.clientFill],
        16.2
      );
      p.styled(['✓', 'NAME', 'DISH', 'ORDER NO.', 'NOTES'], [S.packHeadCenter, S.packHead, S.packHead, S.packHead, S.packHead], 15);
      for (const m of drop.meals) {
        const notes = packNotes(m);
        const h = Math.max(cellLines(m.dish, 44, 11), cellLines(notes, 34, 11), cellLines(m.person, 18, 11));
        const styles = m.allergy
          ? [S.allergyTick, S.packNameA, S.packCellA, S.packCellA, S.packNoteA]
          : [S.tick, S.packName, S.packCell, S.packCell, S.packNote];
        p.styled(['☐', m.person, m.dish, m.orderNo, notes], styles, rowHeight(h, 13.35));
      }
      p.blank();
    }
  }
  return x;
}

// ── Production sheet: PDF ───────────────────────────────────────────────

const M = 40;
const CW = A4_W - M * 2;
const BOTTOM = A4_H - 52;

function runningFooter(pdf: PdfCanvas, label: string) {
  pdf.forEachPage((i, count) => {
    pdf.text(M, A4_H - 28, `Your KitchenCO · ${label} · queries: ${KITCHEN_SUPPORT_EMAIL}`, { size: 6.5, color: GREY_TEXT });
    if (count > 1) pdf.text(A4_W - M, A4_H - 28, `Page ${i + 1} of ${count}`, { size: 6.5, color: GREY_TEXT, align: 'right' });
  });
}

export function productionSheetPdf(days: KitchenDay[], categoryOrder: string[], scope: string): Uint8Array {
  const pdf = new PdfCanvas();
  let first = true;
  let y = 0;
  const startPage = () => {
    if (!first) pdf.newPage();
    first = false;
    y = 50;
  };

  for (const day of days) {
    const cook = buildCookList(day, categoryOrder);
    const date = fmtSlashDate(day.date);
    // COOK columns: tick | qty | dish | notes
    const cx = [M, M + 24, M + 58, M + 280];
    const dishW = cx[3] - cx[2] - 8;
    const noteW = M + CW - cx[3] - 6;

    const cookHeader = () => {
      pdf.rect(M, y, CW, 18, { fill: INK });
      pdf.tick(cx[0] + 8, y + 5, 8);
      pdf.text(cx[1] + 17, y + 12.5, 'QTY', { font: 'Bold', size: 8, color: '#FFFFFF', align: 'center' });
      pdf.text(cx[2], y + 12.5, 'DISH', { font: 'Bold', size: 8, color: '#FFFFFF' });
      pdf.text(cx[3], y + 12.5, 'NOTES', { font: 'Bold', size: 8, color: '#FFFFFF' });
      y += 18;
    };
    const ensure = (h: number, header?: () => void) => {
      if (y + h <= BOTTOM) return;
      startPage();
      header?.();
    };

    startPage();
    pdf.text(M, y + 8, 'WHAT TO COOK', { font: 'Bold', size: 20 });
    pdf.text(M, y + 26, `${date}  ·  ${scope}`, { size: 10, color: GREY_TEXT });
    pdf.text(M, y + 44, `Meals: ${cook.meals}     Allergies: ${cook.allergies.length}`, { font: 'Bold', size: 12 });
    y += 56;

    if (cook.allergies.length > 0) {
      pdf.rect(M, y, CW, 18, { fill: RED });
      pdf.text(M + 6, y + 12.5, '!! ALLERGIES - COOK FIRST, SEAL & LABEL SEPARATELY (already in the list below)', {
        font: 'Bold',
        size: 9,
        color: '#FFFFFF',
      });
      y += 18;
      for (const a of cook.allergies) {
        const dishLines = pdf.wrap(a.dish, 10, dishW, 'Bold');
        const noteLines = pdf.wrap(a.text, 9, noteW, 'Bold');
        const h = Math.max(20, Math.max(dishLines.length * 12, noteLines.length * 11) + 8);
        ensure(h);
        pdf.rect(M, y, CW, h, { fill: PINK });
        pdf.line(M, y + h, M + CW, y + h, '#E8C4C4', 0.5);
        pdf.checkbox(cx[0] + 7, y + 5, 10);
        pdf.text(cx[1] + 17, y + 14, '1', { font: 'Bold', size: 11, align: 'center' });
        dishLines.forEach((l, i) => pdf.text(cx[2], y + 13 + i * 12, l, { font: 'Bold', size: 10 }));
        noteLines.forEach((l, i) => pdf.text(cx[3], y + 13 + i * 11, l, { font: 'Bold', size: 9, color: RED }));
        y += h;
      }
      y += 8;
    }

    ensure(40);
    cookHeader();
    for (const cat of cook.categories) {
      ensure(18 + 22, cookHeader);
      pdf.rect(M, y, CW, 18, { fill: BAND });
      pdf.text(cx[1] + 17, y + 12.5, String(cat.total), { font: 'Bold', size: 10, align: 'center' });
      pdf.text(cx[2], y + 12.5, cat.name.toUpperCase(), { font: 'Bold', size: 10 });
      y += 18;
      for (const d of cat.dishes) {
        const dishLines = pdf.wrap(d.dish, 10, dishW);
        const notes: { text: string; red: boolean; bold: boolean }[] = d.specials.length
          ? [
              { text: `${d.specials.length} special:`, red: true, bold: true },
              ...d.specials.flatMap(s => pdf.wrap(`• ${s.text}`, 8.5, noteW, s.allergy ? 'Bold' : 'Regular').map(t => ({ text: t, red: true, bold: s.allergy }))),
            ]
          : [];
        const h = Math.max(22, Math.max(dishLines.length * 12, notes.length * 10.5) + 9);
        ensure(h, cookHeader);
        pdf.line(M, y + h, M + CW, y + h, '#CCCCCC', 0.5);
        pdf.checkbox(cx[0] + 7, y + 6, 10);
        pdf.text(cx[1] + 17, y + 15, String(d.qty), { font: 'Bold', size: 12, align: 'center' });
        dishLines.forEach((l, i) => pdf.text(cx[2], y + 14 + i * 12, l, { size: 10 }));
        notes.forEach((nl, i) => pdf.text(cx[3], y + 13 + i * 10.5, nl.text, { font: nl.bold ? 'Bold' : 'Regular', size: 8.5, color: nl.red ? RED : INK }));
        y += h;
      }
    }
    ensure(40);
    pdf.text(M, y + 30, 'Head chef:  ______________________________     Time done:  __________', { font: 'Bold', size: 10 });

    // PACK columns: tick | name | dish | order no. | notes
    const px = [M, M + 22, M + 104, M + 300, M + 400];
    const packHeader = () => {
      pdf.rect(M, y, CW, 16, { fill: BAND });
      pdf.tick(px[0] + 7, y + 4, 8, GREY_TEXT);
      ['NAME', 'DISH', 'ORDER NO.', 'NOTES'].forEach((t, i) => pdf.text(px[i + 1], y + 11, t, { font: 'Bold', size: 7, color: GREY_TEXT }));
      y += 16;
    };
    startPage();
    pdf.text(M, y + 8, 'WHAT TO PACK', { font: 'Bold', size: 20 });
    pdf.text(M, y + 26, `${date}  ·  one row = one meal = one sticker  ·  tick when the sticker is on`, { size: 10, color: GREY_TEXT });
    y += 38;
    for (const drop of day.drops) {
      const band = () => {
        pdf.rect(M, y, CW, 20, { fill: INK });
        pdf.text(M + 6, y + 14, pdf.fit(`${drop.client.toUpperCase()}   ·   ${drop.meals.length} meals   ·   ${drop.address}`, 10, CW - 12, 'Bold'), {
          font: 'Bold',
          size: 10,
          color: '#FFFFFF',
        });
        y += 20;
        packHeader();
      };
      ensure(20 + 16 + 18 + 8);
      y += 8;
      band();
      for (const m of drop.meals) {
        const notes = packNotes(m);
        const nameLines = pdf.wrap(m.person, 9, px[2] - px[1] - 6, 'Bold');
        const dishLines = pdf.wrap(m.dish, 9, px[3] - px[2] - 6);
        const noteLines = notes ? pdf.wrap(notes, 8.5, M + CW - px[4] - 4, m.allergy ? 'Bold' : 'Regular') : [];
        const h = Math.max(18, Math.max(nameLines.length, dishLines.length, noteLines.length) * 11 + 7);
        ensure(h, band);
        if (m.allergy) pdf.rect(M, y, CW, h, { fill: PINK });
        pdf.line(M, y + h, M + CW, y + h, '#CCCCCC', 0.5);
        pdf.checkbox(px[0] + 6, y + 4, 9);
        nameLines.forEach((l, i) => pdf.text(px[1], y + 12 + i * 11, l, { font: 'Bold', size: 9 }));
        dishLines.forEach((l, i) => pdf.text(px[2], y + 12 + i * 11, l, { size: 9 }));
        pdf.text(px[3], y + 12, m.orderNo, { size: 8.5 });
        noteLines.forEach((l, i) => pdf.text(px[4], y + 12 + i * 11, l, { font: m.allergy ? 'Bold' : 'Regular', size: 8.5, color: RED }));
        y += h;
      }
    }
  }
  if (first) startPage();
  runningFooter(pdf, `Production sheet · ${days.map(d => fmtSlashDate(d.date)).join(', ')}`);
  return pdf.build();
}

// ── Delivery notes ──────────────────────────────────────────────────────

export function deliveryNotesPdf(days: KitchenDay[]): Uint8Array {
  const pdf = new PdfCanvas();
  const L = 50;
  const W = A4_W - L * 2;
  const qtyX = L + W - 88;
  const okX = L + W - 30;
  let first = true;
  const footers: string[] = [];

  for (const day of days) {
    const date = fmtSlashDate(day.date);
    const compact = day.date.replace(/-/g, '');
    day.drops.forEach((drop, index) => {
      if (!first) pdf.newPage();
      first = false;
      footers.push(date);
      let y = 0;

      // Header
      pdf.text(L + W, 64, KITCHEN_BRAND, { font: 'Bold', size: 10, align: 'right' });
      pdf.text(L, 80, 'DELIVERY NOTE', { font: 'Bold', size: 22 });
      pdf.line(L, 90, L + W, 90, INK, 1.6);

      // Client / date / number band
      pdf.rect(L, 99, W, 70, { fill: '#F0F0F0' });
      pdf.text(L + 9, 114, 'CLIENT', { font: 'Bold', size: 6.5, color: '#555555' });
      pdf.text(L + 232, 114, 'DATE', { font: 'Bold', size: 6.5, color: '#555555' });
      pdf.text(L + 340, 114, 'DELIVERY NOTE NO.', { font: 'Bold', size: 6.5, color: '#555555' });
      pdf.text(L + 9, 136, pdf.fit(drop.client, 15, 215, 'Bold'), { font: 'Bold', size: 15 });
      pdf.text(L + 232, 137, date, { size: 12 });
      pdf.text(L + 340, 137, `DN-${compact}-${String(index + 1).padStart(3, '0')}`, { size: 12 });
      pdf.text(L + 9, 156, pdf.fit(drop.address, 8.5, W - 18), { size: 8.5, color: '#555555' });

      // Totals
      const allergies = drop.meals.filter(m => m.allergy).length;
      pdf.rect(L, 183, W, 68, { stroke: INK, lineWidth: 1 });
      pdf.line(L + W / 2, 183, L + W / 2, 251, '#BBBBBB', 0.5);
      pdf.text(L + 10, 198, 'TOTAL MEALS', { font: 'Bold', size: 6.5, color: '#555555' });
      pdf.text(L + W / 2 + 10, 198, 'ALLERGY MEALS (sealed separately)', { font: 'Bold', size: 6.5, color: '#555555' });
      pdf.text(L + 10, 238, String(drop.meals.length), { font: 'Bold', size: 26 });
      pdf.text(L + W / 2 + 10, 238, String(allergies), { font: 'Bold', size: 26 });

      // Dish table
      const counts = new Map<string, number>();
      for (const m of drop.meals) counts.set(m.dish, (counts.get(m.dish) ?? 0) + 1);
      const dishes = [...counts.entries()].sort((a, b) => b[1] - a[1] || cmp(a[0], b[0]));
      const tableHeader = (top: number) => {
        pdf.rect(L, top, W, 24, { fill: INK });
        pdf.text(L + 7, top + 15.5, 'DISH', { font: 'Bold', size: 7.5, color: '#FFFFFF' });
        pdf.text(qtyX, top + 15.5, 'QTY', { font: 'Bold', size: 7.5, color: '#FFFFFF', align: 'center' });
        pdf.text(okX, top + 15.5, 'OK', { font: 'Bold', size: 7.5, color: '#FFFFFF', align: 'center' });
        return top + 24;
      };
      y = tableHeader(264);
      const ROW = 24;
      for (const [dish, qty] of dishes) {
        if (y + ROW > BOTTOM) {
          pdf.newPage();
          footers.push(date);
          y = tableHeader(50);
        }
        pdf.text(L + 7, y + 16, pdf.fit(dish, 10.5, qtyX - L - 30), { size: 10.5 });
        pdf.text(qtyX, y + 16.5, String(qty), { font: 'Bold', size: 11.5, align: 'center' });
        pdf.checkbox(okX - 6.5, y + 5.5, 13, '#333333');
        pdf.line(L, y + ROW, L + W, y + ROW, '#DDDDDD', 0.5);
        y += ROW;
      }

      // Sign-off
      const SIGN = 14 + 30 + 116;
      if (y + SIGN > BOTTOM) {
        pdf.newPage();
        footers.push(date);
        y = 40;
      }
      pdf.text(L, y + 14, "Each meal carries a sticker with the client, the person's name and the order number.", { size: 7, color: GREY_TEXT });
      pdf.text(L + 7, y + 40, 'Sign on delivery', { font: 'Bold', size: 10.5 });
      const top = y + 48;
      const colW = W / 3;
      pdf.rect(L, top, W, 112, { stroke: INK, lineWidth: 1.2 });
      pdf.line(L, top + 56, L + W, top + 56, '#BBBBBB', 0.5);
      pdf.line(L + colW, top, L + colW, top + 112, '#BBBBBB', 0.5);
      pdf.line(L + colW * 2, top, L + colW * 2, top + 112, '#BBBBBB', 0.5);
      for (const rowTop of [top, top + 56]) pdf.line(L, rowTop + 16, L + W, rowTop + 16, '#DDDDDD', 0.4);
      const labels = [
        ['DRIVER', 'TIME LEFT KITCHEN', 'TIME DELIVERED'],
        ['RECEIVED BY (NAME)', 'SIGNATURE', 'MEALS COUNTED ON SITE'],
      ];
      labels.forEach((row, r) => row.forEach((label, c) => pdf.text(L + c * colW + 7, top + r * 56 + 11, label, { font: 'Bold', size: 6, color: '#555555' })));
    });
  }
  if (first) pdf.text(50, 80, 'No deliveries for these filters.', { size: 12 });
  pdf.forEachPage(i =>
    pdf.text(50, A4_H - 28, `Your KitchenCO · Delivery note · ${footers[i] ?? ''} · queries: ${KITCHEN_SUPPORT_EMAIL}`, { size: 6.5, color: GREY_TEXT })
  );
  return pdf.build();
}

// ── Delivery times ──────────────────────────────────────────────────────

const pad2 = (v: number) => String(v).padStart(2, '0');

/** "12:41", or "23/10/2026 08:05" when it wasn't delivered on its delivery day. */
function fmtDeliveredAt(iso: string, deliveryDate: string): string {
  const d = new Date(iso);
  const clock = `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  const day = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  return day === deliveryDate ? clock : `${fmtSlashDate(day)} ${clock}`;
}

/** "Delivered 12:41", "Delivered (time not recorded)", or the status it's still in. */
function deliveryStatus(row: AdminOrderRow): string {
  const o = row.order;
  if (o.status !== 'Delivered') return o.status;
  return o.deliveredAt ? `Delivered ${fmtDeliveredAt(o.deliveredAt, o.deliveryDate)}` : 'Delivered (time not recorded)';
}

// ── Customer delivery note (one person, printed on request) ─────────────

/**
 * One A4 note per order, for a single person's query or expense claim: who,
 * which drop-off point, which meals, and when it was delivered. The daily
 * paperwork is the company note; this is printed only when someone asks.
 */
export function customerDeliveryNotesPdf(rows: AdminOrderRow[], addresses: Record<string, string>, generated: string): Uint8Array {
  const pdf = new PdfCanvas();
  const L = 50;
  const W = A4_W - L * 2;
  const qtyX = L + W - 30;

  rows.forEach((row, index) => {
    const o = row.order;
    if (index > 0) pdf.newPage();
    const individual = row.companyName === INDIVIDUAL;
    const dropOff = [row.locationName, o.deliveryFloor ? `Floor ${o.deliveryFloor}` : ''].filter(Boolean).join(' · ');
    const address = addresses[o.locationId] || '';

    // Header
    pdf.text(L + W, 64, KITCHEN_BRAND, { font: 'Bold', size: 10, align: 'right' });
    pdf.text(L, 80, 'DELIVERY NOTE', { font: 'Bold', size: 22 });
    pdf.line(L, 90, L + W, 90, INK, 1.6);

    // Customer / date / invoice band
    pdf.rect(L, 99, W, 70, { fill: '#F0F0F0' });
    pdf.text(L + 9, 114, 'DELIVERED TO', { font: 'Bold', size: 6.5, color: '#555555' });
    pdf.text(L + 232, 114, 'DELIVERY DATE', { font: 'Bold', size: 6.5, color: '#555555' });
    pdf.text(L + 340, 114, 'INVOICE NO.', { font: 'Bold', size: 6.5, color: '#555555' });
    pdf.text(L + 9, 136, pdf.fit(o.customerName || 'Customer', 15, 215, 'Bold'), { font: 'Bold', size: 15 });
    pdf.text(L + 232, 137, fmtSlashDate(o.deliveryDate), { size: 12 });
    pdf.text(L + 340, 137, pdf.fit(o.taxInvoiceNumber || o.orderNumber, 12, W - 349), { size: 12 });
    pdf.text(L + 9, 156, pdf.fit(individual ? 'Individual customer' : row.companyName, 8.5, W - 18), { size: 8.5, color: '#555555' });

    // Drop-off point / status
    pdf.rect(L, 183, W, 68, { stroke: INK, lineWidth: 1 });
    pdf.line(L + W / 2, 183, L + W / 2, 251, '#BBBBBB', 0.5);
    pdf.text(L + 10, 198, 'DROP-OFF POINT', { font: 'Bold', size: 6.5, color: '#555555' });
    pdf.text(L + W / 2 + 10, 198, 'STATUS', { font: 'Bold', size: 6.5, color: '#555555' });
    pdf.text(L + 10, 217, pdf.fit(dropOff, 12, W / 2 - 20, 'Bold'), { font: 'Bold', size: 12 });
    pdf.wrap(address, 8.5, W / 2 - 20)
      .slice(0, 2)
      .forEach((l, i) => pdf.text(L + 10, 231 + i * 10.5, l, { size: 8.5, color: '#555555' }));
    pdf.text(L + W / 2 + 10, 217, pdf.fit(deliveryStatus(row), 12, W / 2 - 20, 'Bold'), { font: 'Bold', size: 12 });
    pdf.text(L + W / 2 + 10, 233, `Ordered ${fmtSlashDate(o.orderDate.slice(0, 10))}`, { size: 8.5, color: '#555555' });

    // Meals, each with its size, allergy and special request
    pdf.rect(L, 264, W, 24, { fill: INK });
    pdf.text(L + 7, 279.5, 'MEAL', { font: 'Bold', size: 7.5, color: '#FFFFFF' });
    pdf.text(qtyX, 279.5, 'QTY', { font: 'Bold', size: 7.5, color: '#FFFFFF', align: 'center' });
    let y = 288;
    for (const line of o.lines) {
      const allergy = allergyLabel(line.allergyNotes);
      const note = (line.notes ?? '').trim();
      const extras = [
        ...(line.sizeLabel ? [{ text: line.sizeLabel, red: false }] : []),
        ...(allergy ? [{ text: `!! ${allergy}`, red: true }] : []),
        ...(note && note !== (line.allergyNotes ?? '').trim() ? [{ text: `Note: ${note}`, red: false }] : []),
      ];
      const h = 24 + extras.length * 11;
      if (y + h > BOTTOM - 80) break; // one page per person — no real order is this long
      pdf.text(L + 7, y + 16, pdf.fit(line.name, 10.5, qtyX - L - 30), { size: 10.5 });
      pdf.text(qtyX, y + 16.5, String(line.quantity), { font: 'Bold', size: 11.5, align: 'center' });
      extras.forEach((e, i) =>
        pdf.text(L + 7, y + 28 + i * 11, pdf.fit(e.text, 8.5, qtyX - L - 30, e.red ? 'Bold' : 'Italic'), {
          font: e.red ? 'Bold' : 'Italic',
          size: 8.5,
          color: e.red ? RED : GREY_TEXT,
        })
      );
      pdf.line(L, y + h, L + W, y + h, '#DDDDDD', 0.5);
      y += h;
    }
    pdf.text(L + 7, y + 18, 'Total meals', { font: 'Bold', size: 10.5 });
    pdf.text(qtyX, y + 18.5, String(o.lines.reduce((sum, l) => sum + l.quantity, 0)), { font: 'Bold', size: 11.5, align: 'center' });

    y += 50;
    const drop = individual ? row.locationName : row.companyName;
    pdf.text(L, y, pdf.fit(`Delivered with the ${drop} drop on ${fmtSlashDate(o.deliveryDate)}; the signed company delivery note for that drop`, 8, W), { size: 8, color: GREY_TEXT });
    pdf.text(L, y + 11, "is kept by Your KitchenCO. Each meal's sticker carries this invoice number.", { size: 8, color: GREY_TEXT });
    pdf.text(L, y + 26, `Issued on request: ${generated}`, { size: 8, color: GREY_TEXT });
  });
  if (rows.length === 0) pdf.text(50, 80, 'No order to print.', { size: 12 });
  pdf.forEachPage(i => {
    const o = rows[i]?.order;
    pdf.text(50, A4_H - 28, `Your KitchenCO · Customer delivery note · ${o ? o.taxInvoiceNumber || o.orderNumber : ''} · queries: ${KITCHEN_SUPPORT_EMAIL}`, {
      size: 6.5,
      color: GREY_TEXT,
    });
  });
  return pdf.build();
}

// ── Delivery report ─────────────────────────────────────────────────────

/**
 * What was delivered, to whom and when: per day and client drop, every
 * person's order with its invoice number, meal count and delivery time (or
 * the status it's still in, in red). Filed with the signed company notes.
 */
export function deliveryReportPdf(rows: AdminOrderRow[], addresses: Record<string, string>, scope: string, filters: string, generated: string): Uint8Array {
  const pdf = new PdfCanvas();
  let y = 50;
  const ensure = (h: number, header?: () => void) => {
    if (y + h <= BOTTOM) return;
    pdf.newPage();
    y = 50;
    header?.();
  };

  const days = groupDrops(rows, addresses);
  const drops = days.reduce((n, d) => n + d.drops.length, 0);
  const meals = rows.reduce((n, r) => n + mealsIn(r), 0);
  const delivered = rows.filter(r => r.order.status === 'Delivered').reduce((n, r) => n + mealsIn(r), 0);

  // Header
  pdf.text(M + CW, 50, KITCHEN_BRAND, { font: 'Bold', size: 10, align: 'right' });
  pdf.text(M, 66, 'DELIVERY REPORT', { font: 'Bold', size: 20 });
  pdf.line(M, 76, M + CW, 76, INK, 1.6);
  pdf.text(M, 92, pdf.fit(`${filters}    ·    ${scope}`, 9, CW), { size: 9, color: GREY_TEXT });
  pdf.text(M, 105, `Generated: ${generated}`, { size: 9, color: GREY_TEXT });
  y = 120;

  const tiles: [string, number][] = [
    ['DROPS', drops],
    ['MEALS', meals],
    ['MEALS DELIVERED', delivered],
    ['NOT YET DELIVERED', meals - delivered],
  ];
  const gap = 8;
  const tileW = (CW - gap * 3) / 4;
  tiles.forEach(([label, value], i) => {
    const x = M + i * (tileW + gap);
    pdf.rect(x, y, tileW, 46, { fill: BAND, radius: 6 });
    pdf.text(x + 9, y + 15, label, { font: 'Bold', size: 6.5, color: '#555555' });
    pdf.text(x + 9, y + 36, String(value), { font: 'Bold', size: 15, color: i === 3 && value > 0 ? RED : INK });
  });
  y += 46 + 20;

  // NAME | INVOICE NO. | MEALS | DISHES | DELIVERED
  const cols = [
    { label: 'NAME', x: M, w: 120 },
    { label: 'INVOICE NO.', x: M + 120, w: 110 },
    { label: 'MEALS', x: M + 230, w: 40, right: true },
    { label: 'DISHES', x: M + 270, w: 160 },
    { label: 'DELIVERED', x: M + 430, w: 85 },
  ];
  const cells = (values: string[], ry: number, style: (i: number) => { font: CanvasFont; size: number; color: string }) =>
    cols.forEach((c, i) => {
      const { font, size, color } = style(i);
      if (c.right) pdf.text(c.x + c.w - 8, ry, values[i], { font, size, color, align: 'right' });
      else pdf.text(c.x + 6, ry, pdf.fit(values[i], size, c.w - 12, font), { font, size, color });
    });

  for (const day of days) {
    ensure(80);
    pdf.text(M, y + 10, fmtSlashDate(day.date), { font: 'Bold', size: 12 });
    y += 18;
    for (const drop of day.drops) {
      const dropMeals = drop.rows.reduce((n, r) => n + mealsIn(r), 0);
      const band = (cont = false) => {
        pdf.rect(M, y, CW, 20, { fill: INK });
        pdf.text(M + 6, y + 14, pdf.fit(`${drop.client.toUpperCase()}${cont ? ' (cont.)' : ''}   ·   ${dropMeals} meals   ·   ${drop.address}`, 10, CW - 12, 'Bold'), {
          font: 'Bold',
          size: 10,
          color: '#FFFFFF',
        });
        y += 20;
        pdf.rect(M, y, CW, 16, { fill: BAND });
        cells(cols.map(c => c.label), y + 11, () => ({ font: 'Bold', size: 7, color: GREY_TEXT }));
        y += 16;
      };
      ensure(6 + 20 + 16 + 16);
      y += 6;
      band();
      const people = [...drop.rows].sort((a, b) => cmp(a.order.customerName, b.order.customerName));
      for (const row of people) {
        ensure(16, () => band(true));
        const o = row.order;
        const done = o.status === 'Delivered';
        const when = done ? (o.deliveredAt ? fmtDeliveredAt(o.deliveredAt, o.deliveryDate) : 'Yes (no time)') : o.status;
        cells([o.customerName || 'Customer', o.taxInvoiceNumber || o.orderNumber, String(mealsIn(row)), o.itemName, when], y + 11.5, i => ({
          font: i === 0 || (i === 4 && !done) ? 'Bold' : 'Regular',
          size: 8.5,
          color: i === 4 && !done ? RED : INK,
        }));
        pdf.line(M, y + 16, M + CW, y + 16, '#E2E2E2', 0.4);
        y += 16;
      }
      y += 6;
    }
    y += 8;
  }
  if (rows.length === 0) pdf.text(M, y + 10, 'No deliveries for these filters.', { size: 12 });

  runningFooter(pdf, 'Delivery report');
  return pdf.build();
}

// ── Meal stickers ───────────────────────────────────────────────────────

/** A4 21-up label stock (63.5 x 38.1 mm, 3 across x 7 down) — e.g. Avery L7160 / Tower W121. */
const LABEL = { w: 180, h: 108, left: 20.4, top: 43, pitchX: 187.1, pitchY: 108, cols: 3, rows: 7 };

export function mealStickersPdf(days: KitchenDay[]): Uint8Array {
  const pdf = new PdfCanvas();
  let slot = 0;
  const pad = 9;

  for (const day of days) {
    const date = fmtSlashDate(day.date);
    for (const drop of day.drops) {
      drop.meals.forEach((m, i) => {
        if (slot > 0 && slot % (LABEL.cols * LABEL.rows) === 0) pdf.newPage();
        const cell = slot % (LABEL.cols * LABEL.rows);
        const x = LABEL.left + (cell % LABEL.cols) * LABEL.pitchX;
        const y = LABEL.top + Math.floor(cell / LABEL.cols) * LABEL.pitchY;
        const inner = LABEL.w - pad * 2;
        slot++;

        pdf.rect(x, y, LABEL.w, LABEL.h, { stroke: '#C8C8C8', lineWidth: 0.6, radius: 7 });
        const dateW = pdf.measure(date, 6.5);
        pdf.text(x + LABEL.w - pad, y + 15, date, { size: 6.5, align: 'right' });
        const client = drop.client.toUpperCase();
        const clientMax = inner - dateW - 6;
        const clientSize = pdf.fitSize(client, 13, 8, clientMax, 'Bold') ?? 8;
        pdf.text(x + pad, y + 18, pdf.fit(client, clientSize, clientMax, 'Bold'), { font: 'Bold', size: clientSize });
        const nameSize = pdf.fitSize(m.person, 13, 9, inner, 'Bold') ?? 9;
        pdf.text(x + pad, y + 32, pdf.fit(m.person, nameSize, inner, 'Bold'), { font: 'Bold', size: nameSize });
        const dishSize = pdf.fitSize(m.dish, 7.5, 5.5, inner) ?? 5.5;
        pdf.text(x + pad, y + 43, pdf.fit(m.dish, dishSize, inner), { size: dishSize });

        if (m.note) {
          const note = `Note: ${m.note}`;
          const noteSize = pdf.fitSize(note, 6.5, 5, inner, 'Italic') ?? 5;
          pdf.text(x + pad, y + (m.allergy ? 72 : 86), pdf.fit(note, noteSize, inner, 'Italic'), { font: 'Italic', size: noteSize });
        }
        if (m.allergy) {
          const bar = `!! ${m.allergy} !!`;
          pdf.rect(x + pad, y + 77, inner, 10.5, { fill: '#000000' });
          pdf.text(x + pad + 3, y + 85, pdf.fit(bar, 7, inner - 6, 'Bold'), { font: 'Bold', size: 7, color: '#FFFFFF' });
        }
        pdf.text(x + pad, y + 98, pdf.fit(`Order: ${m.orderNo}`, 6.5, inner - 30, 'Bold'), { font: 'Bold', size: 6.5 });
        pdf.text(x + LABEL.w - pad, y + 98, `${i + 1} / ${drop.meals.length}`, { size: 5.5, align: 'right' });
      });
    }
  }
  if (slot === 0) pdf.text(40, 80, 'No meals for these filters.', { size: 12 });
  return pdf.build();
}

// ── Detailed report (PDF) ───────────────────────────────────────────────

/** "R1 234.50" — the app's R0.00 with thousands spaced (not toLocaleString: en-ZA uses a decimal comma, and Hermes' Intl varies). */
const rands = (n: number) => `R${n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}`;
const mealsIn = (row: AdminOrderRow) => row.order.lines.reduce((sum, l) => sum + l.quantity, 0);

interface ReportColumn {
  label: string;
  width: number;
  align?: 'left' | 'right';
}

interface Tally {
  orders: number;
  meals: number;
  revenue: number;
}

/** Orders / meals / revenue per key (status, client, delivery day). */
function tally(rows: AdminOrderRow[], key: (r: AdminOrderRow) => string): Map<string, Tally> {
  const out = new Map<string, Tally>();
  for (const row of rows) {
    const t = out.get(key(row)) ?? { orders: 0, meals: 0, revenue: 0 };
    t.orders += 1;
    t.meals += mealsIn(row);
    t.revenue += row.order.totalAmount;
    out.set(key(row), t);
  }
  return out;
}

/**
 * The management report behind the current filters: headline figures, then
 * totals per status / client / delivery day / dish, then every order in full
 * (lines, special requests, allergies, subsidy, fees, discount, total).
 */
export function detailedReportPdf(rows: AdminOrderRow[], scope: string, filters: string, generated: string): Uint8Array {
  const pdf = new PdfCanvas();
  let y = 50;
  const newPage = () => {
    pdf.newPage();
    y = 50;
  };
  const ensure = (h: number, header?: () => void) => {
    if (y + h <= BOTTOM) return;
    newPage();
    header?.();
  };

  const orders = rows.length;
  const meals = rows.reduce((s, r) => s + mealsIn(r), 0);
  const revenue = rows.reduce((s, r) => s + r.order.totalAmount, 0);
  const subsidy = rows.reduce((s, r) => s + (r.order.subsidyAmount || 0), 0);
  const fees = rows.reduce((s, r) => s + (r.order.deliveryFee || 0), 0);
  const discounts = rows.reduce((s, r) => s + (r.order.discountAmount || 0), 0);
  const allergyOrders = rows.filter(r => r.order.allergyNotes || r.order.lines.some(l => l.allergyNotes)).length;

  // Header
  pdf.text(M + CW, 50, KITCHEN_BRAND, { font: 'Bold', size: 10, align: 'right' });
  pdf.text(M, 66, 'DETAILED ORDER REPORT', { font: 'Bold', size: 20 });
  pdf.line(M, 76, M + CW, 76, INK, 1.6);
  pdf.text(M, 92, pdf.fit(`${filters}    ·    ${scope}`, 9, CW), { size: 9, color: GREY_TEXT });
  pdf.text(M, 105, `Generated: ${generated}`, { size: 9, color: GREY_TEXT });
  y = 120;

  // Headline tiles, 4 x 2
  const tiles: [string, string][] = [
    ['ORDERS', String(orders)],
    ['MEALS', String(meals)],
    ['REVENUE', rands(revenue)],
    ['AVG ORDER', rands(orders ? revenue / orders : 0)],
    ['SUBSIDY', rands(subsidy)],
    ['DELIVERY FEES', rands(fees)],
    ['DISCOUNTS', rands(discounts)],
    ['ALLERGY ORDERS', String(allergyOrders)],
  ];
  const gap = 8;
  const tileW = (CW - gap * 3) / 4;
  tiles.forEach(([label, value], i) => {
    const x = M + (i % 4) * (tileW + gap);
    const ty = y + Math.floor(i / 4) * (46 + gap);
    pdf.rect(x, ty, tileW, 46, { fill: BAND, radius: 6 });
    pdf.text(x + 9, ty + 15, label, { font: 'Bold', size: 6.5, color: '#555555' });
    const size = pdf.fitSize(value, 15, 9, tileW - 18, 'Bold') ?? 9;
    pdf.text(x + 9, ty + 36, pdf.fit(value, size, tileW - 18, 'Bold'), { font: 'Bold', size });
  });
  y += 46 * 2 + gap + 22;

  const section = (title: string) => {
    ensure(60);
    pdf.text(M, y + 10, title, { font: 'Bold', size: 12 });
    y += 18;
  };

  /** A zebra table that repeats its header row across page breaks, with an optional bold totals row. */
  const table = (cols: ReportColumn[], body: string[][], totals?: string[]) => {
    const xs: number[] = [];
    let x = M;
    for (const c of cols) {
      xs.push(x);
      x += c.width;
    }
    const cells = (row: string[], ry: number, font: CanvasFont, color: string) =>
      cols.forEach((c, i) => {
        const right = c.align === 'right';
        pdf.text(right ? xs[i] + c.width - 6 : xs[i] + 6, ry + 11.5, pdf.fit(row[i] ?? '', 8.5, c.width - 12, font), {
          font,
          size: 8.5,
          color,
          align: right ? 'right' : 'left',
        });
      });
    const header = () => {
      pdf.rect(M, y, CW, 17, { fill: INK });
      cells(cols.map(c => c.label.toUpperCase()), y, 'Bold', '#FFFFFF');
      y += 17;
    };
    header();
    body.forEach((row, i) => {
      ensure(16, header);
      if (i % 2 === 1) pdf.rect(M, y, CW, 16, { fill: BAND });
      cells(row, y, 'Regular', INK);
      y += 16;
    });
    if (totals) {
      ensure(18, header);
      pdf.line(M, y, M + CW, y, INK, 1);
      cells(totals, y + 1, 'Bold', INK);
      y += 18;
    }
    y += 16;
  };

  const countCols: ReportColumn[] = [
    { label: 'Orders', width: 80, align: 'right' },
    { label: 'Meals', width: 80, align: 'right' },
    { label: 'Revenue', width: 90, align: 'right' },
  ];
  const countCells = (t: Tally) => [String(t.orders), String(t.meals), rands(t.revenue)];
  const totalCells = ['Total', String(orders), String(meals), rands(revenue)];

  section('BY STATUS');
  const statusOrder = ['Received', 'Preparing', 'Out for Delivery', 'Delivered', 'Cancelled'];
  const byStatus = [...tally(rows, r => r.order.status).entries()].sort(
    (a, b) => (statusOrder.indexOf(a[0]) + 1 || 99) - (statusOrder.indexOf(b[0]) + 1 || 99)
  );
  table([{ label: 'Status', width: CW - 250 }, ...countCols], byStatus.map(([s, t]) => [s, ...countCells(t)]), totalCells);

  section('BY CLIENT');
  const byClient = [...tally(rows, r => r.companyName).entries()].sort((a, b) => b[1].revenue - a[1].revenue || cmp(a[0], b[0]));
  table(
    [{ label: 'Client', width: CW - 320 }, ...countCols, { label: 'Share', width: 70, align: 'right' }],
    byClient.map(([name, t]) => [name, ...countCells(t), revenue ? `${((t.revenue / revenue) * 100).toFixed(1)}%` : '—']),
    [...totalCells, revenue ? '100%' : '—']
  );

  section('BY DELIVERY DAY');
  const byDay = [...tally(rows, r => r.order.deliveryDate).entries()].sort((a, b) => a[0].localeCompare(b[0]));
  table([{ label: 'Delivery date', width: CW - 250 }, ...countCols], byDay.map(([date, t]) => [fmtSlashDate(date), ...countCells(t)]), totalCells);

  // Menu value = unit price x qty, before subsidy / delivery / discount.
  section('BY DISH');
  const dishes = new Map<string, { category: string; qty: number; value: number }>();
  for (const row of rows)
    for (const l of row.order.lines) {
      const d = dishes.get(l.name) ?? { category: l.category, qty: 0, value: 0 };
      d.qty += l.quantity;
      d.value += l.quantity * l.unitPrice;
      dishes.set(l.name, d);
    }
  const dishRows = [...dishes.entries()].sort((a, b) => b[1].qty - a[1].qty || cmp(a[0], b[0]));
  table(
    [
      { label: 'Dish', width: CW - 300 },
      { label: 'Category', width: 130 },
      { label: 'Qty', width: 70, align: 'right' },
      { label: 'Menu value', width: 100, align: 'right' },
    ],
    dishRows.map(([name, d]) => [name, d.category || '—', String(d.qty), rands(d.value)]),
    ['Total', '', String(meals), rands(dishRows.reduce((s, [, d]) => s + d.value, 0))]
  );

  // Every order in full, by delivery day, client, customer
  const sorted = [...rows].sort(
    (a, b) => a.order.deliveryDate.localeCompare(b.order.deliveryDate) || cmp(a.companyName, b.companyName) || cmp(a.order.customerName, b.order.customerName)
  );
  newPage();
  pdf.text(M, y + 10, 'ORDER DETAIL', { font: 'Bold', size: 12 });
  y += 22;
  for (const row of sorted) {
    const o = row.order;
    const lines = o.lines.map(l => {
      const extras = [l.sizeLabel, l.notes].filter(Boolean).join(' · ');
      return { text: `${l.quantity} x ${l.name}${extras ? `  (${extras})` : ''}`, amount: rands(l.quantity * l.unitPrice) };
    });
    const allergy = [...new Set([o.allergyNotes, ...o.lines.map(l => l.allergyNotes)].filter(Boolean))].join(' · ');
    const money = [
      o.subsidyAmount ? `Subsidy -${rands(o.subsidyAmount)}` : '',
      o.deliveryFee ? `Delivery ${rands(o.deliveryFee)}` : '',
      o.discountAmount ? `Discount -${rands(o.discountAmount)}` : '',
    ].filter(Boolean);
    ensure(20 + lines.length * 13 + (allergy ? 14 : 0) + 28);

    pdf.rect(M, y, CW, 20, { fill: BAND });
    pdf.text(M + 6, y + 13.5, pdf.fit(`#${o.orderNumber}`, 9, 70, 'Bold'), { font: 'Bold', size: 9 });
    pdf.text(M + 80, y + 13.5, fmtSlashDate(o.deliveryDate), { size: 9 });
    pdf.text(M + 145, y + 13.5, pdf.fit(`${o.customerName} — ${row.companyName}, ${row.locationName}`, 9, CW - 145 - 100), { size: 9 });
    pdf.text(M + CW - 6, y + 13.5, o.status, { font: 'Bold', size: 8.5, align: 'right' });
    y += 20;

    for (const l of lines) {
      pdf.text(M + 14, y + 10, pdf.fit(l.text, 8.5, CW - 110), { size: 8.5 });
      pdf.text(M + CW - 6, y + 10, l.amount, { size: 8.5, align: 'right', color: GREY_TEXT });
      y += 13;
    }
    if (allergy) {
      pdf.text(M + 14, y + 10, pdf.fit(`ALLERGY: ${allergy}`, 8.5, CW - 28, 'Bold'), { font: 'Bold', size: 8.5, color: RED });
      y += 14;
    }
    pdf.line(M + 14, y + 2, M + CW, y + 2, '#DDDDDD', 0.5);
    if (money.length) pdf.text(M + 14, y + 13, money.join('    '), { size: 8, color: GREY_TEXT });
    pdf.text(M + CW - 6, y + 13, `Total ${rands(o.totalAmount)}`, { font: 'Bold', size: 9, align: 'right' });
    y += 28;
  }

  runningFooter(pdf, 'Detailed Order Report');
  return pdf.build();
}
