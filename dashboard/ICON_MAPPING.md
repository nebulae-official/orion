# Icon Mapping: Material Symbols Outlined → Lucide React

This document maps every Material Symbols Outlined icon used in the design prototype
(`docs/design-prototype.html`) to its Lucide React equivalent used in the dashboard.

## Prototype Source

The prototype loads Material Symbols via Google Fonts:
```html
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:..." rel="stylesheet" />
```

The dashboard uses `lucide-react` (tree-shakeable SVG icons for React).

---

## Primary Icon Mapping

| Material Symbol | Lucide React Equivalent | Import Name | Usage Location | Status |
|---|---|---|---|---|
| `dashboard` | `LayoutDashboard` | `LayoutDashboard` | Sidebar nav, Dashboard page header | Already correct |
| `queue_play_next` | `ListVideo` | `ListVideo` | Sidebar nav (Content Queue), Dashboard card | Already correct |
| `trending_up` | `TrendingUp` | `TrendingUp` | Sidebar nav (Trends), Dashboard card, Trends page header | Already correct |
| `analytics` | `BarChart3` | `BarChart3` | Sidebar nav (Analytics), Analytics page header | Already correct |
| `publish` | `Send` | `Send` | Sidebar nav (Publishing), content-actions.tsx, content-card.tsx | Already correct |
| `auto_awesome` | `Sparkles` | `Sparkles` | Sidebar logo, login page, Generation decorative element, content-card.tsx | Already correct |
| `settings_input_component` | `Activity` | `Activity` | Sidebar nav (System Health), System Health page header | Already correct |
| `settings` | `Settings` | `Settings` | Sidebar nav (Settings), Settings page header, settings-tabs.tsx | Already correct |
| `check_circle` | `CheckCircle` | `CheckCircle` | Dashboard card (Approved), content-actions.tsx, content-card.tsx, toast.tsx | Already correct |
| `watch_later` | `Clock` | `Clock` | Dashboard card (In Review), content-card.tsx | Already correct |
| `search` | — | — | Prototype top nav search bar | **Not yet implemented** |
| `notifications` | — | — | Prototype top nav bell | **Not yet implemented** |
| `account_circle` | — | — | Prototype top nav user avatar | **Not yet implemented** |

---

## Current Lucide Icons in Dashboard (Full Inventory)

### Sidebar (`src/components/sidebar.tsx`)

| Lucide Icon | Prototype Equivalent | Notes |
|---|---|---|
| `LayoutDashboard` | `dashboard` | Matches |
| `ListVideo` | `queue_play_next` | Matches |
| `TrendingUp` | `trending_up` | Matches |
| `BarChart3` | `analytics` | Matches |
| `Send` | `publish` | Matches |
| `Play` | `auto_awesome` | **Mismatch** — prototype uses `auto_awesome` (sparkle/AI), sidebar uses `Play` (play button). Consider changing to `Sparkles` for consistency. |
| `Activity` | `settings_input_component` | Matches |
| `Settings` | `settings` | Matches |
| `LogOut` | — | Not in prototype (dashboard-only feature) |
| `Menu` | — | Mobile toggle (dashboard-only) |
| `X` | — | Mobile close (dashboard-only) |
| `Sparkles` | `auto_awesome` | Used in sidebar logo, not in nav item |

### Page Headers

| Page | Lucide Icon | Prototype Equivalent | Notes |
|---|---|---|---|
| Dashboard (`page.tsx`) | — (text only) | `dashboard` | Prototype has icon in header; dashboard does not |
| Trends (`trends/page.tsx`) | `TrendingUp` | `trending_up` | Matches |
| Analytics (`analytics/page.tsx`) | `BarChart3` | `analytics` | Matches |
| Generation (`generation/page.tsx`) | `Play` | `auto_awesome` | **Mismatch** — should be `Sparkles` |
| System Health (`system/page.tsx`) | `Activity` | `settings_input_component` | Matches |
| Settings (`settings/page.tsx`) | `Settings` | `settings` | Matches |
| Publishing (`publishing/page.tsx`) | — (text only) | `publish` | No icon in current page header |
| Queue (`queue/page.tsx`) | — (text only) | `queue_play_next` | No icon in current page header |

### Components — Other Icons

| Component File | Lucide Icons | Notes |
|---|---|---|
| `content-card.tsx` | `Play`, `FileText`, `Clock`, `CheckCircle`, `XCircle`, `Send`, `Sparkles` | Status and action icons |
| `content-actions.tsx` | `CheckCircle`, `XCircle`, `RotateCcw`, `Send` | Approve/reject/retry/publish actions |
| `service-health.tsx` | `RefreshCw` | Refresh button |
| `system-info.tsx` | `Server`, `RefreshCw` | Server icon, refresh |
| `gpu-gauge.tsx` | `Cpu`, `RefreshCw` | GPU monitoring |
| `generation-progress.tsx` | Multiple (see file) | Progress tracking icons |
| `toast.tsx` | `X`, `CheckCircle`, `AlertCircle`, `Info` | Toast notifications |
| `video-player.tsx` | Multiple (see file) | Video playback controls |
| `error.tsx` | `AlertCircle`, `RotateCcw` | Error boundary |
| `login/page.tsx` | `Sparkles` | Login branding |
| `login/login-form.tsx` | `Sparkles`, `ArrowRight` | Login form |
| `settings/settings-tabs.tsx` | `Cpu`, `KeyRound`, `Workflow`, `Settings` | Settings tab icons |
| `settings/system-config.tsx` | Multiple | System configuration |
| `settings/pipeline-config.tsx` | Multiple | Pipeline configuration |
| `settings/api-keys-config.tsx` | Multiple | API key management |
| `provider-config.tsx` | Multiple | Provider configuration |

---

## Discrepancies Found

### 1. Generation nav/page uses `Play` instead of `Sparkles`

The prototype uses `auto_awesome` (sparkle/magic wand) for the Generation section.
The dashboard sidebar and Generation page both use `Play` (a play button icon).

**Recommendation:** Change `Play` to `Sparkles` in:
- `src/components/sidebar.tsx` — NAV_ITEMS Generation entry
- `src/app/(dashboard)/generation/page.tsx` — page header icon

### 2. Dashboard page header missing icon

The prototype has a `dashboard` icon in the page header with a styled container.
The current dashboard `page.tsx` uses text only.

**Recommendation:** Add `LayoutDashboard` icon to the Dashboard page header, matching
the pattern used by Trends, Analytics, System Health, and Settings pages.

### 3. Queue and Publishing pages missing header icons

Trends, Analytics, Generation, System Health, and Settings pages all have an icon in
their page header. Queue and Publishing pages do not.

**Recommendation:** Add header icons:
- Queue → `ListVideo`
- Publishing → `Send`

---

## Additional Icons Needed for Prototype Features

These icons are used in the prototype but are not yet present in the dashboard because
the corresponding UI elements have not been implemented.

| Feature | Material Symbol | Recommended Lucide Icon | Import Name | Notes |
|---|---|---|---|---|
| Top nav search bar | `search` | `Search` | `Search` | Search input with icon prefix |
| Top nav notifications | `notifications` | `Bell` | `Bell` | Notification bell button |
| Top nav user avatar | `account_circle` | `CircleUser` | `CircleUser` | User profile button |
| "Live View" badge | — (text badge) | `Radio` | `Radio` | Optional: animated dot indicator for live data. Alternative: `Wifi` or `Podcast` |
| Decorative sparkle | `auto_awesome` (filled) | `Sparkles` | `Sparkles` | Large background decorative element in System Performance card |

### Where these would be added

- **Search, Bell, CircleUser**: A new top navigation bar component (the prototype has
  `<header>` with these elements; the current dashboard has no top nav bar).
- **Radio / Live View**: Inside the System Performance visualization section if/when
  implemented.
- **Sparkles (decorative)**: Background decoration in dashboard cards, already available
  in the codebase.

---

## Complete Lucide React Import Reference

All Lucide icons currently used across the dashboard (deduplicated):

```typescript
import {
  Activity,
  AlertCircle,
  ArrowRight,
  BarChart3,
  CheckCircle,
  Clock,
  Cpu,
  FileText,
  Info,
  KeyRound,
  LayoutDashboard,
  ListVideo,
  LogOut,
  Menu,
  Play,
  RefreshCw,
  RotateCcw,
  Send,
  Server,
  Settings,
  Sparkles,
  TrendingUp,
  Workflow,
  X,
  XCircle,
} from "lucide-react";
```

Icons to add for prototype parity:

```typescript
import {
  Bell,         // Notifications
  CircleUser,   // User avatar
  Radio,        // Live view indicator (optional)
  Search,       // Search bar
} from "lucide-react";
```
