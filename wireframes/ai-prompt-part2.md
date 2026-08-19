# Kitchen Co. App - AI Wireframe Prompt Part 2 of 5

---

## SCREEN 4: ACTIVITY / PAST ORDERS

**Header**:
- "Past Orders" - bold white, 28px
- "Your order history" - grey, 14px

**Empty State** (when no orders):
- 📋 emoji (56px)
- "No orders yet" - bold white, 18px
- Help text (grey, 14px)
- "Browse Menu" button (white, rounded 14px)

**Order Cards** (vertical list):
Each card (dark grey bg, rounded 20px, 16px padding):
- **Header row**:
  - Left: Order ID (bold, 16px) + date (grey, 12px)
  - Right: Total (bold, 18px) + item count badge (dark bg, rounded 8px)
- **Item preview chips** (horizontal scroll, gap 8px):
  - Rounded 10px, dark bg, border
  - Text: "2x Chicken Burger"
  - "+3 more" chip (grey bg)
- **Address section** (dark bg, rounded 12px):
  - 📍 icon (36px circle)
  - Label (bold) + full address (2 lines, grey)
- **Footer** (divider line above):
  - Status badge (colored dot + text): "Delivered" (green)
  - "Reorder" button (white, rounded 10px)

**Tab Bar**: Activity tab active (orange)

---

## SCREEN 5: ORDER TRACKER

**Header**:
- "Order Status" - bold, 28px
- "Order ORD-1234" - grey, 14px

**Tracker Card** (rounded 24px, padding 24px):
- **Header**:
  - Icon (⏱️/🚴/✓) in white circle (52px)
  - Title: "In the Kitchen" (bold, 18px)
  - Subtitle: "Estimated 15-20 mins" (grey, 13px)
- **Progress bar**:
  - 8px height, dark grey bg
  - White fill (rounded ends)
  - Width: 60%
- **4-step tracker** (horizontal, space-between):
  1. Time icon - "Received"
  2. Restaurant icon - "Preparing" (ACTIVE, blue)
  3. Bicycle icon - "On The Way"
  4. Checkmark icon - "Delivered"
  - Active: colored icon circle (36px)
  - Completed: green with checkmark
  - Inactive: grey outline

**Your Items Section**:
- Header: "Your Items (3)" (uppercase, grey, 13px) + count badge
- Item cards (horizontal list):
  - Food emoji (44px circle, dark bg)
  - Item name (bold, 14px)
  - Size/category (grey, 12px)
  - Right side: "x2" + "R 160.00" (bold)

**Order Summary Card**:
- Subtotal row: "R 240.00"
- Delivery row: "Free" (green)
- Divider line (1px, grey)
- Total row: "R 240.00" (bold, 18px)

**Tab Bar**: Orders tab active (orange)

---

## SCREEN 6: ADMIN DASHBOARD

**Header**:
- "Kitchen Dashboard" - bold white
- "Your restaurant at a glance" - grey

**Admin Bottom Tabs** (horizontal scroll, 6 tabs):
- Dashboard (speedometer icon)
- Users (people icon)
- Orders (receipt icon)
- Weeks (calendar icon)
- Meals (restaurant icon)
- Discounts (pricetag icon)
- Active tab: white icon + white label
- Inactive: grey

**Stats Grid** (2x2, gap 12px):
Cards (each with colored icon bg, rounded 16px):
1. Total Users: 24 (blue #5AC8FA)
2. Total Orders: 156 (green #22C55E)
3. In Progress: 12 (orange #FF9500)
4. Revenue: R 18,420 (white)
- Icon (40px circle) + number (bold, 24px) + label (grey, 12px)

**Order Status Breakdown** (card):
- Title: "Order Status Breakdown"
- 4 rows (each):
  - Colored dot + label (e.g., "Pending")
  - Bar chart (dark bg, colored fill)
  - Count number (right)

**Active Week Card**:
- Calendar icon (24px, green)
- "Active Menu Cycle: Week 3"
- "Change" button (outlined)

**Recent Orders** (expandable list):
- Header: "Recent Orders" + "See All" link
- Order item:
  - Status dot (colored) + Order ID
  - User name
  - Total (right) + status badge

**Tab Bar**: Admin tab active (white)

---