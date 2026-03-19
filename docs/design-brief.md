# Orion Dashboard — Design System & UI Redesign Brief

## Project Overview

Orion is a **Digital Twin Content Agency** — a platform of autonomous AI agents that detect trends, generate scripts, create media, assemble videos, and publish to social platforms. The dashboard is the admin control center for monitoring and managing the entire pipeline.

**Tech stack:** Next.js 15.2, React 19, TypeScript, Tailwind CSS 4.0, Recharts 3.8, Lucide React icons.

---

## Current Dashboard Structure

The dashboard is a **single-page app** with a fixed left sidebar and scrollable main content area. It has **8 pages** accessible from the sidebar navigation.

### Shell Layout

```
┌──────────────────────────────────────────────────────┐
│ Sidebar (256px fixed)  │  Main Content (flex-1)      │
│                        │                              │
│  Logo + Version        │  Page Header (icon + title)  │
│  ─────────────         │  ─────────────────────────── │
│  Dashboard             │                              │
│  Content Queue         │  Page Content                │
│  Trends                │  (cards, tables, charts,     │
│  Analytics             │   forms, gauges, etc.)       │
│  Publishing            │                              │
│  Generation            │                              │
│  System Health         │                              │
│  Settings              │                              │
│                        │                              │
│  ─────────────         │                              │
│  Sign out              │                              │
└──────────────────────────────────────────────────────┘
```

- **Sidebar:** Fixed 256px width on desktop, overlay on mobile (<768px). Logo area at top, nav links with Lucide icons, sign-out at bottom.
- **Main content:** Scrollable area with p-8 padding. Each page has a header (icon + h1 + subtitle) followed by page-specific content.
- **Responsive:** Sidebar collapses to hamburger menu on mobile. Grids adapt from 1-col to 2-4 cols.

---

## Pages & Their Content

### 1. Dashboard (Home)
**Purpose:** Landing page after login. Quick-access links.
**Layout:** 4-card grid (1-col mobile → 4-col desktop)
**Elements:**
- 4 DashboardCards (link cards with icon + title + description)
  - Content Queue, Trends, Approved, In Review
- Each card is clickable, navigates to the target page

### 2. Content Queue
**Purpose:** Review and manage content moving through the pipeline.
**Layout:** Filter bar + card grid + pagination
**Elements:**
- **Filter bar:** 7 status filter buttons (All, Draft, Generating, In Review, Approved, Published, Rejected) + sort toggle (Date/Score)
- **Content cards:** Grid of ContentCard components (1→4 cols responsive)
  - Thumbnail placeholder area
  - Status badge (color-coded: Draft=gray, Generating=purple, In Review=amber, Approved=green, Published=cyan, Rejected=red)
  - Confidence score percentage
  - Title (h3)
  - Body excerpt
  - Relative timestamp
- **Pagination:** Numbered page links at bottom

### 3. Trends
**Purpose:** Display trends discovered by the Scout service.
**Layout:** Stat cards + sortable data table
**Elements:**
- **3 StatCards** (top row): Total Found, Used for Content, Discarded — large number + label
- **TrendTable:** Sortable columns — Topic, Source (twitter/google_trends/rss), Virality (0.0-1.0), Status (NEW/USED/DISCARDED), Created date
  - Column headers are clickable to sort (with arrow indicator)
  - Status badges color-coded (NEW=blue, USED=green, DISCARDED=gray)

### 4. Analytics
**Purpose:** Pipeline performance metrics, cost tracking, provider usage.
**Layout:** Stat cards + multiple chart types
**Elements:**
- **3 StatCards:** Total Generated, Approval Rate (%), Total Cost ($) with "Last 30 days" subtitle
- **FunnelChart** (full width): Horizontal bar chart — Generated, In Review, Approved, Published, Rejected — each a different color
- **2-col grid:**
  - **CostChart:** Vertical stacked bar chart — cost by provider (ollama, comfyui, fal.ai, elevenlabs) broken down by category (llm_tokens, image_generation, video_clips, tts_audio)
  - **ProviderPie:** Donut chart — provider usage distribution
- **ErrorTrend** (full width): Line chart — errors over last 7 days with data points

### 5. Publishing
**Purpose:** Publishing history across platforms.
**Layout:** Data table
**Elements:**
- **Table columns:** Content ID, Platform (youtube/tiktok/twitter/instagram), Status badge (Published=green/Pending=yellow/Failed=red), Published date, Post ID
- **Empty state:** Centered message when no records

### 6. Generation
**Purpose:** Real-time progress tracking for content generation pipelines.
**Layout:** Live indicator + pipeline progress cards
**Elements:**
- **Live badge:** Pulsing green dot + "Live" or "Live (Demo)" text
- **Pipeline cards:** One per active generation
  - Title (content heading)
  - Estimated time remaining
  - **6 stage indicators** in a row: Research, Script, Critique, Images, Video, Render
    - Each stage has: icon circle + label
    - States: pending (dim), running (purple spinner), completed (green check), failed (red X)
  - **Progress bar** under active stage with percentage

### 7. System Health
**Purpose:** Monitor service status, system resources, GPU usage.
**Layout:** 3 sections stacked vertically
**Elements:**
- **System Overview** (full width card):
  - "Live" badge with pulsing green dot
  - "Updated Xs ago" counter + refresh button
  - 2-col layout: Host Information table (hostname, OS, arch, CPU cores, Go version, uptime) + Resource Usage (CPU, Memory, Disk progress bars with labels and percentages)
- **Service Status + Infrastructure** (2/3 + 1/3 grid):
  - **Service Status:** 7 service rows (Gateway, Scout, Director, Media, Editor, Pulse, Publisher) — each with status dot, name, uptime, queue size, status badge
  - **Infrastructure:** Redis + PostgreSQL connectivity status with per-service dependency matrix (R/P indicators)
- **GPU Status** (full width):
  - Multi-GPU card grid (1→2 cols)
  - Each GPU card: SVG gauge ring (VRAM usage %), VRAM numbers, utilization %, temperature, power draw, GPU/memory clock speeds, fan speed, driver/CUDA version
  - 1-second polling with live indicator

### 8. Settings
**Purpose:** Configure AI providers, API keys, pipeline behavior, system preferences.
**Layout:** Tabbed interface with 4 tabs
**Elements:**
- **Tab bar:** Horizontal tabs with icons — Providers, API Keys, Pipeline, System
  - Active tab: purple bottom border
  - Hash-based URL routing (#providers, #api-keys, #pipeline, #system)

- **Providers tab:** 2x2 card grid
  - 4 provider cards: LLM, Image Generation, Video Generation, Text-to-Speech
  - Each card: status dot, provider dropdown (Local/Cloud), model dropdown, "Model Parameters" collapsible accordion (temperature, max_tokens, dimensions, quality), Save + Test buttons
  - "Reset to Defaults" button at bottom

- **API Keys tab:**
  - Security warning banner (amber/warning style)
  - "Changes saved locally" info badge
  - 2-col grid of 5 provider cards: OpenAI, Replicate, Fal.ai, ElevenLabs, Runway
  - Each card: icon, provider name, description, status badge (Active/Not Set), masked API key display (last 4 chars with show/hide toggle), Update Key / Verify / Delete buttons

- **Pipeline tab:**
  - 3 section cards: Content Generation, Trend Detection, Publishing
  - Content Generation: Max concurrent pipelines (number), Default quality (dropdown), Auto-approve threshold (slider 0-1), Max retries (number)
  - Trend Detection: Scan interval (number), Min virality score (slider), Max trends per scan (number), Source weights (3 number inputs for RSS/Google/Twitter)
  - Publishing: Platform toggles (checkboxes for YouTube/TikTok/Twitter/Instagram), Schedule mode (dropdown), Rate limits per platform (number inputs)
  - Save Settings + Reset to Defaults buttons

- **System tab:**
  - Dashboard Preferences: Theme switcher (System/Light/Dark buttons), Health check refresh interval (dropdown), Notifications toggle, Default page after login (dropdown)
  - Data Management: Read-only connection info rows (PostgreSQL, Redis, Milvus, Storage)
  - Environment: Read-only info rows (Gateway URL, Dashboard version, Next.js, React, Demo mode, Environment)

---

## Design Tokens (Current)

### Color Palette
| Token | Hex | Usage |
|-------|-----|-------|
| Background | `#0B0F19` | Page background |
| Surface | `#111827` | Cards, panels |
| Surface Elevated | `#1a2234` | Inputs, nested elements |
| Surface Hover | `#1f2b3d` | Hover states |
| Border | `#1e293b` | Card/input borders |
| Border Light | `#2a3a52` | Hover borders |
| Primary (Nebula Violet) | `#7C3AED` | Buttons, active states, accents |
| Primary Light | `#A78BFA` | Hover states |
| Cyan (Starlight) | `#06B6D4` | Secondary accent |
| Gold (Star) | `#F59E0B` | Warning, amber badges |
| Success | `#10B981` | Healthy, published, connected |
| Warning | `#F59E0B` | Pending, checking |
| Danger | `#EF4444` | Error, failed, unhealthy |
| Info | `#3B82F6` | Informational badges |
| Text Primary | `#F1F5F9` | Headings, primary text |
| Text Secondary | `#94A3B8` | Descriptions, labels |
| Text Muted | `#64748B` | Metadata, hints |
| Text Dim | `#475569` | Disabled, inactive |

### Typography
| Element | Font | Size | Weight |
|---------|------|------|--------|
| Page titles (h1) | Space Grotesk | 1.875rem (text-3xl) | Bold (700) |
| Card titles (h2) | Space Grotesk | 1.125rem (text-lg) | Semibold (600) |
| Section headers (h3) | Inter | 1rem (text-base) | Semibold (600) |
| Body text | Inter | 0.875rem (text-sm) | Normal (400) |
| Labels/meta | Inter | 0.75rem (text-xs) | Medium (500) |
| Code/monospace | System mono | 0.875rem | Normal |

### Spacing Scale
| Use | Value |
|-----|-------|
| Compact inputs | px-3 py-2 |
| Buttons | px-4 py-3 |
| Table cells | px-6 py-4 |
| Card padding | p-6 (24px) |
| Page padding | p-8 (32px) |
| Section gaps | gap-6 (24px) |

### Border Radius
| Token | Value | Usage |
|-------|-------|-------|
| sm | 6px | Small elements |
| md | 8px | Inputs, small cards |
| lg | 12px | Cards, panels |
| xl | 16px | Large cards |
| 2xl | 20px | Hero elements |
| full | 9999px | Badges, dots, pills |

---

## UI Component Library (Current)

### Primitive Components
- **Button:** primary/secondary/danger/ghost variants, sm/md/lg sizes, loading spinner state
- **Card:** rounded-xl with border, header/title/content slots
- **Badge:** Color-coded pill (status-surface + status text), text-xs font-medium
- **Status Dot:** Colored circle (h-2/h-3), optional animate-ping for live
- **Table:** Overflow container with header row, body rows, hover states
- **Input/Select:** Dark-themed form controls with focus ring
- **Slider:** Range input with accent-primary
- **Checkbox:** Styled checkbox with label
- **Tabs:** Horizontal tab bar with bottom border indicator
- **Progress Bar:** h-2 rounded-full with color-coded fill
- **Gauge Ring:** SVG circular progress (used for GPU/system metrics)
- **Modal/Dialog:** Centered overlay with backdrop blur
- **Toast/Notification:** Bottom-right positioned notification area
- **Empty State:** Centered icon + heading + description

### Data Visualization
- **StatCard:** Large number + label + optional subtitle
- **Bar Chart (Horizontal):** Pipeline funnel
- **Bar Chart (Vertical):** Cost breakdown (stacked)
- **Donut Chart:** Provider usage distribution
- **Line Chart:** Error trends over time
- **Progress Stages:** Linear step indicator with icon circles (generation pipeline)

### Layout Patterns
- **Page Header:** Icon + h1 + subtitle
- **Card Grid:** 1→2→3→4 column responsive grid
- **Split Layout:** 2/3 + 1/3 grid for related content
- **Full Width Card:** Single card spanning full content width
- **Tabbed Panel:** Tab bar + content panel with hash routing
- **Filter Bar:** Horizontal button group with sort toggle

---

## What the Mockups Should Cover

### Deliverables
1. **Design System Documentation** — Complete token specification (colors, typography, spacing, radius, shadows, animations)
2. **Component Library Mockups** — Every UI component in all states (default, hover, active, disabled, loading, error)
3. **Page Mockups** — All 8 pages + login page at desktop (1440px) and mobile (375px) widths
4. **Interactive Prototype** — Clickable flows for key user journeys

### Key User Journeys to Prototype
1. **Login → Dashboard → Content Queue → Filter → Review item**
2. **Trends → Click trend → See generated content**
3. **Settings → Switch provider → Test connection → Save**
4. **System Health → Monitor services → Check GPU**
5. **Generation → Watch pipeline progress in real-time**

### Design Considerations
- **Dark-first design** — The entire dashboard uses a deep navy/dark theme. Light mode support exists but is secondary.
- **Data-dense but clean** — Pages like Analytics and System Health show lots of data. The design should be information-dense without feeling cluttered.
- **Real-time feel** — Generation and System Health pages have live-updating elements (pulsing dots, counters, progress bars). The design should convey "live monitoring."
- **Professional/technical audience** — Users are developers and content operators who value efficiency over decoration.
- **Consistent card patterns** — Cards are the primary container. They should feel cohesive across all pages while allowing content variation.
- **Status at a glance** — Color-coded badges, dots, and progress indicators should let users assess system state instantly.

---

## Current Screenshots

Reference screenshots are available in `docs/assets/guides/`:

| Screenshot | Description |
|------------|-------------|
| `login-page.png` | Login form with centered card |
| `dashboard-home.png` | Home page with 4 quick-access cards |
| `sidebar-nav.png` | Sidebar navigation (isolated) |
| `content-queue.png` | Content queue with card grid |
| `content-queue-filters.png` | Queue filtered to "Approved" status |
| `trends-page.png` | Trends with stat cards + sortable table |
| `analytics-overview.png` | Analytics with KPI cards + charts |
| `analytics-charts.png` | Full analytics page (scrolled) |
| `publishing-page.png` | Publishing history table |
| `generation-page.png` | Generation progress with stage indicators |
| `system-health.png` | System overview + services + GPU |
| `settings-page.png` | Settings Providers tab |
| `settings-api-keys.png` | Settings API Keys tab |
| `settings-pipeline.png` | Settings Pipeline tab |
| `settings-system.png` | Settings System tab |
