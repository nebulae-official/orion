package handlers

import (
	"fmt"
	"log/slog"
	"net/http"
	"net/http/httputil"
	"net/url"
	"strings"

	"github.com/orion-rigel/orion/internal/gateway/middleware"
)

// NewServiceProxy creates a reverse proxy handler that forwards requests to
// the given backend service URL. It rewrites the path to replace the service
// name segment while preserving the /api/v1/ prefix that backends expect
// (e.g., /api/v1/scout/trends -> /api/v1/trends).
func NewServiceProxy(target string, internalToken string) (http.Handler, error) {
	targetURL, err := url.Parse(target)
	if err != nil {
		return nil, fmt.Errorf("parsing proxy target URL %q: %w", target, err)
	}

	proxy := httputil.NewSingleHostReverseProxy(targetURL)

	// Override the Director to strip the route prefix and forward the request ID.
	defaultDirector := proxy.Director
	proxy.Director = func(req *http.Request) {
		defaultDirector(req)

		// Forward the X-Request-ID header from the gateway context.
		if reqID := middleware.GetRequestID(req.Context()); reqID != "" {
			req.Header.Set("X-Request-ID", reqID)
		}

		// Forward authenticated user identity to backend services.
		if user, ok := middleware.GetUser(req.Context()); ok {
			req.Header.Set("X-User-ID", user.UserID)
			req.Header.Set("X-User-Role", user.Role)
			req.Header.Set("X-User-Email", user.Email)
		}

		// Inject internal service-to-service authentication token.
		if internalToken != "" {
			req.Header.Set("X-Internal-Token", internalToken)
		}
	}

	proxy.ErrorHandler = func(w http.ResponseWriter, r *http.Request, err error) {
		slog.Error("proxy error",
			"target", target,
			"path", r.URL.Path,
			"error", err.Error(),
			"request_id", middleware.GetRequestID(r.Context()),
		)
		http.Error(w, "service unavailable", http.StatusBadGateway)
	}

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Rewrite /api/v1/{service}/{rest...} → /api/v1/{rest...}
		// This preserves the /api/v1/ prefix that backend services expect,
		// only removing the service name segment.
		parts := strings.SplitN(r.URL.Path, "/", 5) // ["", "api", "v1", "service", "rest..."]
		if len(parts) >= 5 {
			r.URL.Path = "/api/v1/" + parts[4]
		} else {
			r.URL.Path = "/api/v1/"
		}
		r.URL.RawPath = ""

		proxy.ServeHTTP(w, r)
	}), nil
}
