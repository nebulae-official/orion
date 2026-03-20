package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
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

// ---- Windows host metrics via sidecar JSON file ----------------------------
//
// The WSL metrics collector (scripts/wsl-metrics-collector.py) runs on the WSL2
// host and writes Windows metrics to /tmp/orion-host-metrics.json every 2s.
// This file is volume-mounted into the gateway container as read-only.
// We read this file instead of calling powershell.exe directly because Docker
// containers inside WSL2 do not have access to Windows interop (powershell.exe).

const hostMetricsFile = "/tmp/orion-host-metrics.json"

// hostMetricsMaxAge is the maximum age before host metrics are considered stale.
const hostMetricsMaxAge = 10 * time.Second

// hostMetrics represents the JSON written by wsl-metrics-collector.py.
type hostMetrics struct {
	MemoryTotal uint64  `json:"memory_total"`
	MemoryFree  uint64  `json:"memory_free"`
	MemoryUsed  uint64  `json:"memory_used"`
	DiskTotal   uint64  `json:"disk_total"`
	DiskFree    uint64  `json:"disk_free"`
	DiskUsed    uint64  `json:"disk_used"`
	CPUUsage    float64 `json:"cpu_usage"`
	Source      string  `json:"source"`
	Timestamp   string  `json:"timestamp"`
}

// readHostMetrics reads the sidecar metrics file and returns the parsed metrics.
// It returns an error if the file does not exist, cannot be parsed, or is stale.
func readHostMetrics() (*hostMetrics, error) {
	data, err := os.ReadFile(hostMetricsFile)
	if err != nil {
		return nil, fmt.Errorf("host metrics file not found: %w (start the WSL metrics collector with 'make metrics-collector')", err)
	}

	var m hostMetrics
	if err := json.Unmarshal(data, &m); err != nil {
		return nil, fmt.Errorf("host metrics parse error: %w", err)
	}

	// Check freshness via the file's modification time (simpler than parsing
	// the embedded timestamp and avoids timezone/format issues).
	info, err := os.Stat(hostMetricsFile)
	if err != nil {
		return nil, err
	}
	if time.Since(info.ModTime()) > hostMetricsMaxAge {
		return nil, fmt.Errorf("host metrics are stale (last updated %s ago)", time.Since(info.ModTime()).Round(time.Second))
	}

	return &m, nil
}

// getWindowsMetricsDirect calls powershell.exe directly via WSL2 interop to
// fetch Windows host memory and disk metrics. This avoids needing the sidecar
// collector script and works whenever powershell.exe is available on PATH.
func getWindowsMetricsDirect() (*hostMetrics, error) {
	psPath, err := exec.LookPath("powershell.exe")
	if err != nil {
		return nil, fmt.Errorf("powershell.exe not found: %w", err)
	}

	script := `$os = Get-CimInstance Win32_OperatingSystem; ` +
		`$disk = Get-CimInstance Win32_LogicalDisk -Filter "DeviceID='C:'"; ` +
		`@{ ` +
		`memory_total = $os.TotalVisibleMemorySize * 1024; ` +
		`memory_free = $os.FreePhysicalMemory * 1024; ` +
		`memory_used = ($os.TotalVisibleMemorySize - $os.FreePhysicalMemory) * 1024; ` +
		`disk_total = $disk.Size; ` +
		`disk_free = $disk.FreeSpace; ` +
		`disk_used = $disk.Size - $disk.FreeSpace; ` +
		`source = "windows_host"; ` +
		`timestamp = (Get-Date -Format o) ` +
		`} | ConvertTo-Json`

	ctx, cancel := context.WithTimeout(context.Background(), 8*time.Second)
	defer cancel()

	cmd := exec.CommandContext(ctx, psPath, "-NoProfile", "-NonInteractive", "-Command", script)
	out, err := cmd.Output()
	if err != nil {
		return nil, fmt.Errorf("powershell.exe failed: %w", err)
	}

	var m hostMetrics
	if err := json.Unmarshal(out, &m); err != nil {
		return nil, fmt.Errorf("parse powershell output: %w", err)
	}
	return &m, nil
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

// gatherSystemInfo2 collects system information, optionally pulling memory and
// disk metrics from the Windows host when useHost is true (WSL2).
func gatherSystemInfo2(_ context.Context, useHost bool) SystemInfo {
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
		// Try Windows host metrics: sidecar file first, then direct PowerShell.
		if hm, err := readHostMetrics(); err == nil {
			memTotal = hm.MemoryTotal
			memUsed = hm.MemoryUsed
			memFree = hm.MemoryFree
			diskTotal = hm.DiskTotal
			diskUsed = hm.DiskUsed
			diskFree = hm.DiskFree
			metricsSource = "windows_host"
		} else if hm, psErr := getWindowsMetricsDirect(); psErr == nil {
			memTotal = hm.MemoryTotal
			memUsed = hm.MemoryUsed
			memFree = hm.MemoryFree
			diskTotal = hm.DiskTotal
			diskUsed = hm.DiskUsed
			diskFree = hm.DiskFree
			metricsSource = "windows_host"
			slog.Debug("using direct powershell for host metrics (sidecar unavailable)", "sidecar_err", err)
		} else {
			// Both methods failed — fall back to Linux /proc metrics.
			slog.Warn("windows host metrics unavailable, falling back to WSL",
				"sidecar_err", err, "powershell_err", psErr)
			memTotal, memUsed, memFree, _ = getMemoryInfo()
			var stat syscall.Statfs_t
			_ = syscall.Statfs("/", &stat)
			diskTotal = stat.Blocks * uint64(stat.Bsize)
			diskFree = stat.Bavail * uint64(stat.Bsize)
			diskUsed = diskTotal - diskFree
			metricsSource = "wsl"
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
