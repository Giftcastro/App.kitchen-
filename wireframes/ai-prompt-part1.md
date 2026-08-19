# Kitchen Co. App - AI Wireframe Prompt Part 1 of 5

## Copy this part first, then continue with parts 2-5

---

Create a mobile app wireframe for **Kitchen Co.**, a food delivery app.

**Platform**: iOS/Android
**Theme**: Dark mode with orange (#FF6B35) accent
**Style**: Modern, clean, card-based UI like Uber Eats

---

## SCREEN 1: LOGIN

**Layout** (centered vertically):
- White circle logo (100px) with black "K" letter
- "Kitchen Co." - bold white text, 34px
- "Delicious meals, delivered fast" - grey text, 15px
- Blue accent line below tagline

**Mode Toggle**:
- Two tabs: "Sign In" | "Sign Up"
- Dark grey background (#1E1E1E), rounded 16px
- Active tab: white background

**Sign In Form**:
- Label: "EMAIL ADDRESS" (12px, grey, uppercase)
- Input field (54px height, dark grey bg, border radius 14px)
  - ✉️ icon on left
  - Placeholder: "name@gmail.com"
- Label: "PASSWORD"
- Input field with 🔒 icon
  - Eye toggle button on right
- Row: "Remember me" checkbox + "Forgot password?" link

**Button**: White "Sign In" button, full width, rounded 14px

**Bottom Text**: "Don't have an account? Sign Up" (blue link)

**Admin Hint** (if admin email detected):
- Gold banner with 👑 icon
- "Admin access detected" text

---

## SCREEN 2: MAIN MENU

**Header**:
- "Kitchen Co." brand (centered)
- Subtitle: "powered by CSG Group" (small, grey)
- Cart icon (top right, 44px circle with badge)

**Search Bar**:
- 44px height, dark grey bg, rounded 14px
- 🔍 icon + placeholder text

**Gold Banner** (⏰ icon):
- "48-hour advance ordering cutoff applies"
- Background: #2A1F00, border: #4A3F00

**Toggle Switch**:
- "Main Menu" | "Today's Menu"
- Active: orange bg (#FF6B35)

**Category Chips** (horizontal scroll):
- "All" - orange when active
- Chips with emoji: 🥗 Salads, 🍝 Pasta, 🍔 Burgers
- Inactive: dark grey with border, 36px height, rounded 20px
- Active: orange bg, white text

**Delivery Estimator Card**:
- 16px padding, rounded 16px
- Title: "Delivery to Home"
- Badge: "60-90 min" (green bg)
- Progress bar (8px height, white fill)

**Menu Grid** (2 columns, 12px gap):
Cards (each):
- Image section (150px height, #22262F bg)
  - Food emoji (64px) centered
  - Discount badge (top left, orange "-20%")
  - Quick add button (bottom right, orange circle 36px with "+" or number)
- Content section (14px padding):
  - Item name (bold, white, 14px)
  - Description (grey, 12px, 2 lines max)
  - Price (orange, bold, 16px)

**Floating Cart Banner** (bottom):
- Above tab bar, 64px height
- Orange cart icon (40px circle)
- Item count + total text
- "View Cart" badge (orange)

**Tab Bar** (bottom, 70px height):
- Menu (fast-food icon) - ACTIVE orange
- Activity (time icon) - grey
- Orders (receipt icon) - grey
- Profile (person icon) - grey

---

## SCREEN 3: PROFILE

**Header**: "My Profile" (bold, 28px)

**Profile Card** (centered, rounded 24px):
- Avatar: white circle 90px with user initial
- Green online dot (bottom right, 18px)
- User name (bold, 22px)
- Email (grey, 14px)
- Stats row (divider line):
  - "12 Orders" | "R 2,400 Spent"

**Account Section**:
- Title: "ACCOUNT" (grey, uppercase, 13px)
- Card with 👑 icon (44px circle)
- "Account Type" / "Administrator"
- Gold "Admin" badge (right side)

**Delivery Addresses**:
- Header: "Delivery Addresses" + "+ Add" button
- Address card:
  - Green "Default" badge
  - Label: "Home" (bold)
  - Street, Suburb, City, Code
  - "Set as default" link (blue)
  - 🗑️ delete icon

**Saved Cards**:
- Header: "Saved Cards" + "+ Add" button
- Card with 💳 icon
- Cardholder name (bold)
- Card number (masked)
- Expiry date
- Delete button

**Quick Actions** (menu card):
- 🛒 View Cart / Check items
- 📋 Order History / View past
- 📍 Track Order / Current status
- Each with › arrow

**Sign Out Button**:
- Full width, dark bg, red text
- 🚪 icon + "Sign Out"

**Tab Bar**: Profile active (orange)

---