// Package commands provides the Cobra command tree for the Orion CLI.
package commands

import (
	"fmt"
	"log/slog"
	"os"

	"github.com/spf13/cobra"
	"github.com/spf13/viper"
)

var cfgFile string

// rootCmd is the base command for the Orion CLI.
var rootCmd = &cobra.Command{
	Use:   "orion",
	Short: "Orion CLI — interact with the Orion gateway",
	Long:  "Command-line interface for the Orion Digital Twin Content Agency gateway.",
	PersistentPreRun: func(cmd *cobra.Command, args []string) {
		initLogger()
	},
	SilenceUsage:  true,
	SilenceErrors: true,
}

func init() {
	cobra.OnInitialize(initConfig)

	rootCmd.PersistentFlags().StringVar(&cfgFile, "config", "", "config file (default $HOME/.orion/config.yaml)")
	rootCmd.PersistentFlags().String("gateway-url", "http://localhost:8000", "gateway base URL")
	rootCmd.PersistentFlags().String("output", "text", "output format: json, table, text")
	rootCmd.PersistentFlags().Bool("verbose", false, "enable verbose logging")

	_ = viper.BindPFlag("gateway_url", rootCmd.PersistentFlags().Lookup("gateway-url"))
	_ = viper.BindPFlag("output", rootCmd.PersistentFlags().Lookup("output"))
	_ = viper.BindPFlag("verbose", rootCmd.PersistentFlags().Lookup("verbose"))
}

// Execute runs the root command.
func Execute() error {
	return rootCmd.Execute()
}

func initConfig() {
	if cfgFile != "" {
		viper.SetConfigFile(cfgFile)
	} else {
		home, err := os.UserHomeDir()
		if err != nil {
			fmt.Fprintln(os.Stderr, "warning: could not determine home directory:", err)
			return
		}
		viper.AddConfigPath(home + "/.orion")
		viper.SetConfigName("config")
		viper.SetConfigType("yaml")
	}

	viper.SetEnvPrefix("ORION")
	viper.AutomaticEnv()

	// Silently ignore missing config file — it's optional.
	_ = viper.ReadInConfig()
}

func initLogger() {
	level := slog.LevelInfo
	if viper.GetBool("verbose") {
		level = slog.LevelDebug
	}
	handler := slog.NewTextHandler(os.Stderr, &slog.HandlerOptions{Level: level})
	slog.SetDefault(slog.New(handler))
}
