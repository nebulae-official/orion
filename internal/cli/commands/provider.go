package commands

import (
	"context"
	"fmt"
	"os"

	"github.com/spf13/cobra"
	"github.com/spf13/viper"

	"github.com/orion-rigel/orion/internal/cli/output"
)

func init() {
	providerSwitchCmd.Flags().String("mode", "", "provider mode: LOCAL or CLOUD (required)")
	providerSwitchCmd.Flags().String("provider", "", "provider name (required)")
	_ = providerSwitchCmd.MarkFlagRequired("mode")
	_ = providerSwitchCmd.MarkFlagRequired("provider")

	providerCmd.AddCommand(providerListCmd)
	providerCmd.AddCommand(providerSwitchCmd)
	providerCmd.AddCommand(providerStatusCmd)
	rootCmd.AddCommand(providerCmd)
}

var providerCmd = &cobra.Command{
	Use:   "provider",
	Short: "Manage AI providers",
	Long:  "List, switch, and inspect the status of AI providers across Orion services.",
}

var providerListCmd = &cobra.Command{
	Use:   "list",
	Short: "List all providers",
	Long:  "Retrieve the list of configured providers for all services.",
	RunE: func(cmd *cobra.Command, args []string) error {
		ctx := context.Background()
		c := newAuthenticatedClient()
		f := output.New(viper.GetString("output"))

		providers, err := c.ListProviders(ctx)
		if err != nil {
			return fmt.Errorf("listing providers: %w", err)
		}
		fmt.Fprint(os.Stdout, f.FormatProviderList(providers))
		return nil
	},
}

var providerSwitchCmd = &cobra.Command{
	Use:   "switch [service]",
	Short: "Switch a service provider",
	Long:  "Switch the active provider for a service, specifying the mode (LOCAL or CLOUD) and the provider name.",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		ctx := context.Background()
		c := newAuthenticatedClient()

		service := args[0]
		mode, _ := cmd.Flags().GetString("mode")
		provider, _ := cmd.Flags().GetString("provider")

		if err := c.SwitchProvider(ctx, service, mode, provider); err != nil {
			return fmt.Errorf("switching provider for %s: %w", service, err)
		}
		fmt.Fprintf(os.Stdout, "Provider for %s switched to %s (%s).\n", service, provider, mode)
		return nil
	},
}

var providerStatusCmd = &cobra.Command{
	Use:   "status",
	Short: "Show provider health and cost details",
	Long:  "Display detailed provider health status including current costs across all services.",
	RunE: func(cmd *cobra.Command, args []string) error {
		ctx := context.Background()
		c := newAuthenticatedClient()
		f := output.New(viper.GetString("output"))

		status, err := c.ProviderStatus(ctx)
		if err != nil {
			return fmt.Errorf("retrieving provider status: %w", err)
		}
		fmt.Fprint(os.Stdout, f.FormatProviderStatus(status))
		return nil
	},
}
