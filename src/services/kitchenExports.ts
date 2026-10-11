/**
 * AdminActiveOrdersViewModel's downloads — production sheet (PDF / Excel),
 * delivery notes, the day's invoices, and the plain-text order / prep
 * sheets — for the rows behind the current Company + Date filters.
 *
 * MAUI orders are one dish each; here one order can hold several lines
 * (one order per checkout), so the per-dish documents walk order.lines.
 */
import type { AdminOrderRow } from './adminOrders';
import { ALL_COMPANIES, ALL_DATES } from './adminOrders';
import { fmtGenerated, fromIso } from './scheduling';
import { fmtIssued, loadInvoiceDocument, PdfWriter, sharePdf, shareText, shareXlsx, writeInvoice, XlsxWriter } from './export';

export interface PrepSummaryItem {
  dishName: string;
  totalQuantity: number;
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const pad = (n: number) => String(n).padStart(2, '0');

/** "dddd, dd MMMM yyyy" */
function fmtFull(iso: string): string {
  const d = fromIso(iso);
  return `${DAYS[d.getDay()]}, ${pad(d.getDate())} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}
/** "ddd dd MMM yyyy" / "ddd dd MMM" */
function fmtShort(iso: string, withYear: boolean): string {
  const d = fromIso(iso);
  return `${DAYS[d.getDay()].slice(0, 3)} ${pad(d.getDate())} ${MONTHS[d.getMonth()].slice(0, 3)}${withYear ? ` ${d.getFullYear()}` : ''}`;
}

/** Bulk kitchen prep list: the filtered orders, totalled per dish, biggest first. */
export function buildPrepSummary(rows: AdminOrderRow[]): PrepSummaryItem[] {
  const totals = new Map<string, number>();
  for (const row of rows) for (const line of row.order.lines) totals.set(line.name, (totals.get(line.name) ?? 0) + line.quantity);
  return [...totals.entries()].map(([dishName, totalQuantity]) => ({ dishName, totalQuantity })).sort((a, b) => b.totalQuantity - a.totalQuantity);
}

const byDeliveryCompanyCustomer = (a: AdminOrderRow, b: AdminOrderRow) =>
  a.order.deliveryDate.localeCompare(b.order.deliveryDate) || a.companyName.localeCompare(b.companyName) || a.order.customerName.localeCompare(b.order.customerName);

export class KitchenExports {
  constructor(
    private rows: AdminOrderRow[],
    private companyFilter: string,
    private dateFilter: string
  ) {}

  private get prep() {
    return buildPrepSummary(this.rows);
  }

  private filterLine() {
    return `Company: ${this.companyFilter}    Date: ${this.dateFilter}`;
  }

  private fileStamp() {
    const date = this.dateFilter === ALL_DATES ? 'all-dates' : this.dateFilter.replace(/, /g, '_').replace(/ /g, '');
    const company = this.companyFilter === ALL_COMPANIES ? 'all' : this.companyFilter.replace(/ /g, '');
    return `${date}_${company}`;
  }

  private header(pdf: PdfWriter, title: string) {
    pdf.heading(title, 16, 2);
    pdf.text(this.filterLine(), 10);
    pdf.text(`Generated ${fmtGenerated()}`, 9, 10);
  }

  async productionSheetPdf() {
    const pdf = new PdfWriter();
    this.header(pdf, 'YOUR KITCHEN CO. - PRODUCTION SHEET');
    const prep = this.prep;
    pdf.subHeading('1. PREP TOTALS (make this many of each)', 12, 4);
    for (const item of prep) pdf.mono(`  ${String(item.totalQuantity).padStart(3)} x  ${item.dishName}`, 10);
    pdf.mono(`  Total meals: ${prep.reduce((s, p) => s + p.totalQuantity, 0)}   Distinct dishes: ${prep.length}`, 9, 12);
    pdf.subHeading('2. DELIVERY NOTES (labelling - one line per order)', 12, 4);
    this.writeDeliveryNotes(pdf);
    await sharePdf(`Production_Sheet_${this.fileStamp()}`, pdf, 'Production Sheet');
  }

  async productionSheetExcel() {
    const xlsx = new XlsxWriter();
    const prep = this.prep;

    const totals = xlsx.addSheet('Prep Totals').widths(36, 10);
    totals.header('Dish', 'Quantity');
    for (const item of prep) totals.row(item.dishName, item.totalQuantity);
    totals.blank();
    totals.row('Total meals', prep.reduce((s, p) => s + p.totalQuantity, 0));

    const sorted = [...this.rows].sort(byDeliveryCompanyCustomer);
    const orders = xlsx.addSheet('Order Report').widths(16, 22, 24, 30, 36, 8, 12, 18, 16, 14, 30, 30);
    orders.header('Delivery Date', 'Company', 'Location', 'Customer', 'Dish', 'Qty', 'Order #', 'Ordered', 'Floor / Desk', 'Status', 'Notes', 'Allergy');
    for (const r of sorted) {
      for (const line of r.order.lines) {
        orders.row(
          fmtShort(r.order.deliveryDate, true),
          r.companyName,
          r.locationName,
          r.order.customerName,
          line.name,
          line.quantity,
          r.order.orderNumber,
          fmtIssued(r.order.orderDate),
          r.order.deliveryFloor,
          r.order.status,
          line.notes,
          line.allergyNotes
        );
      }
    }

    // One row per unit so it can be mail-merged straight onto label stationery.
    const labels = xlsx.addSheet('Labels').widths(30, 36, 22, 24, 16, 30);
    labels.header('Customer', 'Dish', 'Company', 'Location', 'Delivery', 'Allergy');
    for (const r of sorted)
      for (const line of r.order.lines)
        for (let i = 0; i < line.quantity; i++)
          labels.row(r.order.customerName, line.name, r.companyName, r.locationName, fmtShort(r.order.deliveryDate, false), line.allergyNotes);

    await shareXlsx(`Production_Sheet_${this.fileStamp()}`, xlsx, 'Production Sheet');
  }

  async deliveryNotesPdf() {
    const pdf = new PdfWriter();
    this.header(pdf, 'YOUR KITCHEN CO. - DELIVERY NOTES');
    this.writeDeliveryNotes(pdf);
    await sharePdf(`Delivery_Notes_${this.fileStamp()}`, pdf, 'Delivery Notes');
  }

  private writeDeliveryNotes(pdf: PdfWriter) {
    let labelCount = 0;
    const groupBy = <T>(items: T[], key: (t: T) => string) => {
      const map = new Map<string, T[]>();
      for (const item of items) map.set(key(item), [...(map.get(key(item)) ?? []), item]);
      return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
    };

    for (const [date, byDate] of groupBy(this.rows, r => r.order.deliveryDate)) {
      pdf.subHeading(`DELIVERY: ${fmtFull(date)}`, 11, 2);
      for (const [, byCompany] of groupBy(byDate, r => `${r.companyName} | ${r.locationName}`)) {
        pdf.text(`${byCompany[0].companyName} - ${byCompany[0].locationName}`, 10, 2);
        for (const [person, byPerson] of groupBy(byCompany, r => r.order.customerName)) {
          const floor = byPerson.map(r => r.order.deliveryFloor).find(f => f.trim());
          pdf.mono(`  ${person}${floor ? `  (${floor})` : ''}`, 10);
          for (const r of byPerson) {
            for (const line of [...r.order.lines].sort((a, b) => a.name.localeCompare(b.name))) {
              labelCount += line.quantity;
              pdf.mono(`     [ ] ${line.quantity} x ${line.name}   #${r.order.orderNumber}`, 9);
              if (line.allergyNotes) pdf.mono(`         !! ALLERGY: ${line.allergyNotes}`, 9);
              if (line.notes) pdf.mono(`         Note: ${line.notes}`, 9);
            }
          }
        }
        pdf.blank(4);
      }
    }
    const people = new Set(this.rows.map(r => r.order.customerName)).size;
    const lines = this.rows.reduce((s, r) => s + r.order.lines.length, 0);
    pdf.rule(64);
    pdf.mono(`Labels: ${labelCount}   People: ${people}   Order lines: ${lines}`, 9);
  }

  /** Every invoice for the filtered orders, one per page — the same document the customer's Invoice page builds. */
  async invoicesPdf() {
    const pdf = new PdfWriter();
    const sorted = [...this.rows].sort(byDeliveryCompanyCustomer);
    for (let i = 0; i < sorted.length; i++) writeInvoice(pdf, await loadInvoiceDocument(sorted[i].order), i > 0);
    await sharePdf(`Invoices_${this.fileStamp()}`, pdf, 'Invoices');
  }

  async printOrderSheet() {
    const groups = new Map<string, AdminOrderRow[]>();
    for (const row of this.rows) {
      const key = `${row.companyName} — ${row.locationName}`;
      groups.set(key, [...(groups.get(key) ?? []), row]);
    }
    const out = ['YOUR KITCHEN CO. — ORDER SHEET', this.filterLine(), `Generated: ${fmtGenerated()}`, '-'.repeat(42)];
    for (const key of [...groups.keys()].sort()) {
      out.push('', key);
      for (const row of groups.get(key)!.sort((a, b) => a.order.deliveryDate.localeCompare(b.order.deliveryDate))) {
        out.push(
          `  [${row.deliveryDateLabel}] #${row.order.orderNumber} — ${row.order.customerName}: ${row.order.itemName} (R${row.order.totalAmount.toFixed(2)}) — ${row.order.status}`
        );
      }
    }
    out.push('', '-'.repeat(42), `Total orders: ${this.rows.length}`);
    await shareText(out.join('\n'), 'Order Sheet');
  }

  async printPrepSheet() {
    const prep = this.prep;
    const out = [
      'YOUR KITCHEN CO. — KITCHEN PREP SHEET',
      this.filterLine(),
      `Generated: ${fmtGenerated()}`,
      '-'.repeat(42),
      '',
      ...prep.map(p => `  ${String(p.totalQuantity).padStart(3)}x  ${p.dishName}`),
      '',
      '-'.repeat(42),
      `Total meals: ${prep.reduce((sum, p) => sum + p.totalQuantity, 0)}   Distinct dishes: ${prep.length}`,
    ];
    await shareText(out.join('\n'), 'Kitchen Prep Sheet');
  }
}
