package auth_test

import (
	"testing"

	"github.com/golang-jwt/jwt/v5"
	"github.com/orion-rigel/orion/pkg/auth"
)

func TestValidateToken(t *testing.T) {
	t.Parallel()

	secret := "test-secret"

	validToken := func() string {
		tok := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
			"sub": "admin",
			"exp": float64(9999999999),
		})
		s, _ := tok.SignedString([]byte(secret))
		return s
	}

	expiredToken := func() string {
		tok := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
			"sub": "admin",
			"exp": float64(1000000000),
		})
		s, _ := tok.SignedString([]byte(secret))
		return s
	}

	tests := []struct {
		name      string
		tokenStr  string
		secret    string
		wantErr   bool
		wantValid bool
	}{
		{
			name:      "valid token",
			tokenStr:  validToken(),
			secret:    secret,
			wantErr:   false,
			wantValid: true,
		},
		{
			name:     "expired token",
			tokenStr: expiredToken(),
			secret:   secret,
			wantErr:  true,
		},
		{
			name:     "wrong secret",
			tokenStr: validToken(),
			secret:   "wrong-secret",
			wantErr:  true,
		},
		{
			name:     "malformed token",
			tokenStr: "not.a.valid.token",
			secret:   secret,
			wantErr:  true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			token, err := auth.ValidateToken(tt.tokenStr, tt.secret)
			if (err != nil) != tt.wantErr {
				t.Errorf("ValidateToken() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if !tt.wantErr && !token.Valid {
				t.Error("ValidateToken() returned invalid token, want valid")
			}
		})
	}
}
