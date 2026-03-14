package handlers

import (
	"encoding/json"
	"net/http"
	"os/exec"
	"strconv"
	"strings"
)

// GpuInfo represents GPU telemetry returned to the dashboard.
type GpuInfo struct {
	Name               string   `json:"name"`
	VRAMTotalMB        float64  `json:"vram_total_mb"`
	VRAMUsedMB         float64  `json:"vram_used_mb"`
	VRAMFreeMB         float64  `json:"vram_free_mb"`
	UtilizationPercent float64  `json:"utilization_percent"`
	TemperatureC       *float64 `json:"temperature_c"`
}

// GPU returns a handler that queries nvidia-smi for GPU telemetry.
func GPU() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		info, err := queryGPU()
		if err != nil {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusServiceUnavailable)
			json.NewEncoder(w).Encode(map[string]string{
				"error": err.Error(),
			})
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(info)
	}
}

// queryGPU shells out to nvidia-smi and parses the CSV output.
func queryGPU() (*GpuInfo, error) {
	out, err := exec.Command(
		"nvidia-smi",
		"--query-gpu=name,memory.total,memory.used,memory.free,utilization.gpu,temperature.gpu",
		"--format=csv,noheader,nounits",
	).Output()
	if err != nil {
		return nil, err
	}

	// Output is a single CSV line like:
	// NVIDIA GeForce RTX 3070, 8192, 4304, 3715, 22, 45
	fields := strings.SplitN(strings.TrimSpace(string(out)), ", ", 6)
	if len(fields) < 6 {
		return nil, &exec.Error{Name: "nvidia-smi", Err: exec.ErrNotFound}
	}

	totalMB, _ := strconv.ParseFloat(strings.TrimSpace(fields[1]), 64)
	usedMB, _ := strconv.ParseFloat(strings.TrimSpace(fields[2]), 64)
	freeMB, _ := strconv.ParseFloat(strings.TrimSpace(fields[3]), 64)
	utilPct, _ := strconv.ParseFloat(strings.TrimSpace(fields[4]), 64)

	var tempC *float64
	if v, err := strconv.ParseFloat(strings.TrimSpace(fields[5]), 64); err == nil {
		tempC = &v
	}

	return &GpuInfo{
		Name:               strings.TrimSpace(fields[0]),
		VRAMTotalMB:        totalMB,
		VRAMUsedMB:         usedMB,
		VRAMFreeMB:         freeMB,
		UtilizationPercent: utilPct,
		TemperatureC:       tempC,
	}, nil
}
