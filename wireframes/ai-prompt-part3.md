# Kitchen Co. App - AI Wireframe Prompt Part 3 of 5

---

## SCREEN 7: ADD TO CART MODAL

**Type**: Slide-up modal (85% screen height)

**Overlay**: Dark background (85% opacity black)

**Modal Card** (bottom sheet):
- Background: #1A1D24
- Top border radius: 28px
- Padding: 24px
- Top border: 1px, #2E3340

**Header**:
- "Customize Order" - bold white, 22px
- Close button (✕) - grey, 28px, right side

**Item Info Section** (card, dark bg):
- Food emoji (40px) on left
- Item name (bold, white)
- Price (orange, bold, 18px)
- Meal type (if applicable, grey, 13px)

**Special Instructions Section**:
- Label: "SPECIAL INSTRUCTIONS / ALLERGIES" (uppercase, grey, 13px)
- Textarea:
  - 4 lines minimum height
  - Dark bg (#14171C)
  - Border: 1px, #2E3340
  - Rounded 16px
  - Placeholder: "e.g., No onions, allergy to nuts, extra sauce..."

**Add to Cart Button**:
- Full width
- Orange bg (#FF6B35)
- White text "Add to Cart" (bold, 16px)
- Rounded 16px
- Shadow: orange glow

---

## SCREEN 8: TODAY'S MENU (CYCLE MENU)

**Toggle**: "Main Menu" | "Today's Menu" (Today's active, orange)

**Hero Card** (centered, rounded 20px):
- 📅 emoji (32px)
- "Week 3 Menu" - bold white, 18px
- "All items R80.00 • Freshly prepared" - grey, 13px
- Badges row: "Week 3" | "R80 flat" (dark bg, rounded 20px)

**Today Indicator** (centered banner):
- Background: #22262F, border: 1px #2E3340
- Rounded 16px
- Green text: "Today is Wednesday"
- "Wednesday" in bold green

**Day Header**:
- Green dot (8px) + "Wednesday" (bold, green, 15px)
- "4 meals" count (grey, 12px)

**Today's Meals Grid** (2 columns):
Cards (green border #22C55E):
- Image section:
  - TODAY badge (green, top left, 12px padding)
  - Meal type icon (48px, colored bg)
- Content:
  - Meal type label (uppercase, colored, 10px)
  - Meal name (bold, white)
  - Price: "R80" (orange, bold)

**Floating Cart Banner**: Same as main menu

**Tab Bar**: Menu tab active (orange)

---

## NAVIGATION FLOW DIAGRAM

**Primary Flow**:
```
Login Screen
    ↓
Main Menu (Home)
    ↓
[Browse Menu] → [Select Item] → [Add to Cart Modal] → [Cart] → [Checkout]
    ↓
[Today's Menu] (toggle)
    ↓
Profile Tab ← → Activity Tab ← → Orders Tab
    ↓
Admin Tab (if admin user)
    ↓
Admin Dashboard
```

**Secondary Flows**:
- Profile → View Cart
- Profile → Order History
- Profile → Track Order
- Profile → Add Address Modal
- Profile → Add Card Modal
- Admin → Users Management
- Admin → Orders Management
- Admin → Menu Management
- Admin → Discounts Management
- Admin → Week Cycle Control

**Modal Stack**:
- Add to Cart (from menu items)
- Add Address (from profile)
- Delete Confirmation (address/card)
- Add Discount (admin)
- Add User (admin)
- Add/Edit Menu Item (admin)

---

## DESIGN SPECIFICATIONS

### Color System

**Primary Colors**:
- Background: #121212 (near black)
- Surface Primary: #1A1D24 (dark grey)
- Surface Secondary: #1E1E1E
- Surface Tertiary: #22262F

**Card Colors**:
- Menu Cards: #1A1D24
- Profile Cards: #1A1A1A
- Input Fields: #1E1E1E

**Border Colors**:
- Primary Border: #2E3340
- Secondary Border: #2C2C2E
- Tertiary Border: #1C1C1E

**Accent Colors**:
- Primary (Orange): #FF6B35
- Success (Green): #22C55E
- Info (Blue): #5AC8FA
- Warning (Gold): #FFD60A, #FF9500
- Error (Red): #FF453A

**Text Colors**:
- Primary: #F5F7FA (white)
- Secondary: #9AA3B2, #8E8E93 (grey)
- Tertiary: #6B6B6B, #6B7280 (dark grey)
- Inverse: #000000 (on white buttons)

---

### Typography Scale

**Font Family**: System default (-apple-system, Roboto, Segoe UI)

**Weights**:
- Black: 900 (headings, prices)
- Bold: 700-800 (subheadings, buttons)
- SemiBold: 600 (labels, metadata)
- Medium: 500 (body text)
- Regular: 400 (descriptions)

**Sizes**:
- Display: 34px (app name)
- H1: 28px (screen titles)
- H2: 22px (modal titles)
- H3: 18px (card titles)
- H4: 16px (item names)
- Body: 14-15px (descriptions)
- Small: 12-13px (labels, metadata)
- Tiny: 10-11px (badges, hints)

**Letter Spacing**:
- Headings: -0.5 to -0.3
- Labels: 0.5 to 1.2 (uppercase)
- Body: 0 (normal)
- Buttons: -0.2 to -0.4

**Line Heights**:
- Headings: 1.2-1.3
- Body: 1.4-1.5
- Buttons: 1.0

---