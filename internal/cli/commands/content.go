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
	contentListCmd.Flags().String("status", "", "filter by content status")
	contentListCmd.Flags().Int("limit", 20, "maximum number of items to return")

	contentApproveCmd.Flags().String("schedule-at", "", "schedule publication time (RFC3339)")

	contentRejectCmd.Flags().String("feedback", "", "reason for rejection (required)")
	contentRejectCmd.Flags().String("action", "", "follow-up action: REGENERATE or DISCARD")
	_ = contentRejectCmd.MarkFlagRequired("feedback")

	contentRegenerateCmd.Flags().String("feedback", "", "optional feedback for regeneration")

	contentCmd.AddCommand(contentListCmd)
	contentCmd.AddCommand(contentViewCmd)
	contentCmd.AddCommand(contentApproveCmd)
	contentCmd.AddCommand(contentRejectCmd)
	contentCmd.AddCommand(contentRegenerateCmd)
	rootCmd.AddCommand(contentCmd)
}

var contentCmd = &cobra.Command{
	Use:   "content",
	Short: "Manage content items",
	Long:  "List, view, approve, reject, and regenerate content managed by Orion.",
}

var contentListCmd = &cobra.Command{
	Use:   "list",
	Short: "List content items",
	Long:  "Retrieve a list of content items from the gateway, optionally filtered by status.",
	RunE: func(cmd *cobra.Command, args []string) error {
		ctx := context.Background()
		c := newAuthenticatedClient()
		f := output.New(viper.GetString("output"))

		status, _ := cmd.Flags().GetString("status")
		limit, _ := cmd.Flags().GetInt("limit")

		items, err := c.ListContent(ctx, status, limit)
		if err != nil {
			return fmt.Errorf("listing content: %w", err)
		}
		fmt.Fprint(os.Stdout, f.FormatContentList(items))
		return nil
	},
}

var contentViewCmd = &cobra.Command{
	Use:   "view [id]",
	Short: "View content details",
	Long:  "Display full details for a single content item including script body and asset list.",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		ctx := context.Background()
		c := newAuthenticatedClient()
		f := output.New(viper.GetString("output"))

		item, err := c.GetContent(ctx, args[0])
		if err != nil {
			return fmt.Errorf("retrieving content %s: %w", args[0], err)
		}
		fmt.Fprint(os.Stdout, f.FormatContentDetail(item))
		return nil
	},
}

var contentApproveCmd = &cobra.Command{
	Use:   "approve [id]",
	Short: "Approve a content item",
	Long:  "Approve a content item for publication, optionally scheduling a publish time.",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		ctx := context.Background()
		c := newAuthenticatedClient()

		scheduleAt, _ := cmd.Flags().GetString("schedule-at")

		if err := c.ApproveContent(ctx, args[0], scheduleAt); err != nil {
			return fmt.Errorf("approving content %s: %w", args[0], err)
		}
		fmt.Fprintf(os.Stdout, "Content %s approved.\n", args[0])
		return nil
	},
}

var contentRejectCmd = &cobra.Command{
	Use:   "reject [id]",
	Short: "Reject a content item",
	Long:  "Reject a content item with feedback and an optional follow-up action.",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		ctx := context.Background()
		c := newAuthenticatedClient()

		feedback, _ := cmd.Flags().GetString("feedback")
		action, _ := cmd.Flags().GetString("action")

		if err := c.RejectContent(ctx, args[0], feedback, action); err != nil {
			return fmt.Errorf("rejecting content %s: %w", args[0], err)
		}
		fmt.Fprintf(os.Stdout, "Content %s rejected.\n", args[0])
		return nil
	},
}

var contentRegenerateCmd = &cobra.Command{
	Use:   "regenerate [id]",
	Short: "Regenerate a content item",
	Long:  "Request regeneration of a content item, optionally providing feedback.",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		ctx := context.Background()
		c := newAuthenticatedClient()

		feedback, _ := cmd.Flags().GetString("feedback")

		if err := c.RegenerateContent(ctx, args[0], feedback); err != nil {
			return fmt.Errorf("regenerating content %s: %w", args[0], err)
		}
		fmt.Fprintf(os.Stdout, "Content %s queued for regeneration.\n", args[0])
		return nil
	},
}

// newAuthenticatedClient creates an OrionClient with the stored auth token.
func newAuthenticatedClient() *client.OrionClient {
	c := client.New(viper.GetString("gateway_url"))
	if token := viper.GetString("auth_token"); token != "" {
		c.SetToken(token)
	}
	return c
}
