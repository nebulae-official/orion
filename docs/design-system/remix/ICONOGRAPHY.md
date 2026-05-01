# Iconography — Orion

## Primary icon system: Lucide

The Orion dashboard uses **[Lucide](https://lucide.dev)** (`lucide-react` in code) as its sole icon library. Lucide's line weight (1.5px, stroke-linecap round) and geometric-but-friendly silhouettes match the glass-and-neon aesthetic perfectly — the thin white strokes pick up the nebula glow without fighting it.

**For designs in this system, link Lucide from CDN:**

```html
<!-- Lucide icons via ESM -->
<script type="module">
  import { createIcons, icons } from "https://cdn.jsdelivr.net/npm/lucide@latest/+esm";
  createIcons({ icons });
</script>

<!-- Then use: -->
<i data-lucide="sparkles"></i>
<i data-lucide="layout-dashboard"></i>
```

Or for static HTML, inline SVGs copied from [lucide.dev](https://lucide.dev).

### Canonical usage (verbatim from `dashboard/src/components/sidebar.tsx`)

| Where | Lucide name | Color |
| --- | --- | --- |
| Brand mark / Aperture | Hand-drawn SVG (`assets/orion-aperture.svg`) | violet→cyan gradient; white/ink for mono |
| Dashboard nav | `LayoutDashboard` | `text-violet-300` active |
| Trends | `TrendingUp` | `text-cyan` on page header |
| Content Queue | `ListVideo` | — |
| Publishing | `Send` | — |
| Analytics | `BarChart3` | — |
| System Health | `Activity` | — |
| Settings | `Settings` | — |
| Admin Users | `Users` | — |
| Profile | `UserCircle` / `CircleUser` | — |
| Sign out | `LogOut` | — |
| Top-nav search | `Search` | `text-text-muted`, inside pill input |
| Top-nav notifications | `Bell` (via `NotificationBell`) | — |
| Status | `CheckCircle`, `XCircle`, `Clock`, `AlertCircle`, `Info`, `FileText` | semantic color |
| Actions | `RotateCcw` (retry), `RefreshCw` (refresh), `ArrowRight` | ghost |
| OAuth | `Github`, `Chrome` (Google) | outline buttons |
| Toast | `X` (close), `CheckCircle`, `AlertCircle`, `Info` | semantic |
| System | `Cpu`, `Server`, `KeyRound`, `Workflow`, `Radio` (live) | semantic |

### Sizing

- Sidebar / nav items: **`h-5 w-5`** (20px)
- Inline with body text: **`h-3.5 w-3.5`** or **`h-4 w-4`**
- Page-header icons (inside a 48px rounded-xl container): **`h-6 w-6`** or **`h-8 w-8`**
- Dashboard-card corner icon (inside `w-12 h-12` tile): **`h-6 w-6`**

Line width is Lucide default (1.5–2px stroke). Don't bold them.

## Emoji

**Not used in product UI chrome.** The product README uses emoji as section markers (`✦`, `🎬`, `🔭`, `🎨`, `✂️`, `📊`, `📡`, `🔐`, `⚡`, `🖥️`, `⌨️`) but that stays in Markdown decoration. In the dashboard itself, every decorative glyph is a Lucide SVG.

## Unicode ornaments

**The four-point star `✦` (`U+2726` BLACK FOUR POINTED STAR) is semi-brand.** It appears in the README headline and at the start of each major section (`## ✦ Overview`, `## ✦ Architecture`, etc). Fine to use as a hairline ornament or bullet in slides and decks, _sparingly_.

**The bullet `•` (`U+2022`)** is used as a separator in meta lines: `"2m ago • Campaign: Orion_Nexus_A"`. The literal character, not a CSS dot.

## Logos & brand marks

The Orion brand mark is the **Aperture** — two concentric rings with three satellite nodes at 0° / 120° / 240° and a gradient core. It reads as lens, viewport, and constellation simultaneously. The wordmark is **orion** set in Space Grotesk 700 at −0.03em tracking, lowercase.

See `assets/`:

- `assets/orion-aperture.svg` — standalone symbol, full-color gradient (violet→cyan) — for on-dark use, the sidebar brand header, title cards
- `assets/orion-logo-tile.svg` — app-icon squircle (violet gradient background, white core) — for iOS/macOS launchers
- `assets/orion-logo.svg` — horizontal lockup (symbol + "orion" wordmark) — for email signatures, press kits, GitHub org avatars
- `assets/orion-wordmark.svg` — wordmark only, for horizontal lockups that already have the symbol nearby
- `assets/favicon.svg` — radical-simplification favicon (ring + core only) — legible at 16×16
- `assets/sparkles.svg` — Lucide Sparkles glyph, kept for the **Generation** nav item (product feature, not brand)

Clearspace is one symbol-radius on all sides. Never rotate, stretch, or recolor outside violet↔cyan or monochrome white/ink. See `Brand Book.html` for construction rules and misuse examples.

## Placeholders

When you need an icon and don't know which one, use Lucide's **`Box`** or **`Square`** — both look intentional and quiet. Don't invent SVGs; don't substitute emoji.

## Do and don't

| Do | Don't |
| --- | --- |
| Use Lucide for every glyph | Hand-roll SVG paths |
| Keep stroke at 1.5–2px | Fill-style icons (Material Symbols filled, SF Symbols) |
| Color icons with semantic tokens (`text-primary`, `text-cyan`, `text-success`) | Hardcoded hexes on icons |
| Use the **Aperture** mark as the Orion brand mark | Substitute Sparkles or any other Lucide glyph for the brand mark |
| Put ✦ as a section ornament sparingly | Decorate UI chrome with emoji |
