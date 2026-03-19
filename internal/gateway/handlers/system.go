package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"os/exec"
	"runtime"
	"strconv"
	"strings"
	"sync"
	"syscall"
	"time"
)

// startTime records when the gateway process started.
var startTime = time.Now()

// SystemInfo represents host system information returned to the dashboard.
type SystemInfo struct {
	Hostname      string    `json:"hostname"`
	OS            string    `json:"os"`
	Platform      string    `json:"platform"`
	Architecture  string    `json:"architecture"`
	NumCPU        int       `json:"num_cpu"`
	GoVersion     string    `json:"go_version"`
	CPUUsage      float64   `json:"cpu_usage"`
	CPUPerCore    []float64 `json:"cpu_per_core"`
	MemoryTotal   uint64    `json:"memory_total"`
	MemoryUsed    uint64    `json:"memory_used"`
	MemoryFree    uint64    `json:"memory_free"`
	MemoryUsage   float64   `json:"memory_usage"`
	DiskTotal     uint64    `json:"disk_total"`
	DiskUsed      uint64    `json:"disk_used"`
	DiskFree      uint64    `json:"disk_free"`
	DiskUsage     float64   `json:"disk_usage"`
	Uptime        string    `json:"uptime"`
	UptimeSeconds float64   `json:"uptime_seconds"`
	IsWSL         bool      `json:"is_wsl"`
	MetricsSource string    `json:"metrics_source"`
}

// ---- WSL2 detection (cached) ------------------------------------------------

var (
	wsl2Once   sync.Once
	wsl2Result bool
)

// isWSL2 returns true when the gateway is running inside WSL2.
// The result is cached on first call because it cannot change at runtime.
func isWSL2() bool {
	wsl2Once.Do(func() {
		data, err := os.ReadFile("/proc/version")
		if err != nil {
			return
		}
		lower := strings.ToLower(string(data))
		wsl2Result = strings.Contains(lower, "wsl2") || strings.Contains(lower, "microsoft-standard-wsl2")
	})
	return wsl2Result
}

// ---- Cached Windows host metrics via PowerShell -----------------------------

type windowsMetricsCache struct {
	mu        sync.Mutex
	memTotal  uint64
	memUsed   uint64
	memFree   uint64
	diskTotal uint64
	diskUsed  uint64
	diskFree  uint64
	updatedAt time.Time
	ttl       time.Duration
}

var winCache = &windowsMetricsCache{ttl: 5 * time.Second}

// refreshIfStale refreshes memory and disk metrics from PowerShell if the cache
// has expired. It is safe for concurrent use.
func (c *windowsMetricsCache) refreshIfStale(ctx context.Context) {
	c.mu.Lock()
	defer c.mu.Unlock()
	if time.Since(c.updatedAt) < c.ttl {
		return
	}
	// Fetch memory and disk in a single PowerShell invocation to save startup cost.
	psScript := `
$os = Get-CimInstance Win32_OperatingSystem | Select-Object TotalVisibleMemorySize, FreePhysicalMemory
$dk = Get-CimInstance Win32_LogicalDisk -Filter "DeviceID='C:'" | Select-Object Size, FreeSpace
@{ mem = $os; disk = $dk } | ConvertTo-Json -Compress
`
	cmdCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	out, err := exec.CommandContext(cmdCtx, "powershell.exe", "-NoProfile", "-NonInteractive", "-Command", psScript).Output()
	if err != nil {
		return
	}

	var result struct {
		Mem struct {
			TotalVisibleMemorySize json.Number `json:"TotalVisibleMemorySize"`
			FreePhysicalMemory     json.Number `json:"FreePhysicalMemory"`
		} `json:"mem"`
		Disk struct {
			Size      json.Number `json:"Size"`
			FreeSpace json.Number `json:"FreeSpace"`
		} `json:"disk"`
	}
	if err := json.Unmarshal(out, &result); err != nil {
		return
	}

	// Memory values from WMI are in KB.
	totalKB, _ := result.Mem.TotalVisibleMemorySize.Int64()
	freeKB, _ := result.Mem.FreePhysicalMemory.Int64()
	c.memTotal = uint64(totalKB) * 1024
	c.memFree = uint64(freeKB) * 1024
	c.memUsed = c.memTotal - c.memFree

	// Disk values are in bytes.
	diskSize, _ := result.Disk.Size.Int64()
	diskFree, _ := result.Disk.FreeSpace.Int64()
	c.diskTotal = uint64(diskSize)
	c.diskFree = uint64(diskFree)
	c.diskUsed = c.diskTotal - c.diskFree

	c.updatedAt = time.Now()
}

func (c *windowsMetricsCache) getMemory(ctx context.Context) (total, used, free uint64) {
	c.refreshIfStale(ctx)
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.memTotal, c.memUsed, c.memFree
}

func (c *windowsMetricsCache) getDisk(ctx context.Context) (total, used, free uint64) {
	c.refreshIfStale(ctx)
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.diskTotal, c.diskUsed, c.diskFree
}

// SystemInfoHandler returns a handler that reports host system information.
// It supports a ?host=true|false query parameter to toggle between Windows host
// and Linux/WSL metrics when running under WSL2.
func SystemInfoHandler() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		// Determine whether to use Windows host metrics.
		useHost := isWSL2() // default: use host metrics when in WSL2
		if q := r.URL.Query().Get("host"); q != "" {
			switch strings.ToLower(q) {
			case "true", "1":
				useHost = true
			case "false", "0":
				useHost = false
			}
		}
		info := gatherSystemInfo2(r.Context(), useHost)

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(info)
	}
}

// gatherSystemInfo collects host system information using /proc and syscall.
// Kept for backward compatibility with tests.
func gatherSystemInfo() SystemInfo {
	return gatherSystemInfo2(context.Background(), false)
}

// gatherSystemInfo2 collects system information, optionally pulling memory and
// disk metrics from the Windows host when useHost is true (WSL2).
func gatherSystemInfo2(ctx context.Context, useHost bool) SystemInfo {
	hostname, _ := os.Hostname()

	// CPU usage from /proc/stat (two samples with 100ms delay) — always Linux.
	cpuUsage, cpuPerCore, cpuErr := getCPUUsage()
	if cpuErr != nil {
		cpuUsage = 0
		cpuPerCore = nil
	}

	var memTotal, memUsed, memFree uint64
	var diskTotal, diskUsed, diskFree uint64
	metricsSource := "linux"

	if useHost && isWSL2() {
		// Windows host metrics via cached PowerShell calls.
		memTotal, memUsed, memFree = winCache.getMemory(ctx)
		diskTotal, diskUsed, diskFree = winCache.getDisk(ctx)
		metricsSource = "windows_host"

		// Fallback to Linux if PowerShell returned zeros (e.g. first-call failure).
		if memTotal == 0 {
			memTotal, memUsed, memFree, _ = getMemoryInfo()
			metricsSource = "linux"
		}
		if diskTotal == 0 {
			var stat syscall.Statfs_t
			_ = syscall.Statfs("/", &stat)
			diskTotal = stat.Blocks * uint64(stat.Bsize)
			diskFree = stat.Bavail * uint64(stat.Bsize)
			diskUsed = diskTotal - diskFree
			metricsSource = "linux"
		}
	} else {
		// Standard Linux / WSL metrics.
		var memErr error
		memTotal, memUsed, memFree, memErr = getMemoryInfo()
		if memErr != nil {
			var sysInfo syscall.Sysinfo_t
			_ = syscall.Sysinfo(&sysInfo)
			memTotal = sysInfo.Totalram * uint64(sysInfo.Unit)
			memFree = sysInfo.Freeram * uint64(sysInfo.Unit)
			memUsed = memTotal - memFree
		}

		var stat syscall.Statfs_t
		_ = syscall.Statfs("/", &stat)
		diskTotal = stat.Blocks * uint64(stat.Bsize)
		diskFree = stat.Bavail * uint64(stat.Bsize)
		diskUsed = diskTotal - diskFree
	}

	var memUsage float64
	if memTotal > 0 {
		memUsage = float64(memUsed) / float64(memTotal) * 100
	}
	var diskUsage float64
	if diskTotal > 0 {
		diskUsage = float64(diskUsed) / float64(diskTotal) * 100
	}

	uptime := time.Since(startTime)

	return SystemInfo{
		Hostname:      hostname,
		OS:            runtime.GOOS,
		Platform:      runtime.GOOS + "/" + runtime.GOARCH,
		Architecture:  runtime.GOARCH,
		NumCPU:        runtime.NumCPU(),
		GoVersion:     runtime.Version(),
		CPUUsage:      cpuUsage,
		CPUPerCore:    cpuPerCore,
		MemoryTotal:   memTotal,
		MemoryUsed:    memUsed,
		MemoryFree:    memFree,
		MemoryUsage:   memUsage,
		DiskTotal:     diskTotal,
		DiskUsed:      diskUsed,
		DiskFree:      diskFree,
		DiskUsage:     diskUsage,
		Uptime:        formatUptime(uptime),
		UptimeSeconds: uptime.Seconds(),
		IsWSL:         isWSL2(),
		MetricsSource: metricsSource,
	}
}

// cpuStat holds total and idle jiffies for a single CPU or aggregate.
type cpuStat struct {
	total int64
	idle  int64
}

// procStatData holds parsed /proc/stat CPU data.
type procStatData struct {
	total int64
	idle  int64
	cores []cpuStat
}

// getCPUUsage reads /proc/stat twice with a 100ms delay to calculate real CPU usage.
func getCPUUsage() (float64, []float64, error) {
	first, err := readProcStat()
	if err != nil {
		return 0, nil, err
	}
	time.Sleep(100 * time.Millisecond)
	second, err := readProcStat()
	if err != nil {
		return 0, nil, err
	}

	// Calculate overall CPU usage
	totalDelta := second.total - first.total
	idleDelta := second.idle - first.idle
	var usage float64
	if totalDelta > 0 {
		usage = 100.0 * (1.0 - float64(idleDelta)/float64(totalDelta))
	}

	// Calculate per-core usage
	var perCore []float64
	for i := range first.cores {
		coreTotalDelta := second.cores[i].total - first.cores[i].total
		coreIdleDelta := second.cores[i].idle - first.cores[i].idle
		var coreUsage float64
		if coreTotalDelta > 0 {
			coreUsage = 100.0 * (1.0 - float64(coreIdleDelta)/float64(coreTotalDelta))
		}
		perCore = append(perCore, coreUsage)
	}

	return usage, perCore, nil
}

// readProcStat parses /proc/stat for CPU jiffies.
func readProcStat() (procStatData, error) {
	data, err := os.ReadFile("/proc/stat")
	if err != nil {
		return procStatData{}, err
	}

	var result procStatData
	for _, line := range strings.Split(string(data), "\n") {
		fields := strings.Fields(line)
		if len(fields) < 5 {
			continue
		}
		if fields[0] == "cpu" {
			// Overall CPU line
			result.total, result.idle = parseCPULine(fields[1:])
		} else if strings.HasPrefix(fields[0], "cpu") {
			// Per-core line (cpu0, cpu1, etc.)
			total, idle := parseCPULine(fields[1:])
			result.cores = append(result.cores, cpuStat{total: total, idle: idle})
		}
	}
	return result, nil
}

// parseCPULine parses the numeric fields from a /proc/stat cpu line.
// Fields: user nice system idle iowait irq softirq steal
func parseCPULine(fields []string) (int64, int64) {
	var vals []int64
	for _, f := range fields {
		v, _ := strconv.ParseInt(f, 10, 64)
		vals = append(vals, v)
	}
	var total int64
	for _, v := range vals {
		total += v
	}
	idle := vals[3] // idle is the 4th field
	if len(vals) > 4 {
		idle += vals[4] // add iowait
	}
	return total, idle
}

// getMemoryInfo reads /proc/meminfo for accurate memory values (works on WSL).
func getMemoryInfo() (total, used, free uint64, err error) {
	data, err := os.ReadFile("/proc/meminfo")
	if err != nil {
		return 0, 0, 0, err
	}
	var memTotal, memAvailable uint64
	for _, line := range strings.Split(string(data), "\n") {
		fields := strings.Fields(line)
		if len(fields) < 2 {
			continue
		}
		val, _ := strconv.ParseUint(fields[1], 10, 64)
		val *= 1024 // kB to bytes
		switch fields[0] {
		case "MemTotal:":
			memTotal = val
		case "MemAvailable:":
			memAvailable = val
		}
	}
	return memTotal, memTotal - memAvailable, memAvailable, nil
}

// formatUptime formats a duration into a human-readable string.
func formatUptime(d time.Duration) string {
	days := int(d.Hours()) / 24
	hours := int(d.Hours()) % 24
	minutes := int(d.Minutes()) % 60

	if days > 0 {
		return fmt.Sprintf("%dd %dh %dm", days, hours, minutes)
	}
	if hours > 0 {
		return fmt.Sprintf("%dh %dm", hours, minutes)
	}
	return fmt.Sprintf("%dm", minutes)
}
