package commands

import (
	"context"
	"fmt"
	"os"
	"strings"

	"github.com/spf13/cobra"
	"github.com/spf13/viper"

	"github.com/orion-rigel/orion/internal/cli/output"
)

func init() {
	scoutTriggerCmd.Flags().StringSlice("sources", nil, "comma-separated list of sources to scan")
	scoutTriggerCmd.Flags().StringSlice("regions", nil, "comma-separated list of regions to scan")

	scoutTrendsCmd.Flags().Int("limit", 20, "maximum number of trends to return")
	scoutTrendsCmd.Flags().Float64("min-score", 0, "minimum trend score threshold")

	scoutConfigCmd.Flags().Bool("show", false, "display current scout configuration")
	scoutConfigCmd.Flags().String("set", "", "set a configuration value (KEY=VALUE)")

	scoutCmd.AddCommand(scoutTriggerCmd)
	scoutCmd.AddCommand(scoutTrendsCmd)
	scoutCmd.AddCommand(scoutConfigCmd)
	rootCmd.AddCommand(scoutCmd)
}

var scoutCmd = &cobra.Command{
	Use:   "scout",
	Short: "Scout trend detection commands",
	Long:  "Trigger scans, view detected trends, and manage scout configuration.",
}

var scoutTriggerCmd = &cobra.Command{
	Use:   "trigger",
	Short: "Trigger a scout scan",
	Long:  "Initiate a new trend scan via the scout service, optionally filtering by sources and regions.",
	RunE: func(cmd *cobra.Command, args []string) error {
		ctx := context.Background()
		c := newAuthenticatedClient()

		sources, _ := cmd.Flags().GetStringSlice("sources")
		regions, _ := cmd.Flags().GetStringSlice("regions")

		resp, err := c.TriggerScout(ctx, sources, regions)
		if err != nil {
			return fmt.Errorf("triggering scout scan: %w", err)
		}
		fmt.Fprintf(os.Stdout, "Scan triggered: %s (ID: %s)\n", resp.Status, resp.ScanID)
		return nil
	},
}

var scoutTrendsCmd = &cobra.Command{
	Use:   "trends",
	Short: "List detected trends",
	Long:  "Retrieve detected trends from the scout service, with optional limit and minimum score filter.",
	RunE: func(cmd *cobra.Command, args []string) error {
		ctx := context.Background()
		c := newAuthenticatedClient()
		f := output.New(viper.GetString("output"))

		limit, _ := cmd.Flags().GetInt("limit")
		minScore, _ := cmd.Flags().GetFloat64("min-score")

		trends, err := c.ListTrends(ctx, limit, minScore)
		if err != nil {
			return fmt.Errorf("listing trends: %w", err)
		}
		fmt.Fprint(os.Stdout, f.FormatTrendList(trends))
		return nil
	},
}

var scoutConfigCmd = &cobra.Command{
	Use:   "config",
	Short: "View or update scout configuration",
	Long:  "Display current scout configuration or set a specific configuration value.",
	RunE: func(cmd *cobra.Command, args []string) error {
		ctx := context.Background()
		c := newAuthenticatedClient()
		f := output.New(viper.GetString("output"))

		show, _ := cmd.Flags().GetBool("show")
		set, _ := cmd.Flags().GetString("set")

		if set != "" {
			parts := strings.SplitN(set, "=", 2)
			if len(parts) != 2 {
				return fmt.Errorf("invalid format: use --set KEY=VALUE")
			}
			if err := c.SetScoutConfig(ctx, parts[0], parts[1]); err != nil {
				return fmt.Errorf("setting scout config: %w", err)
			}
			fmt.Fprintf(os.Stdout, "Scout config updated: %s=%s\n", parts[0], parts[1])
			return nil
		}

		// Default to --show behavior.
		_ = show
		cfg, err := c.GetScoutConfig(ctx)
		if err != nil {
			return fmt.Errorf("retrieving scout config: %w", err)
		}
		fmt.Fprint(os.Stdout, f.FormatScoutConfig(cfg))
		return nil
	},
}
