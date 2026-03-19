# Orion Design System

Apple visionOS-inspired glassmorphism design system for the Orion Dashboard.

## Color Palette

Inspired by [colorhunt.co/palette/0206170f172aa855f722d3ee](https://colorhunt.co/palette/0206170f172aa855f722d3ee) (Cyberpunk Noir) and [colorhunt.co/palette/2d033b810ca8c147e92de1fc](https://colorhunt.co/palette/2d033b810ca8c147e92de1fc) (Deep Nebula).

| Token | Hex | Usage |
|-------|-----|-------|
| `--color-bg` | `#080b14` | Page background (body) |
| `--color-surface` | `#111827` | Sidebar, elevated panels |
| `--color-surface-elevated` | `#1a2234` | Form inputs, sub-sections within cards |
| `--color-primary` | `#7C3AED` | Primary accent (nebula violet) |
| `--color-primary-light` | `#A78BFA` | Lighter violet for emphasis |
| `--color-cyan` | `#06B6D4` | Secondary accent (starlight cyan) |
| `--color-text` | `#F1F5F9` | Primary text |
| `--color-text-secondary` | `#94A3B8` | Secondary text |
| `--color-text-muted` | `#64748B` | Muted labels |
| `--color-text-dim` | `#475569` | Dimmed metadata |

### Semantic Colors

| Token | Hex | Usage |
|-------|-----|-------|
| `--color-success` | `#10B981` | Healthy, connected, approved |
| `--color-warning` | `#F59E0B` | Checking, pending, caution |
| `--color-danger` | `#EF4444` | Error, failed, unhealthy |
| `--color-info` | `#3B82F6` | Informational highlights |

## Glass Card Material

The core visual element. Uses `backdrop-filter` with `saturate()` to pull nebula colors through the glass.

```css
.glass-card {
  background: rgba(13, 18, 32, 0.48);
  backdrop-filter: blur(24px) saturate(180%);
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.1),  /* specular highlight */
    0 8px 32px rgba(0, 0, 0, 0.3),             /* ambient shadow */
    0 2px 8px rgba(0, 0, 0, 0.2);              /* contact shadow */
}
```

**Usage:** All top-level cards, panels, and sections use `glass-card luminous-border rounded-xl p-6`.

**Do NOT use:** `bg-surface` or `border border-border` for top-level cards. Reserve those for modals and overlays.

## Luminous Border

Gradient glow pseudo-element that creates a subtle light edge on cards.

```html
<div class="glass-card luminous-border rounded-xl p-6">...</div>
```

## Nebula Background

Fixed-position mesh gradient with animated orbs. Applied via `.nebula-bg` in the dashboard layout.

- 7-layer radial gradient mesh (violet, cyan, blue, magenta)
- 2 animated orbs (`::before` violet, `::after` cyan)
- `mix-blend-mode: screen` on orbs for additive color blending
- Respects `prefers-reduced-motion` (disables animation)

## Progress Bars

Track: `glass-track` (semi-transparent with inset shadow)
Fill: Standard `bg-success/warning/danger` with optional `glass-fill-*` glow

```html
<div class="h-2 w-full overflow-hidden rounded-full glass-track">
  <div class="h-full rounded-full bg-success glass-fill-success transition-all duration-500"
       style="width: 65%" />
</div>
```

**Do NOT use:** `bg-surface-elevated` for progress bar tracks inside glass cards.

## Buttons

### Variants

| Variant | Class | Usage |
|---------|-------|-------|
| **Primary** | `bg-primary text-white shadow-lg shadow-primary/25` | Main CTAs, form submits |
| **Secondary** | `glass-card text-text-secondary` | Cancel, filter toggles, auxiliary actions |
| **Danger** | `bg-danger text-white shadow-lg shadow-danger/25` | Delete, reject, destructive |
| **Ghost** | `text-text-secondary hover:bg-white/[0.06]` | Icon buttons, minimal actions |

### Sizing

| Size | Classes |
|------|---------|
| **sm** | `rounded-lg px-3 py-1.5 text-xs` |
| **md** | `rounded-lg px-4 py-2 text-sm` |
| **lg** | `rounded-xl px-5 py-2.5 text-base` |

### Standard Primary Button

```html
<button class="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5
  text-sm font-semibold text-white shadow-lg shadow-primary/25
  transition-all hover:bg-primary-muted hover:shadow-primary/30">
  Button Text
</button>
```

Use the `<Button>` component from `@/components/ui/button` when possible.

## Status Badges

Consistent `rounded-full px-2.5 py-0.5 text-xs font-medium` with semantic surface colors:

| Status | Background | Text |
|--------|-----------|------|
| Healthy/Active | `bg-success-surface` | `text-success-light` |
| Warning/Checking | `bg-warning-surface` | `text-warning-light` |
| Error/Unhealthy | `bg-danger-surface` | `text-danger-light` |
| Neutral/Not Set | `bg-surface-elevated` | `text-text-dim` |
| Primary/Active | `bg-primary-surface` | `text-primary-light` |

## Alert Banners

Warning/error banners inside pages:

```html
<div class="rounded-lg border border-warning/30 bg-warning-surface px-4 py-3 text-sm text-warning-light">
  Warning message here
</div>
```

## Typography

| Token | Font | Usage |
|-------|------|-------|
| `--font-headline` | Space Grotesk | Headings, metric values, labels |
| `--font-body` | Inter | Body text, descriptions |

### Heading Sizes

| Level | Classes |
|-------|---------|
| Page title | `font-headline text-3xl font-bold` |
| Section title | `font-headline text-xl font-bold` |
| Card title | `text-lg font-semibold` |
| Subsection | `text-sm font-semibold text-text-secondary` |

## Spacing

- **Card padding:** `p-6` (1.5rem)
- **Card gap:** `gap-6` between cards
- **Internal spacing:** `gap-4` or `space-y-4` within cards
- **Section margin:** `mb-8` between page sections

## Border Radius Scale

| Token | Value | Usage |
|-------|-------|-------|
| `rounded-lg` | 0.5rem | Buttons, inner elements, badges |
| `rounded-xl` | 0.75rem | Cards, panels, sections |
| `rounded-2xl` | 1rem | Hero cards, modals |
| `rounded-full` | 50% | Status dots, badges, progress bars |

## Z-Index Scale

| Layer | Z-Index | Element |
|-------|---------|---------|
| Background | 0 | `.nebula-bg` |
| Content | 10 | `<main>` |
| TopNav | 40 | `<header>` |
| Sidebar | 50 | `<aside>` |
| Modal | 50+ | Overlays, dropdowns |

## Animation

- **Transitions:** `transition-all duration-300` for cards, `transition-colors` for buttons
- **Hover scale:** `hover:scale-[1.01]` on interactive cards only
- **Orb drift:** 22-28s slow alternate animation for background
- **Reduced motion:** All animations respect `prefers-reduced-motion: reduce`

## Do's and Don'ts

| Do | Don't |
|----|-------|
| Use `glass-card luminous-border` for top-level cards | Use `bg-surface border-border` for cards |
| Use `glass-track` for progress bar backgrounds | Use `bg-surface-elevated` for progress bars inside glass |
| Use `shadow-lg shadow-primary/25` on primary buttons | Use plain `shadow-sm` on CTAs |
| Use semantic color tokens (`bg-success-surface`) | Hardcode colors (`bg-amber-500/10`) |
| Use `font-headline` for headings | Mix font families randomly |
| Add `saturate()` to backdrop-filter | Use `backdrop-filter: blur()` alone |
