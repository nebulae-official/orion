package handlers

import (
	"encoding/json"
	"testing"

	"github.com/golang-jwt/jwt/v5"
	"github.com/orion-rigel/orion/pkg/config"
)

func TestGenerateTokenOnboarding(t *testing.T) {
	t.Parallel()

	cfg := config.Config{
		JWTSecret: "test-secret-key-for-onboarding",
	}
	h := &AuthHandler{cfg: cfg}

	tests := []struct {
		name            string
		extra           map[string]interface{}
		wantOnboarding  bool
		wantKeyPresent  bool
	}{
		{
			name:            "extra with onboarding true embeds claim",
			extra:           map[string]interface{}{"onboarding": true},
			wantOnboarding:  true,
			wantKeyPresent:  true,
		},
		{
			name:            "extra with onboarding false embeds claim",
			extra:           map[string]interface{}{"onboarding": false},
			wantOnboarding:  false,
			wantKeyPresent:  true,
		},
		{
			name:            "nil extra has no onboarding claim",
			extra:           nil,
			wantOnboarding:  false,
			wantKeyPresent:  false,
		},
		{
			name:            "empty extra has no onboarding claim",
			extra:           map[string]interface{}{},
			wantOnboarding:  false,
			wantKeyPresent:  false,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			signed, jti, err := h.generateToken(
				"user-123",
				"user@test.local",
				"Test User",
				"editor",
				tc.extra,
			)
			if err != nil {
				t.Fatalf("generateToken error: %v", err)
			}
			if jti == "" {
				t.Fatal("expected non-empty jti")
			}

			// Parse the token to inspect claims.
			token, err := jwt.Parse(signed, func(token *jwt.Token) (interface{}, error) {
				return []byte(cfg.JWTSecret), nil
			})
			if err != nil {
				t.Fatalf("parsing token: %v", err)
			}

			claims, ok := token.Claims.(jwt.MapClaims)
			if !ok {
				t.Fatal("expected MapClaims")
			}

			// Verify standard claims are always present.
			if sub, _ := claims["sub"].(string); sub != "user-123" {
				t.Errorf("want sub=user-123, got %q", sub)
			}
			if email, _ := claims["email"].(string); email != "user@test.local" {
				t.Errorf("want email=user@test.local, got %q", email)
			}
			if name, _ := claims["name"].(string); name != "Test User" {
				t.Errorf("want name='Test User', got %q", name)
			}
			if role, _ := claims["role"].(string); role != "editor" {
				t.Errorf("want role=editor, got %q", role)
			}
			if claims["jti"] == nil {
				t.Error("expected jti claim")
			}
			if claims["iat"] == nil {
				t.Error("expected iat claim")
			}
			if claims["exp"] == nil {
				t.Error("expected exp claim")
			}

			// Verify the onboarding claim.
			val, keyPresent := claims["onboarding"]
			if keyPresent != tc.wantKeyPresent {
				t.Errorf("onboarding key present: got %v, want %v", keyPresent, tc.wantKeyPresent)
			}

			if tc.wantKeyPresent {
				// JWT JSON decoding may represent booleans as bool or via json.Number;
				// re-marshal/unmarshal to get the canonical JSON representation.
				raw, _ := json.Marshal(claims)
				var decoded map[string]interface{}
				_ = json.Unmarshal(raw, &decoded)

				got, _ := decoded["onboarding"].(bool)
				if got != tc.wantOnboarding {
					t.Errorf("onboarding value: got %v, want %v (raw: %v)", got, tc.wantOnboarding, val)
				}
			}
		})
	}
}
