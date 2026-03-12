// Package config provides configuration loading utilities for Orion services.
package config

import "os"

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
	}
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
