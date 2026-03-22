package handlers_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/orion-rigel/orion/internal/gateway/handlers"
)

func TestGPUHandler(t *testing.T) {
	t.Run("returns JSON response", func(t *testing.T) {
		handler := handlers.GPU()

		req := httptest.NewRequest(http.MethodGet, "/api/v1/gpu", nil)
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, req)

		contentType := rec.Header().Get("Content-Type")
		if contentType != "application/json" {
			t.Errorf("expected Content-Type application/json, got %s", contentType)
		}

		// In CI or machines without nvidia-smi, expect 503.
		// On machines with GPU, expect 200 with valid GpuResponse.
		if rec.Code == http.StatusOK {
			var resp handlers.GpuResponse
			if err := json.NewDecoder(rec.Body).Decode(&resp); err != nil {
				t.Fatalf("failed to decode GPU response: %v", err)
			}
			if len(resp.GPUs) == 0 {
				t.Error("expected at least one GPU when status is 200")
			}
			for _, gpu := range resp.GPUs {
				if gpu.Name == "" {
					t.Error("expected GPU name to be non-empty")
				}
				if gpu.VRAMTotalMB <= 0 {
					t.Error("expected VRAMTotalMB > 0")
				}
			}
		} else if rec.Code == http.StatusServiceUnavailable {
			var errResp map[string]string
			if err := json.NewDecoder(rec.Body).Decode(&errResp); err != nil {
				t.Fatalf("failed to decode error response: %v", err)
			}
			if errResp["error"] == "" {
				t.Error("expected error message in 503 response")
			}
		} else {
			t.Errorf("expected status 200 or 503, got %d", rec.Code)
		}
	})
}

func TestGpuResponseStructure(t *testing.T) {
	t.Run("GpuResponse marshals correctly", func(t *testing.T) {
		temp := 65.0
		power := 120.5
		resp := handlers.GpuResponse{
			GPUs: []handlers.GpuInfo{
				{
					Name:               "NVIDIA RTX 4090",
					VRAMTotalMB:        24576,
					VRAMUsedMB:         8192,
					VRAMFreeMB:         16384,
					UtilizationPercent: 45.0,
					TemperatureC:       &temp,
					PowerDrawW:         &power,
					DriverVersion:      "535.86.05",
					CUDAVersion:        "12.2",
				},
			},
		}

		data, err := json.Marshal(resp)
		if err != nil {
			t.Fatalf("failed to marshal GpuResponse: %v", err)
		}

		var decoded handlers.GpuResponse
		if err := json.Unmarshal(data, &decoded); err != nil {
			t.Fatalf("failed to unmarshal GpuResponse: %v", err)
		}

		if len(decoded.GPUs) != 1 {
			t.Fatalf("expected 1 GPU, got %d", len(decoded.GPUs))
		}
		gpu := decoded.GPUs[0]
		if gpu.Name != "NVIDIA RTX 4090" {
			t.Errorf("expected name %q, got %q", "NVIDIA RTX 4090", gpu.Name)
		}
		if gpu.TemperatureC == nil || *gpu.TemperatureC != 65.0 {
			t.Errorf("expected TemperatureC 65.0, got %v", gpu.TemperatureC)
		}
		if gpu.PowerDrawW == nil || *gpu.PowerDrawW != 120.5 {
			t.Errorf("expected PowerDrawW 120.5, got %v", gpu.PowerDrawW)
		}
	})

	t.Run("nullable fields omit when nil", func(t *testing.T) {
		resp := handlers.GpuResponse{
			GPUs: []handlers.GpuInfo{
				{
					Name:          "Test GPU",
					VRAMTotalMB:   1024,
					DriverVersion: "535.0",
				},
			},
		}

		data, err := json.Marshal(resp)
		if err != nil {
			t.Fatalf("failed to marshal: %v", err)
		}

		// Verify nullable fields are present but null (Go encodes *float64 nil as null).
		var raw map[string]interface{}
		if err := json.Unmarshal(data, &raw); err != nil {
			t.Fatalf("failed to unmarshal raw: %v", err)
		}

		gpus := raw["gpus"].([]interface{})
		gpu := gpus[0].(map[string]interface{})

		if gpu["temperature_c"] != nil {
			t.Errorf("expected temperature_c to be null, got %v", gpu["temperature_c"])
		}
		if gpu["power_draw_w"] != nil {
			t.Errorf("expected power_draw_w to be null, got %v", gpu["power_draw_w"])
		}
	})
}
