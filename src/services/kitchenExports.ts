/**
 * Services/KitchenExports — YKC Daily Kitchen Documents & Dispatch Suite
 *
 * Implements the complete 5-sheet Excel workbook and vector PDF suite matching
 * the official Your KitchenCO specifications:
 *  - Excel Workbook (`YKC_Daily_Kitchen_Documents.xlsx`):
 *      1. `FILTER - ALL MEALS`
 *      2. `1. COOK` (WHAT TO COOK)
 *      3. `2. PACK` (WHAT TO PACK)
 *      4. `3. DELIVERY NOTE`
 *      5. `4. DELIVERY REPORT`
 *  - PDF Documents:
 *      1. `YKC_Production_Sheet.pdf` (1. COOK + 2. PACK)
 *      2. `YKC_Delivery_Notes.pdf` (3. DELIVERY NOTE per company)
 *      3. `YKC_Delivery_Report.pdf` (4. DELIVERY REPORT per company, one line per sticker)
 *      4. `YKC_Meal_Stickers.pdf` (5. MEAL STICKERS — 3x7 A4 label sheets, 21 per page)
 *      5. `YKC_Individual_Delivery_Notes.pdf` (2 individual slips per A4 page with cut line)
 *      6. `YKC_Invoices.pdf` (Tax Invoices matching YKC Invoice template)
 */
import {
  PdfWriter,
  XlsxWriter,
  XlsxRowCell,
  XLSX_STYLE,
  PDF_COLORS,
  PAGE_W,
  PAGE_H,
  wrapPdfText,
  sharePdf,
  shareXlsx,
  INVOICE_SUPPORT_EMAIL,
} from './export';
import { OrderHistoryItem, CartItem } from '../types';

export interface AdminActiveOrderRow {
  order: OrderHistoryItem;
  companyName: string;
  locationName: string;
  customerName: string;
  deliveryDateLabel: string;
}

export interface PrepSummarySpecialNote {
  recipientName: string;
  companyName: string;
  note: string;
  isAllergy: boolean;
}

export interface PrepSummaryItem {
  dishName: string;
  categoryName: string;
  totalQuantity: number;
  allergyCount: number;
  specialNotes: PrepSummarySpecialNote[];
}

export interface FlatMealRecord {
  company: string;
  companyUpper: string;
  companyAddress: string;
  dropoffPoint: string;
  sticker: string;
  stickerIndex: number;
  companyTotal: number;
  category: string;
  categoryUpper: string;
  meal: string;
  recipientName: string;
  customerEmail: string;
  orderNo: string;
  notes: string | null;
  isAllergy: boolean;
  allergyYesNo: 'YES' | 'No';
  allergyDisplay: string;
  deliveryDateIso: string;
  deliveryDateSlash: string;
  deliveryDateShort: string;
  invoiceDateShort: string;
  eatByDateSlash: string;
  order: OrderHistoryItem;
  cartItem: CartItem;
}

export type KitchenExportType =
  | 'workbook_excel'
  | 'production_excel'
  | 'production_pdf'
  | 'delivery_pdf'
  | 'delivery_report_pdf'
  | 'stickers_pdf'
  | 'individual_delivery_pdf'
  | 'invoices_pdf';

const pad2 = (n: number) => String(n).padStart(2, '0');
const pad3 = (n: number) => String(n).padStart(3, '0');

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_FULL = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const CATEGORY_ORDER: string[] = [
  'CIAO ITALY',
  'SANDWICHES',
  'WRAPS',
  'SALAD BAR',
  'RAMEN BOWLS',
  'FITNESS MEALS',
  'YKC — CYCLE MENU',
  'YKC CYCLE MENU',
  'STIR FRY',
  'HOT DOGS',
  'HOT DOG SALOON',
  'BURGER BAR',
  'POKE BOWL',
  'HOMEMADE WINTER SOUPS',
  'VEGAN MEALS',
  'SIDES & SAUCES',
];

function categoryRank(catUpper: string): number {
  const idx = CATEGORY_ORDER.findIndex((c) => catUpper.includes(c) || c.includes(catUpper));
  return idx === -1 ? 999 : idx;
}

/**
 * Determines whether a note string represents a medical/dietary ALLERGY
 * (which must be cooked first, sealed & labeled separately) vs a culinary special request.
 */
export function isAllergyNote(note?: string | null): boolean {
  if (!note || !note.trim()) return false;
  return /allerg|peanut|nut\b|nuts\b|dairy|gluten|fish|shellfish|soy|sesame|celiac|coeliac|anaphyla|intoleran|lactose|^!!/i.test(
    note.trim()
  );
}

/**
 * Formats an allergy note in clean uppercase (e.g. "DAIRY ALLERGY") while preserving special requests.
 */
export function formatNoteDisplay(note?: string | null, isAllergy?: boolean): string {
  if (!note || !note.trim()) return '';
  const clean = note.trim().replace(/^!!+\s*/, '').replace(/\s*!!+$/, '');
  if (isAllergy ?? isAllergyNote(clean)) {
    const up = clean.toUpperCase();
    return up.includes('ALLERGY') ? up : `${up} ALLERGY`;
  }
  return clean;
}

export function cleanPersonName(rawName?: string): string {
  if (!rawName) return 'Corporate Client';
  return rawName.replace(/\s*\([^)]*@[^)]*\)\s*$/, '').trim() || 'Corporate Client';
}

function extractEmail(rawName?: string, fallbackEmail?: string): string {
  if (fallbackEmail && fallbackEmail.includes('@')) return fallbackEmail.trim();
  const match = rawName?.match(/\(([^)]*@[^)]*)\)/);
  return match ? match[1].trim() : '';
}

function parseIsoDate(iso?: string): Date {
  if (iso && /^\d{4}-\d{2}-\d{2}/.test(iso)) {
    const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  return new Date();
}

export function formatSlashDate(iso?: string): string {
  const d = parseIsoDate(iso);
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
}

export function formatEatBySlashDate(iso?: string): string {
  const d = parseIsoDate(iso);
  d.setDate(d.getDate() + 1);
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
}

export function formatShortDayDate(iso?: string): string {
  const d = parseIsoDate(iso);
  return `${DAYS_SHORT[d.getDay()]} ${pad2(d.getDate())} ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`;
}

export function formatShortDate(iso?: string): string {
  const d = parseIsoDate(iso);
  return `${pad2(d.getDate())} ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`;
}

export function formatFullDate(iso?: string): string {
  const d = parseIsoDate(iso);
  return `${pad2(d.getDate())} ${MONTHS_FULL[d.getMonth()]} ${d.getFullYear()}`;
}

function formatCompactDate(iso?: string): string {
  const d = parseIsoDate(iso);
  return `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}`;
}

function normalizeCategoryDisplay(rawCat?: string, menuType?: string): { title: string; upper: string } {
  if (!rawCat || !rawCat.trim()) {
    if (menuType === 'chefs_choice') {
      return { title: 'YKC — Cycle Menu', upper: 'YKC CYCLE MENU' };
    }
    return { title: 'Ciao Italy', upper: 'CIAO ITALY' };
  }
  const clean = rawCat.trim();
  const upper = clean.toUpperCase();
  if (upper.includes('CHEF') || upper.includes('CYCLE')) {
    return { title: 'YKC — Cycle Menu', upper: 'YKC CYCLE MENU' };
  }
  if (upper.includes('HOT DOG')) {
    return { title: 'Hot Dogs', upper: 'HOT DOGS' };
  }
  const title = clean
    .toLowerCase()
    .split(/\s+/)
    .map((w) => (w === 'ykc' || w === 'bbq' || w === 'gi' ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ');
  return { title, upper };
}

function normalizeAddress(companyName: string, locationName?: string, deliveryFloor?: string): string {
  const loc = (locationName || '').trim();
  if (loc && !loc.toLowerCase().startsWith(companyName.toLowerCase())) {
    return loc;
  }
  if (loc.includes('•')) {
    return loc.split('•').slice(1).join('•').trim();
  }
  const lower = companyName.toLowerCase();
  if (lower.includes('ecogra')) return '160 Jan Smuts Ave, Rosebank, Johannesburg';
  if (lower.includes('rcl')) return '15 Railey Road, Bedfordview, Johannesburg';
  if (lower.includes('tata')) return '39 Ferguson Road, Illovo, Johannesburg';
  if (lower.includes('betway')) return '34 Melrose Blvd, Melrose Arch, Johannesburg';
  if (lower.includes('intellect')) return '11 Alice Lane, Sandhurst, Building 1';
  return loc || deliveryFloor || 'Corporate Office Park, Johannesburg';
}

function normalizeOrderInvNumber(order: OrderHistoryItem, seqIdx: number): string {
  if (order.taxInvoiceNumber && /^INV-\d{8}-\d+/.test(order.taxInvoiceNumber)) {
    return order.taxInvoiceNumber;
  }
  if (order.orderNumber && /^INV-\d{8}-\d+/.test(order.orderNumber)) {
    return order.orderNumber;
  }
  const dateCompact = formatCompactDate(order.targetDeliveryDate);
  const digits = (order.taxInvoiceNumber || order.orderNumber || '').replace(/\D/g, '').slice(-5);
  const seq = digits ? digits.padStart(5, '0') : String(seqIdx + 1).padStart(5, '0');
  return `INV-${dateCompact}-${seq}`;
}

function formatMealTitle(item: CartItem): string {
  let name = item.menuItem.name.trim();
  if (item.selectedAddOns && item.selectedAddOns.length > 0) {
    const addOnText = item.selectedAddOns.map((a) => a.name).join(', ');
    if (!name.includes(addOnText)) {
      name = `${name} | ${addOnText}`;
    }
  } else if (item.size === 'large' && !/large/i.test(name)) {
    name = `${name} | Large`;
  }
  return name;
}

/**
 * Flattens all order items into individual container records, groups by company,
 * sorts by Category -> Meal -> Recipient Name, and assigns `1 of N` sticker numbers.
 */
export function buildFlatMealRecords(rows: AdminActiveOrderRow[]): FlatMealRecord[] {
  const rawList: Omit<FlatMealRecord, 'sticker' | 'stickerIndex' | 'companyTotal'>[] = [];

  rows.forEach((r, orderIdx) => {
    const company = (r.companyName || r.order.companyName || 'Corporate Partner').trim();
    const companyUpper = company.toUpperCase();
    const companyAddress = normalizeAddress(company, r.locationName || r.order.companyLocation, r.order.deliveryFloor);
    const dropoffPoint = r.order.deliveryFloor || 'Reception desk';
    const recipientName = cleanPersonName(r.order.customerName || r.customerName);
    const customerEmail = extractEmail(r.customerName, r.order.customerEmail);
    const orderNo = normalizeOrderInvNumber(r.order, orderIdx);
    const deliveryDateIso = r.order.targetDeliveryDate || new Date().toISOString().slice(0, 10);
    const deliveryDateSlash = formatSlashDate(deliveryDateIso);
    const deliveryDateShort = formatShortDayDate(deliveryDateIso);
    const invoiceDateShort = formatShortDate(r.order.createdAt || deliveryDateIso);
    const eatByDateSlash = formatEatBySlashDate(deliveryDateIso);

    for (const item of r.order.items) {
      const qty = Math.max(1, item.quantity || 1);
      const { title: category, upper: categoryUpper } = normalizeCategoryDisplay(
        item.menuItem.categoryName,
        item.menuItem.menuType
      );
      const meal = formatMealTitle(item);
      const rawNote = item.allergyNotes?.trim() || null;
      const allergyFlag = isAllergyNote(rawNote);
      const allergyDisplay = rawNote ? formatNoteDisplay(rawNote, allergyFlag) : '';

      for (let q = 0; q < qty; q++) {
        rawList.push({
          company,
          companyUpper,
          companyAddress,
          dropoffPoint,
          category,
          categoryUpper,
          meal,
          recipientName,
          customerEmail,
          orderNo,
          notes: rawNote ? (allergyFlag ? allergyDisplay : rawNote) : null,
          isAllergy: allergyFlag,
          allergyYesNo: allergyFlag ? 'YES' : 'No',
          allergyDisplay,
          deliveryDateIso,
          deliveryDateSlash,
          deliveryDateShort,
          invoiceDateShort,
          eatByDateSlash,
          order: r.order,
          cartItem: item,
        });
      }
    }
  });

  // Group by company (preserving first-seen company order)
  const companyMap = new Map<string, typeof rawList>();
  for (const item of rawList) {
    const key = item.companyUpper;
    const list = companyMap.get(key) || [];
    list.push(item);
    companyMap.set(key, list);
  }

  const finalRecords: FlatMealRecord[] = [];
  for (const [, compItems] of companyMap.entries()) {
    compItems.sort((a, b) => {
      const catDiff = categoryRank(a.categoryUpper) - categoryRank(b.categoryUpper);
      if (catDiff !== 0) return catDiff;
      const catAlpha = a.categoryUpper.localeCompare(b.categoryUpper);
      if (catAlpha !== 0) return catAlpha;
      const mealDiff = a.meal.localeCompare(b.meal);
      if (mealDiff !== 0) return mealDiff;
      return a.recipientName.localeCompare(b.recipientName);
    });

    const total = compItems.length;
    compItems.forEach((rec, idx) => {
      finalRecords.push({
        ...rec,
        stickerIndex: idx + 1,
        companyTotal: total,
        sticker: `${idx + 1} of ${total}`,
      });
    });
  }

  return finalRecords;
}

/**
 * Builds the aggregated prep summary for `1. COOK` and the Admin Prep Summary view.
 */
export function buildPrepSummary(orders: AdminActiveOrderRow[]): PrepSummaryItem[] {
  const flat = buildFlatMealRecords(orders);
  const map = new Map<string, PrepSummaryItem>();

  for (const rec of flat) {
    const key = `${rec.categoryUpper}::${rec.meal}`;
    let entry = map.get(key);
    if (!entry) {
      entry = {
        dishName: rec.meal,
        categoryName: rec.categoryUpper,
        totalQuantity: 0,
        allergyCount: 0,
        specialNotes: [],
      };
      map.set(key, entry);
    }
    entry.totalQuantity += 1;
    if (rec.isAllergy) {
      entry.allergyCount += 1;
    }
    if (rec.notes) {
      entry.specialNotes.push({
        recipientName: rec.recipientName,
        companyName: rec.company,
        note: rec.notes,
        isAllergy: rec.isAllergy,
      });
    }
  }

  return [...map.values()].sort((a, b) => {
    const catDiff = categoryRank(a.categoryName) - categoryRank(b.categoryName);
    if (catDiff !== 0) return catDiff;
    if (b.totalQuantity !== a.totalQuantity) return b.totalQuantity - a.totalQuantity;
    return a.dishName.localeCompare(b.dishName);
  });
}

// ── Shared Invoice Page Renderer (Used by Admin & Customer TaxInvoiceModal) ──

export function renderInvoicePageToPdf(pdf: PdfWriter, row: AdminActiveOrderRow, pageNum = 1) {
  const o = row.order;
  const invNo = normalizeOrderInvNumber(o, pageNum - 1);
  const invDate = formatFullDate(o.createdAt || o.targetDeliveryDate);
  const customerName = cleanPersonName(o.customerName || row.customerName);
  const customerEmail = extractEmail(row.customerName, o.customerEmail) || 'client@corporate.co.za';
  const companyName = row.companyName || o.companyName || 'Corporate Partner';
  const address = normalizeAddress(companyName, row.locationName || o.companyLocation, o.deliveryFloor);
  const dropoff = o.deliveryFloor || 'Corporate Reception Pantry';
  const statusText = o.status === 'cancelled' ? 'CANCELLED' : 'PAID';

  const leftX = 42;
  const rightX = PAGE_W - 42;
  const contentW = rightX - leftX;

  // 1. Top Brand Wordmark & INVOICE Title
  pdf.textAt(leftX, 56, 'your kitchen co.', 24, 'Normal', PDF_COLORS.darkGrey);
  pdf.drawLine(leftX + 42, 60, leftX + 135, 60, PDF_COLORS.borderLight, 0.8);
  pdf.rightTextAt(rightX, 58, 'INVOICE', 20, 'Bold', PDF_COLORS.black);

  pdf.textAt(leftX, 78, 'Your KitchenCO (Pty) Ltd \xB7 Reg. 2024/104928/07', 8.5, 'Normal', PDF_COLORS.midGrey);
  pdf.rightTextAt(rightX, 78, 'Corporate Culinary Hub, Sandton, Johannesburg', 8.5, 'Normal', PDF_COLORS.midGrey);

  pdf.drawLine(leftX, 88, rightX, 88, PDF_COLORS.black, 1.5);

  // 2. Metadata Bar (INVOICE NO. | INVOICE DATE | ORDER REF. | STATUS)
  const metaTop = 98;
  const metaH = 44;
  const statusBoxW = 104;
  pdf.fillRect(leftX, metaTop, contentW - statusBoxW, metaH, PDF_COLORS.greyFill);
  pdf.fillRect(rightX - statusBoxW, metaTop, statusBoxW, metaH, PDF_COLORS.greenFill);

  pdf.textAt(leftX + 10, metaTop + 15, 'INVOICE NO.', 7.5, 'Bold', PDF_COLORS.midGrey);
  pdf.textAt(leftX + 10, metaTop + 32, invNo, 11, 'Bold', PDF_COLORS.black);

  pdf.textAt(leftX + 150, metaTop + 15, 'INVOICE DATE', 7.5, 'Bold', PDF_COLORS.midGrey);
  pdf.textAt(leftX + 150, metaTop + 32, invDate, 10.5, 'Normal', PDF_COLORS.black);

  pdf.textAt(leftX + 275, metaTop + 15, 'ORDER REF.', 7.5, 'Bold', PDF_COLORS.midGrey);
  pdf.textAt(leftX + 275, metaTop + 32, `#${invNo}`, 10.5, 'Normal', PDF_COLORS.black);

  pdf.textAt(rightX - statusBoxW + 10, metaTop + 15, 'STATUS', 7.5, 'Bold', PDF_COLORS.midGrey);
  pdf.textAt(rightX - statusBoxW + 10, metaTop + 33, statusText, 12, 'Bold', PDF_COLORS.greenText);

  // 3. BILLED TO & DELIVERED TO Boxes
  const boxTop = 152;
  const boxH = 74;
  const halfW = contentW / 2;
  pdf.strokeRect(leftX, boxTop, halfW, boxH, PDF_COLORS.borderLight, 0.75);
  pdf.strokeRect(leftX + halfW, boxTop, halfW, boxH, PDF_COLORS.borderLight, 0.75);

  pdf.textAt(leftX + 10, boxTop + 16, 'BILLED TO', 7.5, 'Bold', PDF_COLORS.midGrey);
  pdf.textAt(leftX + 10, boxTop + 34, customerName, 10.5, 'Bold', PDF_COLORS.black);
  pdf.textAt(leftX + 10, boxTop + 50, customerEmail, 9.5, 'Normal', PDF_COLORS.darkGrey);

  const delivX = leftX + halfW + 10;
  pdf.textAt(delivX, boxTop + 16, 'DELIVERED TO', 7.5, 'Bold', PDF_COLORS.midGrey);
  pdf.textAt(delivX, boxTop + 34, companyName, 10.5, 'Bold', PDF_COLORS.black);
  pdf.textAt(delivX, boxTop + 49, address.slice(0, 48), 9.5, 'Normal', PDF_COLORS.darkGrey);
  pdf.textAt(delivX, boxTop + 63, dropoff.slice(0, 48), 9.5, 'Normal', PDF_COLORS.darkGrey);

  // 4. Line Items Table Header
  let curY = 242;
  pdf.fillRect(leftX, curY, contentW, 22, PDF_COLORS.black);
  pdf.textAt(leftX + 8, curY + 14, 'DELIVERY', 8, 'Bold', PDF_COLORS.white);
  pdf.textAt(leftX + 86, curY + 14, 'DESCRIPTION', 8, 'Bold', PDF_COLORS.white);
  pdf.rightTextAt(leftX + 355, curY + 14, 'QTY', 8, 'Bold', PDF_COLORS.white);
  pdf.rightTextAt(leftX + 435, curY + 14, 'UNIT PRICE', 8, 'Bold', PDF_COLORS.white);
  pdf.rightTextAt(rightX - 8, curY + 14, 'TOTAL', 8, 'Bold', PDF_COLORS.white);
  curY += 22;

  const delivDayShort = formatShortDayDate(o.targetDeliveryDate).split(' ').slice(0, 3).join(' ');

  for (const item of o.items) {
    const hasNote = Boolean(item.allergyNotes && item.allergyNotes.trim());
    const rowH = hasNote ? 36 : 26;
    const mealName = formatMealTitle(item);
    const unitPrice = item.unitPrice || item.menuItem.price || 80;
    const lineTotal = item.totalPrice || unitPrice * item.quantity;

    pdf.textAt(leftX + 8, curY + 16, delivDayShort, 9.5, 'Normal', PDF_COLORS.darkGrey);
    pdf.textAt(leftX + 86, curY + 15, mealName, 9.5, 'Bold', PDF_COLORS.black);
    if (hasNote) {
      const noteText = isAllergyNote(item.allergyNotes)
        ? `Allergy alert: ${formatNoteDisplay(item.allergyNotes, true)}`
        : `Special request: ${item.allergyNotes!.trim()}`;
      pdf.textAt(leftX + 86, curY + 28, noteText, 8, 'Normal', PDF_COLORS.redBanner);
    }

    pdf.rightTextAt(leftX + 355, curY + 16, String(item.quantity), 9.5, 'Normal', PDF_COLORS.black);
    pdf.rightTextAt(leftX + 435, curY + 16, `R ${unitPrice.toFixed(2)}`, 9.5, 'Normal', PDF_COLORS.black);
    pdf.rightTextAt(rightX - 8, curY + 16, `R ${lineTotal.toFixed(2)}`, 9.5, 'Bold', PDF_COLORS.black);

    curY += rowH;
    pdf.drawLine(leftX, curY, rightX, curY, PDF_COLORS.borderLight, 0.6);
  }

  // 5. Totals Summary Block
  curY += 10;
  const totalsLeftX = leftX + 245;
  pdf.drawLine(totalsLeftX, curY, rightX, curY, PDF_COLORS.black, 1.4);
  curY += 18;

  if (o.discountZar && o.discountZar > 0) {
    pdf.rightTextAt(leftX + 415, curY, 'Corporate Subsidy / Discount', 9, 'Normal', PDF_COLORS.midGrey);
    pdf.rightTextAt(rightX - 8, curY, `- R ${o.discountZar.toFixed(2)}`, 9.5, 'Normal', PDF_COLORS.greenText);
    curY += 18;
  }

  if (o.deliveryFee && o.deliveryFee > 0) {
    pdf.rightTextAt(leftX + 415, curY, 'Delivery Fee', 9, 'Normal', PDF_COLORS.midGrey);
    pdf.rightTextAt(rightX - 8, curY, `R ${o.deliveryFee.toFixed(2)}`, 9.5, 'Normal', PDF_COLORS.black);
    curY += 18;
  }

  pdf.rightTextAt(leftX + 415, curY, 'TOTAL', 10, 'Bold', PDF_COLORS.black);
  pdf.rightTextAt(rightX - 8, curY, `R ${o.totalPaid.toFixed(2)}`, 12, 'Bold', PDF_COLORS.black);
  curY += 20;

  const payMethod = o.paymentMethod || 'PayFast';
  pdf.rightTextAt(leftX + 415, curY, `Paid via ${payMethod} on ${invDate}`, 9.5, 'Normal', PDF_COLORS.darkGrey);
  pdf.rightTextAt(rightX - 8, curY, `- R ${o.totalPaid.toFixed(2)}`, 9.5, 'Bold', PDF_COLORS.greenText);
  curY += 10;

  pdf.fillRect(totalsLeftX, curY, rightX - totalsLeftX, 24, PDF_COLORS.greyFill);
  pdf.rightTextAt(leftX + 415, curY + 16, 'AMOUNT DUE', 10, 'Bold', PDF_COLORS.black);
  pdf.rightTextAt(rightX - 8, curY + 16, 'R 0.00', 12, 'Bold', PDF_COLORS.black);
  curY += 42;

  // 6. Payment Details & Queries Box
  const footerBoxH = 68;
  pdf.fillRect(leftX, curY, contentW, footerBoxH, PDF_COLORS.greyFill);

  pdf.textAt(leftX + 10, curY + 16, 'PAYMENT DETAILS', 7.5, 'Bold', PDF_COLORS.midGrey);
  pdf.textAt(leftX + 10, curY + 32, `Method: ${payMethod}`, 9, 'Normal', PDF_COLORS.black);
  pdf.textAt(leftX + 10, curY + 45, `Payment ID: ${o.paymentReference || 'PF-VERIFIED'}`, 9, 'Normal', PDF_COLORS.black);
  pdf.textAt(leftX + 10, curY + 58, `Date paid: ${invDate}`, 9, 'Normal', PDF_COLORS.black);

  const qX = leftX + halfW + 10;
  pdf.textAt(qX, curY + 16, 'QUERIES', 7.5, 'Bold', PDF_COLORS.midGrey);
  pdf.textAt(qX, curY + 32, 'Billing, orders & deliveries:', 9, 'Normal', PDF_COLORS.black);
  pdf.textAt(qX, curY + 46, INVOICE_SUPPORT_EMAIL, 9.5, 'Bold', PDF_COLORS.black);

  curY += footerBoxH + 16;
  pdf.textAt(
    leftX,
    curY,
    'This is a computer-generated invoice and is valid without a signature.',
    8,
    'Normal',
    PDF_COLORS.midGrey
  );

  // Page bottom footer
  pdf.textAt(leftX, PAGE_H - 30, `Your KitchenCO (Pty) Ltd \xB7 Invoice ${invNo}`, 8, 'Normal', PDF_COLORS.midGrey);
  pdf.rightTextAt(rightX, PAGE_H - 30, `Page ${pageNum}`, 8, 'Normal', PDF_COLORS.midGrey);
}

// ── Main KitchenExports Class ───────────────────────────────────────────

export class KitchenExports {
  private flatRecords: FlatMealRecord[];

  constructor(
    private rows: AdminActiveOrderRow[],
    private companyFilter: string,
    private dateFilter: string
  ) {
    this.flatRecords = buildFlatMealRecords(rows);
  }

  private get primaryDateSlash(): string {
    if (this.flatRecords.length > 0) return this.flatRecords[0].deliveryDateSlash;
    return formatSlashDate();
  }

  private get primaryDateCompact(): string {
    if (this.flatRecords.length > 0) return formatCompactDate(this.flatRecords[0].deliveryDateIso);
    return formatCompactDate();
  }

  private fileStamp(): string {
    const date = (this.dateFilter || this.primaryDateSlash)
      .replace(/[\/, ]+/g, '_')
      .replace(/_+/g, '_');
    const company = (this.companyFilter || 'All_Clients').replace(/\s+/g, '_');
    return `${date}_${company}`;
  }

  private groupByCompany(): { company: string; companyUpper: string; address: string; records: FlatMealRecord[] }[] {
    const map = new Map<string, { company: string; companyUpper: string; address: string; records: FlatMealRecord[] }>();
    for (const r of this.flatRecords) {
      let group = map.get(r.companyUpper);
      if (!group) {
        group = {
          company: r.company,
          companyUpper: r.companyUpper,
          address: r.companyAddress,
          records: [],
        };
        map.set(r.companyUpper, group);
      }
      group.records.push(r);
    }
    return [...map.values()];
  }

  // ════════════════════════════════════════════════════════════════════════
  // 1. MULTI-SHEET EXCEL WORKBOOK (`YKC_Daily_Kitchen_Documents.xlsx`)
  // ════════════════════════════════════════════════════════════════════════

  async dailyKitchenWorkbookExcel(): Promise<void> {
    const xlsx = new XlsxWriter();
    const records = this.flatRecords;
    const dateSlash = this.primaryDateSlash;
    const dateCompact = this.primaryDateCompact;
    const companyGroups = this.groupByCompany();
    const allergies = records.filter((r) => r.isAllergy);

    // ── SHEET 1: FILTER - ALL MEALS ───────────────────────────────────────
    const sFilter = xlsx
      .addSheet('FILTER - ALL MEALS')
      .widths(14, 10, 18, 42, 22, 21, 34, 10, 13);

    sFilter.header('Company', 'Sticker', 'Category', 'Meal', 'Name', 'Order No.', 'Notes', 'Allergy', 'Delivery date');

    for (const r of records) {
      if (r.isAllergy) {
        sFilter.styledRow(
          [
            { value: r.company, style: XLSX_STYLE.ALLERGY_NORMAL },
            { value: r.sticker, style: XLSX_STYLE.ALLERGY_NORMAL },
            { value: r.category, style: XLSX_STYLE.ALLERGY_NORMAL },
            { value: r.meal, style: XLSX_STYLE.ALLERGY_NORMAL },
            { value: r.recipientName, style: XLSX_STYLE.ALLERGY_BOLD },
            { value: r.orderNo, style: XLSX_STYLE.ALLERGY_NORMAL },
            { value: r.allergyDisplay, style: XLSX_STYLE.ALLERGY_RED_BOLD },
            { value: 'YES', style: XLSX_STYLE.ALLERGY_RED_BOLD },
            { value: r.deliveryDateSlash, style: XLSX_STYLE.ALLERGY_NORMAL },
          ],
          XLSX_STYLE.ALLERGY_NORMAL,
          20
        );
      } else {
        sFilter.styledRow(
          [
            r.company,
            r.sticker,
            r.category,
            r.meal,
            { value: r.recipientName, style: XLSX_STYLE.BOLD },
            r.orderNo,
            r.notes ? { value: r.notes, style: XLSX_STYLE.RED_TEXT } : null,
            'No',
            r.deliveryDateSlash,
          ],
          XLSX_STYLE.DEFAULT,
          19
        );
      }
    }

    // ── SHEET 2: 1. COOK (WHAT TO COOK) ───────────────────────────────────
    const sCook = xlsx.addSheet('1. COOK').widths(5, 7, 46, 52);
    sCook.styledRow(
      [
        null,
        { value: 'WHAT TO COOK', style: XLSX_STYLE.TITLE_XL },
        null,
        { value: 'your kitchen co.', style: XLSX_STYLE.SUBTITLE_GREY },
      ],
      XLSX_STYLE.DEFAULT,
      26
    );
    sCook.styledRow(
      [
        null,
        { value: `${dateSlash}  ·  ${this.companyFilter === 'All Companies' ? 'all clients' : this.companyFilter}`, style: XLSX_STYLE.SUBTITLE_GREY },
      ],
      XLSX_STYLE.DEFAULT,
      18
    );
    sCook.styledRow(
      [
        null,
        { value: `Meals: ${records.length}     Allergies: ${allergies.length}`, style: XLSX_STYLE.SUMMARY_BOLD },
      ],
      XLSX_STYLE.DEFAULT,
      22
    );
    sCook.blank(10);

    // Allergies Red Banner
    const allergyBannerRow = sCook.currentRow + 1;
    sCook.styledRow(
      [
        {
          value: '!! ALLERGIES - COOK FIRST, SEAL & LABEL SEPARATELY (already in the list below)',
          style: XLSX_STYLE.RED_BANNER,
        },
        { value: null, style: XLSX_STYLE.RED_BANNER },
        { value: null, style: XLSX_STYLE.RED_BANNER },
        { value: null, style: XLSX_STYLE.RED_BANNER },
      ],
      XLSX_STYLE.RED_BANNER,
      24
    );
    sCook.merge(`A${allergyBannerRow}:D${allergyBannerRow}`);

    if (allergies.length === 0) {
      sCook.styledRow(['☐', 0, 'No allergies flagged for this batch', ''], XLSX_STYLE.DEFAULT, 20);
    } else {
      for (const al of allergies) {
        sCook.styledRow(
          [
            { value: '☐', style: XLSX_STYLE.ALLERGY_NORMAL },
            { value: 1, style: XLSX_STYLE.ALLERGY_BOLD },
            { value: al.meal, style: XLSX_STYLE.ALLERGY_BOLD },
            { value: `${al.allergyDisplay} - ${al.recipientName} (${al.company})`, style: XLSX_STYLE.ALLERGY_RED_BOLD },
          ],
          XLSX_STYLE.ALLERGY_NORMAL,
          22
        );
      }
    }

    sCook.blank(12);
    sCook.styledRow(
      [
        { value: '✓', style: XLSX_STYLE.BLACK_HEADER },
        { value: 'QTY', style: XLSX_STYLE.BLACK_HEADER },
        { value: 'DISH', style: XLSX_STYLE.BLACK_HEADER },
        { value: 'NOTES', style: XLSX_STYLE.BLACK_HEADER },
      ],
      XLSX_STYLE.BLACK_HEADER,
      22
    );

    const prepItems = buildPrepSummary(this.rows);
    const byCategory = new Map<string, PrepSummaryItem[]>();
    for (const item of prepItems) {
      const list = byCategory.get(item.categoryName) || [];
      list.push(item);
      byCategory.set(item.categoryName, list);
    }

    for (const [catUpper, items] of byCategory.entries()) {
      const catTotal = items.reduce((s, i) => s + i.totalQuantity, 0);
      const catHeaderRowNum = sCook.currentRow + 1;
      const firstDishRow = catHeaderRowNum + 1;
      const lastDishRow = catHeaderRowNum + items.length;

      sCook.styledRow(
        [
          { value: null, style: XLSX_STYLE.GREY_BAR },
          {
            value: catTotal,
            formula: items.length > 0 ? `SUM(B${firstDishRow}:B${lastDishRow})` : undefined,
            style: XLSX_STYLE.GREY_BAR,
          },
          { value: catUpper, style: XLSX_STYLE.GREY_BAR },
          { value: null, style: XLSX_STYLE.GREY_BAR },
        ],
        XLSX_STYLE.GREY_BAR,
        22
      );

      for (const dish of items) {
        let notesText: string | null = null;
        const hasAllergyInDish = dish.specialNotes.some((n) => n.isAllergy);
        if (dish.specialNotes.length > 0) {
          const sortedNotes = [...dish.specialNotes].sort((a, b) => Number(b.isAllergy) - Number(a.isAllergy));
          const bullets = sortedNotes.map((n) => `• ${n.note} - ${n.recipientName}`).join('\n');
          notesText = `${dish.specialNotes.length} special:\n${bullets}`;
        }
        const rowHeight = dish.specialNotes.length > 0 ? Math.max(24, (dish.specialNotes.length + 1) * 15) : 22;
        sCook.styledRow(
          [
            '☐',
            { value: dish.totalQuantity, style: XLSX_STYLE.QTY_BOLD },
            dish.dishName,
            notesText
              ? { value: notesText, style: hasAllergyInDish ? XLSX_STYLE.RED_BOLD : XLSX_STYLE.RED_TEXT }
              : null,
          ],
          XLSX_STYLE.DEFAULT,
          rowHeight
        );
      }
    }

    sCook.blank(16);
    sCook.styledRow(
      [
        null,
        { value: 'Head chef:', style: XLSX_STYLE.BOLD },
        '______________________________     Time done: __________',
      ],
      XLSX_STYLE.DEFAULT,
      24
    );

    // ── SHEET 3: 2. PACK (WHAT TO PACK) ───────────────────────────────────
    const sPack = xlsx.addSheet('2. PACK').widths(6, 22, 44, 38);

    for (const group of companyGroups) {
      sPack.styledRow(
        [
          { value: 'WHAT TO PACK', style: XLSX_STYLE.TITLE_XL },
          null,
          null,
          { value: 'your kitchen co.', style: XLSX_STYLE.SUBTITLE_GREY },
        ],
        XLSX_STYLE.DEFAULT,
        26
      );
      sPack.styledRow(
        [{ value: `${dateSlash}  ·  work through this company's stickers in order`, style: XLSX_STYLE.SUBTITLE_GREY }],
        XLSX_STYLE.DEFAULT,
        18
      );

      const bannerRow = sPack.currentRow + 1;
      sPack.styledRow(
        [
          { value: `${group.companyUpper}   ·   ${group.records.length} meals`, style: XLSX_STYLE.COMPANY_BANNER },
          { value: null, style: XLSX_STYLE.COMPANY_BANNER },
          { value: null, style: XLSX_STYLE.COMPANY_BANNER },
          { value: null, style: XLSX_STYLE.COMPANY_BANNER },
        ],
        XLSX_STYLE.COMPANY_BANNER,
        26
      );
      sPack.merge(`A${bannerRow}:D${bannerRow}`);

      sPack.styledRow([{ value: group.address, style: XLSX_STYLE.SUBTITLE_GREY }], XLSX_STYLE.DEFAULT, 18);
      sPack.blank(8);

      sPack.styledRow(
        [
          { value: '☐', style: XLSX_STYLE.GREY_BAR },
          { value: `All stickers used: 1 to ${group.records.length}`, style: XLSX_STYLE.GREY_BAR },
          { value: null, style: XLSX_STYLE.GREY_BAR },
          { value: null, style: XLSX_STYLE.GREY_BAR },
        ],
        XLSX_STYLE.GREY_BAR,
        24
      );
      sPack.blank(8);

      // Dish counts for this company
      sPack.styledRow(
        [
          { value: '✓', style: XLSX_STYLE.BLACK_HEADER },
          { value: 'QTY', style: XLSX_STYLE.BLACK_HEADER },
          { value: 'DISH', style: XLSX_STYLE.BLACK_HEADER },
          { value: null, style: XLSX_STYLE.BLACK_HEADER },
        ],
        XLSX_STYLE.BLACK_HEADER,
        22
      );

      const dishTotals = new Map<string, number>();
      for (const r of group.records) {
        dishTotals.set(r.meal, (dishTotals.get(r.meal) ?? 0) + 1);
      }
      const sortedDishes = [...dishTotals.entries()].sort((a, b) =>
        b[1] !== a[1] ? b[1] - a[1] : a[0].localeCompare(b[0])
      );

      for (const [dishName, qty] of sortedDishes) {
        sPack.styledRow(['☐', { value: qty, style: XLSX_STYLE.QTY_BOLD }, dishName, null], XLSX_STYLE.DEFAULT, 20);
      }

      const specials = group.records
        .filter((r) => Boolean(r.notes))
        .sort((a, b) => Number(b.isAllergy) - Number(a.isAllergy));

      sPack.blank(8);
      const specBannerRow = sPack.currentRow + 1;
      sPack.styledRow(
        [
          {
            value: `SPECIAL REQUESTS & ALLERGIES (${specials.length}) - check the sticker matches`,
            style: XLSX_STYLE.RED_BANNER,
          },
          { value: null, style: XLSX_STYLE.RED_BANNER },
          { value: null, style: XLSX_STYLE.RED_BANNER },
          { value: null, style: XLSX_STYLE.RED_BANNER },
        ],
        XLSX_STYLE.RED_BANNER,
        22
      );
      sPack.merge(`A${specBannerRow}:D${specBannerRow}`);

      for (const sp of specials) {
        if (sp.isAllergy) {
          sPack.styledRow(
            [
              { value: '☐', style: XLSX_STYLE.ALLERGY_NORMAL },
              { value: sp.recipientName, style: XLSX_STYLE.ALLERGY_BOLD },
              { value: sp.meal, style: XLSX_STYLE.ALLERGY_NORMAL },
              { value: sp.allergyDisplay, style: XLSX_STYLE.ALLERGY_RED_BOLD },
            ],
            XLSX_STYLE.ALLERGY_NORMAL,
            20
          );
        } else {
          sPack.styledRow(
            [
              '☐',
              { value: sp.recipientName, style: XLSX_STYLE.BOLD },
              sp.meal,
              { value: sp.notes, style: XLSX_STYLE.RED_TEXT },
            ],
            XLSX_STYLE.DEFAULT,
            20
          );
        }
      }

      sPack.blank(12);
      sPack.styledRow(
        [null, { value: 'Packed by:', style: XLSX_STYLE.BOLD }, '________________________     Time: ________', null],
        XLSX_STYLE.DEFAULT,
        22
      );
      sPack.blank(20);
    }

    // ── SHEET 4: 3. DELIVERY NOTE ─────────────────────────────────────────
    const sDelivNote = xlsx.addSheet('3. DELIVERY NOTE').widths(8, 22, 44, 34);

    companyGroups.forEach((group, idx) => {
      const dnNumber = `DN-${dateCompact}-${pad3(idx + 1)}`;
      const companyAllergies = group.records.filter((r) => r.isAllergy).length;

      sDelivNote.styledRow(
        [
          { value: 'DELIVERY NOTE', style: XLSX_STYLE.TITLE_XL },
          null,
          null,
          { value: 'your kitchen co.', style: XLSX_STYLE.SUBTITLE_GREY },
        ],
        XLSX_STYLE.DEFAULT,
        26
      );

      const dnBannerRow = sDelivNote.currentRow + 1;
      sDelivNote.styledRow(
        [
          { value: `${group.companyUpper}   ·   ${dateSlash}   ·   ${dnNumber}`, style: XLSX_STYLE.COMPANY_BANNER },
          { value: null, style: XLSX_STYLE.COMPANY_BANNER },
          { value: null, style: XLSX_STYLE.COMPANY_BANNER },
          { value: null, style: XLSX_STYLE.COMPANY_BANNER },
        ],
        XLSX_STYLE.COMPANY_BANNER,
        26
      );
      sDelivNote.merge(`A${dnBannerRow}:D${dnBannerRow}`);

      sDelivNote.styledRow([{ value: group.address, style: XLSX_STYLE.SUBTITLE_GREY }], XLSX_STYLE.DEFAULT, 18);
      sDelivNote.blank(8);

      sDelivNote.styledRow(
        [{ value: `Total meals: ${group.records.length}`, style: XLSX_STYLE.SUMMARY_BOLD }],
        XLSX_STYLE.DEFAULT,
        22
      );
      sDelivNote.styledRow(
        [{ value: `Allergy meals: ${companyAllergies}  (sealed separately)`, style: XLSX_STYLE.RED_BOLD }],
        XLSX_STYLE.DEFAULT,
        20
      );
      sDelivNote.blank(8);

      sDelivNote.styledRow(
        [
          { value: 'Driver:', style: XLSX_STYLE.BOLD },
          '____________________________________',
          null,
          { value: 'Time left kitchen: ____________', style: XLSX_STYLE.BOLD },
        ],
        XLSX_STYLE.DEFAULT,
        22
      );
      sDelivNote.styledRow(
        [
          { value: 'Received by (name):', style: XLSX_STYLE.BOLD },
          '____________________________________',
          null,
          { value: 'Time delivered: ____________', style: XLSX_STYLE.BOLD },
        ],
        XLSX_STYLE.DEFAULT,
        22
      );
      sDelivNote.styledRow(
        [
          { value: 'Signature:', style: XLSX_STYLE.BOLD },
          '____________________________________',
          null,
          { value: 'Meals counted on site: ____________', style: XLSX_STYLE.BOLD },
        ],
        XLSX_STYLE.DEFAULT,
        22
      );
      sDelivNote.blank(8);

      sDelivNote.styledRow(
        [
          { value: '✓', style: XLSX_STYLE.BLACK_HEADER },
          { value: 'QTY', style: XLSX_STYLE.BLACK_HEADER },
          { value: 'DISH', style: XLSX_STYLE.BLACK_HEADER },
          { value: null, style: XLSX_STYLE.BLACK_HEADER },
        ],
        XLSX_STYLE.BLACK_HEADER,
        22
      );

      const dishTotals = new Map<string, number>();
      for (const r of group.records) {
        dishTotals.set(r.meal, (dishTotals.get(r.meal) ?? 0) + 1);
      }
      const sortedDishes = [...dishTotals.entries()].sort((a, b) =>
        b[1] !== a[1] ? b[1] - a[1] : a[0].localeCompare(b[0])
      );

      for (const [dishName, qty] of sortedDishes) {
        sDelivNote.styledRow(['☐', { value: qty, style: XLSX_STYLE.QTY_BOLD }, dishName, null], XLSX_STYLE.DEFAULT, 20);
      }

      const specials = group.records
        .filter((r) => Boolean(r.notes))
        .sort((a, b) => Number(b.isAllergy) - Number(a.isAllergy));

      sDelivNote.blank(8);
      const specRow = sDelivNote.currentRow + 1;
      sDelivNote.styledRow(
        [
          {
            value: `SPECIAL REQUESTS & ALLERGIES (${specials.length}) - check the sticker matches`,
            style: XLSX_STYLE.RED_BANNER,
          },
          { value: null, style: XLSX_STYLE.RED_BANNER },
          { value: null, style: XLSX_STYLE.RED_BANNER },
          { value: null, style: XLSX_STYLE.RED_BANNER },
        ],
        XLSX_STYLE.RED_BANNER,
        22
      );
      sDelivNote.merge(`A${specRow}:D${specRow}`);

      for (const sp of specials) {
        if (sp.isAllergy) {
          sDelivNote.styledRow(
            [
              { value: '☐', style: XLSX_STYLE.ALLERGY_NORMAL },
              { value: sp.recipientName, style: XLSX_STYLE.ALLERGY_BOLD },
              { value: sp.meal, style: XLSX_STYLE.ALLERGY_NORMAL },
              { value: sp.allergyDisplay, style: XLSX_STYLE.ALLERGY_RED_BOLD },
            ],
            XLSX_STYLE.ALLERGY_NORMAL,
            20
          );
        } else {
          sDelivNote.styledRow(
            [
              '☐',
              { value: sp.recipientName, style: XLSX_STYLE.BOLD },
              sp.meal,
              { value: sp.notes, style: XLSX_STYLE.RED_TEXT },
            ],
            XLSX_STYLE.DEFAULT,
            20
          );
        }
      }

      sDelivNote.blank(20);
    });

    // ── SHEET 5: 4. DELIVERY REPORT ───────────────────────────────────────
    const sReport = xlsx.addSheet('4. DELIVERY REPORT').widths(5, 9, 17, 30, 20, 21, 24);
    const ROWS_PER_PAGE = 34;

    for (const group of companyGroups) {
      const totalPages = Math.max(1, Math.ceil(group.records.length / ROWS_PER_PAGE));

      for (let p = 0; p < totalPages; p++) {
        const pageSlice = group.records.slice(p * ROWS_PER_PAGE, (p + 1) * ROWS_PER_PAGE);
        const contLabel = p > 0 ? ' (continued)' : '';

        sReport.styledRow(
          [
            { value: 'DELIVERY REPORT', style: XLSX_STYLE.TITLE_XL },
            null,
            null,
            null,
            null,
            null,
            { value: 'your kitchen co.', style: XLSX_STYLE.SUBTITLE_GREY },
          ],
          XLSX_STYLE.DEFAULT,
          26
        );
        sReport.styledRow(
          [{ value: `${dateSlash}  ·  one line per sticker - same order as the stickers`, style: XLSX_STYLE.SUBTITLE_GREY }],
          XLSX_STYLE.DEFAULT,
          18
        );

        const repBannerRow = sReport.currentRow + 1;
        sReport.styledRow(
          [
            {
              value: `${group.companyUpper}${contLabel}   ·   ${group.records.length} meals   ·   page ${p + 1} of ${totalPages}`,
              style: XLSX_STYLE.COMPANY_BANNER,
            },
            { value: null, style: XLSX_STYLE.COMPANY_BANNER },
            { value: null, style: XLSX_STYLE.COMPANY_BANNER },
            { value: null, style: XLSX_STYLE.COMPANY_BANNER },
            { value: null, style: XLSX_STYLE.COMPANY_BANNER },
            { value: null, style: XLSX_STYLE.COMPANY_BANNER },
            { value: null, style: XLSX_STYLE.COMPANY_BANNER },
          ],
          XLSX_STYLE.COMPANY_BANNER,
          24
        );
        sReport.merge(`A${repBannerRow}:G${repBannerRow}`);

        if (p === 0) {
          sReport.styledRow([{ value: group.address, style: XLSX_STYLE.SUBTITLE_GREY }], XLSX_STYLE.DEFAULT, 18);
        }

        sReport.styledRow(
          [
            { value: '✓', style: XLSX_STYLE.REPORT_HEADER },
            { value: 'STICKER', style: XLSX_STYLE.REPORT_HEADER },
            { value: 'CATEGORY', style: XLSX_STYLE.REPORT_HEADER },
            { value: 'MEAL', style: XLSX_STYLE.REPORT_HEADER },
            { value: 'NAME', style: XLSX_STYLE.REPORT_HEADER },
            { value: 'ORDER NO.', style: XLSX_STYLE.REPORT_HEADER },
            { value: 'NOTES', style: XLSX_STYLE.REPORT_HEADER },
          ],
          XLSX_STYLE.REPORT_HEADER,
          18
        );

        for (const r of pageSlice) {
          const cells: XlsxRowCell[] = r.isAllergy
            ? [
                { value: '☐', style: XLSX_STYLE.ALLERGY_NORMAL },
                { value: r.sticker, style: XLSX_STYLE.ALLERGY_NORMAL },
                { value: r.categoryUpper, style: XLSX_STYLE.ALLERGY_NORMAL },
                { value: r.meal, style: XLSX_STYLE.ALLERGY_NORMAL },
                { value: r.recipientName, style: XLSX_STYLE.ALLERGY_BOLD },
                { value: r.orderNo, style: XLSX_STYLE.ALLERGY_NORMAL },
                { value: r.allergyDisplay, style: XLSX_STYLE.ALLERGY_RED_BOLD },
              ]
            : [
                '☐',
                r.sticker,
                r.categoryUpper,
                r.meal,
                { value: r.recipientName, style: XLSX_STYLE.BOLD },
                r.orderNo,
                r.notes ? { value: r.notes, style: XLSX_STYLE.RED_TEXT } : null,
              ];
          sReport.styledRow(cells, XLSX_STYLE.DEFAULT, 19);
        }

        sReport.blank(16);
      }
    }

    await shareXlsx(`YKC_Daily_Kitchen_Documents_${this.fileStamp()}`, xlsx, 'YKC Daily Kitchen Documents');
  }

  async productionSheetExcel(): Promise<void> {
    return this.dailyKitchenWorkbookExcel();
  }

  // ════════════════════════════════════════════════════════════════════════
  // 2. PRODUCTION SHEET PDF (`1. COOK` + `2. PACK` — `YKC_Production_Sheet.pdf`)
  // ════════════════════════════════════════════════════════════════════════

  async productionSheetPdf(): Promise<void> {
    const pdf = new PdfWriter();
    this.renderCookSectionToPdf(pdf);
    this.renderPackSectionsToPdf(pdf);
    await sharePdf(`YKC_Production_Sheet_${this.fileStamp()}`, pdf, 'YKC Production Sheet');
  }

  private renderCookSectionToPdf(pdf: PdfWriter) {
    pdf.newPage();
    const leftX = 42;
    const rightX = PAGE_W - 42;
    const contentW = rightX - leftX;
    const dateSlash = this.primaryDateSlash;
    const records = this.flatRecords;
    const allergies = records.filter((r) => r.isAllergy);

    // Header
    pdf.textAt(leftX, 62, 'WHAT TO COOK', 20, 'Bold', PDF_COLORS.black);
    pdf.drawBrandLogo(rightX, 58, 17);

    const clientScope = this.companyFilter === 'All Companies' ? 'all clients' : this.companyFilter;
    pdf.textAt(leftX, 78, `${dateSlash}  \xB7  ${clientScope}`, 10, 'Normal', PDF_COLORS.midGrey);
    pdf.textAt(leftX, 95, `Meals: ${records.length}     Allergies: ${allergies.length}`, 12.5, 'Bold', PDF_COLORS.black);

    let curY = 112;

    // Allergies Red Banner
    pdf.fillRect(leftX, curY, contentW, 20, PDF_COLORS.redBanner);
    pdf.textAt(
      leftX + 6,
      curY + 14,
      '!! ALLERGIES - COOK FIRST, SEAL & LABEL SEPARATELY (already in the list below)',
      10,
      'Bold',
      PDF_COLORS.white
    );
    curY += 20;

    if (allergies.length === 0) {
      pdf.fillRect(leftX, curY, contentW, 20, PDF_COLORS.pinkFill);
      pdf.textAt(leftX + 8, curY + 14, 'No medical allergies flagged for this production run.', 9.5, 'Normal', PDF_COLORS.darkGrey);
      curY += 20;
    } else {
      for (const al of allergies) {
        if (curY + 22 > PAGE_H - 55) {
          pdf.newPage();
          curY = 50;
        }
        pdf.fillRect(leftX, curY, contentW, 21, PDF_COLORS.pinkFill);
        pdf.drawCheckbox(leftX + 8, curY + 6, 9, PDF_COLORS.darkGrey);
        pdf.rightTextAt(leftX + 46, curY + 15, '1', 11, 'Bold', PDF_COLORS.black);
        pdf.textAt(leftX + 58, curY + 15, al.meal.slice(0, 42), 10, 'Bold', PDF_COLORS.black);
        pdf.textAt(
          leftX + 280,
          curY + 15,
          `${al.allergyDisplay} - ${al.recipientName} (${al.company})`.slice(0, 46),
          9.5,
          'Bold',
          PDF_COLORS.redBanner
        );
        curY += 21;
        pdf.drawLine(leftX, curY, rightX, curY, PDF_COLORS.borderLight, 0.5);
      }
    }

    curY += 14;

    const drawCookTableHeader = (y: number): number => {
      pdf.fillRect(leftX, y, contentW, 20, PDF_COLORS.black);
      pdf.textAt(leftX + 9, y + 14, 'v', 8.5, 'Bold', PDF_COLORS.white);
      pdf.rightTextAt(leftX + 50, y + 14, 'QTY', 9, 'Bold', PDF_COLORS.white);
      pdf.textAt(leftX + 60, y + 14, 'DISH', 9, 'Bold', PDF_COLORS.white);
      pdf.textAt(leftX + 280, y + 14, 'NOTES', 9, 'Bold', PDF_COLORS.white);
      return y + 20;
    };

    curY = drawCookTableHeader(curY);

    const prepItems = buildPrepSummary(this.rows);
    const byCategory = new Map<string, PrepSummaryItem[]>();
    for (const item of prepItems) {
      const list = byCategory.get(item.categoryName) || [];
      list.push(item);
      byCategory.set(item.categoryName, list);
    }

    for (const [catUpper, items] of byCategory.entries()) {
      const catTotal = items.reduce((s, i) => s + i.totalQuantity, 0);
      if (curY + 45 > PAGE_H - 55) {
        pdf.newPage();
        curY = drawCookTableHeader(50);
      }

      // Category Grey Bar
      pdf.fillRect(leftX, curY, contentW, 20, PDF_COLORS.greyFill);
      pdf.rightTextAt(leftX + 50, curY + 14, String(catTotal), 10.5, 'Bold', PDF_COLORS.black);
      pdf.textAt(leftX + 60, curY + 14, catUpper, 10.5, 'Bold', PDF_COLORS.black);
      curY += 20;

      for (const dish of items) {
        const dishLines = wrapPdfText(dish.dishName, 210, 10, 'Normal');
        const noteLines: { text: string; bold: boolean }[] = [];
        if (dish.specialNotes.length > 0) {
          const hasAllergy = dish.specialNotes.some((n) => n.isAllergy);
          noteLines.push({ text: `${dish.specialNotes.length} special:`, bold: hasAllergy });
          const sortedNotes = [...dish.specialNotes].sort((a, b) => Number(b.isAllergy) - Number(a.isAllergy));
          for (const n of sortedNotes) {
            const wrapped = wrapPdfText(`\x95 ${n.note} - ${n.recipientName}`, 225, 8.5, n.isAllergy ? 'Bold' : 'Normal');
            wrapped.forEach((wLine) => noteLines.push({ text: wLine, bold: n.isAllergy }));
          }
        }

        const rowH = Math.max(24, dishLines.length * 13 + 8, noteLines.length * 11.5 + 8);
        if (curY + rowH > PAGE_H - 55) {
          pdf.newPage();
          curY = drawCookTableHeader(50);
        }

        pdf.drawCheckbox(leftX + 8, curY + 7, 9, PDF_COLORS.darkGrey);
        pdf.rightTextAt(leftX + 50, curY + 16, String(dish.totalQuantity), 12, 'Bold', PDF_COLORS.black);

        dishLines.forEach((dLine, dIdx) => {
          pdf.textAt(leftX + 60, curY + 15 + dIdx * 12, dLine, 10, 'Normal', PDF_COLORS.black);
        });

        noteLines.forEach((nLine, nIdx) => {
          pdf.textAt(
            leftX + 280,
            curY + 13 + nIdx * 11,
            nLine.text,
            8.5,
            nLine.bold ? 'Bold' : 'Normal',
            PDF_COLORS.redBanner
          );
        });

        curY += rowH;
        pdf.drawLine(leftX, curY, rightX, curY, PDF_COLORS.borderLight, 0.5);
      }
    }

    curY += 24;
    if (curY + 30 > PAGE_H - 40) {
      pdf.newPage();
      curY = 70;
    }
    pdf.textAt(leftX + 28, curY, 'Head chef: ______________________________', 10, 'Bold', PDF_COLORS.black);
    pdf.textAt(leftX + 250, curY, 'Time done: ____________', 10, 'Normal', PDF_COLORS.black);
  }

  private renderPackSectionsToPdf(pdf: PdfWriter) {
    const leftX = 48;
    const rightX = PAGE_W - 48;
    const contentW = rightX - leftX;
    const dateSlash = this.primaryDateSlash;
    const companyGroups = this.groupByCompany();

    for (const group of companyGroups) {
      pdf.newPage();
      let curY = 64;

      pdf.textAt(leftX, curY, 'WHAT TO PACK', 17, 'Bold', PDF_COLORS.black);
      pdf.drawBrandLogo(rightX, curY - 4, 15);
      curY += 15;

      pdf.textAt(leftX, curY, `${dateSlash}  \xB7  work through this company's stickers in order`, 9, 'Normal', PDF_COLORS.midGrey);
      curY += 14;

      // Company Banner
      pdf.fillRect(leftX, curY, contentW, 24, PDF_COLORS.black);
      pdf.textAt(leftX + 8, curY + 16, `${group.companyUpper}   \xB7   ${group.records.length} meals`, 13.5, 'Bold', PDF_COLORS.white);
      curY += 24;

      pdf.textAt(leftX, curY + 12, group.address, 9, 'Normal', PDF_COLORS.midGrey);
      curY += 24;

      // All stickers used verification bar
      pdf.fillRect(leftX, curY, contentW, 24, PDF_COLORS.greyFill);
      pdf.drawCheckbox(leftX + 8, curY + 7, 9.5, PDF_COLORS.darkGrey);
      pdf.textAt(leftX + 26, curY + 16, `All stickers used: 1 to ${group.records.length}`, 11, 'Bold', PDF_COLORS.black);
      curY += 34;

      // Dish Table Header
      const drawDishHeader = (y: number): number => {
        pdf.fillRect(leftX, y, contentW, 18, PDF_COLORS.black);
        pdf.textAt(leftX + 8, y + 13, 'v', 8, 'Bold', PDF_COLORS.white);
        pdf.rightTextAt(leftX + 68, y + 13, 'QTY', 8.5, 'Bold', PDF_COLORS.white);
        pdf.textAt(leftX + 95, y + 13, 'DISH', 8.5, 'Bold', PDF_COLORS.white);
        return y + 18;
      };

      curY = drawDishHeader(curY);

      const dishTotals = new Map<string, number>();
      for (const r of group.records) {
        dishTotals.set(r.meal, (dishTotals.get(r.meal) ?? 0) + 1);
      }
      const sortedDishes = [...dishTotals.entries()].sort((a, b) =>
        b[1] !== a[1] ? b[1] - a[1] : a[0].localeCompare(b[0])
      );

      for (const [dishName, qty] of sortedDishes) {
        if (curY + 20 > PAGE_H - 60) {
          pdf.newPage();
          curY = 60;
          pdf.fillRect(leftX, curY, contentW, 22, PDF_COLORS.black);
          pdf.textAt(leftX + 8, curY + 15, `${group.companyUpper} (continued)   \xB7   ${group.records.length} meals`, 12, 'Bold', PDF_COLORS.white);
          curY = drawDishHeader(curY + 30);
        }
        pdf.drawCheckbox(leftX + 8, curY + 5, 7.5, PDF_COLORS.darkGrey);
        pdf.rightTextAt(leftX + 68, curY + 13, String(qty), 9.5, 'Bold', PDF_COLORS.black);
        pdf.textAt(leftX + 95, curY + 13, dishName.slice(0, 62), 9, 'Normal', PDF_COLORS.black);
        curY += 17;
        pdf.drawLine(leftX, curY, rightX, curY, PDF_COLORS.borderLight, 0.5);
      }

      // Special Requests & Allergies
      const specials = group.records
        .filter((r) => Boolean(r.notes))
        .sort((a, b) => Number(b.isAllergy) - Number(a.isAllergy));

      curY += 14;
      if (curY + 45 > PAGE_H - 60) {
        pdf.newPage();
        curY = 60;
      }

      pdf.fillRect(leftX, curY, contentW, 18, PDF_COLORS.redBanner);
      pdf.textAt(
        leftX + 6,
        curY + 13,
        `SPECIAL REQUESTS & ALLERGIES (${specials.length}) - check the sticker matches`,
        8.5,
        'Bold',
        PDF_COLORS.white
      );
      curY += 18;

      for (const sp of specials) {
        if (curY + 19 > PAGE_H - 60) {
          pdf.newPage();
          curY = 60;
        }
        if (sp.isAllergy) {
          pdf.fillRect(leftX, curY, contentW, 18, PDF_COLORS.pinkFill);
        }
        pdf.drawCheckbox(leftX + 8, curY + 5, 7.5, PDF_COLORS.darkGrey);
        pdf.textAt(leftX + 24, curY + 13, sp.recipientName.slice(0, 24), 8.5, 'Bold', PDF_COLORS.black);
        pdf.textAt(leftX + 135, curY + 13, sp.meal.slice(0, 38), 8.5, 'Normal', PDF_COLORS.black);
        pdf.textAt(
          leftX + 310,
          curY + 13,
          (sp.isAllergy ? sp.allergyDisplay : sp.notes || '').slice(0, 40),
          8.5,
          sp.isAllergy ? 'Bold' : 'Normal',
          PDF_COLORS.redBanner
        );
        curY += 18;
        pdf.drawLine(leftX, curY, rightX, curY, PDF_COLORS.borderLight, 0.5);
      }

      curY += 22;
      if (curY + 25 > PAGE_H - 40) {
        pdf.newPage();
        curY = 70;
      }
      pdf.textAt(leftX + 24, curY, 'Packed by: ________________________', 9.5, 'Bold', PDF_COLORS.black);
      pdf.textAt(leftX + 240, curY, 'Time: ____________', 9.5, 'Normal', PDF_COLORS.black);
    }
  }

  // ════════════════════════════════════════════════════════════════════════
  // 3. COMPANY DELIVERY NOTES PDF (`3. DELIVERY NOTE` — `YKC_Delivery_Notes.pdf`)
  // ════════════════════════════════════════════════════════════════════════

  async deliveryNotesPdf(): Promise<void> {
    const pdf = new PdfWriter();
    const leftX = 48;
    const rightX = PAGE_W - 48;
    const contentW = rightX - leftX;
    const dateSlash = this.primaryDateSlash;
    const dateCompact = this.primaryDateCompact;
    const companyGroups = this.groupByCompany();

    companyGroups.forEach((group, idx) => {
      pdf.newPage();
      const dnNumber = `DN-${dateCompact}-${pad3(idx + 1)}`;
      const allergyCount = group.records.filter((r) => r.isAllergy).length;
      let curY = 64;

      pdf.textAt(leftX, curY, 'DELIVERY NOTE', 18, 'Bold', PDF_COLORS.black);
      pdf.drawBrandLogo(rightX, curY - 4, 15);
      curY += 16;

      // Company Black Banner
      pdf.fillRect(leftX, curY, contentW, 24, PDF_COLORS.black);
      pdf.textAt(
        leftX + 8,
        curY + 16,
        `${group.companyUpper}   \xB7   ${dateSlash}   \xB7   ${dnNumber}`,
        12.5,
        'Bold',
        PDF_COLORS.white
      );
      curY += 24;

      pdf.textAt(leftX, curY + 12, group.address, 9, 'Normal', PDF_COLORS.midGrey);
      curY += 30;

      // Totals
      pdf.textAt(leftX, curY, `Total meals: ${group.records.length}`, 14, 'Bold', PDF_COLORS.black);
      curY += 16;
      pdf.textAt(leftX, curY, `Allergy meals: ${allergyCount}  (sealed separately)`, 10.5, 'Bold', PDF_COLORS.redBanner);
      curY += 26;

      // Custody Sign-off Block
      pdf.textAt(leftX, curY, 'Driver:', 9, 'Bold', PDF_COLORS.black);
      pdf.drawLine(leftX + 35, curY + 2, leftX + 290, curY + 2, PDF_COLORS.darkGrey, 0.7);
      pdf.textAt(leftX + 300, curY, 'Time left kitchen:', 9, 'Bold', PDF_COLORS.black);
      pdf.drawLine(leftX + 382, curY + 2, rightX, curY + 2, PDF_COLORS.darkGrey, 0.7);
      curY += 18;

      pdf.textAt(leftX, curY, 'Received by (name):', 9, 'Bold', PDF_COLORS.black);
      pdf.drawLine(leftX + 94, curY + 2, leftX + 290, curY + 2, PDF_COLORS.darkGrey, 0.7);
      pdf.textAt(leftX + 300, curY, 'Time delivered:', 9, 'Bold', PDF_COLORS.black);
      pdf.drawLine(leftX + 372, curY + 2, rightX, curY + 2, PDF_COLORS.darkGrey, 0.7);
      curY += 18;

      pdf.textAt(leftX, curY, 'Signature:', 9, 'Bold', PDF_COLORS.black);
      pdf.drawLine(leftX + 50, curY + 2, leftX + 290, curY + 2, PDF_COLORS.darkGrey, 0.7);
      pdf.textAt(leftX + 300, curY, 'Meals counted on site:', 9, 'Bold', PDF_COLORS.black);
      pdf.drawLine(leftX + 404, curY + 2, rightX, curY + 2, PDF_COLORS.darkGrey, 0.7);
      curY += 18;

      // Dish Checklist Table
      const drawDishHeader = (y: number): number => {
        pdf.fillRect(leftX, y, contentW, 18, PDF_COLORS.black);
        pdf.textAt(leftX + 8, y + 13, 'v', 8, 'Bold', PDF_COLORS.white);
        pdf.rightTextAt(leftX + 68, y + 13, 'QTY', 8.5, 'Bold', PDF_COLORS.white);
        pdf.textAt(leftX + 95, y + 13, 'DISH', 8.5, 'Bold', PDF_COLORS.white);
        return y + 18;
      };

      curY = drawDishHeader(curY);

      const dishTotals = new Map<string, number>();
      for (const r of group.records) {
        dishTotals.set(r.meal, (dishTotals.get(r.meal) ?? 0) + 1);
      }
      const sortedDishes = [...dishTotals.entries()].sort((a, b) =>
        b[1] !== a[1] ? b[1] - a[1] : a[0].localeCompare(b[0])
      );

      for (const [dishName, qty] of sortedDishes) {
        if (curY + 20 > PAGE_H - 55) {
          pdf.newPage();
          curY = 60;
          pdf.fillRect(leftX, curY, contentW, 22, PDF_COLORS.black);
          pdf.textAt(leftX + 8, curY + 15, `${group.companyUpper} (continued)   \xB7   ${dateSlash}   \xB7   ${dnNumber}`, 11.5, 'Bold', PDF_COLORS.white);
          curY = drawDishHeader(curY + 30);
        }
        pdf.drawCheckbox(leftX + 8, curY + 5, 7.5, PDF_COLORS.darkGrey);
        pdf.rightTextAt(leftX + 68, curY + 13, String(qty), 9.5, 'Bold', PDF_COLORS.black);
        pdf.textAt(leftX + 95, curY + 13, dishName.slice(0, 62), 9, 'Normal', PDF_COLORS.black);
        curY += 17;
        pdf.drawLine(leftX, curY, rightX, curY, PDF_COLORS.borderLight, 0.5);
      }

      // Special Requests & Allergies
      const specials = group.records
        .filter((r) => Boolean(r.notes))
        .sort((a, b) => Number(b.isAllergy) - Number(a.isAllergy));

      curY += 14;
      if (curY + 45 > PAGE_H - 55) {
        pdf.newPage();
        curY = 60;
      }

      pdf.fillRect(leftX, curY, contentW, 18, PDF_COLORS.redBanner);
      pdf.textAt(
        leftX + 6,
        curY + 13,
        `SPECIAL REQUESTS & ALLERGIES (${specials.length}) - check the sticker matches`,
        8.5,
        'Bold',
        PDF_COLORS.white
      );
      curY += 18;

      for (const sp of specials) {
        if (curY + 19 > PAGE_H - 55) {
          pdf.newPage();
          curY = 60;
        }
        if (sp.isAllergy) {
          pdf.fillRect(leftX, curY, contentW, 18, PDF_COLORS.pinkFill);
        }
        pdf.drawCheckbox(leftX + 8, curY + 5, 7.5, PDF_COLORS.darkGrey);
        pdf.textAt(leftX + 24, curY + 13, sp.recipientName.slice(0, 24), 8.5, 'Bold', PDF_COLORS.black);
        pdf.textAt(leftX + 135, curY + 13, sp.meal.slice(0, 38), 8.5, 'Normal', PDF_COLORS.black);
        pdf.textAt(
          leftX + 310,
          curY + 13,
          (sp.isAllergy ? sp.allergyDisplay : sp.notes || '').slice(0, 40),
          8.5,
          sp.isAllergy ? 'Bold' : 'Normal',
          PDF_COLORS.redBanner
        );
        curY += 18;
        pdf.drawLine(leftX, curY, rightX, curY, PDF_COLORS.borderLight, 0.5);
      }
    });

    await sharePdf(`YKC_Delivery_Notes_${this.fileStamp()}`, pdf, 'YKC Delivery Notes');
  }

  // ════════════════════════════════════════════════════════════════════════
  // 4. DELIVERY REPORT PDF (`4. DELIVERY REPORT` — `YKC_Delivery_Report.pdf`)
  // ════════════════════════════════════════════════════════════════════════

  async deliveryReportPdf(): Promise<void> {
    const pdf = new PdfWriter();
    const leftX = 34;
    const rightX = PAGE_W - 34;
    const contentW = rightX - leftX;
    const dateSlash = this.primaryDateSlash;
    const companyGroups = this.groupByCompany();
    const ROWS_PER_PAGE = 34;

    for (const group of companyGroups) {
      const totalPages = Math.max(1, Math.ceil(group.records.length / ROWS_PER_PAGE));

      for (let p = 0; p < totalPages; p++) {
        pdf.newPage();
        const pageSlice = group.records.slice(p * ROWS_PER_PAGE, (p + 1) * ROWS_PER_PAGE);
        const contLabel = p > 0 ? ' (continued)' : '';
        let curY = 54;

        pdf.textAt(leftX, curY, 'DELIVERY REPORT', 18, 'Bold', PDF_COLORS.black);
        pdf.drawBrandLogo(rightX, curY - 3, 16);
        curY += 15;

        pdf.textAt(leftX, curY, `${dateSlash}  \xB7  one line per sticker - same order as the stickers`, 9, 'Normal', PDF_COLORS.midGrey);
        curY += 12;

        // Black Company Banner with page X of Y on the right
        pdf.fillRect(leftX, curY, contentW, 24, PDF_COLORS.black);
        pdf.textAt(
          leftX + 8,
          curY + 16,
          `${group.companyUpper}${contLabel}   \xB7   ${group.records.length} meals`,
          13,
          'Bold',
          PDF_COLORS.white
        );
        pdf.rightTextAt(rightX - 8, curY + 16, `page ${p + 1} of ${totalPages}`, 9.5, 'Bold', PDF_COLORS.white);
        curY += 24;

        if (p === 0) {
          pdf.textAt(leftX, curY + 11, group.address, 8.5, 'Normal', PDF_COLORS.midGrey);
          curY += 18;
        } else {
          curY += 6;
        }

        // Grey Table Header
        pdf.fillRect(leftX, curY, contentW, 18, PDF_COLORS.greyFill);
        pdf.textAt(leftX + 24, curY + 12, 'STICKER', 7, 'Bold', PDF_COLORS.midGrey);
        pdf.textAt(leftX + 66, curY + 12, 'CATEGORY', 7, 'Bold', PDF_COLORS.midGrey);
        pdf.textAt(leftX + 148, curY + 12, 'MEAL', 7, 'Bold', PDF_COLORS.midGrey);
        pdf.textAt(leftX + 275, curY + 12, 'NAME', 7, 'Bold', PDF_COLORS.midGrey);
        pdf.textAt(leftX + 372, curY + 12, 'ORDER NO.', 7, 'Bold', PDF_COLORS.midGrey);
        pdf.textAt(leftX + 448, curY + 12, 'NOTES', 7, 'Bold', PDF_COLORS.midGrey);
        curY += 18;

        let prevCat = p > 0 ? group.records[p * ROWS_PER_PAGE - 1].categoryUpper : pageSlice[0]?.categoryUpper;

        for (const r of pageSlice) {
          // Draw thicker category divider when category changes
          if (prevCat && r.categoryUpper !== prevCat) {
            pdf.drawLine(leftX, curY, rightX, curY, PDF_COLORS.black, 1.1);
          }
          prevCat = r.categoryUpper;

          const rowH = 18;
          if (r.isAllergy) {
            pdf.fillRect(leftX, curY, contentW, rowH, PDF_COLORS.pinkFill);
          }

          pdf.drawCheckbox(leftX + 4, curY + 4.5, 8.5, PDF_COLORS.black, 1.0);
          pdf.rightTextAt(leftX + 58, curY + 12.5, r.sticker, 8, 'Normal', PDF_COLORS.midGrey);
          pdf.textAt(leftX + 66, curY + 12.5, r.categoryUpper.slice(0, 18), 8, 'Normal', PDF_COLORS.darkGrey);
          pdf.textAt(leftX + 148, curY + 12.5, r.meal.slice(0, 28), 8.5, 'Normal', PDF_COLORS.black);
          pdf.textAt(leftX + 275, curY + 12.5, r.recipientName.slice(0, 21), 8.5, 'Bold', PDF_COLORS.black);
          pdf.textAt(leftX + 372, curY + 12.5, r.orderNo, 7.5, 'Normal', PDF_COLORS.midGrey);

          if (r.notes) {
            pdf.textAt(
              leftX + 448,
              curY + 12.5,
              (r.isAllergy ? r.allergyDisplay : r.notes).slice(0, 22),
              7.5,
              r.isAllergy ? 'Bold' : 'Normal',
              PDF_COLORS.redBanner
            );
          }

          curY += rowH;
          pdf.drawLine(leftX, curY, rightX, curY, PDF_COLORS.borderLight, 0.5);
        }

        // Page Footer
        pdf.textAt(
          leftX,
          PAGE_H - 28,
          `Your KitchenCO \xB7 Delivery report \xB7 ${dateSlash} \xB7 queries: ${INVOICE_SUPPORT_EMAIL}`,
          7.5,
          'Normal',
          PDF_COLORS.midGrey
        );
        pdf.rightTextAt(
          rightX,
          PAGE_H - 28,
          `${group.company} \xB7 page ${p + 1} of ${totalPages}`,
          7.5,
          'Normal',
          PDF_COLORS.midGrey
        );
      }
    }

    await sharePdf(`YKC_Delivery_Report_${this.fileStamp()}`, pdf, 'YKC Delivery Report');
  }

  // ════════════════════════════════════════════════════════════════════════
  // 5. MEAL STICKERS PDF (`5. MEAL STICKERS` — 3x7 A4 Grid = 21 labels/page)
  // ════════════════════════════════════════════════════════════════════════

  async mealStickersPdf(): Promise<void> {
    const pdf = new PdfWriter();
    const records = this.flatRecords;

    const COLS = 3;
    const ROWS = 7;
    const PER_PAGE = COLS * ROWS; // 21 labels per A4 sheet

    const marginX = 20;
    const marginY = 26;
    const gapX = 8;
    const gapY = 6;
    const cardW = (PAGE_W - marginX * 2 - gapX * (COLS - 1)) / COLS; // ~179.6 pt
    const cardH = (PAGE_H - marginY * 2 - gapY * (ROWS - 1)) / ROWS; // ~107.7 pt
    const footerStripH = 24;

    const totalPages = Math.max(1, Math.ceil(records.length / PER_PAGE));

    for (let p = 0; p < totalPages; p++) {
      pdf.newPage();
      const pageItems = records.slice(p * PER_PAGE, (p + 1) * PER_PAGE);

      pageItems.forEach((rec, idx) => {
        const col = idx % COLS;
        const row = Math.floor(idx / COLS);
        const x = marginX + col * (cardW + gapX);
        const y = marginY + row * (cardH + gapY);

        // Bottom metadata grey strip
        pdf.fillRect(x + 1, y + cardH - footerStripH, cardW - 2, footerStripH - 1, PDF_COLORS.stickerBar);

        // Card border (thick black 2pt if allergy, thin light grey if normal)
        if (rec.isAllergy) {
          pdf.strokeRect(x, y, cardW, cardH, PDF_COLORS.black, 2.0);
        } else {
          pdf.strokeRect(x, y, cardW, cardH, PDF_COLORS.borderLight, 0.75);
        }

        // Top row: brand logo left + COMPANY right
        pdf.textAt(x + 7, y + 15, 'your kitchen co.', 10.5, 'Normal', PDF_COLORS.darkGrey);
        pdf.rightTextAt(x + cardW - 7, y + 14.5, rec.companyUpper.slice(0, 14), 7.5, 'Normal', PDF_COLORS.midGrey);
        pdf.drawLine(x + 7, y + 20, x + cardW - 7, y + 20, PDF_COLORS.black, 0.85);

        // Recipient Name
        pdf.textAt(x + 7, y + 33, rec.recipientName.slice(0, 24), 9.5, 'Bold', PDF_COLORS.black);

        // Category & Dish
        pdf.textAt(x + 7, y + 44, rec.categoryUpper.slice(0, 28), 7.5, 'Normal', PDF_COLORS.darkGrey);
        const mealLines = wrapPdfText(rec.meal, cardW - 14, 8, 'Normal');
        pdf.textAt(x + 7, y + 54, mealLines[0] || '', 8, 'Normal', PDF_COLORS.black);
        if (mealLines[1] && !rec.isAllergy) {
          pdf.textAt(x + 7, y + 63, mealLines[1], 7.5, 'Normal', PDF_COLORS.black);
        }

        // Callout line: Allergy black bar OR Special Note OR "Reserved for..."
        if (rec.isAllergy) {
          const barY = y + 60;
          pdf.fillRect(x + 7, barY, cardW - 14, 13, PDF_COLORS.black);
          pdf.centerTextAt(
            x + cardW / 2,
            barY + 9.5,
            `!! ${rec.allergyDisplay} !!`.slice(0, 28),
            7.5,
            'Bold',
            PDF_COLORS.white
          );
        } else if (rec.notes) {
          const noteY = mealLines[1] ? y + 72 : y + 66;
          pdf.textAt(x + 7, noteY, `Note: ${rec.notes}`.slice(0, 34), 7, 'Bold', PDF_COLORS.black);
        } else {
          const resY = mealLines[1] ? y + 72 : y + 66;
          pdf.textAt(
            x + 7,
            resY,
            `Reserved for ${rec.recipientName} \xB7 not for sharing`.slice(0, 38),
            6.3,
            'Normal',
            PDF_COLORS.lightGreyText
          );
        }

        // Footer Strip: Made date, Order #, EAT BY boxed pill, and Sticker X of N
        const stripTop = y + cardH - footerStripH;
        pdf.textAt(x + 7, stripTop + 10, `Made ${rec.deliveryDateSlash}`, 6.5, 'Normal', PDF_COLORS.darkGrey);
        pdf.textAt(x + 7, stripTop + 19, `Order ${rec.orderNo}`, 6, 'Normal', PDF_COLORS.midGrey);

        // EAT BY pill box on top-right of strip
        const eatByText = `EAT BY ${rec.eatByDateSlash}`;
        const pillW = 66;
        const pillH = 10;
        const pillX = x + cardW - 7 - pillW;
        const pillY = stripTop + 3;
        pdf.fillAndStrokeRect(pillX, pillY, pillW, pillH, PDF_COLORS.white, PDF_COLORS.black, 0.7);
        pdf.centerTextAt(pillX + pillW / 2, pillY + 7.5, eatByText, 6.2, 'Bold', PDF_COLORS.black);

        // Sticker number on bottom-right of strip
        pdf.rightTextAt(x + cardW - 7, stripTop + 19.5, rec.sticker, 6.5, 'Normal', PDF_COLORS.midGrey);
      });
    }

    await sharePdf(`YKC_Meal_Stickers_${this.fileStamp()}`, pdf, 'YKC Meal Stickers');
  }

  // ════════════════════════════════════════════════════════════════════════
  // 6. INDIVIDUAL DELIVERY NOTES PDF (2 slips per A4 page with `cut here`)
  // ════════════════════════════════════════════════════════════════════════

  async individualDeliveryNotesPdf(): Promise<void> {
    const pdf = new PdfWriter();
    const records = this.flatRecords;
    const leftX = 36;
    const rightX = PAGE_W - 36;
    const contentW = rightX - leftX;

    for (let i = 0; i < records.length; i++) {
      const rec = records[i];
      const isTopHalf = i % 2 === 0;
      if (isTopHalf) {
        pdf.newPage();
      } else {
        // Draw dashed "cut here" line between top and bottom slip
        const cutY = 420;
        pdf.textAt(18, cutY - 3, 'cut here', 7, 'Normal', PDF_COLORS.lightGreyText);
        pdf.drawDashedLine(18, cutY, PAGE_W - 18, cutY, PDF_COLORS.borderMid, 0.75);
      }

      const baseTop = isTopHalf ? 42 : 454;
      const dnNo = `DN-${rec.orderNo.replace(/^INV-/, '')}-1`;

      // Header: DELIVERY NOTE individual order | your kitchen co.
      pdf.textAt(leftX, baseTop + 16, 'DELIVERY NOTE', 16, 'Bold', PDF_COLORS.black);
      pdf.textAt(leftX + 142, baseTop + 16, 'individual order', 10, 'Normal', PDF_COLORS.midGrey);
      pdf.drawBrandLogo(rightX, baseTop + 14, 16);

      // Black Customer Banner
      const bannerTop = baseTop + 26;
      pdf.fillRect(leftX, bannerTop, contentW, 24, PDF_COLORS.black);
      pdf.textAt(leftX + 8, bannerTop + 16, rec.recipientName.toUpperCase(), 13, 'Bold', PDF_COLORS.white);
      pdf.rightTextAt(
        rightX - 8,
        bannerTop + 16,
        `Sticker ${rec.sticker}   \xB7   Delivery 1 of 1`,
        10,
        'Bold',
        PDF_COLORS.white
      );

      // Grey Metadata Box (4 columns)
      const metaTop = bannerTop + 30;
      pdf.fillRect(leftX, metaTop, contentW, 38, PDF_COLORS.greyFill);

      pdf.textAt(leftX + 8, metaTop + 13, 'INVOICE NO.', 6.8, 'Bold', PDF_COLORS.midGrey);
      pdf.textAt(leftX + 8, metaTop + 28, rec.orderNo, 9.5, 'Bold', PDF_COLORS.black);

      pdf.textAt(leftX + 140, metaTop + 13, 'INVOICE DATE', 6.8, 'Bold', PDF_COLORS.midGrey);
      pdf.textAt(leftX + 140, metaTop + 28, rec.invoiceDateShort, 9.5, 'Normal', PDF_COLORS.black);

      pdf.textAt(leftX + 270, metaTop + 13, 'DELIVERY DATE', 6.8, 'Bold', PDF_COLORS.midGrey);
      pdf.textAt(leftX + 270, metaTop + 28, rec.deliveryDateShort, 9.5, 'Bold', PDF_COLORS.black);

      pdf.textAt(leftX + 400, metaTop + 13, 'DELIVERY NOTE NO.', 6.8, 'Bold', PDF_COLORS.midGrey);
      pdf.textAt(leftX + 400, metaTop + 28, dnNo, 9.5, 'Normal', PDF_COLORS.black);

      // DELIVER TO block
      const delivTop = metaTop + 50;
      pdf.textAt(leftX, delivTop, 'DELIVER TO', 7, 'Bold', PDF_COLORS.midGrey);
      pdf.textAt(leftX, delivTop + 14, rec.company, 11, 'Bold', PDF_COLORS.black);
      pdf.textAt(leftX, delivTop + 27, rec.companyAddress, 9, 'Normal', PDF_COLORS.black);
      pdf.textAt(leftX, delivTop + 40, `Drop-off point: ${rec.dropoffPoint}`, 9, 'Bold', PDF_COLORS.black);

      // Item Table Header
      const tableTop = delivTop + 52;
      pdf.fillRect(leftX, tableTop, contentW, 18, PDF_COLORS.black);
      pdf.textAt(leftX + 6, tableTop + 12.5, 'OK', 7.5, 'Bold', PDF_COLORS.white);
      pdf.textAt(leftX + 26, tableTop + 12.5, 'QTY', 7.5, 'Bold', PDF_COLORS.white);
      pdf.textAt(leftX + 54, tableTop + 12.5, 'ITEM', 7.5, 'Bold', PDF_COLORS.white);
      pdf.textAt(leftX + 310, tableTop + 12.5, 'NOTE', 7.5, 'Bold', PDF_COLORS.white);
      pdf.rightTextAt(rightX - 6, tableTop + 12.5, 'INVOICE LINE', 7.5, 'Bold', PDF_COLORS.white);

      // Item Row
      const itemTop = tableTop + 18;
      const itemH = 28;
      if (rec.isAllergy) {
        pdf.fillRect(leftX, itemTop, contentW, itemH, PDF_COLORS.pinkFill);
      }
      pdf.drawCheckbox(leftX + 6, itemTop + 9, 10, PDF_COLORS.black, 0.9);
      pdf.textAt(leftX + 30, itemTop + 18, '1', 10.5, 'Bold', PDF_COLORS.black);
      pdf.textAt(leftX + 54, itemTop + 11, rec.categoryUpper, 7, 'Normal', PDF_COLORS.midGrey);
      pdf.textAt(leftX + 54, itemTop + 22, rec.meal.slice(0, 44), 10, 'Bold', PDF_COLORS.black);

      if (rec.notes) {
        const noteText = rec.isAllergy ? `!! ${rec.allergyDisplay}` : rec.notes;
        pdf.textAt(
          leftX + 310,
          itemTop + 18,
          noteText.slice(0, 32),
          8.5,
          rec.isAllergy ? 'Bold' : 'Normal',
          PDF_COLORS.redBanner
        );
      }

      pdf.rightTextAt(rightX - 6, itemTop + 18, '1 of 1', 8.5, 'Normal', PDF_COLORS.black);
      pdf.drawLine(leftX, itemTop + itemH, rightX, itemTop + itemH, PDF_COLORS.borderLight, 0.6);

      // On delivery sign-off block
      const signTop = itemTop + itemH + 62;
      pdf.textAt(leftX, signTop, 'On delivery', 9.5, 'Bold', PDF_COLORS.black);

      pdf.textAt(leftX, signTop + 18, 'Delivered by:', 8.5, 'Bold', PDF_COLORS.black);
      pdf.drawLine(leftX + 64, signTop + 20, leftX + 250, signTop + 20, PDF_COLORS.darkGrey, 0.7);

      pdf.textAt(leftX + 265, signTop + 18, 'Time delivered:', 8.5, 'Bold', PDF_COLORS.black);
      pdf.drawLine(leftX + 338, signTop + 20, rightX, signTop + 20, PDF_COLORS.darkGrey, 0.7);

      pdf.textAt(leftX, signTop + 38, 'Left at drop-off point', 8.5, 'Bold', PDF_COLORS.black);
      pdf.drawCheckbox(leftX + 102, signTop + 29, 9.5, PDF_COLORS.black, 1.0);

      pdf.textAt(leftX + 265, signTop + 38, 'Collected by (name & signature):', 8.5, 'Bold', PDF_COLORS.black);
      pdf.drawLine(leftX + 412, signTop + 40, rightX, signTop + 40, PDF_COLORS.darkGrey, 0.7);

      // Slip Footer
      pdf.textAt(
        leftX,
        signTop + 62,
        `Your KitchenCO \xB7 Paid via PayFast \xB7 Queries: ${INVOICE_SUPPORT_EMAIL} - please quote invoice ${rec.orderNo}`,
        7.5,
        'Normal',
        PDF_COLORS.midGrey
      );
    }

    await sharePdf(`YKC_Individual_Delivery_Notes_${this.fileStamp()}`, pdf, 'YKC Individual Delivery Notes');
  }

  // ════════════════════════════════════════════════════════════════════════
  // 7. CONSOLIDATED INVOICES PDF (`YKC_Invoices.pdf`)
  // ════════════════════════════════════════════════════════════════════════

  async invoicesPdf(): Promise<void> {
    const pdf = new PdfWriter();
    for (let i = 0; i < this.rows.length; i++) {
      pdf.newPage();
      renderInvoicePageToPdf(pdf, this.rows[i], i + 1);
    }
    await sharePdf(`YKC_Invoices_${this.fileStamp()}`, pdf, 'YKC Tax Invoices');
  }
}
