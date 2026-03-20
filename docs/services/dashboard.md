# Dashboard

Next.js 15 admin dashboard for monitoring content pipelines, reviewing trends, and managing the Orion platform.

| Property      | Value                   |
| ------------- | ----------------------- |
| **Port**      | 3001                    |
| **Language**  | TypeScript 5.x          |
| **Framework** | Next.js 15.2 + React 19 |
| **Source**    | `dashboard/`            |

## :material-tools: Tech Stack

| Library               | Version   | Purpose                        |
| --------------------- | --------- | ------------------------------ |
| Next.js               | 15.2      | App Router framework           |
| React                 | 19.x      | UI library (Server Components) |
| Tailwind CSS          | 4.0       | Utility-first styling          |
| Recharts              | 3.8       | Data visualization             |
| Lucide React          | 0.468     | Icon library                   |
| clsx + tailwind-merge | 2.1 / 2.6 | Conditional class utilities    |

## :material-folder-outline: Architecture

The dashboard uses the App Router (not Pages Router):

```
dashboard/
  src/
    app/
      layout.tsx        # Root layout with providers
      page.tsx           # Landing page
      loading.tsx        # Global loading state
      error.tsx          # Global error boundary
      (routes)/          # Route groups
    components/          # Shared components
    lib/                 # Utilities, API client, helpers
```

### Key Patterns

- **Server Components by default** -- `"use client"` added only for interactivity
- **Server Actions for mutations** -- No API routes unless necessary
- **Tailwind utility classes only** -- No CSS modules or styled-components
- **`cn()` helper** -- Combines `clsx` + `tailwind-merge` for conditional classes
- **Strict TypeScript** -- No `any` types

### Key Pages

- **System Health** -- System overview (host info, resource bars), service status with uptime/queue sizes for all 7 services, infrastructure panel (Redis/PostgreSQL), and multi-GPU monitoring with 1-second polling
- **Settings** -- Tabbed interface with four tabs: Providers (provider/model config with Test Connection and Model Parameters), API Keys (manage cloud provider keys), Pipeline (generation, trend detection, and publishing settings), and System (dashboard preferences, data management, environment info)

## :material-cog: Configuration

| Variable                  | Default                 | Description          |
| ------------------------- | ----------------------- | -------------------- |
| `NEXT_PUBLIC_GATEWAY_URL` | `http://localhost:8000` | Gateway API base URL |

## :material-console: Commands

```bash
# Development
cd dashboard && npm run dev

# Production build
cd dashboard && npm run build

# Start production server
cd dashboard && npm run start

# Lint
cd dashboard && npm run lint
```

---

!!! tip ":lucide-book-open: Visual Guide Available"
    See the **[Dashboard Tour](../guides/dashboard-overview.md)** for a complete walkthrough of every page with screenshots, or try **[Demo Mode](../guides/demo-mode.md)** to explore without a backend.
