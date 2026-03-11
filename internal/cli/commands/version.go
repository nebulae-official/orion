package commands

import (
	"fmt"

	"github.com/spf13/cobra"
)

// Build-time variables set via ldflags.
var (
	version   = "dev"
	commit    = "none"
	buildDate = "unknown"
)

func init() {
	rootCmd.AddCommand(versionCmd)
}

var versionCmd = &cobra.Command{
	Use:   "version",
	Short: "Print version information",
	Run: func(cmd *cobra.Command, args []string) {
		fmt.Printf("orion %s\n", version)
		fmt.Printf("  commit:  %s\n", commit)
		fmt.Printf("  built:   %s\n", buildDate)
	},
}
