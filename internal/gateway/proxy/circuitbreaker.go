// Package proxy provides reliability primitives for upstream service communication.
package proxy

import (
	"fmt"
	"log/slog"
	"net/http"
	"sync"
	"time"
)

// State represents the current state of a circuit breaker.
type State int

const (
	// StateClosed is the normal operating state — requests are forwarded.
	StateClosed State = iota
	// StateOpen means the circuit has tripped — requests are rejected immediately.
	StateOpen
	// StateHalfOpen allows a single probe request to determine recovery.
	StateHalfOpen
)

// String returns a human-readable name for the state.
func (s State) String() string {
	switch s {
	case StateClosed:
		return "closed"
	case StateOpen:
		return "open"
	case StateHalfOpen:
		return "half-open"
	default:
		return "unknown"
	}
}

// CircuitBreaker implements a simple three-state circuit breaker.
// It is safe for concurrent use.
type CircuitBreaker struct {
	mu sync.Mutex

	name             string
	maxFailures      int
	resetTimeout     time.Duration
	consecutiveFails int
	state            State
	lastFailure      time.Time
	halfOpenProbing  bool
}

// Option configures a CircuitBreaker.
type Option func(*CircuitBreaker)

// WithMaxFailures sets the number of consecutive failures before the circuit
// opens. Default is 5.
func WithMaxFailures(n int) Option {
	return func(cb *CircuitBreaker) {
		if n > 0 {
			cb.maxFailures = n
		}
	}
}

// WithResetTimeout sets how long the circuit stays open before transitioning
// to half-open. Default is 30 seconds.
func WithResetTimeout(d time.Duration) Option {
	return func(cb *CircuitBreaker) {
		if d > 0 {
			cb.resetTimeout = d
		}
	}
}

// NewCircuitBreaker creates a circuit breaker for the named service.
func NewCircuitBreaker(name string, opts ...Option) *CircuitBreaker {
	cb := &CircuitBreaker{
		name:         name,
		maxFailures:  5,
		resetTimeout: 30 * time.Second,
		state:        StateClosed,
	}
	for _, opt := range opts {
		opt(cb)
	}
	return cb
}

// State returns the current state of the circuit breaker.
func (cb *CircuitBreaker) State() State {
	cb.mu.Lock()
	defer cb.mu.Unlock()
	return cb.currentState()
}

// currentState returns the effective state, accounting for timeout-based
// transitions from open to half-open. Must be called with cb.mu held.
func (cb *CircuitBreaker) currentState() State {
	if cb.state == StateOpen && time.Since(cb.lastFailure) >= cb.resetTimeout {
		cb.state = StateHalfOpen
		slog.Info("circuit_breaker_half_open", "service", cb.name)
	}
	return cb.state
}

// Allow reports whether a request should be forwarded to the upstream service.
// It returns false when the circuit is open, indicating the caller should fail
// fast with a 503.
func (cb *CircuitBreaker) Allow() bool {
	cb.mu.Lock()
	defer cb.mu.Unlock()

	switch cb.currentState() {
	case StateClosed:
		return true
	case StateHalfOpen:
		// Allow exactly one probe request.
		if cb.halfOpenProbing {
			return false
		}
		cb.halfOpenProbing = true
		return true
	case StateOpen:
		return false
	default:
		return true
	}
}

// RecordSuccess records a successful response from the upstream service.
func (cb *CircuitBreaker) RecordSuccess() {
	cb.mu.Lock()
	defer cb.mu.Unlock()

	prevState := cb.state
	cb.consecutiveFails = 0
	cb.state = StateClosed
	cb.halfOpenProbing = false

	if prevState != StateClosed {
		slog.Info("circuit_breaker_closed", "service", cb.name, "previous_state", prevState.String())
	}
}

// RecordFailure records a failed request. If the number of consecutive
// failures reaches the threshold the circuit opens.
func (cb *CircuitBreaker) RecordFailure() {
	cb.mu.Lock()
	defer cb.mu.Unlock()

	cb.consecutiveFails++
	cb.lastFailure = time.Now()
	cb.halfOpenProbing = false

	if cb.consecutiveFails >= cb.maxFailures && cb.state != StateOpen {
		cb.state = StateOpen
		slog.Warn("circuit_breaker_opened",
			"service", cb.name,
			"consecutive_failures", cb.consecutiveFails,
			"reset_timeout", cb.resetTimeout.String(),
		)
	}
}

// Wrap returns an http.Handler that guards the given handler with this circuit
// breaker. When the circuit is open, it responds with 503 Service Unavailable.
func (cb *CircuitBreaker) Wrap(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !cb.Allow() {
			http.Error(w, fmt.Sprintf(`{"message":"service %s is temporarily unavailable"}`, cb.name), http.StatusServiceUnavailable)
			return
		}

		rec := &statusRecorder{ResponseWriter: w, statusCode: http.StatusOK}
		next.ServeHTTP(rec, r)

		if rec.statusCode >= 500 {
			cb.RecordFailure()
		} else {
			cb.RecordSuccess()
		}
	})
}

// statusRecorder captures the status code written by the upstream handler.
type statusRecorder struct {
	http.ResponseWriter
	statusCode  int
	wroteHeader bool
}

func (sr *statusRecorder) WriteHeader(code int) {
	if !sr.wroteHeader {
		sr.statusCode = code
		sr.wroteHeader = true
	}
	sr.ResponseWriter.WriteHeader(code)
}
