package client

import (
	"context"
	"fmt"
	"time"
)

// LoginRequest is the payload sent to the gateway login endpoint.
type LoginRequest struct {
	Username string `json:"username"`
	Password string `json:"password"`
}

// LoginResponse is the payload returned by the gateway login endpoint.
type LoginResponse struct {
	Token     string    `json:"token"`
	ExpiresAt time.Time `json:"expires_at"`
	Username  string    `json:"username"`
}

// AuthStatusResponse is the payload returned by the auth status check.
type AuthStatusResponse struct {
	Username  string    `json:"username"`
	ExpiresAt time.Time `json:"expires_at"`
	ServerURL string    `json:"server_url"`
}

// Login authenticates against the gateway and returns a token response.
func (c *OrionClient) Login(ctx context.Context, username, password string) (LoginResponse, error) {
	var resp LoginResponse
	payload := LoginRequest{
		Username: username,
		Password: password,
	}
	if err := c.post(ctx, "/api/v1/auth/login", payload, &resp); err != nil {
		return resp, fmt.Errorf("login: %w", err)
	}
	return resp, nil
}

// RefreshToken requests a new token using the current valid token.
func (c *OrionClient) RefreshToken(ctx context.Context) (LoginResponse, error) {
	var resp LoginResponse
	if err := c.post(ctx, "/api/v1/auth/refresh", nil, &resp); err != nil {
		return resp, fmt.Errorf("token refresh: %w", err)
	}
	return resp, nil
}
