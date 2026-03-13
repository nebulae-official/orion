// Package config provides configuration loading utilities for Orion services.
package config

import (
	"fmt"
	"os"
	"strings"
)

// Config holds common runtime configuration.
type Config struct {
	AppEnv       string
	GatewayPort  string
	PostgresUser string
	PostgresPass string
	PostgresDB   string
	RedisURL     string
	MilvusHost   string
	MilvusPort   string
	OllamaHost   string
	ComfyUIHost  string

	// Service URLs for the gateway reverse proxy.
	ScoutURL      string
	DirectorURL   string
	MediaURL      string
	EditorURL     string
	PulseURL      string
	PublisherURL  string

	// Authentication
	JWTSecret     string
	AdminUsername string
	AdminPassword string
	AdminEmail    string

	// Security
	AllowedOrigins []string
	TrustedProxies []string

	// Build metadata
	AppVersion string
}

// Load reads configuration from environment variables with sensible defaults.
func Load() Config {
	return Config{
		AppEnv:       getEnv("APP_ENV", "development"),
		GatewayPort:  getEnv("GATEWAY_PORT", "8000"),
		PostgresUser: getEnv("POSTGRES_USER", "orion"),
		PostgresPass: getEnv("POSTGRES_PASSWORD", "orion_dev"),
		PostgresDB:   getEnv("POSTGRES_DB", "orion"),
		RedisURL:     getEnv("REDIS_URL", "redis://localhost:6379"),
		MilvusHost:   getEnv("MILVUS_HOST", "localhost"),
		MilvusPort:   getEnv("MILVUS_PORT", "19530"),
		OllamaHost:   getEnv("OLLAMA_HOST", "http://localhost:11434"),
		ComfyUIHost:  getEnv("COMFYUI_HOST", "http://localhost:8188"),

		ScoutURL:     getEnv("SCOUT_URL", "http://localhost:8001"),
		DirectorURL:  getEnv("DIRECTOR_URL", "http://localhost:8002"),
		MediaURL:     getEnv("MEDIA_URL", "http://localhost:8003"),
		EditorURL:    getEnv("EDITOR_URL", "http://localhost:8004"),
		PulseURL:     getEnv("PULSE_URL", "http://localhost:8005"),
		PublisherURL: getEnv("PUBLISHER_URL", "http://localhost:8006"),

		JWTSecret:     getEnv("ORION_JWT_SECRET", "dev-secret-change-in-production"),
		AdminUsername: getEnv("ORION_ADMIN_USER", "admin"),
		AdminPassword: getEnv("ORION_ADMIN_PASS", "orion_dev"),
		AdminEmail:    getEnv("ORION_ADMIN_EMAIL", "admin@orion.local"),

		AllowedOrigins: splitEnv("ORION_ALLOWED_ORIGINS", ""),
		TrustedProxies: splitEnv("ORION_TRUSTED_PROXIES", ""),
		AppVersion:     getEnv("ORION_VERSION", "0.1.0"),
	}
}

// IsDevelopment returns true when the application environment is "development".
func (c Config) IsDevelopment() bool {
	return c.AppEnv == "development"
}

// insecureDefault maps a config field name to its insecure default value.
type insecureDefault struct {
	Field string
	Value string
}

// InsecureDefaults returns a list of field names that still hold their
// development-only default values. An empty slice means the configuration
// is safe for production.
func (c Config) InsecureDefaults() []string {
	checks := []insecureDefault{
		{"JWTSecret", "dev-secret-change-in-production"},
		{"AdminPassword", "orion_dev"},
		{"PostgresPass", "orion_dev"},
	}

	var insecure []string
	for _, chk := range checks {
		var current string
		switch chk.Field {
		case "JWTSecret":
			current = c.JWTSecret
		case "AdminPassword":
			current = c.AdminPassword
		case "PostgresPass":
			current = c.PostgresPass
		}
		if current == chk.Value {
			insecure = append(insecure, chk.Field)
		}
	}
	if len(c.AllowedOrigins) == 0 {
		insecure = append(insecure, "AllowedOrigins (CORS will allow all origins)")
	}
	return insecure
}

// EnforceProduction returns an error when the application is not in
// development mode and insecure default values are still present. The error
// message lists every offending field so operators can fix them all at once.
func (c Config) EnforceProduction() error {
	if c.IsDevelopment() {
		return nil
	}
	insecure := c.InsecureDefaults()
	if len(insecure) == 0 {
		return nil
	}
	return fmt.Errorf("insecure defaults in production: %s", strings.Join(insecure, ", "))
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

// splitEnv reads a comma-separated environment variable into a string slice.
// Returns nil when the variable is unset or empty.
func splitEnv(key, fallback string) []string {
	v := getEnv(key, fallback)
	if v == "" {
		return nil
	}
	parts := strings.Split(v, ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		if t := strings.TrimSpace(p); t != "" {
			out = append(out, t)
		}
	}
	return out
}
