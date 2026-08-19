# Kitchen Co. App - AI Wireframe Prompt Part 4 of 5

---

### Spacing System

**Base Unit**: 8px grid

**Common Spacing**:
- xs: 4px
- sm: 8px
- md: 12px
- lg: 16px
- xl: 20px
- 2xl: 24px
- 3xl: 32px
- 4xl: 40px

**Component Spacing**:
- Card padding: 16-24px
- Card margin: 12-16px
- Button padding: 14-18px vertical, 24-32px horizontal
- Input padding: 14-16px
- Icon margins: 8-16px
- Section gaps: 24-32px

---

### Shadow Specifications

**Elevation 1** (subtle, cards):
- shadowOpacity: 0.2
- shadowRadius: 8
- shadowOffset: { height: 2, width: 0 }

**Elevation 2** (cards):
- shadowOpacity: 0.3
- shadowRadius: 12
- shadowOffset: { height: 4, width: 0 }

**Elevation 3** (elevated cards):
- shadowOpacity: 0.4
- shadowRadius: 16
- shadowOffset: { height: 6, width: 0 }

**Elevation 4** (modals, dropdowns):
- shadowOpacity: 0.6
- shadowRadius: 20
- shadowOffset: { height: 10, width: 0 }

**Button Shadows**:
- Orange buttons: orange glow (shadowOpacity: 0.3)
- White buttons: white glow (shadowOpacity: 0.2)

---

## COMPONENT SPECIFICATIONS

### Buttons

**Primary Button**:
- Background: #FF6B35
- Text: White, bold 16px
- Padding: 18px vertical, 24px horizontal
- Border radius: 16px
- Shadow: orange glow
- Min height: 54px

**Secondary Button**:
- Background: #FFFFFF
- Text: Black, bold 15px
- Padding: 14px vertical, 20px horizontal
- Border radius: 14px
- Shadow: white glow

**Destructive Button**:
- Background: #FF453A
- Text: White, bold 15px
- Same padding as secondary

**Ghost Button**:
- Background: transparent
- Border: 1px, #2C2C2E
- Text: grey or white
- Padding: 10px vertical, 16px horizontal

---

### Input Fields

**Text Input**:
- Height: 54px
- Background: #1E1E1E
- Border: 1.5px, #2C2C2E
- Border radius: 14px
- Padding: 16px horizontal
- Icon prefix: 18px emoji, 12px right margin
- Placeholder: #6B6B6B
- Text: white, 16px

**Textarea**:
- Min height: 120px
- Same styling as input
- Padding: 16px
- Text align: top

**Error State**:
- Border color: #FF453A
- Error text: red, 12px, below input

---

### Cards

**Standard Card**:
- Background: #1A1D24 or #1A1A1A
- Border: 1px, #2E3340 or #2C2C2E
- Border radius: 20px
- Padding: 16-24px
- Shadow: elevation 2

**Card Variations**:
- Menu cards: #1A1D24 bg, 20px radius
- Profile cards: #1A1A1A bg, 24px radius
- List items: #1A1D24 bg, 16px radius
- Info cards: #22262F bg, 16px radius

---

### Badges & Chips

**Status Badge**:
- Background: dark (#1E1E1E)
- Border: 1px, grey
- Border radius: 10px
- Padding: 6px vertical, 10px horizontal
- Content: colored dot (6px) + text (12px, bold)

**Discount Badge**:
- Background: #FF9500
- Border radius: 12px
- Padding: 2px vertical, 8px horizontal
- Text: black, bold, 10px, uppercase

**Category Chip**:
- Height: 36px
- Padding: 0 16px horizontal
- Border radius: 20px
- Inactive: #1A1D24 bg, border #2E3340
- Active: #FF6B35 bg
- Content: emoji icon + text

**Toggle Chip** (horizontal scroll):
- Min width: 80px
- Same styling as category chips

---

### Lists

**Order List Item**:
- Background: #1A1A1A
- Border: 1px, #2C2C2E
- Border radius: 20px
- Padding: 16px
- Margin bottom: 12px

**Menu List Item**:
- Background: #1A1D24
- Border: 1px, #2E3340
- Border radius: 16px
- Padding: 16px
- Margin bottom: 10px

---

### Icons

**Icon Containers**:
- Small: 36-44px (circles)
- Medium: 52px (circles)
- Large: 90px (circles, avatars)

**Icon Styles**:
- Background: #1E1E1E or white
- Border: 1px, #2C2C2E
- Border radius: 50% (circles) or 10-12px (squares)
- Emoji size: 18-24px

---

### Navigation

**Tab Bar** (bottom):
- Height: 70px (including padding)
- Background: #1A1D24
- Border top: 1px, #2E3340
- Padding bottom: 8px (safe area)
- Icon size: 28px
- Label: 10px, below icon
- Gap: 4px between icon and label
- Active: orange (#FF6B35)
- Inactive: grey (#6B7280)

**Top Tab Bar** (admin):
- Height: auto
- Background: #1A1A1A
- Border bottom: 1px, #2C2C2E
- Padding: 8px
- Gap: 4px
- Horizontal scroll
- Icon: 20px
- Label: 10px, below icon

---

## INTERACTIVE STATES

### Button States

**Enabled**:
- Primary: orange bg, white text
- Secondary: white bg, black text

**Pressed/Active**:
- opacity: 0.8-0.9
- Slight scale down (0.98)

**Disabled**:
- opacity: 0.4
- Grey bg (#2C2C2E) for primary
- No shadow

**Loading**:
- Show skeleton or spinner
- Disabled state

---

### Input States

**Default**:
- Border: 1.5px, #2C2C2E
- Background: #1E1E1E

**Focused**:
- Border: 1.5px, #5AC8FA (blue)
- Subtle blue glow

**Error**:
- Border: 1.5px, #FF453A (red)
- Error message below

**Disabled**:
- opacity: 0.5
- Grey bg

---

### Card States

**Default**:
- Normal shadow, full opacity

**Pressed**:
- opacity: 0.8
- Scale: 0.98

**Selected/Active**:
- Border color change (e.g., orange or green)
- Slight glow

---

## ANIMATIONS

**Transitions**:
- Duration: 200-300ms
- Easing: ease-in-out
- Common: opacity, transform, background color

**Modal Animation**:
- Slide up from bottom
- Duration: 300ms
- Easing: ease-out

**Button Press**:
- Scale: 0.95-0.98
- Duration: 100ms

**List Items**:
- Stagger fade in: 50ms delay between items

---

## ACCESSIBILITY

**Touch Targets**:
- Minimum: 44x44px
- Buttons: 54px height
- Icons: 40-44px
- Chips: 36px height

**Color Contrast**:
- Text on dark bg: minimum 4.5:1
- Large text: minimum 3:1
- Orange on dark: passes WCAG AA

**Typography**:
- Minimum body text: 14px
- Minimum label text: 12px

---