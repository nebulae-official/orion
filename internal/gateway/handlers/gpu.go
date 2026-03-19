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
	PowerDrawW         *float64 `json:"power_draw_w"`
	ClockGPUMHz        *float64 `json:"clock_gpu_mhz"`
	ClockMemMHz        *float64 `json:"clock_mem_mhz"`
	FanSpeedPercent    *float64 `json:"fan_speed_percent"`
	DriverVersion      string   `json:"driver_version"`
	CUDAVersion        string   `json:"cuda_version"`
}

// GpuResponse wraps the array of GPUs for the API response.
type GpuResponse struct {
	GPUs []GpuInfo `json:"gpus"`
}

// GPU returns a handler that queries nvidia-smi for GPU telemetry.
func GPU() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		gpus, err := queryGPUs()
		if err != nil {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusServiceUnavailable)
			_ = json.NewEncoder(w).Encode(map[string]string{
				"error": err.Error(),
			})
			return
		}

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(GpuResponse{GPUs: gpus})
	}
}

// queryGPUs shells out to nvidia-smi and parses the CSV output for all GPUs.
func queryGPUs() ([]GpuInfo, error) {
	out, err := exec.Command(
		"nvidia-smi",
		"--query-gpu=name,memory.total,memory.used,memory.free,utilization.gpu,temperature.gpu,power.draw,clocks.gr,clocks.mem,fan.speed,driver_version",
		"--format=csv,noheader,nounits",
	).Output()
	if err != nil {
		return nil, err
	}

	// Get CUDA version separately
	cudaVersion := queryCUDAVersion()

	lines := strings.Split(strings.TrimSpace(string(out)), "\n")
	gpus := make([]GpuInfo, 0, len(lines))

	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}

		fields := strings.SplitN(line, ", ", 11)
		if len(fields) < 11 {
			continue
		}

		totalMB, _ := strconv.ParseFloat(strings.TrimSpace(fields[1]), 64)
		usedMB, _ := strconv.ParseFloat(strings.TrimSpace(fields[2]), 64)
		freeMB, _ := strconv.ParseFloat(strings.TrimSpace(fields[3]), 64)
		utilPct, _ := strconv.ParseFloat(strings.TrimSpace(fields[4]), 64)

		var tempC *float64
		if v, parseErr := strconv.ParseFloat(strings.TrimSpace(fields[5]), 64); parseErr == nil {
			tempC = &v
		}

		var powerW *float64
		if v, parseErr := strconv.ParseFloat(strings.TrimSpace(fields[6]), 64); parseErr == nil {
			powerW = &v
		}

		var clockGPU *float64
		if v, parseErr := strconv.ParseFloat(strings.TrimSpace(fields[7]), 64); parseErr == nil {
			clockGPU = &v
		}

		var clockMem *float64
		if v, parseErr := strconv.ParseFloat(strings.TrimSpace(fields[8]), 64); parseErr == nil {
			clockMem = &v
		}

		var fanSpeed *float64
		if v, parseErr := strconv.ParseFloat(strings.TrimSpace(fields[9]), 64); parseErr == nil {
			fanSpeed = &v
		}

		driverVersion := strings.TrimSpace(fields[10])

		gpus = append(gpus, GpuInfo{
			Name:               strings.TrimSpace(fields[0]),
			VRAMTotalMB:        totalMB,
			VRAMUsedMB:         usedMB,
			VRAMFreeMB:         freeMB,
			UtilizationPercent: utilPct,
			TemperatureC:       tempC,
			PowerDrawW:         powerW,
			ClockGPUMHz:        clockGPU,
			ClockMemMHz:        clockMem,
			FanSpeedPercent:    fanSpeed,
			DriverVersion:      driverVersion,
			CUDAVersion:        cudaVersion,
		})
	}

	if len(gpus) == 0 {
		return nil, &exec.Error{Name: "nvidia-smi", Err: exec.ErrNotFound}
	}

	return gpus, nil
}

// queryCUDAVersion extracts the CUDA version from nvidia-smi output.
func queryCUDAVersion() string {
	out, err := exec.Command("nvidia-smi", "--query-gpu=driver_version", "--format=csv,noheader").Output()
	if err != nil {
		return ""
	}

	// nvidia-smi header line contains CUDA version; try parsing from the main command
	headerOut, err := exec.Command("nvidia-smi").Output()
	if err != nil {
		_ = out // suppress unused
		return ""
	}

	// Look for "CUDA Version: X.Y" in the nvidia-smi output
	header := string(headerOut)
	idx := strings.Index(header, "CUDA Version:")
	if idx == -1 {
		return ""
	}
	rest := header[idx+len("CUDA Version:"):]
	rest = strings.TrimSpace(rest)
	// Take until next whitespace or pipe
	end := strings.IndexAny(rest, " |\n\r")
	if end == -1 {
		return rest
	}
	return strings.TrimSpace(rest[:end])
}
