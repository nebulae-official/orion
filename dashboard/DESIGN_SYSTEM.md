# Orion Design System

Extracted from the Orion OS dashboard prototype (`docs/design-prototype.html`).
This document is the source of truth for all visual design tokens, component patterns, and layout conventions used in the Orion dashboard.

---

## 1. Color Palette

All colors follow a Material Design 3-inspired naming convention adapted for a dark-first space theme.

### Surface Colors

| Token | Hex | Usage |
|---|---|---|
| `surface` | `#131313` | Primary background / canvas |
| `surface-dim` | `#131313` | Dimmed surface (matches base) |
| `surface-bright` | `#3a3939` | Elevated bright surface |
| `surface-container-lowest` | `#0e0e0e` | Deepest container (input fields) |
| `surface-container-low` | `#1c1b1b` | Low-elevation container |
| `surface-container` | `#201f1f` | Default container |
| `surface-container-high` | `#2a2a2a` | High-elevation container |
| `surface-container-highest` | `#353534` | Highest-elevation container |
| `surface-variant` | `#353534` | Variant surface for differentiation |
| `surface-tint` | `#d2bbff` | Surface tint overlay color |
| `background` | `#131313` | Body background base |

### Primary Colors (Violet)

| Token | Hex | Usage |
|---|---|---|
| `primary` | `#d2bbff` | Primary text/icon color on dark bg |
| `primary-container` | `#7c3aed` | Primary container fill (buttons, badges) |
| `on-primary` | `#3f008e` | Text on primary fill |
| `on-primary-container` | `#ede0ff` | Text on primary-container |
| `primary-fixed` | `#eaddff` | Fixed primary (light context) |
| `primary-fixed-dim` | `#d2bbff` | Dimmed fixed primary |
| `on-primary-fixed` | `#25005a` | Text on primary-fixed |
| `on-primary-fixed-variant` | `#5a00c6` | Text on primary-fixed variant |
| `inverse-primary` | `#732ee4` | Inverse primary (light surfaces) |

### Secondary Colors (Cyan)

| Token | Hex | Usage |
|---|---|---|
| `secondary` | `#bdf4ff` | Secondary text/icon color |
| `secondary-container` | `#00e3fd` | Secondary container fill |
| `on-secondary` | `#00363d` | Text on secondary fill |
| `on-secondary-container` | `#00616d` | Text on secondary-container |
| `secondary-fixed` | `#9cf0ff` | Fixed secondary |
| `secondary-fixed-dim` | `#00daf3` | Dimmed fixed secondary |
| `on-secondary-fixed` | `#001f24` | Text on secondary-fixed |
| `on-secondary-fixed-variant` | `#004f58` | Text on secondary-fixed variant |

### Tertiary Colors (Muted Violet)

| Token | Hex | Usage |
|---|---|---|
| `tertiary` | `#cdc1e5` | Tertiary text/icon color |
| `tertiary-container` | `#6c6282` | Tertiary container fill |
| `on-tertiary` | `#342c49` | Text on tertiary fill |
| `on-tertiary-container` | `#ede1ff` | Text on tertiary-container |
| `tertiary-fixed` | `#eaddff` | Fixed tertiary |
| `tertiary-fixed-dim` | `#cdc1e5` | Dimmed fixed tertiary |
| `on-tertiary-fixed` | `#1f1732` | Text on tertiary-fixed |
| `on-tertiary-fixed-variant` | `#4b4260` | Text on tertiary-fixed variant |

### Status Colors

| Token | Hex | Usage |
|---|---|---|
| `error` | `#ffb4ab` | Error text/icon |
| `error-container` | `#93000a` | Error container fill |
| `on-error` | `#690005` | Text on error fill |
| `on-error-container` | `#ffdad6` | Text on error-container |
| Success (emerald) | Tailwind `emerald-400` / `emerald-200` | Success states, "Approved" card |
| Warning (amber) | Tailwind `amber-400` / `amber-200` | Warning states, "In Review" card |

### Text / Outline Colors

| Token | Hex | Usage |
|---|---|---|
| `on-surface` | `#e5e2e1` | Primary body text |
| `on-surface-variant` | `#ccc3d8` | Secondary/muted text |
| `on-background` | `#e5e2e1` | Text on background |
| `outline` | `#958da1` | Borders, dividers |
| `outline-variant` | `#4a4455` | Subtle borders |
| `inverse-surface` | `#e5e2e1` | Inverse surface |
| `inverse-on-surface` | `#313030` | Text on inverse surface |

### Ambient Background

The body uses layered radial gradients over the base `#131313`:

```css
background-color: #131313;
background-image:
  radial-gradient(at 0% 0%, rgba(124, 58, 237, 0.15) 0px, transparent 50%),
  radial-gradient(at 100% 100%, rgba(0, 218, 243, 0.05) 0px, transparent 50%);
```

- Top-left: Violet glow (`rgba(124, 58, 237, 0.15)`)
- Bottom-right: Cyan glow (`rgba(0, 218, 243, 0.05)`)

---

## 2. Typography

### Font Families

| Role | Font | Weights | Usage |
|---|---|---|---|
| Display / Headline | Space Grotesk | 300, 400, 500, 600, 700 | Headings, card titles, brand text, labels, nav links |
| Body | Inter | 300, 400, 500, 600 | Body text, descriptions, paragraphs |
| Label | Space Grotesk | 400, 500 | Badges, micro-labels, tracking-widest text |

### Type Scale

| Style | Font | Size | Weight | Tracking | Example |
|---|---|---|---|---|---|
| Brand title | Space Grotesk | `text-2xl` (1.5rem) | 700 (bold) | `tracking-widest` | "ORION" |
| Brand subtitle | Space Grotesk | `text-[10px]` | 400 | `tracking-widest`, uppercase | "Digital Twin Systems" |
| Page heading | Space Grotesk | `text-4xl` (2.25rem) | 700 (bold) | `tracking-tight` | "Dashboard" |
| Page subtitle | Inter | `text-sm` (0.875rem) | 400 | default | "Welcome to the..." |
| Card heading | Space Grotesk | `text-lg` (1.125rem) | 600 (semibold) | `tracking-tight` | "Content Queue" |
| Section heading | Space Grotesk | `text-xl` (1.25rem) | 700 (bold) | `tracking-tight` | "System Performance" |
| Body text | Inter | `text-sm` (0.875rem) | 400 | default | Card descriptions |
| Metric number | Space Grotesk | `text-2xl` (1.5rem) | 700 (bold) | default | "24", "156" |
| Micro label | Space Grotesk | `text-[10px]` | 400 | `tracking-widest`, uppercase | "Items Pending", "LIVE VIEW" |
| Nav link | Space Grotesk | `text-sm` (0.875rem) | 400 | `tracking-tight` | "Content Queue" |
| Activity text | Inter | `text-sm` / `text-xs` | 500 / 400 | default | Event descriptions |
| Top bar label | Space Grotesk | `text-[10px]` | 400 | `tracking-widest`, uppercase | "Orion OS" |
| Search input | Space Grotesk | `text-[10px]` | 400 | `tracking-wider` | "SEARCH SYSTEM..." |

---

## 3. Effects & Treatments

### Glassmorphism (`.glass-card`)

```css
.glass-card {
  background: rgba(53, 53, 52, 0.2);
  backdrop-filter: blur(24px);
  border: 1px solid rgba(149, 141, 161, 0.15);
}
```

- Semi-transparent warm gray background
- 24px backdrop blur for frosted-glass effect
- Subtle outline-colored border at 15% opacity

### Luminous Border (`.luminous-border`)

A glowing gradient border that fades from primary color at the top-left corner using a CSS mask technique:

```css
.luminous-border {
  position: relative;
}
.luminous-border::before {
  content: "";
  position: absolute;
  inset: 0;
  padding: 1px;
  border-radius: inherit;
  background: linear-gradient(135deg, rgba(210, 187, 255, 0.3) 0%, transparent 40%);
  -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
}
```

- Creates a 1px gradient border that glows from primary at top-left and fades to transparent
- Uses `mask-composite: exclude` to hollow out the center
- `border-radius: inherit` ensures it follows the parent shape

### Glow Shadows (Status Dots)

Status indicator dots emit a colored glow:

```
emerald:  shadow-[0_0_10px_rgba(52,211,153,0.5)]
violet:   shadow-[0_0_10px_rgba(167,139,250,0.5)]
cyan:     shadow-[0_0_10px_rgba(34,211,238,0.5)]
amber:    shadow-[0_0_10px_rgba(251,191,36,0.5)]
```

### Sidebar Glow

The sidebar casts a subtle violet shadow into the main content area:

```
shadow-[20px_0_50px_rgba(124,58,237,0.06)]
```

### Selection Color

```css
selection:bg-primary/30
```

---

## 4. Component Patterns

### Glass Card

The foundational card component. Combines `.glass-card` + `.luminous-border`.

```html
<div class="glass-card luminous-border p-6 rounded-xl flex flex-col gap-4
            group hover:scale-[1.01] transition-all duration-300">
  <!-- content -->
</div>
```

- Rounded corners: `rounded-xl` (0.5rem from custom config)
- Padding: `p-6`
- Hover: subtle scale-up `hover:scale-[1.01]`
- Transition: `transition-all duration-300`

### Status Dot

```html
<div class="w-2 h-2 rounded-full bg-emerald-400 mt-1.5
            shadow-[0_0_10px_rgba(52,211,153,0.5)]"></div>
```

- Size: 8px circle
- Color matches status (emerald, violet, cyan, amber)
- Glow shadow radiates 10px

### Nav Link (Active)

```html
<a class="flex items-center gap-3 px-4 py-3 text-violet-300
          bg-violet-500/10 rounded-lg border-l-2 border-violet-400
          font-['Space_Grotesk'] tracking-tight text-sm
          transition-all duration-300">
  <span class="material-symbols-outlined">dashboard</span>
  <span>Dashboard</span>
</a>
```

- Active state: violet text, violet tinted background, left border accent
- Icon + label layout with `gap-3`

### Nav Link (Inactive)

```html
<a class="flex items-center gap-3 px-4 py-3 text-slate-400
          hover:text-slate-200 hover:bg-white/5
          transition-all duration-300
          font-['Space_Grotesk'] tracking-tight text-sm">
  <!-- ... -->
</a>
```

- Default: `text-slate-400`
- Hover: `text-slate-200`, `bg-white/5`

### Page Header

```html
<header class="mb-12 flex items-start gap-4">
  <div class="p-3 bg-primary-container/20 rounded-xl border border-primary/20">
    <span class="material-symbols-outlined text-primary text-3xl">dashboard</span>
  </div>
  <div>
    <h1 class="text-4xl font-headline font-bold text-on-surface tracking-tight">Dashboard</h1>
    <p class="text-on-surface-variant font-body text-sm mt-1">Subtitle text</p>
  </div>
</header>
```

- Icon container: `p-3`, primary-container bg at 20% opacity, rounded-xl, primary border at 20%
- Heading: `text-4xl`, Space Grotesk, bold, tight tracking
- Subtitle: `text-sm`, Inter, on-surface-variant color

### Metric Footer

```html
<div class="mt-4 pt-4 border-t border-white/5 flex justify-between items-center">
  <span class="font-headline text-2xl font-bold">24</span>
  <span class="text-[10px] font-headline uppercase tracking-widest text-slate-500">
    Items Pending
  </span>
</div>
```

- Top border: `border-white/5` (very subtle separator)
- Left: large number, Space Grotesk bold
- Right: micro label, uppercase, widest tracking

### Top Nav Bar

```html
<header class="fixed top-0 right-0 w-[calc(100%-18rem)] h-16
               flex justify-between items-center px-8 z-40
               bg-transparent backdrop-blur-md">
  <!-- Left: "Orion OS" label -->
  <!-- Right: search input + icon buttons -->
</header>
```

- Height: 64px (`h-16`)
- Width: full minus sidebar (288px)
- Transparent with medium backdrop blur
- z-index: 40

### Brand Header

```html
<h1 class="text-2xl font-bold tracking-widest text-transparent bg-clip-text
           bg-gradient-to-br from-violet-300 to-cyan-400 font-headline">
  ORION
</h1>
```

- Gradient text: violet-300 to cyan-400 (top-left to bottom-right)
- Uses `bg-clip-text` + `text-transparent` technique
- Uppercase, widest tracking

### Badge / Pill

```html
<span class="px-3 py-1 bg-primary/10 text-primary rounded-full
             text-[10px] font-headline tracking-widest uppercase">
  Live View
</span>
```

- Padding: `px-3 py-1`
- Background: primary at 10% opacity
- Text: primary color
- Border radius: `rounded-full` (0.75rem from custom config)
- Typography: 10px, Space Grotesk, uppercase, widest tracking

### Activity Feed Item

```html
<div class="flex gap-4 items-start">
  <div class="w-2 h-2 rounded-full bg-emerald-400 mt-1.5
              shadow-[0_0_10px_rgba(52,211,153,0.5)]"></div>
  <div>
    <p class="text-sm font-medium text-on-surface">Event title</p>
    <p class="text-xs text-on-surface-variant mt-1">Timestamp and details</p>
  </div>
</div>
```

- Status dot + text block layout
- `gap-4` between dot and text
- Title: `text-sm`, medium weight
- Details: `text-xs`, variant color

### Bar Chart Placeholder

```html
<div class="w-full h-64 flex items-end gap-2 px-4">
  <div class="flex-1 bg-primary/20 rounded-t-sm h-[40%]"></div>
  <!-- more bars with varying heights and opacity -->
</div>
```

- Bars use primary and secondary colors at varying opacities (20%-100%)
- `rounded-t-sm` on top corners only
- Heights set via percentage `h-[n%]`

---

## 5. Spacing & Layout

### Sidebar

- Width: `w-72` (288px)
- Padding: `p-6`
- Background: `bg-slate-950/40` with `backdrop-blur-xl`
- Border: `border-r border-violet-500/10`
- Shadow: `shadow-[20px_0_50px_rgba(124,58,237,0.06)]`
- Fixed positioning: `fixed left-0 top-0 h-full`
- z-index: 50

### Main Content

- Left margin: `ml-72` (clears sidebar)
- Top padding: `pt-24` (clears top nav + spacing)
- Padding: `p-8`
- Min height: `min-h-screen`

### Top Nav

- Height: `h-16` (64px)
- Width: `w-[calc(100%-18rem)]`
- Horizontal padding: `px-8`
- Fixed positioning: `fixed top-0 right-0`
- z-index: 40

### Card Grid

- Top row: `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6`
- Bottom section: `grid grid-cols-1 lg:grid-cols-3 gap-8`
- Wide card: `lg:col-span-2`
- Section spacing: `mt-12`

### Common Spacing Values

| Token | Value | Usage |
|---|---|---|
| `gap-2` | 0.5rem | Bar chart bars |
| `gap-3` | 0.75rem | Nav icon-to-label |
| `gap-4` | 1rem | Page header icon-to-text, activity items |
| `gap-6` | 1.5rem | Card grid, card internal |
| `gap-8` | 2rem | Section grid |
| `p-6` | 1.5rem | Card padding |
| `p-8` | 2rem | Main content, large card padding |
| `px-4` | 1rem | Nav link horizontal padding |
| `py-3` | 0.75rem | Nav link vertical padding |
| `mb-12` | 3rem | Page header bottom margin, brand header |
| `mt-12` | 3rem | Between grid sections |
| `space-y-1` | 0.25rem | Nav link list |
| `space-y-6` | 1.5rem | Activity feed items |

---

## 6. Border Radius

The prototype uses significantly tighter radii than Tailwind defaults:

| Token | Value | Tailwind Class | Usage |
|---|---|---|---|
| `DEFAULT` | `0.125rem` (2px) | `rounded` | Base radius |
| `lg` | `0.25rem` (4px) | `rounded-lg` | Nav links, icon containers |
| `xl` | `0.5rem` (8px) | `rounded-xl` | Cards, page header icon |
| `full` | `0.75rem` (12px) | `rounded-full` | Badges, pills, search input |

These are much smaller than Tailwind's defaults (`rounded-lg` = 0.5rem normally). This gives the UI a sharper, more technical appearance.

---

## 7. Iconography

- Icon set: **Material Symbols Outlined**
- Default settings: `FILL 0, wght 400, GRAD 0, opsz 24`
- Sizes used: `text-sm` (nav search), `text-2xl` (card icons), `text-3xl` (page header), `text-9xl` (decorative watermark)
- Filled variant used sparingly for decorative elements: `font-variation-settings: 'FILL' 1`

---

## 8. Interaction States

| State | Treatment |
|---|---|
| Hover (card) | `hover:scale-[1.01]` with `transition-all duration-300` |
| Hover (nav) | `hover:text-slate-200 hover:bg-white/5` |
| Hover (button) | `hover:text-violet-300 transition-colors` |
| Hover (action btn) | `hover:bg-white/5 transition-colors` |
| Focus | `focus:ring-1 focus:ring-primary-container` (inputs) |
| Active (nav) | Violet text + bg + left border accent |
| Selection | `selection:bg-primary/30` |

---

## 9. Gradients

| Name | Value | Usage |
|---|---|---|
| Brand gradient | `bg-gradient-to-br from-violet-300 to-cyan-400` | "ORION" brand text |
| Luminous border | `linear-gradient(135deg, rgba(210,187,255,0.3) 0%, transparent 40%)` | Card top-left glow |
| Ambient violet | `radial-gradient(at 0% 0%, rgba(124,58,237,0.15) 0px, transparent 50%)` | Body background |
| Ambient cyan | `radial-gradient(at 100% 100%, rgba(0,218,243,0.05) 0px, transparent 50%)` | Body background |
