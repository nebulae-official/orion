package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"runtime"
	"syscall"
	"time"
)

// startTime records when the gateway process started.
var startTime = time.Now()

// SystemInfo represents host system information returned to the dashboard.
type SystemInfo struct {
	Hostname     string  `json:"hostname"`
	OS           string  `json:"os"`
	Platform     string  `json:"platform"`
	Architecture string  `json:"architecture"`
	NumCPU       int     `json:"num_cpu"`
	GoVersion    string  `json:"go_version"`
	CPUUsage     float64 `json:"cpu_usage"`
	MemoryTotal  uint64  `json:"memory_total"`
	MemoryUsed   uint64  `json:"memory_used"`
	MemoryFree   uint64  `json:"memory_free"`
	MemoryUsage  float64 `json:"memory_usage"`
	DiskTotal    uint64  `json:"disk_total"`
	DiskUsed     uint64  `json:"disk_used"`
	DiskFree     uint64  `json:"disk_free"`
	DiskUsage    float64 `json:"disk_usage"`
	Uptime       string  `json:"uptime"`
	UptimeSeconds float64 `json:"uptime_seconds"`
}

// SystemInfoHandler returns a handler that reports host system information.
func SystemInfoHandler() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		info := gatherSystemInfo()

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_ = json.NewEncoder(w).Encode(info)
	}
}

// gatherSystemInfo collects host system information using Go standard library.
func gatherSystemInfo() SystemInfo {
	hostname, _ := os.Hostname()

	// Memory stats from Go runtime
	var memStats runtime.MemStats
	runtime.ReadMemStats(&memStats)

	// System memory via sysinfo
	var sysInfo syscall.Sysinfo_t
	_ = syscall.Sysinfo(&sysInfo)

	memTotal := sysInfo.Totalram * uint64(sysInfo.Unit)
	memFree := sysInfo.Freeram * uint64(sysInfo.Unit)
	memUsed := memTotal - memFree
	var memUsage float64
	if memTotal > 0 {
		memUsage = float64(memUsed) / float64(memTotal) * 100
	}

	// Disk usage via statfs on root
	var stat syscall.Statfs_t
	_ = syscall.Statfs("/", &stat)

	diskTotal := stat.Blocks * uint64(stat.Bsize)
	diskFree := stat.Bavail * uint64(stat.Bsize)
	diskUsed := diskTotal - diskFree
	var diskUsage float64
	if diskTotal > 0 {
		diskUsage = float64(diskUsed) / float64(diskTotal) * 100
	}

	// Uptime
	uptime := time.Since(startTime)

	return SystemInfo{
		Hostname:      hostname,
		OS:            runtime.GOOS,
		Platform:      runtime.GOOS + "/" + runtime.GOARCH,
		Architecture:  runtime.GOARCH,
		NumCPU:        runtime.NumCPU(),
		GoVersion:     runtime.Version(),
		CPUUsage:      estimateCPUUsage(),
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
	}
}

// estimateCPUUsage returns a rough CPU usage estimate based on goroutine count
// relative to available CPUs. This is a lightweight approximation that avoids
// parsing /proc/stat.
func estimateCPUUsage() float64 {
	numCPU := runtime.NumCPU()
	numGoroutine := runtime.NumGoroutine()
	// Rough heuristic: goroutines / (CPUs * 4) capped at 100
	usage := float64(numGoroutine) / float64(numCPU*4) * 100
	if usage > 100 {
		usage = 100
	}
	return usage
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
