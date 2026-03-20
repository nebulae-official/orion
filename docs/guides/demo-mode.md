# :lucide-monitor: Demo Mode

Demo mode lets you run the Orion Dashboard with pre-seeded fixture data instead of connecting to the backend services. This is useful for development, demos, and testing the UI without spinning up the full Docker Compose stack.

!!! success "What Demo Mode Enables"
    With demo mode active, you can explore **every page** of the Orion Dashboard -- Trends, Content Queue, Analytics, Publishing, Settings, and System Health -- using realistic pre-seeded data. No backend services, no Docker, no GPU required.

## :lucide-info: What Is Demo Mode

When `NEXT_PUBLIC_DEMO_MODE=true`, the dashboard:

- Serves fixture data from `dashboard/src/lib/demo-data.ts` instead of calling the Gateway API
- Skips authentication -- no login required
- Displays realistic trends, content items, publishing history, and analytics
- Runs the GPU gauge and provider config with simulated values
- WebSocket connections are disabled (no live updates)

All pages work in demo mode: Trends, Content Queue, Analytics, Publishing, Settings, and System Health.

!!! info "Demo Mode Limitations"
    In demo mode, data is **read-only and ephemeral**. Any changes you make (e.g., approving content, switching providers) are stored in local component state and reset on page reload. WebSocket-based real-time updates are disabled, and no data is persisted to a database.

---

## :lucide-play: Activating Demo Mode

### :material-hammer-wrench: Using Make

```bash
make seed-demo
```

This generates fixture files and prints instructions:

```
Fixtures generated in scripts/fixtures/
Start dashboard with: NEXT_PUBLIC_DEMO_MODE=true make dash-dev
```

Then start the dashboard:

```bash
NEXT_PUBLIC_DEMO_MODE=true make dash-dev
```

### :lucide-wrench: Manual Setup

```bash
# Generate fixture data (optional -- dashboard has built-in fixtures)
python3 scripts/generate_dummy_data.py

# Start the dashboard in demo mode
cd dashboard
NEXT_PUBLIC_DEMO_MODE=true npm run dev
```

The dashboard is available at `http://localhost:3001` (dev server port).

---

## :lucide-terminal: Seeding via CLI

The CLI provides an admin command for seeding:

```bash
orion admin seed
```

This seeds the database with initial data when the backend is running. For demo mode (frontend-only), use `make seed-demo` instead.

---

## :lucide-layout-dashboard: What Each Page Shows in Demo Mode

### :lucide-trending-up: Trends

Six pre-seeded trends with realistic topics and virality scores:

| Topic                                        | Score | Source        | Status    |
| -------------------------------------------- | ----- | ------------- | --------- |
| AI Agents Replace Junior Devs -- Hype or...  | 0.94  | google_trends | USED      |
| Apple Vision Pro 2 Leak Sparks AR/VR Debate  | 0.91  | twitter       | USED      |
| Rust Adoption Surges in Enterprise Backend   | 0.87  | rss           | NEW       |
| Open-Source LLMs Close the Gap on GPT-5      | 0.82  | google_trends | NEW       |
| Kubernetes 1.32 Drops Docker Support         | 0.76  | rss           | DISCARDED |
| WebAssembly Enters Server-Side Mainstream    | 0.73  | twitter       | NEW       |

### :lucide-list: Content Queue

Content items at various pipeline stages: generating, review, approved, published, and failed. Click any item to view its full details including script, media assets, and metadata.

### :lucide-bar-chart-3: Analytics

Charts showing content performance metrics, engagement data, and trend correlation over time. All data is generated relative to the current date so it always looks fresh.

### :lucide-send: Publishing

Publishing history with platform distribution across Twitter, YouTube, and TikTok. Shows post URLs and engagement metrics.

### :lucide-settings: Settings

Provider configuration cards for LLM, Image, Video, and TTS. In demo mode, changes are saved to local state but not persisted to the backend. The status indicators show simulated connection states.

### :lucide-heart-pulse: System Health

Service status cards show all services as healthy. The GPU gauge displays a simulated utilization value.

---

## :lucide-database: Generating Custom Fixture Data

The fixture generator script creates JSON files in `scripts/fixtures/`:

```bash
python3 scripts/generate_dummy_data.py
```

The dashboard's built-in fixtures in `dashboard/src/lib/demo-data.ts` are independent of the generated JSON files. To customize the dashboard demo data, edit `demo-data.ts` directly.

---

## :lucide-scale: Demo Mode vs Full Stack

| Feature               | Demo Mode | Full Stack |
| --------------------- | --------- | ---------- |
| Backend required      | No        | Yes        |
| Authentication        | Skipped   | Required   |
| Real-time updates     | No        | Yes (WebSocket) |
| Data persistence      | No        | Yes (PostgreSQL) |
| AI generation         | No        | Yes        |
| Provider switching    | UI only   | Functional |
| GPU monitoring        | Simulated | Real       |

---

## :lucide-arrow-right: Next Steps

- **[Full Pipeline Demo](demo-full-pipeline.md)** -- Run the complete pipeline with real services
- **[Provider Setup](demo-provider-setup.md)** -- Configure AI providers
- **[Dashboard Overview](dashboard-overview.md)** -- Tour of all dashboard pages
- **[CLI Quickstart](cli-quickstart.md)** -- Manage Orion from the terminal
