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
// the given backend service URL. It strips the matched route prefix so the
// backend receives clean paths (e.g., /api/v1/scout/trends -> /trends).
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
		// Strip the /api/v1/{service} prefix from the path before proxying.
		// Chi sets the route context so we can use the wildcard match.
		// The path after the service prefix becomes the backend path.
		parts := strings.SplitN(r.URL.Path, "/", 5) // ["", "api", "v1", "service", "rest..."]
		if len(parts) >= 5 {
			r.URL.Path = "/" + parts[4]
		} else {
			r.URL.Path = "/"
		}
		r.URL.RawPath = ""

		proxy.ServeHTTP(w, r)
	}), nil
}
