# Kitchen Co. App - AI Wireframe Prompt Part 5 of 5 (FINAL PART)

---

## SCREEN 6 CONTINUED: ADMIN DASHBOARD SUBSECTIONS

### USERS MANAGEMENT
**Header**: "User Management" + "24 registered users" + Add button (+)

**User Cards** (list):
- Avatar circle (40px, colored bg based on role)
  - Admin: yellow (#FFD60A)
  - User: blue (#5AC8FA)
- User initial (bold, colored)
- User name (bold, white)
- Email (grey)
- Meta: "Joined 15 Jan 2025 • 12 orders"
- Admin badge (gold, for admin users)
- Delete button (trash icon, red, admin only)

### ORDERS MANAGEMENT
**Header**: "All Orders" + "156 total orders"

**Expandable Order Cards**:
- Header:
  - Order ID (bold) + user name
  - Status badge (colored, right)
  - Date (grey, small)
- Expanded content (when tapped):
  - Divider line
  - Item rows:
    - "2x Chicken Burger — Regular" (name + size)
    - Price (right aligned)
  - Divider
  - Total row (bold)
  - Address with 📍 icon

### WEEKS MANAGEMENT
**Header**: "Menu Cycles" + "Select which week is active"

**Weeks Grid** (2 columns):
- Week cards (1-8):
  - Week number (bold, 32px)
  - "Week X" label
  - Active checkmark (green, for active week)
  - Active state: green border, green text
  - Inactive: grey border

**Info Card**:
- ℹ️ icon (blue)
- "Currently Active: Week X menu is being shown to customers"

### MEALS MANAGEMENT
**Header**: "Menu Management" + category count + Add button

**Category Filter** (horizontal chips):
- "All Categories" + individual categories
- Scrollable

**Menu Items List**:
- Category header: name + item count
- Item cards:
  - Item name (bold)
  - Price (orange)
  - Description (grey, 2 lines)
  - Edit (✏️ blue) + Delete (🗑️ red) buttons

**Add/Edit Modals**:
- Item name input
- Price input
- Description textarea
- Category selector (horizontal chips)

### DISCOUNTS MANAGEMENT
**Header**: "Discount Codes" + count + Add button

**Discount Cards**:
- Top row:
  - Code tag (dark bg, rounded, bold text)
  - Percentage: "-20% OFF"
  - Toggle switch (right, on/off)
- Bottom row:
  - Expiry date or "No expiry"
  - Delete icon (red)

**Add Discount Modal**:
- Code input (e.g., "SAVE20")
- Percentage input
- Company input (optional)
- Category picker (horizontal chips, optional)
- Item picker (if category selected, optional)
- Cancel + Add buttons

---

## SCREEN 9: CART SCREEN

**Header**:
- "Your Cart" - bold white
- Item count badge

**Cart Items List**:
Each item card:
- Food emoji (40px)
- Item name (bold)
- Size/notes (grey)
- Quantity controls (- / 2 / +)
- Price (right, bold)

**Order Summary**:
- Subtotal
- Delivery fee (or Free)
- Discount (if applied)
- Divider
- Total (bold, larger)

**Delivery Address**:
- 📍 icon
- Address display
- "Change" link

**Payment Method**:
- 💳 icon
- Card info
- "Change" link

**Checkout Button**:
- Full width, orange
- "Place Order" text

---

## ADDITIONAL EMPTY STATES

### No Menu Items
- 🍽️ emoji
- "No items found"
- "Try different keywords"
- Search clear button

### No Past Orders
- ✨ emoji
- "No past orders yet"
- "Your current order is active"
- Help text

### No Active Order (Tracker)
- 📋 emoji
- "No active order"
- "When you place an order..."
- Help text

### No Addresses
- 📍 emoji
- "No addresses saved yet"
- "Tap to add your first delivery address"

### No Cards
- 💳 emoji
- "No cards saved yet"
- "Save a card at checkout"

---

## MODAL PATTERNS

### Add Address Modal
**Slide-up modal**:
- Title: "Add Delivery Address"
- Close button (✕)
- Form fields:
  - Label input (e.g., "Home")
  - Street (required)
  - Row: Suburb + City
  - Postal code
- Save button (white, disabled if required fields empty)

### Delete Confirmation Modal
**Center modal** (fade in):
- 🗑️ icon (40px)
- "Remove Address?" title
- "This action cannot be undone" text
- Two buttons: Cancel + Remove (red)

---

## RESPONSIVE BEHAVIOR

### iPhone SE (375px width)
- Standard layout as described
- 2-column grid works well
- All text sizes remain

### iPhone Pro Max (430px width)
- Slightly larger cards
- More padding
- Same grid layout

### Android (360-412px)
- Minor adjustments
- Safe area handling

### Tablet (768px+)
- Optional: 3-column grid for menu
- Side-by-side layout for profile sections
- Admin dashboard: full width utilization

---

## IMAGE/ICON GUIDELINES

### Emoji Usage
- Menu items: food emoji (🍔, 🥗, 🍝, etc.)
- Categories: category emoji
- Actions: meaningful emoji (🛒, 📋, 📍)
- Status: status emoji (✅, ⏰, 🚴)

### Icon Containers
- Always use circular or rounded square backgrounds
- Size based on context (36-90px)
- Consistent border styling

### Placeholder Images
- If no image: use emoji in colored bg
- Background: #22262F or category color
- Center emoji: 48-64px

---

## EDGE CASES

### Loading States
- Skeleton screens for lists
- Shimmer effect (light grey moving gradient)
- Placeholder rectangles matching content size

### Error States
- Red accent borders
- Error message below field
- Retry button where applicable

### Empty States
- Centered icon (56-64px)
- Title (bold, white)
- Subtitle (grey)
- CTA button (white)

### Success States
- Green checkmark
- "Success" message
- Auto-dismiss or button to continue

---

## FINAL CHECKLIST

Generate wireframes showing:
✓ All 8 main screens
✓ All modal overlays
✓ Empty states for each section
✓ Loading/skeleton states
✓ Error states
✓ Active/selected states
✓ Disabled states
✓ Responsive variations
✓ Navigation flow
✓ Gesture indicators (swipe, tap)
✓ Safe area handling
✓ Dark theme consistency
✓ Orange accent usage
✓ Card shadows and borders
✓ Typography hierarchy
✓ Touch target sizes

---

**REMEMBER**: 
- Dark theme throughout (#121212 background)
- Orange (#FF6B35) as primary accent
- White text on dark backgrounds
- Rounded corners (16-24px)
- Subtle shadows for depth
- Card-based layout
- Bottom tab navigation
- Consistent spacing (8px grid)
- All interactive elements clearly visible
- Realistic food content placeholders