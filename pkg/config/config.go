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
	}
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
