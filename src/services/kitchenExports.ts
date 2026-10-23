/**
 * AdminActiveOrdersViewModel's downloads — production sheet (PDF / Excel),
 * delivery notes, meal stickers, the day's invoices, the delivery report,
 * one person's delivery note (on request), the detailed report
 * and the plain-text prep sheet — for the rows behind the current Company + Date
 * filters. The kitchen paperwork itself is laid out in kitchenDocs.ts.
 *
 * MAUI orders are one dish each; here one order can hold several lines
 * (one order per checkout), so the per-dish documents walk order.lines.
 */
import type { AdminOrderRow } from './adminOrders';
import { ALL_COMPANIES, ALL_DATES } from './adminOrders';
import { getCategoryOrder } from './catalog';
import { getLocationById } from './directory';
import { fmtGenerated } from './scheduling';
import { loadInvoiceDocument, PdfWriter, sharePdf, sharePdfBytes, shareText, shareXlsx, writeInvoice } from './export';
import {
  buildKitchenDays,
  customerDeliveryNotesPdf,
  deliveryNotesPdf,
  deliveryReportPdf,
  detailedReportPdf,
  mealStickersPdf,
  productionSheetPdf,
  productionSheetXlsx,
} from './kitchenDocs';

export interface PrepSummaryItem {
  dishName: string;
  totalQuantity: number;
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

  /** "all clients" or the filtered company — the COOK / PACK subtitle. */
  private scope() {
    return this.companyFilter === ALL_COMPANIES ? 'all clients' : this.companyFilter;
  }

  /** locationId -> printable address, for every drop in the filtered orders. */
  private async addresses() {
    const ids = [...new Set(this.rows.map(r => r.order.locationId).filter(Boolean))];
    const found = await Promise.all(ids.map(id => getLocationById(id).catch(() => null)));
    const addresses: Record<string, string> = {};
    ids.forEach((id, i) => {
      const loc = found[i];
      if (loc) addresses[id] = loc.address || loc.name;
    });
    return addresses;
  }

  /** The filtered orders as per-day client drops, with each drop's printable address. */
  private async days() {
    return buildKitchenDays(this.rows, await this.addresses());
  }

  /** Menu category order for the COOK list; alphabetical if it can't be loaded. */
  private categoryOrder() {
    return getCategoryOrder().catch(() => [] as string[]);
  }

  async productionSheetPdf() {
    const [days, order] = await Promise.all([this.days(), this.categoryOrder()]);
    await sharePdfBytes(`Production_Sheet_${this.fileStamp()}`, productionSheetPdf(days, order, this.scope()), 'Production Sheet');
  }

  async productionSheetExcel() {
    const [days, order] = await Promise.all([this.days(), this.categoryOrder()]);
    await shareXlsx(`Production_Sheet_${this.fileStamp()}`, productionSheetXlsx(days, order, this.scope()), 'Production Sheet');
  }

  async deliveryNotesPdf() {
    await sharePdfBytes(`Delivery_Notes_${this.fileStamp()}`, deliveryNotesPdf(await this.days()), 'Delivery Notes');
  }

  async mealStickersPdf() {
    await sharePdfBytes(`Meal_Stickers_${this.fileStamp()}`, mealStickersPdf(await this.days()), 'Meal Stickers');
  }

  /** Per drop, each person's order with its invoice number and the time it was delivered. */
  async deliveryReportPdf() {
    const pdf = deliveryReportPdf(this.rows, await this.addresses(), this.scope(), this.filterLine(), fmtGenerated());
    await sharePdfBytes(`Delivery_Report_${this.fileStamp()}`, pdf, 'Delivery Report');
  }

  /** One person's delivery note per order — printed on request (a query or expense claim), not daily. */
  async customerDeliveryNotesPdf() {
    const sorted = [...this.rows].sort(byDeliveryCompanyCustomer);
    const name = sorted.length === 1 ? `Delivery_Note_${sorted[0].order.taxInvoiceNumber || sorted[0].order.orderNumber}` : `Customer_Delivery_Notes_${this.fileStamp()}`;
    await sharePdfBytes(name, customerDeliveryNotesPdf(sorted, await this.addresses(), fmtGenerated()), 'Delivery Note');
  }

  /** Management report: headline figures, totals per status / client / day / dish, and every order in full. */
  async detailedReportPdf() {
    await sharePdfBytes(`Detailed_Report_${this.fileStamp()}`, detailedReportPdf(this.rows, this.scope(), this.filterLine(), fmtGenerated()), 'Detailed Report');
  }

  /** Every invoice for the filtered orders, one per page — the same document the customer's Invoice page builds. */
  async invoicesPdf() {
    const pdf = new PdfWriter();
    const sorted = [...this.rows].sort(byDeliveryCompanyCustomer);
    for (let i = 0; i < sorted.length; i++) writeInvoice(pdf, await loadInvoiceDocument(sorted[i].order), i > 0);
    await sharePdf(`Invoices_${this.fileStamp()}`, pdf, 'Invoices');
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
