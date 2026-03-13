// Package auth provides shared JWT authentication utilities.
package auth

import (
	"fmt"

	"github.com/golang-jwt/jwt/v5"
)

// ValidateToken parses and validates a JWT token string using HMAC signing.
// It returns the parsed token or an error if validation fails.
func ValidateToken(tokenStr, secret string) (*jwt.Token, error) {
	token, err := jwt.Parse(tokenStr, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return []byte(secret), nil
	})
	if err != nil {
		return nil, fmt.Errorf("parsing token: %w", err)
	}
	return token, nil
}
