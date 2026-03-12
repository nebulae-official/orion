package commands

import (
	"bufio"
	"context"
	"fmt"
	"os"
	"sync"

	"github.com/spf13/cobra"
	"github.com/spf13/viper"

	"github.com/orion-rigel/orion/internal/cli/client"
	"github.com/orion-rigel/orion/internal/cli/output"
)

func init() {
	systemLogsCmd.Flags().IntP("tail", "n", 50, "number of log lines to retrieve")
	systemLogsCmd.Flags().BoolP("follow", "f", false, "stream logs in real time")

	systemCmd.AddCommand(systemHealthCmd)
	systemCmd.AddCommand(systemStatusCmd)
	systemCmd.AddCommand(systemLogsCmd)
	rootCmd.AddCommand(systemCmd)
}

var systemCmd = &cobra.Command{
	Use:   "system",
	Short: "System administration commands",
	Long:  "Health checks, status, and log viewing for Orion services.",
}

var systemHealthCmd = &cobra.Command{
	Use:   "health",
	Short: "Check health of all services",
	Long:  "Hit /health on all 5 services concurrently and display a status table.",
	RunE: func(cmd *cobra.Command, args []string) error {
		ctx := context.Background()
		c := newAuthenticatedClient()
		f := output.New(viper.GetString("output"))

		return runSystemHealth(ctx, c, f)
	},
}

var systemStatusCmd = &cobra.Command{
	Use:   "status",
	Short: "Show system status",
	Long:  "Display system mode, GPU availability, queue depth, and active content count.",
	RunE: func(cmd *cobra.Command, args []string) error {
		ctx := context.Background()
		c := newAuthenticatedClient()
		f := output.New(viper.GetString("output"))

		resp, err := c.SystemStatus(ctx)
		if err != nil {
			return fmt.Errorf("retrieving system status: %w", err)
		}
		fmt.Fprint(os.Stdout, f.FormatSystemStatus(resp))
		return nil
	},
}

var systemLogsCmd = &cobra.Command{
	Use:   "logs [service]",
	Short: "View service logs",
	Long:  "Retrieve logs from a specific service via the gateway.",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		ctx := context.Background()
		c := newAuthenticatedClient()

		service := args[0]
		tail, _ := cmd.Flags().GetInt("tail")
		follow, _ := cmd.Flags().GetBool("follow")

		return runSystemLogs(ctx, c, service, tail, follow)
	},
}

// serviceHealthResult holds the health check result for a single service.
type serviceHealthResult struct {
	Name   string
	Status string
	Err    error
}

func runSystemHealth(ctx context.Context, c *client.OrionClient, f *output.Formatter) error {
	services := []string{"gateway", "scout", "director", "media", "editor", "pulse"}
	results := make([]serviceHealthResult, len(services))

	var wg sync.WaitGroup
	wg.Add(len(services))

	for i, svc := range services {
		go func(idx int, name string) {
			defer wg.Done()
			var h client.HealthResponse
			var err error

			if name == "gateway" {
				h, err = c.Health(ctx)
			} else {
				h, err = c.ServiceHealth(ctx, name)
			}

			if err != nil {
				results[idx] = serviceHealthResult{Name: name, Status: "unhealthy", Err: err}
			} else {
				results[idx] = serviceHealthResult{Name: name, Status: h.Status}
			}
		}(i, svc)
	}

	wg.Wait()

	entries := make([]output.ServiceHealthEntry, len(results))
	for i, r := range results {
		entry := output.ServiceHealthEntry{
			Name:   r.Name,
			Status: r.Status,
		}
		if r.Err != nil {
			entry.Error = r.Err.Error()
		}
		entries[i] = entry
	}

	fmt.Fprint(os.Stdout, f.FormatServiceHealth(entries))
	return nil
}

func runSystemLogs(ctx context.Context, c *client.OrionClient, service string, tail int, follow bool) error {
	if follow {
		return runStreamLogs(ctx, c, service, tail)
	}

	logs, err := c.SystemLogs(ctx, service, tail)
	if err != nil {
		return fmt.Errorf("retrieving logs for %s: %w", service, err)
	}
	fmt.Fprint(os.Stdout, logs)
	return nil
}

func runStreamLogs(ctx context.Context, c *client.OrionClient, service string, tail int) error {
	reader, err := c.SystemLogsStream(ctx, service, tail)
	if err != nil {
		return fmt.Errorf("streaming logs for %s: %w", service, err)
	}
	defer reader.Close()

	scanner := bufio.NewScanner(reader)
	for scanner.Scan() {
		fmt.Fprintln(os.Stdout, scanner.Text())
	}
	return scanner.Err()
}
