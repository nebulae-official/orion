# Orion Design System

> Orion is a **Digital Twin Content Agency** — a swarm of AI microservices that detect trends, generate scripts and media, assemble videos, and publish to social platforms autonomously. The operator experience is an **Apple visionOS-inspired glassmorphism dashboard** called **Orion OS**.

This design system captures the visual language of that dashboard so it can be re-used to design new screens, prototypes, slides, and mocks on-brand.

---

## Sources

| Source | Where |
| --- | --- |
| GitHub repo | [`nebulae-official/orion`](https://github.com/nebulae-official/orion) (main) |
| Product README | `README.md` in the repo |
| Dashboard design doc | `dashboard/DESIGN_SYSTEM.md` |
| Icon mapping doc | `dashboard/ICON_MAPPING.md` |
| Global styles (truth) | `dashboard/src/app/globals.css` |
| Components | `dashboard/src/components/**` |
| Screen examples | `dashboard/src/app/(dashboard)/**`, `dashboard/src/app/(auth)/**` |

No Figma was provided. All tokens below are lifted verbatim from `globals.css` and the repo's `DESIGN_SYSTEM.md`.

---

## Products

Orion is a monorepo with four surfaces:

1. **Dashboard** — Next.js 15 + React 19 + Tailwind 4 operator UI (`dashboard/`). Primary visual surface. _This is what the design system documents._
2. **Gateway & Services** — Go + Python microservices. No UI.
3. **CLI** — Python Typer + Rich. Terminal output.
4. **Docs** — Zensical static site.

→ This design system has **one UI kit: Dashboard** (`ui_kits/dashboard/`).

---

## Brand Personality

**Playful-professional, spacefaring, operator-grade.** The product is a "digital twin content agency" — so the vocabulary leans astronomical (Orion, Nebula, Pulse, Scout, Director, Starlight, Nebula Violet, ✦). The tone is confident and technical — think a mission-control console that also happens to be beautiful.

**Not** minimalist. **Not** cutesy. **Not** corporate SaaS. The closest analogues are visionOS, macOS Sonoma wallpaper, and the marketing material for high-end dev-tools (Linear, Raycast, Vercel).

---

## Content Fundamentals

### Voice

- **Confident, spacefaring, operator-grade.** Section headings read like console labels: `SYSTEM PERFORMANCE`, `LIVE VIEW`, `SEARCH SYSTEM…`, `ORION OS`.
- **Second-person, active verbs.** `"Sign in to the Content Agency dashboard"`, `"View detected trends and real-time market shifts"`, `"Welcome to the Orion Content Agency dashboard"`.
- **Technical words survive.** `pipeline`, `pub/sub`, `LangGraph`, `vector memory`, `niche` appear in user-facing copy, not just docs. The audience is technical operators; don't dumb it down.
- **One short sentence per screen subtitle.** Page headers follow an `{Icon} {Title} / {one-line subtitle}` pattern.

### Casing

| Where | Case |
| --- | --- |
| Page titles, card titles, buttons | `Title Case` |
| Status labels (`Approved`, `In Review`) | `Title Case` |
| Signature eyebrow labels (`LIVE VIEW`, `ORION OS`, `SEARCH SYSTEM…`, `READY`) | `ALL CAPS` with `letter-spacing: 0.2em` (the `.eyebrow` class) |
| Body copy | Sentence case |
| Trend-table status enums (`NEW`, `USED`, `DISCARDED`) | `ALL CAPS` (data; preserve backend casing) |

The uppercase + wide-tracked label is a **signature motif** — use it for nav metadata ("Digital Twin Systems"), live-view badges, metric-card subtitles ("Items Pending"), section chips. Never on body paragraphs.

### Emoji & icons in copy

- **No emoji in UI copy.** The product README uses them heavily as section markers (`✦`, `🎬`, `🔭`, `📊`), but that's README decoration, not product chrome.
- **Sparkle `✦` is brand-adjacent** — it appears in the README headline and could be used sparingly as an ornament. Don't overdo it.
- **All in-product icons are [Lucide](https://lucide.dev) SVGs** (`lucide-react`). See `ICONOGRAPHY.md` for the full map.

### Example snippets (verbatim from the repo)

- `"Welcome to Orion"` / `"Sign in to the Content Agency dashboard"` (login)
- `"Dashboard / Welcome to the Orion Content Agency dashboard"` (home)
- `"Trends / Discovered trends and their pipeline status."` (trends)
- `"No trends found. Scout may not be running."` (empty state — note: names the **service**, not a generic "try again")
- `"Content ready for publishing and distribution."` (card)
- `"SYSTEM PERFORMANCE"` / `"LIVE VIEW"` / `"SEARCH SYSTEM…"` / `"ORION OS"` / `"DIGITAL TWIN SYSTEMS"` / `"VIEW SYSTEM LOGS"` (eyebrow labels)
- `"Unable to load trends data. Showing cached or empty results."` (warning banner)

Notice: empty and error states **reference specific services by name** (`Scout may not be running`) rather than generic apology copy. Keep that.

---

## Visual Foundations

### Color

**Three brand colors carry the system:**

- **Nebula Violet** `#7C3AED` — primary. Logos, CTAs, active nav, metric-card accents. Light variant `#A78BFA` for emphasis.
- **Starlight Cyan** `#06B6D4` — secondary. Linked to "Trends" surface, the brand gradient, the second background orb.
- **Golden Star** `#F59E0B` — accent / warning. Sparse, reserved for caution and gold highlights.

Everything else is a near-black (`#080b14 → #111827 → #1a2234`) ladder of dark surfaces. **Never place solid colored blocks on top of glass cards** — use surface tints (`primary-surface`, `cyan-surface`) at 8–12% alpha so the glass still reads through.

Full tokens in `colors_and_type.css`. Dark is the default; a warm-gray Apple-esque light mode override is provided but dark is canonical.

### Typography

- **Display/Headlines:** `Space Grotesk` (500/600/700). Tight tracking on headings (`-0.02em`), extra-wide tracking on eyebrow labels (`0.2em`).
- **Body:** `Geist` (300/400/500/600/700). Modern, warm-neutral sans with excellent numerals — pairs beautifully with Space Grotesk and is more refined than Inter for dense dashboards. Normal tracking, `1.5–1.625` line-height.
- **Mono:** `JetBrains Mono` (400/500). Inline `<code>` gets a faint violet surface.

No custom font files needed — both families are on Google Fonts. `colors_and_type.css` imports them at the top.

### Backgrounds

The signature background is the **nebula mesh** — a fixed-position layer with a 7-stop radial-gradient mesh, plus two huge blurred orbs (`::before` violet top-left, `::after` cyan bottom-right) that slowly drift via 22–28s CSS keyframe animations with `mix-blend-mode: screen`. It's **always-on** beneath all dashboard chrome.

- Full-bleed images: rare. The product leans on the mesh + glass rather than hero imagery.
- No hand-drawn illustrations. No textures. No grain.
- No repeating patterns.

### Animation

- Very restrained. `transition-all duration-300` on cards, `transition-colors` on buttons.
- **One named motion:** the orb drift (22s and 28s, alternating).
- Hover scale on interactive cards only — `hover:scale-[1.01]` (tiny, not bouncy).
- No spring physics, no bounces, no stagger enters. `ease-in-out` everywhere.
- **Respects `prefers-reduced-motion`** — orbs freeze, glass blur falls back to a solid tint.

### Hover & press

| State | Treatment |
| --- | --- |
| Card hover | `hover:scale-[1.01]` + a brighter play-overlay on thumbnails |
| Button hover (primary) | `hover:bg-primary/90` (slightly darker) |
| Button hover (ghost) | `hover:bg-white/[0.06]` + text `hover:text-text` |
| Nav item hover | `hover:bg-white/5`, `hover:text-slate-200` |
| Nav item active | violet-tinted bg `bg-violet-500/10`, `text-violet-300`, left-border `border-l-2 border-violet-400` |
| Focus visible | `outline: 2px solid var(--primary); outline-offset: 2px` |
| Press | No explicit scale-down. Active states = same as hover. |

### Borders & shadows

- **Borders are hairline and desaturated.** `rgba(255,255,255,0.08)` on glass cards; `var(--border)` `#1e293b` on non-glass elements.
- **Three shadow layers on every glass card:**
  1. inset top highlight (`inset 0 1px 0 rgba(255,255,255,0.1)`) — the specular edge
  2. ambient `0 8px 32px rgba(0,0,0,0.3)`
  3. contact `0 2px 8px rgba(0,0,0,0.2)`
- **Primary buttons get a colored shadow:** `shadow-lg shadow-primary/25` — a violet halo, not a grey one.
- **Sidebar gets a violet-tinted shadow** to the right: `20px 0 50px rgba(124,58,237,0.06)`.

### Transparency & blur

The whole system hinges on `backdrop-filter: blur(24px) saturate(180%)`. `saturate()` is **non-optional** — without it the glass looks grey. Card fill is `rgba(13,18,32,0.48)`. Sidebar uses `bg-surface/80 backdrop-blur-xl`. Top nav is `bg-transparent backdrop-blur-md`.

### Layout rules

- Sidebar is fixed, 288px (`w-72`) on desktop; collapses to 80px (`w-20`) on tablet; drawer on mobile.
- Top nav fixed 64px (`h-16`).
- Main content area starts at `pt-16 ml-72` on desktop.
- Card padding `p-6` (24px). Hero card padding `p-8` (32px).
- Card gap `gap-6`. Page gutter `p-8`.
- Section break `mb-8` or `mt-12`.

### Corner radii

| Token | Value | Usage |
| --- | --- | --- |
| `--radius-sm` | 6px | small chips |
| `--radius-md` | 8px | **buttons, inputs** |
| `--radius-lg` | 12px | **cards (default)** |
| `--radius-xl` | 16px | hero cards |
| `--radius-2xl` | 20px | login card, modals |
| `--radius-full` | 9999px | status dots, pills, progress bars |

Rounding is moderate — not iOS-round, not sharp. `rounded-lg` is the workhorse.

### Color vibe of imagery

Imagery in the product is thumbnails inside content cards — `aspect-video` frames over `bg-surface-elevated`. When absent, a `Play` icon placeholder renders. The brand doesn't dictate photo treatments; the surrounding chrome does all the visual work.

---

## Files in this system

| File | What it is |
| --- | --- |
| `README.md` | This file — overview + content + visuals |
| `ICONOGRAPHY.md` | Icon system (Lucide), emoji, logos |
| `SKILL.md` | Claude Code / Agent Skill manifest |
| `colors_and_type.css` | All color + type CSS variables + signature utility classes (`.glass-card`, `.luminous-border`, `.nebula-bg`, `.eyebrow`) |
| `fonts/` | (empty — fonts are pulled from Google Fonts) |
| `assets/` | Logos, icons, brand marks |
| `preview/` | Card files rendered in the Design System tab |
| `ui_kits/dashboard/` | Interactive recreation of the Orion OS dashboard |

---

## Quick start

To design something on-brand:

```html
<link rel="stylesheet" href="colors_and_type.css" />
<body>
  <div class="nebula-bg"></div>
  <main style="position: relative; z-index: 10; padding: 2rem;">
    <span class="eyebrow">Live View</span>
    <h1>System Performance</h1>
    <div class="glass-card luminous-border" style="padding: 2rem;">
      …
    </div>
  </main>
</body>
```

That's the 80% case — nebula background, one eyebrow label, one glass card.
