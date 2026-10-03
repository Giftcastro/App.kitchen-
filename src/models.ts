/**
 * App models — the MAUI app's Models/*.cs, as TypeScript. Field names follow
 * the C# properties (camelCased) so a ported view binds the same names its
 * .xaml did. Dates are ISO yyyy-mm-dd strings (C# DateOnly) unless noted.
 */

export type MenuType = 'static' | 'cycle';

export interface Option {
  name: string;
  additionalPrice: number;
  /** For a Size option: the menu_item_sizes label place_order prices it by. */
  sizeLabel?: string;
  /** True for a category add-on (sent to place_order as an addon). */
  isAddOn?: boolean;
}

export interface CustomizationGroup {
  title: string;
  isMultiSelect: boolean;
  options: Option[];
}

export interface Product {
  /** menu_items uuid for static items; "cycle:<week>:<day>:<slot>:<date>" for cycle items. */
  id: string;
  name: string;
  description: string;
  basePrice: number;
  imageUrl: string;
  icon: string;
  /** Static: the menu category ("BURGER BAR"). Cycle: the meal slot ("Curry of the Day"). */
  category: string;
  categoryId?: string;
  ingredients: string;
  dietaryTags: string[];
  /** "Large R140.00" sub-price, from the Size group. */
  largePrice?: number;
  /** Cycle items only exist on one date — ProductDetail locks to it. */
  lockedDeliveryDate?: string;
  isAvailable: boolean;
  menuType: MenuType;
  customizationGroups: CustomizationGroup[];
  /** The base size label place_order prices an un-customised static item by. */
  baseSizeLabel?: string;
  cycleRef?: { weekNumber: number; dayOfWeek: string; slot: string };
}

export interface CartItem {
  key: string;
  product: Product;
  selectedOptions: Option[];
  specialRequests: string;
  allergyNotes: string;
  deliveryDate: string;
  menuType: MenuType;
  quantity: number;
  /** Unit price incl. options (MAUI's FinalPrice is this x Quantity — see lineTotal). */
  unitPrice: number;
}

export const lineTotal = (item: CartItem) => item.unitPrice * item.quantity;

export type DiscountType = 'None' | 'Percentage' | 'FixedZar';

export interface CompanyLocation {
  id: string;
  companyId: string;
  /** e.g. "Building 2 - Sandton" (company_addresses.label, falling back to the street). */
  name: string;
  /** One-line postal address. */
  address: string;
  deliveryInstructions: string;
  isActive: boolean;
  distanceKm: number;
  /** False when no distance has been surveyed yet — place_order can't price delivery until one is set. */
  distanceKnown: boolean;
  street: string;
  unit?: string;
  suburb: string;
  city: string;
  code: string;
  label?: string;
}

export interface Company {
  id: string;
  name: string;
  billingEmail: string;
  isActive: boolean;
  mealSubsidyAmount: number;
  discountType: DiscountType;
  discountValue: number;
  whitelistedDomains: string[];
  locations: CompanyLocation[];
}

export function financialsSummary(c: Company): string {
  const parts: string[] = [];
  if (c.mealSubsidyAmount > 0) parts.push(`R${c.mealSubsidyAmount.toFixed(2)}/meal subsidy`);
  if (c.discountType === 'Percentage' && c.discountValue > 0) parts.push(`${c.discountValue}% discount`);
  if (c.discountType === 'FixedZar' && c.discountValue > 0) parts.push(`R${c.discountValue.toFixed(2)} discount`);
  return parts.length > 0 ? parts.join(' · ') : 'No subsidy or discount set';
}

export type Role = 'Customer' | 'Kitchen Staff' | 'Admin';

export interface UserAccount {
  id: string;
  fullName: string;
  email: string;
  role: Role;
  isActive: boolean;
  /** ISO timestamp */
  joinedDate: string;
  companyId: string;
  /** company_addresses id for company staff; their own address id for individuals. */
  locationId: string;
  deliveryFloor: string;
  accountType: 'individual' | 'company';
}

export type OrderStatus = 'Received' | 'Preparing' | 'Out for Delivery' | 'Delivered' | 'Cancelled';
export type DisputeStatus = 'Investigating' | 'Refunded' | 'Resolved';

export interface OrderLine {
  name: string;
  quantity: number;
  unitPrice: number;
  sizeLabel?: string;
  notes: string;
  allergyNotes: string;
  category: string;
  deliveryDate: string;
  isCycle: boolean;
}

export interface Order {
  id: string;
  /** Short human reference (the invoice number place_order mints). */
  orderNumber: string;
  orderId: string;
  userId: string;
  customerName: string;
  status: OrderStatus;
  summaryText: string;
  allergyNotes: string;
  /** "2x Classic Burger, Caesar Salad" */
  itemName: string;
  lines: OrderLine[];
  category: string;
  /** ISO timestamp */
  orderDate: string;
  totalAmount: number;
  subsidyAmount: number;
  deliveryFee: number;
  discountAmount: number;
  rating: number;
  ratingFeedback: string;
  taxInvoiceNumber: string;
  disputeReason: string;
  disputeTicketRef: string;
  disputeReportedAt?: string;
  disputeStatus: DisputeStatus | '';
  deliveryDate: string;
  menuType: MenuType;
  companyId: string;
  locationId: string;
  deliveryFloor: string;
}

export const orderStage = (o: Order) =>
  o.status === 'Preparing' ? 2 : o.status === 'Out for Delivery' ? 3 : o.status === 'Delivered' ? 4 : 1;
export const hasDispute = (o: Order) => !!o.disputeTicketRef;
export const hasRating = (o: Order) => o.rating > 0;
/** Reorder only for the always-available static menu. */
export const canReorder = (o: Order) => o.menuType === 'static';

export interface Discount {
  id: string;
  code: string;
  percentage: number;
  active: boolean;
  /** ISO timestamp */
  expires?: string;
  companyId?: string;
  companyName?: string;
  /** Narrows the code to one menu category / one dish (set outside the MAUI screens). */
  categoryId?: string;
  itemId?: string;
}

export interface NotificationLog {
  id: string;
  title: string;
  body: string;
  targetAudience: string;
  /** ISO timestamp */
  sentAt: string;
  recipientCount: number;
}

export interface CycleMenuDay {
  day: string;
  weekNumber: number;
  /** [label, dish] for the five slots, in MAUI's order. */
  categories: [string, string][];
}

export interface DeliveryDateOption {
  date: string;
  cycleMenu?: CycleMenuDay | null;
}
