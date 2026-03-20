# :lucide-shield: System Administration

How to monitor service health, GPU status, and configure AI providers.

---

## :lucide-heart-pulse: System Health Page

Navigate to **System Health** from the sidebar. The page is divided into several panels: System Overview, Service Status, Infrastructure, and GPU.

![System Health](../assets/screenshots/system-health.png)

### :lucide-monitor: System Overview

The System Overview panel displays host-level information and resource usage:

- **Host Information** -- Hostname, OS/platform, architecture, CPU cores, Go version, and system uptime
- **Resource Usage** -- CPU, Memory, and Disk usage shown as progress bars with percentages

A **Live** indicator in the panel header shows "Updated Xs ago" to confirm real-time data. The panel polls every 5 seconds.

### :lucide-server: Service Status

The Service Status panel monitors all seven backend services:

| Service | Role |
| --- | --- |
| **Gateway** | HTTP gateway that routes requests to backend services |
| **Scout (Trends)** | Detects trending topics from external sources |
| **Director (Scripts)** | Generates content scripts from trends |
| **Media (Assets)** | Produces images, video, and audio assets |
| **Editor (Publish)** | Assembles and renders final video content |
| **Publisher** | Publishes content to external platforms |
| **Pulse (Analytics)** | Collects and aggregates analytics data |

Each service row shows:

- **Status indicator** -- Healthy (green dot), Unhealthy (red dot), or Checking (gray dot)
- **Uptime** -- How long the service has been running
- **Queue size** -- Number of items currently queued for that service

The panel auto-refreshes every 5 seconds with a **Live** indicator confirming the polling interval.

### :lucide-database: Infrastructure

The Infrastructure panel shows connectivity status for shared dependencies:

- **Redis** -- Connection status to the Redis pub/sub and cache layer
- **PostgreSQL** -- Connection status to the primary database

Per-service dependency checks are displayed with badges: **R** (Redis) and **P** (Postgres) next to each service, indicating whether that service can reach each dependency.

### :lucide-circle-dot: Status Indicators

- **Healthy** (green dot) -- Service is running and responding to health checks
- **Unhealthy** (red dot) -- Service is down or not responding
- **Checking** (gray dot) -- Health check in progress

!!! tip "Service Restart Procedure"
    If a service shows as **unhealthy**, restart it with Docker Compose: `docker compose -f deploy/docker-compose.yml restart <service-name>`. Wait 10--15 seconds for the health check to update. If the service remains unhealthy after restart, check its logs with `docker compose -f deploy/docker-compose.yml logs <service-name> --tail 50`.

---

## :lucide-cpu: GPU Status Monitoring

The GPU section displays cards for each detected GPU on the machine running local AI models. Multi-GPU setups show a separate card per device. This panel polls every 1 second for near-real-time updates.

Metrics shown per GPU card:

| Metric | Description |
| --- | --- |
| **VRAM gauge** | Visual indicator of VRAM usage (percentage) |
| **VRAM Used** | Actual VRAM consumption (e.g., 8743 / 24576 MB) |
| **GPU Utilization** | Current GPU compute utilization percentage |
| **Temperature** | GPU temperature in Celsius |
| **Power Draw** | Current power consumption in watts |
| **GPU Clock** | Current GPU core clock speed |
| **Memory Clock** | Current memory clock speed |
| **Fan Speed** | Fan speed percentage |
| **Driver Version** | Installed NVIDIA driver version |
| **CUDA Version** | CUDA toolkit version |
| **Device** | GPU model name (e.g., NVIDIA RTX 4090) |

!!! warning "GPU Monitoring Thresholds"
    Watch these critical thresholds closely:

    - **VRAM > 90%** -- Risk of out-of-memory errors. Reduce concurrent generation jobs or switch some workloads to cloud providers.
    - **Temperature > 85 C** -- Sustained high temperatures can cause thermal throttling and reduce performance. Check cooling and airflow.
    - **GPU Utilization > 95%** for extended periods -- The GPU is saturated. Queue times will increase. Consider offloading workloads to cloud.

---

## :lucide-settings: Provider Configuration

Navigate to **Settings** from the sidebar to configure AI providers for each generation service.

![Settings page](../assets/screenshots/settings-page.png)

### :lucide-layout-grid: Provider Cards

Four cards are available, one for each generation service:

| Card | Controls |
| --- | --- |
| **LLM (Text Generation)** | Provider and model for script writing |
| **Image Generation** | Provider and model for visual assets |
| **Video Generation** | Provider and model for video content |
| **Text-to-Speech** | Provider and model for audio narration |

### :lucide-repeat: Changing Providers

1. Select the **Provider** dropdown and choose between:
   - **Local (Ollama / ComfyUI)** -- Uses local GPU-accelerated models
   - **Cloud (OpenAI / Replicate)** -- Uses cloud API services
2. Select the **Model** from the available options for that provider
3. Click **Save Configuration**

The green dot next to each card title indicates whether the selected provider is currently connected and available.

### :lucide-plug: Test Connection

Each provider card includes a **Test Connection** button. Click it to verify that the selected provider is reachable and properly configured before saving. This is especially useful when switching to cloud providers to confirm API keys are set.

### :lucide-sliders-horizontal: Model Parameters

Expand the **Model Parameters** accordion on any provider card to fine-tune generation settings (e.g., temperature, max tokens). These parameters are applied when the provider processes requests.

### :lucide-scale: When to Use Cloud vs Local

| Scenario | Recommendation |
| --- | --- |
| GPU utilization consistently above 80% | Switch some workloads to Cloud |
| Cost budget is tight | Use Local providers |
| Need highest quality output | Use Cloud providers |
| Running without a GPU | Must use Cloud providers |

---

## :lucide-arrow-right: Next Steps

- **[Analytics Guide](analytics-guide.md)** -- Track costs and provider usage
- **[Dashboard Overview](dashboard-overview.md)** -- Tour of all dashboard pages
- **[CLI Quickstart](cli-quickstart.md)** -- Manage the system from the command line
- **[Monitoring Guide](demo-monitoring.md)** -- Prometheus and Grafana observability
- **[Provider Setup](demo-provider-setup.md)** -- Detailed provider configuration
