package commands

import (
	"context"
	"fmt"
	"os"

	"github.com/spf13/cobra"
	"github.com/spf13/viper"

	"github.com/orion-rigel/orion/internal/cli/client"
	"github.com/orion-rigel/orion/internal/cli/output"
)

func init() {
	healthCmd.Flags().Bool("all", false, "check health of all services via gateway")
	rootCmd.AddCommand(healthCmd)
}

var healthCmd = &cobra.Command{
	Use:   "health",
	Short: "Check gateway health",
	Long:  "Call the gateway /health endpoint and display the result.",
	RunE: func(cmd *cobra.Command, args []string) error {
		ctx := context.Background()
		c := client.New(viper.GetString("gateway_url"))
		f := output.New(viper.GetString("output"))

		all, _ := cmd.Flags().GetBool("all")

		if all {
			return runHealthAll(ctx, c, f)
		}
		return runHealth(ctx, c, f)
	},
}

func runHealth(ctx context.Context, c *client.OrionClient, f *output.Formatter) error {
	h, err := c.Health(ctx)
	if err != nil {
		return fmt.Errorf("gateway unreachable: %w", err)
	}
	fmt.Fprint(os.Stdout, f.FormatHealth(h))
	return nil
}

func runHealthAll(ctx context.Context, c *client.OrionClient, f *output.Formatter) error {
	services := []string{"scout", "director", "media", "editor", "pulse"}

	// Gateway health first.
	gw, err := c.Health(ctx)
	if err != nil {
		return fmt.Errorf("gateway unreachable: %w", err)
	}
	fmt.Fprintln(os.Stdout, f.FormatHealth(gw))

	// Individual services.
	for _, svc := range services {
		h, err := c.ServiceHealth(ctx, svc)
		if err != nil {
			fmt.Fprintf(os.Stderr, "%s: unreachable (%v)\n", svc, err)
			continue
		}
		fmt.Fprintln(os.Stdout, f.FormatHealth(h))
	}
	return nil
}
