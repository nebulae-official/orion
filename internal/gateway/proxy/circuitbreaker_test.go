package proxy_test

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/orion-rigel/orion/internal/gateway/proxy"
)

func TestCircuitBreaker_Allow(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name        string
		maxFail     int
		failures    int
		wantAllowed bool
	}{
		{
			name:        "closed circuit allows requests",
			maxFail:     3,
			failures:    0,
			wantAllowed: true,
		},
		{
			name:        "below threshold allows requests",
			maxFail:     5,
			failures:    4,
			wantAllowed: true,
		},
		{
			name:        "at threshold opens circuit",
			maxFail:     3,
			failures:    3,
			wantAllowed: false,
		},
		{
			name:        "above threshold stays open",
			maxFail:     3,
			failures:    10,
			wantAllowed: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			cb := proxy.NewCircuitBreaker("test-svc", proxy.WithMaxFailures(tt.maxFail))

			for range tt.failures {
				cb.RecordFailure()
			}

			got := cb.Allow()
			if got != tt.wantAllowed {
				t.Errorf("Allow() = %v, want %v after %d failures (threshold %d)", got, tt.wantAllowed, tt.failures, tt.maxFail)
			}
		})
	}
}

func TestCircuitBreaker_StateTransitions(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name      string
		setup     func(cb *proxy.CircuitBreaker)
		wantState proxy.State
	}{
		{
			name:      "initial state is closed",
			setup:     func(_ *proxy.CircuitBreaker) {},
			wantState: proxy.StateClosed,
		},
		{
			name: "opens after max failures",
			setup: func(cb *proxy.CircuitBreaker) {
				for range 3 {
					cb.RecordFailure()
				}
			},
			wantState: proxy.StateOpen,
		},
		{
			name: "success resets to closed",
			setup: func(cb *proxy.CircuitBreaker) {
				cb.RecordFailure()
				cb.RecordFailure()
				cb.RecordSuccess()
			},
			wantState: proxy.StateClosed,
		},
		{
			name: "success after open resets to closed",
			setup: func(cb *proxy.CircuitBreaker) {
				for range 3 {
					cb.RecordFailure()
				}
				// Simulate half-open by waiting for reset timeout
				// then record success
				cb.RecordSuccess()
			},
			wantState: proxy.StateClosed,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			cb := proxy.NewCircuitBreaker("test-svc",
				proxy.WithMaxFailures(3),
				proxy.WithResetTimeout(10*time.Millisecond),
			)
			tt.setup(cb)

			got := cb.State()
			if got != tt.wantState {
				t.Errorf("State() = %v, want %v", got, tt.wantState)
			}
		})
	}
}

func TestCircuitBreaker_HalfOpenAfterTimeout(t *testing.T) {
	t.Parallel()

	cb := proxy.NewCircuitBreaker("test-svc",
		proxy.WithMaxFailures(2),
		proxy.WithResetTimeout(10*time.Millisecond),
	)

	// Trip the circuit
	cb.RecordFailure()
	cb.RecordFailure()

	if cb.State() != proxy.StateOpen {
		t.Fatalf("expected open, got %v", cb.State())
	}

	// Wait for reset timeout
	time.Sleep(15 * time.Millisecond)

	if cb.State() != proxy.StateHalfOpen {
		t.Fatalf("expected half-open after timeout, got %v", cb.State())
	}

	// A successful probe should close the circuit
	if !cb.Allow() {
		t.Fatal("half-open should allow a probe request")
	}
	cb.RecordSuccess()

	if cb.State() != proxy.StateClosed {
		t.Fatalf("expected closed after successful probe, got %v", cb.State())
	}
}

func TestCircuitBreaker_HalfOpenFailureReopens(t *testing.T) {
	t.Parallel()

	cb := proxy.NewCircuitBreaker("test-svc",
		proxy.WithMaxFailures(1),
		proxy.WithResetTimeout(10*time.Millisecond),
	)

	// Trip the circuit
	cb.RecordFailure()

	// Wait for half-open
	time.Sleep(15 * time.Millisecond)

	if cb.State() != proxy.StateHalfOpen {
		t.Fatalf("expected half-open, got %v", cb.State())
	}

	// Probe fails — circuit should re-open
	cb.RecordFailure()

	if cb.State() != proxy.StateOpen {
		t.Fatalf("expected open after failed probe, got %v", cb.State())
	}
}

func TestCircuitBreaker_Wrap(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name           string
		upstreamStatus int
		failsBefore    int
		maxFail        int
		wantStatus     int
	}{
		{
			name:           "forwards successful request",
			upstreamStatus: http.StatusOK,
			failsBefore:    0,
			maxFail:        3,
			wantStatus:     http.StatusOK,
		},
		{
			name:           "forwards when below threshold",
			upstreamStatus: http.StatusOK,
			failsBefore:    2,
			maxFail:        3,
			wantStatus:     http.StatusOK,
		},
		{
			name:           "returns 503 when circuit open",
			upstreamStatus: http.StatusOK,
			failsBefore:    3,
			maxFail:        3,
			wantStatus:     http.StatusServiceUnavailable,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			cb := proxy.NewCircuitBreaker("test-svc", proxy.WithMaxFailures(tt.maxFail))

			// Pre-load failures
			for range tt.failsBefore {
				cb.RecordFailure()
			}

			upstream := http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
				w.WriteHeader(tt.upstreamStatus)
			})

			handler := cb.Wrap(upstream)
			req := httptest.NewRequest(http.MethodGet, "/test", nil)
			rec := httptest.NewRecorder()

			handler.ServeHTTP(rec, req)

			if rec.Code != tt.wantStatus {
				t.Errorf("got status %d, want %d", rec.Code, tt.wantStatus)
			}
		})
	}
}

func TestCircuitBreaker_WrapRecordsUpstream5xx(t *testing.T) {
	t.Parallel()

	cb := proxy.NewCircuitBreaker("test-svc", proxy.WithMaxFailures(2))

	upstream := http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusBadGateway)
	})

	handler := cb.Wrap(upstream)

	for range 2 {
		req := httptest.NewRequest(http.MethodGet, "/test", nil)
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, req)
	}

	if cb.State() != proxy.StateOpen {
		t.Errorf("expected circuit to open after 2 upstream 5xx errors, got state %v", cb.State())
	}

	// Next request should be rejected
	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusServiceUnavailable {
		t.Errorf("got status %d, want 503", rec.Code)
	}
}

func TestCircuitBreaker_DefaultOptions(t *testing.T) {
	t.Parallel()

	cb := proxy.NewCircuitBreaker("defaults")

	// Should require 5 failures by default
	for range 4 {
		cb.RecordFailure()
	}
	if !cb.Allow() {
		t.Error("should still allow after 4 failures with default threshold of 5")
	}

	cb.RecordFailure()
	if cb.Allow() {
		t.Error("should not allow after 5 failures")
	}
}
