/**
 * The basket's money, computed by the same rules place_order applies
 * (supabase/migrations/0008_maui_parity.sql) so what the Cart and Payment
 * screens show is what the customer is actually charged:
 *
 *   subtotal   sum of unit price x quantity
 *   discount   the best active discount code that applies, % of subtotal,
 *              plus the company's own discount on what's left after subsidy
 *   subsidy    company accounts: per-meal subsidy x meals, capped
 *   delivery   one flat fee per checkout, by the location's distance band
 *
 * Delivery fee bands are MAUI's DeliveryFeeCalculator (same as the
 * database's calculate_delivery_fee_cents).
 */
import type { CartItem, Company, CompanyLocation, Discount, UserAccount } from '../models';
import { lineTotal } from '../models';

export function deliveryFeeFor(distanceKm: number): number | null {
  if (distanceKm <= 15) return 100;
  if (distanceKm <= 20) return 140;
  if (distanceKm <= 30) return 200;
  if (distanceKm <= 50) return 350;
  return null;
}

export function deliveryTierLabel(distanceKm: number): string {
  if (distanceKm <= 15) return '0–15km';
  if (distanceKm <= 20) return '15.01–20km';
  if (distanceKm <= 30) return '20.01–30km';
  if (distanceKm <= 50) return '30.01–50km';
  return 'Outside delivery range (50km+)';
}

export interface CartQuote {
  cartTotal: number;
  discountAmount: number;
  discountLabel: string;
  subsidyTotal: number;
  subsidyLabel: string;
  deliveryFee: number;
  deliveryFeeLabel: string;
  isOutsideDeliveryRange: boolean;
  amountDue: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function quoteCart(
  items: CartItem[],
  user: UserAccount | null,
  company: Company | null,
  location: CompanyLocation | null,
  discounts: Discount[]
): CartQuote {
  const cartTotal = round2(items.reduce((sum, i) => sum + lineTotal(i), 0));
  const quantity = items.reduce((sum, i) => sum + i.quantity, 0);
  const now = Date.now();
  const companyId = user?.accountType === 'company' ? user.companyId : '';

  const applicable = discounts
    .filter(d => d.active && (!d.expires || new Date(d.expires).getTime() > now))
    .filter(d => !d.companyId || d.companyId === companyId)
    .filter(
      d =>
        (!d.categoryId && !d.itemId) ||
        items.some(i => i.menuType === 'static' && (i.product.id === d.itemId || i.product.categoryId === d.categoryId))
    )
    .sort((a, b) => b.percentage - a.percentage);
  const code = applicable[0];
  const codeDiscount = code ? round2((cartTotal * code.percentage) / 100) : 0;

  let subsidyTotal = 0;
  let companyDiscount = 0;
  let subsidyLabel = '';
  if (user?.accountType === 'company' && company) {
    subsidyTotal = round2(Math.min(company.mealSubsidyAmount * quantity, cartTotal - codeDiscount));
    if (company.mealSubsidyAmount > 0) {
      subsidyLabel = `${company.name} covers R${company.mealSubsidyAmount.toFixed(2)} per meal (incl. VAT)`;
    }
    const remaining = Math.max(cartTotal - codeDiscount - subsidyTotal, 0);
    if (company.discountType === 'Percentage') companyDiscount = round2((remaining * Math.min(company.discountValue, 100)) / 100);
    if (company.discountType === 'FixedZar') companyDiscount = Math.min(company.discountValue * items.length, remaining);
  }

  const discountParts = [code ? `Discount (${code.code})` : '', companyDiscount > 0 && company ? `${company.name} discount` : ''].filter(Boolean);

  let deliveryFee = 0;
  let deliveryFeeLabel = '';
  let isOutsideDeliveryRange = false;
  if (location && items.length > 0) {
    if (!location.distanceKnown) {
      isOutsideDeliveryRange = true;
      deliveryFeeLabel = 'No delivery distance is set for your location yet — please contact us';
    } else {
      const fee = deliveryFeeFor(location.distanceKm);
      if (fee == null) {
        isOutsideDeliveryRange = true;
        deliveryFeeLabel = `${location.distanceKm.toFixed(1)}km is outside our delivery range — please contact us`;
      } else {
        deliveryFee = fee;
        deliveryFeeLabel = `Delivery (${deliveryTierLabel(location.distanceKm)}): R${fee.toFixed(2)}`;
      }
    }
  }

  const discountAmount = round2(codeDiscount + companyDiscount);
  return {
    cartTotal,
    discountAmount,
    discountLabel: discountParts.join(' + '),
    subsidyTotal,
    subsidyLabel,
    deliveryFee,
    deliveryFeeLabel,
    isOutsideDeliveryRange,
    amountDue: round2(Math.max(cartTotal - discountAmount - subsidyTotal, 0) + deliveryFee),
  };
}
