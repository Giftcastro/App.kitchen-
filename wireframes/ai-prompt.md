# AI Wireframe Generation Prompt for Kitchen Co.

## Copy and paste this prompt into your AI wireframe tool (Uizard, WireframeAI, Figma AI, etc.)

---

Create a comprehensive mobile app wireframe for **Kitchen Co.**, a food delivery and ordering application.

## App Overview
- **Platform**: iOS/Android mobile app
- **Theme**: Dark mode with orange (#FF6B35) accent color
- **Style**: Modern, clean, Uber-like card-based UI
- **Navigation**: Bottom tab bar with 4-5 tabs

---

## Screen 1: LOGIN / AUTHENTICATION
**Purpose**: Entry point with multiple authentication modes

**Layout**:
- Centered logo at top (white circle with "K" letter)
- App name "Kitchen Co." in bold white
- Tagline: "Delicious meals, delivered fast"
- Horizontal toggle: "Sign In" | "Sign Up"
- Form fields with icons:
  - Email (✉️ icon)
  - Password (🔒 icon) with visibility toggle
- "Remember me" checkbox
- "Forgot password?" link
- Large white "Continue" button
- "Don't have an account? Sign Up" switch text
- Admin detection hint (gold banner with crown icon)

**Special Features**:
- Sign Up mode adds: Full Name, Account Type (Individual/Company), Company Name field
- Forgot Password mode: Lock icon, email field, help text

---

## Screen 2: MAIN MENU (Home)
**Purpose**: Browse and order from menu

**Header**:
- Brand: "Kitchen Co." with "powered by CSG Group" subtitle
- Cart icon (top right) with badge showing item count

**Search Section**:
- Search bar with magnifying glass icon
- Placeholder: "Search dishes, meals..."

**Notice Banner**:
- Gold banner with ⏰ icon
- Text: "48-hour advance ordering cutoff applies"

**Toggle Switch**:
- "Main Menu" | "Today's Menu" toggle
- Active state: orange background

**Category Filters** (Horizontal scrollable chips):
- "All" chip (active state: orange)
- Category chips with emoji icons: 🥗 Salads, 🍝 Pasta, 🍔 Burgers, etc.
- Active chip: orange background, inactive: dark grey with border

**Delivery Estimator Card**:
- Address display
- Delivery time estimate
- Progress bar showing delivery window

**Menu Grid (2 columns)**:
- Card design:
  - Image area (150px height) with emoji/food icon
  - Discount badge (top left, orange "-20%" tag)
  - Quick add button (bottom right, orange circle with "+" or quantity)
  - Content: Item name (bold), description, price (orange, bold)
  - Cards have dark grey background (#1A1D24), rounded corners (20px), subtle border

**Floating Cart Banner** (Bottom, above tab bar):
- Cart icon (orange circle)
- Item count and total
- "View Cart" button

**Bottom Tab Bar**:
- Menu (fast-food icon) - ACTIVE, orange
- Activity (time icon) - inactive
- Orders (receipt icon) - inactive
- Profile (person icon) - inactive

---

## Screen 3: PROFILE SCREEN
**Purpose**: User account management

**Header**:
- "My Profile" title

**Profile Card**:
- Large avatar (white circle, 90px) with user initial
- Green online indicator dot
- User name (bold, large)
- Email address (grey)
- Stats row: "12 Orders" | "R 2,400 Spent"

**Account Section**:
- Section title: "Account" (small, grey, uppercase)
- Card with:
  - Crown icon in circle
  - "Account Type" / "Administrator"
  - Gold "Admin" badge

**Delivery Addresses Section**:
- Header: "Delivery Addresses" + "+ Add" button (white)
- Address cards:
  - Green "Default" badge
  - Label (bold): "Home"
  - Street address
  - Suburb, City, Postal Code
  - "Set as default" link
  - Delete icon (trash emoji)

**Saved Cards Section**:
- Header: "Saved Cards" + "+ Add" button
- Card showing:
  - Card icon (💳 or 💎)
  - Cardholder name
  - Card number (masked)
  - Expiry date
  - Delete button

**Quick Actions Section**:
- Menu card with 3 items:
  1. 🛒 View Cart / Check your items
  2. 📋 Order History / View past orders
  3. 📍 Track Order / Current order status
- Each with arrow (›) indicator

**Sign Out Button**:
- Full-width button with door icon
- Red "Sign Out" text

**Tab Bar**: Profile tab active (orange)

---

## Screen 4: ACTIVITY / PAST ORDERS
**Purpose**: Order history

**Header**:
- "Past Orders" title
- "Your order history" subtitle

**Empty State** (if no orders):
- 📋 emoji
- "No orders yet" title
- Help text
- "Browse Menu" button

**Order Cards** (List):
- Order ID (bold, e.g., "ORD-1234")
- Date/time (e.g., "2 days ago")
- Total amount (right-aligned, bold)
- Item count badge
- Item preview chips (horizontal scroll):
  - "2x Chicken Burger"
  - "1x Caesar Salad"
  - "+3 more"
- Delivery address section:
  - 📍 icon
  - Address label
  - Full address
- Footer:
  - Status badge (colored dot + text): "Delivered" (green)
  - "Reorder" button (white)

**Tab Bar**: Activity tab active (orange)

---

## Screen 5: ORDER TRACKER
**Purpose**: Real-time order status tracking

**Header**:
- "Order Status" title
- "Order ORD-1234" subtitle

**Tracker Card**:
- Icon (⏱️, 🚴, ✓) in white circle (52px)
- Title: "In the Kitchen"
- Subtitle: "Estimated 15-20 mins"
- Progress bar:
  - Background: dark grey
  - Fill: white (60% width)
  - Rounded ends

**4-Step Progress Tracker**:
- Icons: Time → Restaurant → Bicycle → Checkmark
- Labels: Received → Preparing → On The Way → Delivered
- Active step: blue icon
- Completed steps: green with checkmark
- Inactive: grey outline

**Your Items Section**:
- Section header: "Your Items (3)"
- Item cards:
  - Food emoji icon in circle
  - Item name (bold)
  - Size/category (grey)
  - Quantity: "x2"
  - Price: "R 160.00"

**Order Summary Card**:
- Subtotal: R 240.00
- Delivery: Free (green)
- Divider line
- Total: R 240.00 (bold, larger)

**Tab Bar**: Orders tab active (orange)

---

## Screen 6: ADMIN DASHBOARD
**Purpose**: Restaurant management (admin only)

**Header**:
- "Kitchen Dashboard" title
- "Your restaurant at a glance" subtitle

**Bottom Tab Navigation** (Horizontal scroll):
- Dashboard (speedometer) - ACTIVE, white
- Users (people)
- Orders (receipt)
- Weeks (calendar)
- Meals (restaurant)
- Discounts (pricetag)

**Stats Grid (2x2)**:
- Total Users: 24 (blue icon)
- Total Orders: 156 (green icon)
- In Progress: 12 (orange icon)
- Revenue: R 18,420 (white icon)

**Order Status Breakdown**:
- Horizontal bar charts:
  - Pending: 8 (orange)
  - Preparing: 4 (blue)
  - On The Way: 2 (green)
  - Delivered: 142 (grey)

**Active Week Card**:
- Calendar icon
- "Active Menu Cycle: Week 3"
- "Change" button

**Recent Orders List**:
- Order ID, user name, total, status badge
- Expandable to show items

**Users Section**:
- User cards with avatar, name, email, role badge
- Delete button (trash icon)

**Menu Management**:
- Category filter chips (horizontal scroll)
- Menu items list with edit/delete actions
- Add item button (+)

**Discounts Section**:
- Discount code cards
- Toggle switch (active/inactive)
- Percentage and expiry info

**Tab Bar**: Admin tab active (white)

---

## Screen 7: ADD TO CART MODAL
**Purpose**: Item customization before adding to cart

**Layout** (Slide-up modal, 85% screen height):
- Dark overlay background (85% opacity)
- White modal card (rounded top corners, 28px radius)

**Modal Header**:
- "Customize Order" title (bold, 22px)
- Close button (✕, grey, 28px)

**Item Info Section**:
- Food emoji (40px)
- Item name (bold)
- Price (orange, bold, 18px)
- Meal type (if applicable, grey)

**Special Instructions Section**:
- Label: "Special Instructions / Allergies" (uppercase, grey)
- Textarea (4 lines, dark background, rounded)
- Placeholder: "e.g., No onions, allergy to nuts..."

**Add to Cart Button**:
- Full-width, orange background
- "Add to Cart" text (white, bold)
- Shadow effect

---

## Screen 8: TODAY'S MENU (Cycle Menu)
**Purpose**: Weekly rotating menu

**Toggle**: "Main Menu" | "Today's Menu" (Today's active)

**Hero Card**:
- 📅 emoji (32px)
- "Week 3 Menu" title
- "All items R80.00 • Freshly prepared"
- Badges: "Week 3" | "R80 flat"

**Today Indicator**:
- Green text: "Today is Wednesday"

**Day Header**:
- Green dot + "Wednesday" (green bold)
- "4 meals" count

**Today's Meals Grid (2 columns)**:
- Cards with green border
- TODAY badge (green, top left)
- Meal type icon (48px)
- Meal type label (e.g., "MAIN MEAL", colored)
- Meal name
- Price: R80

**Floating Cart Banner**: Same as main menu

**Tab Bar**: Menu tab active

---

## Navigation Flow
1. **Login** → **Main Menu** (after authentication)
2. **Main Menu** has 4 tabs:
   - Menu (home)
   - Activity (past orders)
   - Orders (order tracker)
   - Profile
3. **Admin users** see additional "Admin" tab
4. **Profile** links to:
   - Cart
   - Activity
   - Tracker
5. **Menu** flows to:
   - Item detail modal
   - Cart
   - Checkout

---

## Design Specifications

**Color Palette**:
- Background: #121212 (near black)
- Surface: #1A1D24 (dark grey)
- Card: #1A1A1A (profile), #1A1D24 (menu)
- Border: #2E3340, #2C2C2E
- Primary Accent: #FF6B35 (orange)
- Success: #22C55E (green)
- Info: #5AC8FA (blue)
- Warning: #FF9500, #FFD60A (gold/yellow)
- Error: #FF453A (red)
- Text Primary: #F5F7FA (white)
- Text Secondary: #8E8E93, #9AA3B2 (grey)
- Text Tertiary: #6B6B6B, #6B7280 (dark grey)

**Typography**:
- Headings: Bold, 900 weight, letter-spacing: -0.5
- Body: 14-16px, weight 500-700
- Labels: 12px, uppercase, letter-spacing: 0.5-1.2

**Spacing**:
- Card padding: 16-24px
- Card radius: 16-24px
- Button radius: 14-16px
- Input radius: 14px
- Gap between elements: 8-16px

**Shadows**:
- Cards: shadowOpacity 0.3-0.4, shadowRadius 12-16
- Buttons: shadowOpacity 0.2-0.3, shadowRadius 8-12
- Elevation: 5-10

---

## Interactive Elements

**Buttons**:
- Primary: Orange background, white text, rounded (16px)
- Secondary: White background, black text
- Destructive: Red (#FF453A) background

**Inputs**:
- Dark background (#1E1E1E)
- Border: 1.5px, grey (#2C2C2E)
- Icon prefix (emoji)
- Height: 54px
- Radius: 14px

**Cards**:
- Background: #1A1D24 or #1A1A1A
- Border: 1px, grey
- Radius: 20px
- Shadow: subtle, dark

**Badges**:
- Rounded pills (border-radius: 12-20px)
- Small padding (4-8px vertical, 8-12px horizontal)
- Bold, uppercase text

---

## Additional Notes

- All screens use SafeAreaView with dark background
- StatusBar: light-content, dark background
- Loading states: skeleton screens
- Empty states: centered icon + title + subtitle + CTA button
- All modals: slide-up from bottom, 85% opacity overlay
- Tab bar: 60-70px height, dark background, top border
- Active tab: orange icon and label
- Inactive tab: grey (#6B7280)

---

Generate high-fidelity wireframes showing:
1. All 8 screens listed above
2. Navigation flow between screens
3. Modal overlays
4. Empty states
5. Interactive states (active, disabled, loading)
6. Responsive layouts for different screen sizes

Use the design specifications provided to maintain consistency across all screens. Show realistic content placeholders (food items, user names, addresses, order numbers).