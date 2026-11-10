import {
  buildFlatMealRecords,
  buildPrepSummary,
  renderInvoicePageToPdf,
  AdminActiveOrderRow,
} from '../kitchenExports';
import {
  XlsxWriter,
  XLSX_STYLE,
  PdfWriter,
  INVOICE_BILLING_EMAIL,
  INVOICE_SUPPORT_EMAIL,
  PLATFORM_MASTER_EMAIL,
} from '../export';
import { OrderHistoryItem } from '../../types';

const createSampleOrder = (overrides: Partial<OrderHistoryItem> = {}): OrderHistoryItem => ({
  id: 'ord_test_1',
  orderNumber: 'INV-20260831-00016',
  taxInvoiceNumber: 'INV-20260831-00016',
  createdAt: '2026-08-30T10:00:00Z',
  targetDeliveryDate: '2026-08-31',
  deliveryDateFormatted: 'Mon, 31 Aug 2026',
  deliverySlot: '12:00 PM Sharp',
  companyName: 'Ecogra',
  companyLocation: '21619922, Block B, Ground Floor, 100 Fairway Green Office Park, 3 Abrey Rd, Kloof, 3610',
  deliveryFloor: 'Ground Floor Reception',
  customerName: 'Gerhard Visser',
  customerEmail: 'gerhard.visser@ecogra.com',
  items: [
    {
      id: 'item_1',
      menuItem: {
        id: 'dish_1',
        name: 'Beef Lasagne',
        description: 'Classic oven-baked beef lasagne',
        ingredients: 'Beef mince, pasta sheets, bechamel, tomato ragu',
        price: 75,
        categoryId: 'cat_italy',
        categoryName: 'Ciao Italy',
        calories: 640,
        dietaryTags: [],
        menuType: 'standard',
        isAvailable: true,
      },
      quantity: 1,
      size: 'standard',
      selectedAddOns: [],
      allergyNotes: 'DAIRY ALLERGY',
      targetDeliveryDate: '2026-08-31',
      unitPrice: 75,
      totalPrice: 75,
    },
  ],
  itemSubtotal: 75,
  vatAmount: 0,
  deliveryFee: 0,
  totalPaid: 75,
  paymentMethod: 'Credit/Debit Card',
  paymentReference: 'PG-20260831-00016',
  status: 'kitchen_prepping',
  stage: 2,
  ...overrides,
});

describe('YKC Kitchen Exports & Document Engine', () => {
  it('standardizes official YKC email routing constants', () => {
    expect(INVOICE_BILLING_EMAIL).toBe('invoicesykc@csggroup.co.za');
    expect(INVOICE_SUPPORT_EMAIL).toBe('supportykc@csggroup.co.za');
    expect(PLATFORM_MASTER_EMAIL).toBe('techykc@csggroup.co.za');
  });

  it('builds flat meal records sorted by Company -> Category -> Meal -> Name with 1 of N stickers', () => {
    const rows: AdminActiveOrderRow[] = [
      {
        order: createSampleOrder({
          id: 'ord_2',
          orderNumber: 'INV-20260831-00022',
          customerName: 'Zanele Dlamini',
          items: [
            {
              ...createSampleOrder().items[0],
              id: 'item_2',
              menuItem: {
                ...createSampleOrder().items[0].menuItem,
                name: 'Chicken Tikka Masala',
                categoryName: 'The Passage to India',
              },
              allergyNotes: 'Extra spicy',
            },
          ],
        }),
        companyName: 'Ecogra',
        locationName: 'Kloof Campus',
        customerName: 'Zanele Dlamini (zanele@ecogra.com)',
        deliveryDateLabel: '31/08/2026',
      },
      {
        order: createSampleOrder({
          id: 'ord_1',
          orderNumber: 'INV-20260831-00016',
          customerName: 'Gerhard Visser',
        }),
        companyName: 'Ecogra',
        locationName: 'Kloof Campus',
        customerName: 'Gerhard Visser (gerhard.visser@ecogra.com)',
        deliveryDateLabel: '31/08/2026',
      },
      {
        order: createSampleOrder({
          id: 'ord_3',
          orderNumber: 'INV-20260831-00020',
          customerName: 'Ahmed Maseko',
          items: [
            {
              ...createSampleOrder().items[0],
              id: 'item_3',
              allergyNotes: undefined,
            },
          ],
        }),
        companyName: 'Ecogra',
        locationName: 'Kloof Campus',
        customerName: 'Ahmed Maseko (ahmed@ecogra.com)',
        deliveryDateLabel: '31/08/2026',
      },
    ];

    const records = buildFlatMealRecords(rows);
    expect(records).toHaveLength(3);

    // Ciao Italy -> Beef Lasagne -> Ahmed Maseko comes first (Sticker 1 of 3)
    expect(records[0].recipientName).toBe('Ahmed Maseko');
    expect(records[0].sticker).toBe('1 of 3');
    expect(records[0].isAllergy).toBe(false);
    expect(records[0].allergyYesNo).toBe('No');

    // Ciao Italy -> Beef Lasagne -> Gerhard Visser comes second (Sticker 2 of 3)
    expect(records[1].recipientName).toBe('Gerhard Visser');
    expect(records[1].sticker).toBe('2 of 3');
    expect(records[1].isAllergy).toBe(true);
    expect(records[1].allergyYesNo).toBe('YES');
    expect(records[1].notes).toBe('DAIRY ALLERGY');

    // The Passage to India -> Chicken Tikka Masala -> Zanele Dlamini comes third (Sticker 3 of 3)
    expect(records[2].recipientName).toBe('Zanele Dlamini');
    expect(records[2].sticker).toBe('3 of 3');
    expect(records[2].isAllergy).toBe(false);
    expect(records[2].allergyYesNo).toBe('No');
    expect(records[2].notes).toBe('Extra spicy');
    expect(records[2].deliveryDateSlash).toBe('31/08/2026');
    expect(records[2].eatByDateSlash).toBe('01/09/2026');
  });

  it('builds prep summary with allergy counts and special notes', () => {
    const rows: AdminActiveOrderRow[] = [
      {
        order: createSampleOrder(),
        companyName: 'Ecogra',
        locationName: 'Kloof',
        customerName: 'Gerhard Visser',
        deliveryDateLabel: '31/08/2026',
      },
    ];
    const summary = buildPrepSummary(rows);
    expect(summary).toHaveLength(1);
    expect(summary[0].dishName).toBe('Beef Lasagne');
    expect(summary[0].categoryName).toBe('CIAO ITALY');
    expect(summary[0].totalQuantity).toBe(1);
    expect(summary[0].allergyCount).toBe(1);
    expect(summary[0].specialNotes[0].isAllergy).toBe(true);
    expect(summary[0].specialNotes[0].note).toContain('DAIRY ALLERGY');
  });

  it('builds a valid Office Open XML .xlsx ZIP binary with PK header', () => {
    const xlsx = new XlsxWriter();
    const sheet = xlsx.addSheet('1. COOK');
    sheet.widths(40, 14);
    sheet.styledRow([{ value: '1. COOK — WHAT TO COOK', style: XLSX_STYLE.COMPANY_BANNER }], XLSX_STYLE.COMPANY_BANNER, 24);
    sheet.merge('A1:B1');
    sheet.styledRow([{ value: 'Total Meals', style: XLSX_STYLE.BOLD }, { value: 51, style: XLSX_STYLE.QTY_BOLD }]);

    const bytes = xlsx.build();
    expect(bytes).toBeInstanceOf(Uint8Array);
    // ZIP magic bytes: PK\x03\x04 (0x50, 0x4b, 0x03, 0x04)
    expect(bytes[0]).toBe(0x50);
    expect(bytes[1]).toBe(0x4b);
    expect(bytes[2]).toBe(0x03);
    expect(bytes[3]).toBe(0x04);

    const ascii = new TextDecoder().decode(bytes);
    expect(ascii).toContain('xl/workbook.xml');
    expect(ascii).toContain('xl/styles.xml');
    expect(ascii).toContain('xl/worksheets/sheet1.xml');
    expect(ascii).toContain('1. COOK');
  });

  it('renders official YKC Invoice PDF page with %PDF-1.4 header and vector blocks', () => {
    const pdf = new PdfWriter();
    const row: AdminActiveOrderRow = {
      order: createSampleOrder(),
      companyName: 'Ecogra',
      locationName: 'Kloof Campus',
      customerName: 'Gerhard Visser (gerhard.visser@ecogra.com)',
      deliveryDateLabel: '31/08/2026',
    };
    renderInvoicePageToPdf(pdf, row, 1);
    const bytes = pdf.build();
    const content = new TextDecoder().decode(bytes);
    expect(content.startsWith('%PDF-1.4')).toBe(true);
    expect(content).toContain('INVOICE');
    expect(content).toContain('BILLED TO');
    expect(content).toContain('DELIVERED TO');
    expect(content).toContain('Gerhard Visser');
    expect(content).toContain('supportykc@csggroup.co.za');
  });
});
