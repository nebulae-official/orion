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
	rootCmd.AddCommand(statusCmd)
}

var statusCmd = &cobra.Command{
	Use:   "status",
	Short: "Show system overview",
	Long:  "Display gateway health and connected service statuses.",
	RunE: func(cmd *cobra.Command, args []string) error {
		ctx := context.Background()
		c := client.New(viper.GetString("gateway_url"))
		f := output.New(viper.GetString("output"))

		s, err := c.Status(ctx)
		if err != nil {
			return fmt.Errorf("could not retrieve status: %w", err)
		}
		fmt.Fprint(os.Stdout, f.FormatStatus(s))
		return nil
	},
}
