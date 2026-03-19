package middleware

import (
	"context"
	"net/http"
	"strings"

	"github.com/golang-jwt/jwt/v5"
	"github.com/orion-rigel/orion/pkg/auth"
)

const userContextKey contextKey = "user"

// UserClaims holds the JWT claims extracted from the token.
type UserClaims struct {
	UserID string
	Name   string
	Email  string
	Role   string
}

// GetUser retrieves the authenticated user from the request context.
func GetUser(ctx context.Context) (UserClaims, bool) {
	u, ok := ctx.Value(userContextKey).(UserClaims)
	return u, ok
}

// Auth returns middleware that validates JWT Bearer tokens and optionally
// checks whether the token has been revoked. Pass a nil blacklist to skip
// revocation checks (useful in tests or when Redis is unavailable).
func Auth(secret string, bl *auth.TokenBlacklist) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			authHeader := r.Header.Get("Authorization")
			if authHeader == "" || !strings.HasPrefix(authHeader, "Bearer ") {
				http.Error(w, `{"message":"missing or invalid authorization header"}`, http.StatusUnauthorized)
				return
			}

			tokenStr := strings.TrimPrefix(authHeader, "Bearer ")
			token, err := jwt.Parse(tokenStr, func(token *jwt.Token) (interface{}, error) {
				if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
					return nil, jwt.ErrSignatureInvalid
				}
				return []byte(secret), nil
			})
			if err != nil || !token.Valid {
				http.Error(w, `{"message":"invalid or expired token"}`, http.StatusUnauthorized)
				return
			}

			claims, ok := token.Claims.(jwt.MapClaims)
			if !ok {
				http.Error(w, `{"message":"invalid token claims"}`, http.StatusUnauthorized)
				return
			}

			// Check token revocation when a blacklist is configured.
			if bl != nil {
				jti, ok := claims["jti"].(string)
				if !ok || jti == "" {
					http.Error(w, `{"message":"token missing required jti claim"}`, http.StatusUnauthorized)
					return
				}
				if bl.IsRevoked(r.Context(), jti) {
					http.Error(w, `{"message":"token has been revoked"}`, http.StatusUnauthorized)
					return
				}
			}

			user := UserClaims{
				UserID: claimStr(claims, "sub"),
				Name:   claimStr(claims, "name"),
				Email:  claimStr(claims, "email"),
				Role:   claimStr(claims, "role"),
			}

			ctx := context.WithValue(r.Context(), userContextKey, user)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

func claimStr(claims jwt.MapClaims, key string) string {
	if v, ok := claims[key].(string); ok {
		return v
	}
	return ""
}
