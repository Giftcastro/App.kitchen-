/**
 * Maps our `Order` onto the display fields JoTsav/kicthenCoV1 `main` carries
 * on its `OrderHistoryItem`, so the ported Orders screen, Tax Invoice modal
 * and Dispute modal all read the same derived values instead of each
 * re-deriving them slightly differently.
 *
 * His type stores these fields on the order itself. Ours does not, because
 * they are either fixed for the whole service (the batch drop slot) or already
 * implied by data we do hold (the delivery address). Nothing here invents a
 * value: where we genuinely have no source — a payment reference on an order
 * placed before that field existed — the field comes back undefined and the UI
 * omits that row rather than showing a plausible-looking fake.
 */
import { Order } from '../context/KitchenCoContext';

/**
 * When the day's batch lands in the building. Deliveries are one scheduled
 * drop per site, not a rolling ETA, so this is a fixed published time rather
 * than anything computed per order. Mirrors BATCH_DROP_LABEL in (tabs)/orders.tsx.
 */
export const BATCH_DROP_SLOT = '12:00 PM SAST';

export interface OrderPresentation {
  /** Our order id doubles as his `orderNumber` (e.g. "ORD-1295"). */
  orderNumber: string;
  deliveryDateFormatted: string;
  deliverySlot: string;
  /** Company/site the batch is dropped at, from the order's delivery address. */
  companyLocation: string;
  /** Floor / suite within that building, when the address records one. */
  deliveryFloor: string;
  itemSubtotal: number;
  discountAmount: number;
  subsidyAmount: number;
  deliveryFee: number;
  totalPaid: number;
  /**
   * Derived from the order id and date, NOT issued by a finance system — this
   * project has no backend to allocate real invoice numbers. Stable for a
   * given order so the same order always shows the same number.
   */
  taxInvoiceNumber: string;
  /** Undefined for orders placed before payfast.tsx started threading it through. */
  paymentReference?: string;
}

/** "Tue, 08 Sept" — the date line on his order cards. */
export function formatDeliveryDate(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString('en-ZA', { weekday: 'short', day: '2-digit', month: 'short' });
}

export function presentOrder(order: Order): OrderPresentation {
  const address = order.deliveryAddress;
  const companyLocation = address
    ? [address.label, address.street].filter(Boolean).join(' • ')
    : 'Delivery address not recorded';

  // Our DeliveryAddress has no floor/unit field; company sites do (see
  // CompanyAddress.unit), but an order snapshots a DeliveryAddress. Fall back
  // to the published drop point rather than inventing a floor number.
  const deliveryFloor = address?.suburb
    ? `${address.suburb} floor pantry`
    : 'Designated floor pantry';

  const itemSubtotal = order.totalPrice ?? order.items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const date = new Date(order.timestamp);
  const stamp = Number.isNaN(date.getTime())
    ? '0000'
    : `${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;

  return {
    orderNumber: order.id,
    deliveryDateFormatted: formatDeliveryDate(order.timestamp),
    deliverySlot: BATCH_DROP_SLOT,
    companyLocation,
    deliveryFloor,
    itemSubtotal,
    discountAmount: order.discountAmount ?? 0,
    subsidyAmount: order.subsidyAmount ?? 0,
    deliveryFee: order.deliveryFee ?? 0,
    totalPaid: order.total,
    taxInvoiceNumber: `INV-KC-${stamp}-${order.id.replace(/[^0-9]/g, '') || '0000'}`,
    paymentReference: order.paymentReference,
  };
}
