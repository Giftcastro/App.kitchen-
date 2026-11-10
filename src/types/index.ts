export interface CompanyDomain {
  id: string;
  domain: string;
  companyName: string;
  locationName: string;
  buildingName: string;
  deliveryFloor?: string;
  distanceKm?: number;
  isActive: boolean;
}

export type UserRole = 'admin' | 'chef' | 'user';

export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  phoneNumber: string;
  role: UserRole;
  companyId: string;
  companyName: string;
  locationName: string;
  buildingName: string;
  deliveryFloor: string;
  avatarId?: string;
  createdAt: string;
}

export type DietaryTag = 
  | 'Vegetarian' 
  | 'Halaal' 
  | 'Gluten-Free' 
  | 'Vegan' 
  | 'Dairy-Free' 
  | 'Low Carb' 
  | 'Nut-Free';

export type MenuType = 'standard' | 'chefs_choice';

export interface MenuAddOn {
  name: string;
  price: number;
}

export interface MenuItemPrices {
  standard: number;
  large?: number;
}

export interface MenuCategory {
  id: string;
  name: string;
  slug: string;
  menuType: MenuType;
  heroImage: string;
  displayOrder: number;
  isActive?: boolean;
  addOns?: MenuAddOn[];
}

export interface MenuItem {
  id: string;
  categoryId: string;
  name: string;
  description: string;
  ingredients: string;
  dietaryTags: DietaryTag[];
  price: number; // Base standard price
  prices?: MenuItemPrices;
  addOns?: MenuAddOn[];
  categoryName?: string;
  menuType: MenuType;
  isAvailable: boolean;
  calories?: number;
}

export interface CartItem {
  id: string;
  menuItem: MenuItem;
  quantity: number;
  size?: 'standard' | 'large';
  selectedAddOns?: MenuAddOn[];
  allergyNotes?: string;
  targetDeliveryDate: string; // YYYY-MM-DD
  unitPrice: number;
  totalPrice: number;
}

export interface CycleDayPlan {
  day: 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday';
  main_meal: string;
  vegetarian_meal: string;
  healthy_meal: string;
  curry_of_the_day: string;
  gourmet_sandwich: string;
}

export interface CycleWeekPlan {
  week: number;
  days: CycleDayPlan[];
}

export interface DeliveryDateOption {
  dateString: string; // YYYY-MM-DD
  dayName: string; // e.g. "Wed"
  dayNumber: number; // e.g. 26
  monthName: string; // e.g. "Aug"
  year: number;
  fullFormattedDate: string; // e.g. "Wednesday, 26 Aug 2026"
  isAvailable: boolean;
  isLocked: boolean;
  isHoliday: boolean;
  holidayName?: string;
  cutoffDeadlineFormatted: string; // e.g. "Monday, 24 Aug at 9:00 AM SAST"
  noticeBannerText: string;
}

export type ThemeMode = 'system' | 'dark' | 'light';
export type BrandTheme = 'Current' | 'MediterraneanPantry';

export interface ThemeColors {
  background: string;
  backgroundSecondary: string;
  surface: string;
  surfaceElevated: string;
  surfaceHighlight: string;
  surfaceBorder: string;
  surfaceBorderLight: string;
  primary: string;
  primaryLight: string;
  primaryDark: string;
  primaryMuted: string;
  primaryGlow: string;
  onPrimary: string;
  brandGold: string;
  onBrandGold: string;
  chipBg: string;
  subtleFill: string;
  subtleFillStrong: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  textInverse: string;
  goldWarning: string;
  goldWarningSurface: string;
  goldWarningBorder: string;
  error: string;
  errorSurface: string;
  errorBorder: string;
  success: string;
  successSurface: string;
  successBorder: string;
  inputBackground: string;
  inputBorder: string;
  inputBorderFocus: string;
  buttonDisabled: string;
  buttonDisabledText: string;
  tagBackground: string;
  tagBorder: string;
  tagText: string;
  glassBackground: string;
  glassBorder: string;
  glassPill: string;
  overlay: string;
  isDark: boolean;
}

export interface BroadcastNotification {
  id: string;
  title: string;
  body: string;
  targetAudience: 'all' | 'company' | 'user' | string;
  companyId?: string;
  targetUserId?: string;
  deliveryDate?: string;
  recipientCount: number;
  sentAt: string;
  channel: 'kitchenco' | 'company' | 'me';
}

export interface SupportComplaintTicket {
  id: string;
  ticketRef: string;
  userId: string;
  userEmail: string;
  problemType: 'order_not_arrived' | 'cancellation' | 'quality_issue' | 'other';
  orderId?: string;
  orderNumber?: string;
  details: string;
  status: 'pending' | 'investigating' | 'resolved';
  createdAt: string;
}

export interface DropoffFloor {
  id: string;
  label: string;
  description: string;
  isDefault?: boolean;
}

export type OrderStatus =
  | 'pending_payment'
  | 'paid_scheduled'
  | 'kitchen_prepping'
  | 'out_for_delivery'
  | 'delivered'
  | 'unfulfilled'
  | 'cancelled';

export interface OrderRating {
  rating: number; // 1 to 5 stars
  feedback?: string;
  submittedAt: string;
}

export interface DisputeInfo {
  reportedAt: string;
  reason: string;
  supportTicketRef: string; // e.g. "TCK-88219"
  status: 'investigating' | 'refunded' | 'resolved';
}

export interface OrderHistoryItem {
  id: string;
  userId?: string;
  customerName?: string;
  customerEmail?: string;
  companyName?: string;
  orderNumber: string; // e.g. "ORD-2026-0826-KCO"
  targetDeliveryDate: string; // YYYY-MM-DD
  deliveryDateFormatted: string;
  deliverySlot: string; // "12:00 PM Sharp"
  deliveryFloor: string;
  companyLocation: string;
  items: CartItem[];
  itemSubtotal: number;
  discountType?: 'percentage' | 'fixed_zar';
  discountValue?: number;
  discountZar?: number;
  discountPercentage?: number;
  deliveryFee: number;
  vatAmount: number; // 0 or omitted
  totalPaid: number;
  paymentMethod: 'Instant EFT' | 'Credit/Debit Card' | 'Masterpass' | 'PayFast Sandbox';
  paymentReference: string;
  status: OrderStatus;
  stage: 1 | 2 | 3 | 4;
  createdAt: string;
  itnVerifiedAt?: string;
  taxInvoiceNumber: string; // e.g. "INV-KC-2608-0192"
  rating?: OrderRating;
  dispute?: DisputeInfo;
}

// --- Screen 7 Admin & Dispatch Types ---
export type AdminRoute =
  | 'overview'
  | 'active-orders'
  | 'companies'
  | 'notifications'
  | 'menu'
  | 'users'
  | 'reports'
  | 'settings';

export type ActiveOrderStatusFilter = 'all' | 'preparing' | 'out_for_delivery' | 'delivered';

export interface EmailRoutingDirectory {
  helpSupport: string;
  billingInvoices: string;
  kitchen: string;
  appSender: string;
  adminBackup: string;
  platformMaster: string;
}

export type AdminTab = 'dispatch' | 'menu' | 'cycle' | 'analytics' | 'accounts' | 'broadcasts' | AdminRoute;

export interface AggregatedPrepItem {
  dishId: string;
  dishName: string;
  categoryName: string;
  totalQuantity: number;
  allergyFlagsCount: number;
  allergyNotesSummary?: string[];
}

export interface BatchSiteRecipient {
  orderId?: string;
  orderNumber: string;
  customerName?: string;
  clientName?: string;
  email?: string;
  clientEmail?: string;
  mealName?: string;
  mealsSummary?: string;
  quantity?: number;
  allergyNotes?: string;
}

export interface BatchSiteGroup {
  id: string; // unique site ID
  companyName: string;
  locationName?: string;
  deliveryFloor: string;
  totalMeals: number;
  status: OrderStatus;
  recipients: BatchSiteRecipient[];
}

export interface CycleWeekConfig {
  weekNumber: number; // 1 to 8
  title: string;
  description: string;
  mealCount: number;
  status: 'active_now' | 'scheduled_next' | 'inactive';
}

export interface CorporateAccount {
  id: string;
  companyName: string;
  domains: string[];
  activeUsersCount: number;
  locations: string[];
  distanceKm: number;
  discountType?: 'percentage' | 'fixed_zar';
  discountValue?: number; // e.g. 10 for 10% or 25 for R25.00
  discountPercentage?: number; // legacy backward compatibility
  billingEmail?: string;
  mealSubsidyAmount?: number;
  deliveryFeeMode?: 'free' | 'flat' | 'distance';
  flatFeeAmount?: number;
  isActive?: boolean;
  createdAt: string;
}

export interface DeliveryFeeTier {
  minKm: number;
  maxKm: number;
  feeZar: number;
  label: string;
}
