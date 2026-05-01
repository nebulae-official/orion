# SKILL.md — Designing with the Orion design system

You are designing a new screen, prototype, slide, or deck for the **Orion** content-agency product. Follow these rules.

## Always start by linking tokens

Every HTML file you create must `<link>` the canonical stylesheet:

```html
<link rel="stylesheet" href="colors_and_type.css">
```

Then use the CSS variables it defines (`--bg`, `--surface-1`, `--primary`, `--text-primary`, etc) and utility classes (`.glass-card`, `.luminous-border`). Never hardcode hex. Never invent new colors.

If the design is a deck, also use `<link>` and set `background: var(--bg-deep)` on `body`.

## Type stack

Google Fonts — include in every file:

```html
<link href="https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600;700&family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
```

Three fonts only — no system fallbacks, no Inter.

- Headings, labels, stats, nav labels → **Space Grotesk** (display, kept as Orion's brand voice)
- Body, table cells, descriptions → **Geist** (modern neutral with excellent numerals for dense dashboards)
- Code, hashes, timestamps → **JetBrains Mono**

Eyebrow labels are signature: `font-family: Space Grotesk; font-size: 10px; font-weight: 500; text-transform: uppercase; letter-spacing: 0.2em; color: var(--primary-light)` (violet `#A78BFA`).

## Surface hierarchy (critical)

1. Page background is **always** the nebula bg — dark `#080b14` with 3 radial violet + cyan glows at 18%/20%, 85%/15%, 60%/90%. Copy `.muted-bg` from `preview/_card.css` or set an equivalent.
2. On that bg, every panel is a **glass card**: `.glass-card.luminous-border` (see `colors_and_type.css`). Translucent navy with backdrop-blur, 1px white/8% border, inset specular highlight, ambient shadow.
3. Never nest a glass card inside a glass card with another luminous border — the glow stacks and looks wrong. Use a plain dark sub-surface (`background: #1a2234`) for nested elements.

## Iconography

**Lucide only for product icons.** Never emoji in UI chrome. Sidebar 20px, inline 14–16px, card-header 24px. The **brand mark** is hand-drawn (`assets/orion-aperture.svg`) — never substitute a Lucide glyph for the logo. See `ICONOGRAPHY.md` for the canonical glyph mapping.and, `TrendingUp` for trends, `ListVideo` for queue, `Send` for publishing, etc.

## Radii

6 (chips) · 8 (buttons, inputs) · 12 (cards — **the default**) · 16 (hero) · 20 (modal) · 9999 (pills, status dots, top-nav search).

## Colors — the short list

- Primary: `#7C3AED` (violet)
- Primary light (on dark): `#A78BFA`
- Secondary: `#06B6D4` (cyan)
- Accent: `#F59E0B` (golden star, sparingly)
- Success `#10B981` · Warning `#F59E0B` · Danger `#EF4444` · Info `#3B82F6`
- Text: `#F1F5F9` / `#94A3B8` / `#64748B` / `#475569`
- Gradient brand text: `linear-gradient(135deg, #A78BFA 0%, #22D3EE 100%)` — used for the `ORION` wordmark only. Don't gradient other headings.

## Motion

Default `transition: all 200ms ease`. Entry: `fadeIn` + subtle `translateY(-8px)` on load. Status dots pulse at 2s. Keep it restrained — the glass already does the work.

## Vocabulary

Screens are "systems". Headers read like console labels in ALL-CAPS letter-spaced text: `SYSTEM PERFORMANCE`, `LIVE VIEW`, `SEARCH SYSTEM…`. Names lean astronomical: Orion, Nebula, Pulse, Scout, Director. ✦ (U+2726) is a fine ornament; emoji is not.

Page header pattern: **{Lucide icon inside rounded-xl gradient tile} {Title in Space Grotesk 32px bold} / {one-line subtitle in 14px #94A3B8}**.

## What to do when starting a new design

1. Link `colors_and_type.css` + Google Fonts.
2. Set body `background: var(--bg-deep)` and paint a `.muted-bg` radial-gradient layer.
3. Pick a layout: a single hero glass card centered (for auth-style screens), or **sidebar (260px, `#111827`) + top-nav (64px, glass) + content (max-w 1400px)** for the main product.
4. Reach for components from `ui_kits/dashboard.html` — copy the markup, don't re-derive.
5. Space Grotesk for any heading or label; Geist for body; JetBrains Mono for code/timestamps.
6. Lucide icons only.

## Tweakable palette

When surfacing a design for the user, consider exposing 1–2 Tweaks that switch the nebula glow hue (violet / cyan / teal) or toggle `luminous-border` on/off. It's the most evocative knob this system has.
