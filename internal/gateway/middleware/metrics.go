package middleware

import (
	"net/http"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

var (
	httpRequestsTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "orion_gateway_requests_total",
			Help: "Total number of HTTP requests",
		},
		[]string{"method", "path", "status_code"},
	)

	httpRequestDuration = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "orion_gateway_request_duration_seconds",
			Help:    "HTTP request duration in seconds",
			Buckets: prometheus.DefBuckets,
		},
		[]string{"method", "path"},
	)

	httpActiveConnections = promauto.NewGauge(
		prometheus.GaugeOpts{
			Name: "orion_gateway_active_connections",
			Help: "Number of active HTTP connections",
		},
	)
)

// Metrics records request count, duration, and active connections for Prometheus.
func Metrics(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		httpActiveConnections.Inc()
		defer httpActiveConnections.Dec()

		start := time.Now()
		rw := newResponseWriter(w)

		next.ServeHTTP(rw, r)

		duration := time.Since(start).Seconds()
		status := strconv.Itoa(rw.statusCode)

		// Use the registered route pattern to avoid high-cardinality labels
		// from dynamic path segments (e.g. UUIDs).
		routePattern := r.URL.Path
		if rctx := chi.RouteContext(r.Context()); rctx != nil {
			if pattern := rctx.RoutePattern(); pattern != "" {
				routePattern = pattern
			}
		}

		httpRequestsTotal.WithLabelValues(r.Method, routePattern, status).Inc()
		httpRequestDuration.WithLabelValues(r.Method, routePattern).Observe(duration)
	})
}
