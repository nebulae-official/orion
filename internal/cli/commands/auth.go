package commands

import (
	"bufio"
	"context"
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/spf13/cobra"
	"github.com/spf13/viper"

	"github.com/orion-rigel/orion/internal/cli/client"
)

func init() {
	authLoginCmd.Flags().String("api-url", "", "override gateway URL for login")
	authCmd.AddCommand(authLoginCmd)
	authCmd.AddCommand(authLogoutCmd)
	authCmd.AddCommand(authStatusCmd)
	rootCmd.AddCommand(authCmd)
}

var authCmd = &cobra.Command{
	Use:   "auth",
	Short: "Manage authentication",
	Long:  "Login, logout, and check authentication status with the Orion gateway.",
}

var authLoginCmd = &cobra.Command{
	Use:   "login",
	Short: "Authenticate with the gateway",
	Long:  "Prompt for credentials and obtain a JWT token from the Orion gateway.",
	RunE: func(cmd *cobra.Command, args []string) error {
		ctx := context.Background()

		apiURL, _ := cmd.Flags().GetString("api-url")
		if apiURL == "" {
			apiURL = viper.GetString("gateway_url")
		}

		username, password, err := readCredentials()
		if err != nil {
			return fmt.Errorf("reading credentials: %w", err)
		}

		c := client.New(apiURL)
		c.SetToken(viper.GetString("auth_token"))

		resp, err := c.Login(ctx, username, password)
		if err != nil {
			return fmt.Errorf("authentication failed: %w", err)
		}

		viper.Set("auth_token", resp.Token)
		viper.Set("auth_username", resp.Username)
		viper.Set("auth_expires_at", resp.ExpiresAt.Format(time.RFC3339))
		viper.Set("gateway_url", apiURL)

		if err := writeConfig(); err != nil {
			return fmt.Errorf("saving config: %w", err)
		}

		fmt.Fprintf(os.Stdout, "Logged in as %s (token expires %s)\n", resp.Username, resp.ExpiresAt.Format(time.RFC3339))
		return nil
	},
}

var authLogoutCmd = &cobra.Command{
	Use:   "logout",
	Short: "Clear stored credentials",
	Long:  "Remove the stored JWT token and user information from the local config.",
	RunE: func(cmd *cobra.Command, args []string) error {
		viper.Set("auth_token", "")
		viper.Set("auth_username", "")
		viper.Set("auth_expires_at", "")

		if err := writeConfig(); err != nil {
			return fmt.Errorf("saving config: %w", err)
		}

		fmt.Fprintln(os.Stdout, "Logged out successfully.")
		return nil
	},
}

var authStatusCmd = &cobra.Command{
	Use:   "status",
	Short: "Show authentication status",
	Long:  "Display the current user, token expiry, and connected server URL.",
	RunE: func(cmd *cobra.Command, args []string) error {
		token := viper.GetString("auth_token")
		if token == "" {
			fmt.Fprintln(os.Stdout, "Not logged in.")
			return nil
		}

		username := viper.GetString("auth_username")
		expiresAt := viper.GetString("auth_expires_at")
		serverURL := viper.GetString("gateway_url")

		fmt.Fprintf(os.Stdout, "User:       %s\n", username)
		fmt.Fprintf(os.Stdout, "Server:     %s\n", serverURL)

		if expiresAt != "" {
			t, err := time.Parse(time.RFC3339, expiresAt)
			if err == nil {
				if time.Now().After(t) {
					fmt.Fprintf(os.Stdout, "Token:      expired at %s\n", expiresAt)
				} else {
					fmt.Fprintf(os.Stdout, "Token:      valid until %s\n", expiresAt)
				}
			} else {
				fmt.Fprintf(os.Stdout, "Expires at: %s\n", expiresAt)
			}
		}
		return nil
	},
}

// readCredentials reads username and password from stdin.
func readCredentials() (string, string, error) {
	reader := bufio.NewReader(os.Stdin)

	fmt.Fprint(os.Stderr, "Username: ")
	username, err := reader.ReadString('\n')
	if err != nil {
		return "", "", fmt.Errorf("reading username: %w", err)
	}

	fmt.Fprint(os.Stderr, "Password: ")
	password, err := reader.ReadString('\n')
	if err != nil {
		return "", "", fmt.Errorf("reading password: %w", err)
	}

	return strings.TrimSpace(username), strings.TrimSpace(password), nil
}

// writeConfig ensures the config directory exists and writes the viper config.
func writeConfig() error {
	home, err := os.UserHomeDir()
	if err != nil {
		return fmt.Errorf("determining home directory: %w", err)
	}

	configDir := home + "/.orion"
	if err := os.MkdirAll(configDir, 0o700); err != nil {
		return fmt.Errorf("creating config directory: %w", err)
	}

	configPath := configDir + "/config.yaml"

	// If the config file doesn't exist yet, create it so viper can write to it.
	if _, err := os.Stat(configPath); os.IsNotExist(err) {
		f, err := os.Create(configPath)
		if err != nil {
			return fmt.Errorf("creating config file: %w", err)
		}
		f.Close()
	}

	if err := viper.WriteConfigAs(configPath); err != nil {
		return fmt.Errorf("writing config: %w", err)
	}
	return nil
}
