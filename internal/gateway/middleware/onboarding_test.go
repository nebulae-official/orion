package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/golang-jwt/jwt/v5"
)

const onboardingTestSecret = "onboarding-test-secret"

// makeToken creates a signed JWT with the given claims for testing.
func makeToken(t *testing.T, claims jwt.MapClaims) string {
	t.Helper()
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	s, err := token.SignedString([]byte(onboardingTestSecret))
	if err != nil {
		t.Fatalf("signing token: %v", err)
	}
	return s
}

func TestClaimBool(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name   string
		claims jwt.MapClaims
		key    string
		want   bool
	}{
		{
			name:   "returns true for bool true value",
			claims: jwt.MapClaims{"onboarding": true},
			key:    "onboarding",
			want:   true,
		},
		{
			name:   "returns false for bool false value",
			claims: jwt.MapClaims{"onboarding": false},
			key:    "onboarding",
			want:   false,
		},
		{
			name:   "returns false for missing key",
			claims: jwt.MapClaims{"sub": "user-1"},
			key:    "onboarding",
			want:   false,
		},
		{
			name:   "returns false for string value",
			claims: jwt.MapClaims{"onboarding": "true"},
			key:    "onboarding",
			want:   false,
		},
		{
			name:   "returns false for int value",
			claims: jwt.MapClaims{"onboarding": 1},
			key:    "onboarding",
			want:   false,
		},
		{
			name:   "returns false for nil value",
			claims: jwt.MapClaims{"onboarding": nil},
			key:    "onboarding",
			want:   false,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			got := claimBool(tc.claims, tc.key)
			if got != tc.want {
				t.Errorf("claimBool(%v, %q) = %v, want %v", tc.claims, tc.key, got, tc.want)
			}
		})
	}
}

func TestUserClaimsOnboarding(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name            string
		claims          jwt.MapClaims
		wantOnboarding  bool
		wantUserID      string
		wantEmail       string
		wantRole        string
	}{
		{
			name: "extracts NeedsOnboarding true from JWT",
			claims: jwt.MapClaims{
				"sub":         "user-onboard-1",
				"email":       "new@test.local",
				"name":        "New User",
				"role":        "editor",
				"onboarding":  true,
				"exp":         float64(9999999999),
				"iat":         float64(1000000000),
			},
			wantOnboarding: true,
			wantUserID:     "user-onboard-1",
			wantEmail:      "new@test.local",
			wantRole:       "editor",
		},
		{
			name: "NeedsOnboarding defaults to false when claim absent",
			claims: jwt.MapClaims{
				"sub":   "user-existing-1",
				"email": "existing@test.local",
				"name":  "Existing User",
				"role":  "admin",
				"exp":   float64(9999999999),
				"iat":   float64(1000000000),
			},
			wantOnboarding: false,
			wantUserID:     "user-existing-1",
			wantEmail:      "existing@test.local",
			wantRole:       "admin",
		},
		{
			name: "NeedsOnboarding false when claim is explicitly false",
			claims: jwt.MapClaims{
				"sub":         "user-2",
				"email":       "user2@test.local",
				"name":        "User Two",
				"role":        "editor",
				"onboarding":  false,
				"exp":         float64(9999999999),
				"iat":         float64(1000000000),
			},
			wantOnboarding: false,
			wantUserID:     "user-2",
			wantEmail:      "user2@test.local",
			wantRole:       "editor",
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			tokenStr := makeToken(t, tc.claims)

			// Pass the token through the Auth middleware and capture the UserClaims.
			var captured UserClaims
			var capturedOK bool

			inner := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				captured, capturedOK = GetUser(r.Context())
				w.WriteHeader(http.StatusOK)
			})

			handler := Auth(onboardingTestSecret, nil)(inner)

			req := httptest.NewRequest(http.MethodGet, "/test", nil)
			req.Header.Set("Authorization", "Bearer "+tokenStr)
			rr := httptest.NewRecorder()

			handler.ServeHTTP(rr, req)

			if rr.Code != http.StatusOK {
				t.Fatalf("want status 200, got %d", rr.Code)
			}
			if !capturedOK {
				t.Fatal("expected user claims in context")
			}
			if captured.NeedsOnboarding != tc.wantOnboarding {
				t.Errorf("NeedsOnboarding: got %v, want %v", captured.NeedsOnboarding, tc.wantOnboarding)
			}
			if captured.UserID != tc.wantUserID {
				t.Errorf("UserID: got %q, want %q", captured.UserID, tc.wantUserID)
			}
			if captured.Email != tc.wantEmail {
				t.Errorf("Email: got %q, want %q", captured.Email, tc.wantEmail)
			}
			if captured.Role != tc.wantRole {
				t.Errorf("Role: got %q, want %q", captured.Role, tc.wantRole)
			}
		})
	}
}
