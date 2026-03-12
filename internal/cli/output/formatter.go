// Package output provides formatting utilities for CLI output.
package output

import (
	"bytes"
	"encoding/json"
	"fmt"
	"strings"
	"text/tabwriter"

	"github.com/orion-rigel/orion/internal/cli/client"
)

// Format is the output format type.
type Format string

const (
	// FormatJSON renders output as JSON.
	FormatJSON Format = "json"
	// FormatTable renders output as an aligned table.
	FormatTable Format = "table"
	// FormatText renders output as plain text.
	FormatText Format = "text"
)

// ServiceHealthEntry holds the health result for a single service for display.
type ServiceHealthEntry struct {
	Name   string
	Status string
	Error  string
}

// Formatter formats CLI responses for display.
type Formatter struct {
	format Format
}

// New creates a Formatter for the given output format string.
func New(format string) *Formatter {
	switch Format(strings.ToLower(format)) {
	case FormatJSON:
		return &Formatter{format: FormatJSON}
	case FormatTable:
		return &Formatter{format: FormatTable}
	default:
		return &Formatter{format: FormatText}
	}
}

// FormatHealth formats a HealthResponse for display.
func (f *Formatter) FormatHealth(h client.HealthResponse) string {
	switch f.format {
	case FormatJSON:
		return toJSON(h)
	case FormatTable:
		return f.healthTable(h)
	default:
		return f.healthText(h)
	}
}

// FormatStatus formats a StatusResponse for display.
func (f *Formatter) FormatStatus(s client.StatusResponse) string {
	switch f.format {
	case FormatJSON:
		return toJSON(s)
	case FormatTable:
		return f.statusTable(s)
	default:
		return f.statusText(s)
	}
}

// FormatServiceHealth formats a list of service health results for display.
func (f *Formatter) FormatServiceHealth(entries []ServiceHealthEntry) string {
	switch f.format {
	case FormatJSON:
		return toJSON(entries)
	default:
		return f.serviceHealthTable(entries)
	}
}

// FormatSystemStatus formats the system status response for display.
func (f *Formatter) FormatSystemStatus(s client.SystemStatusResponse) string {
	switch f.format {
	case FormatJSON:
		return toJSON(s)
	default:
		return f.systemStatusText(s)
	}
}

// FormatContentList formats a list of content items for display.
func (f *Formatter) FormatContentList(resp client.ContentListResponse) string {
	switch f.format {
	case FormatJSON:
		return toJSON(resp)
	default:
		return f.contentListTable(resp)
	}
}

// FormatContentDetail formats a single content item for display.
func (f *Formatter) FormatContentDetail(item client.ContentItem) string {
	switch f.format {
	case FormatJSON:
		return toJSON(item)
	default:
		return f.contentDetailText(item)
	}
}

// FormatTrendList formats a list of detected trends for display.
func (f *Formatter) FormatTrendList(resp client.TrendListResponse) string {
	switch f.format {
	case FormatJSON:
		return toJSON(resp)
	default:
		return f.trendListTable(resp)
	}
}

// FormatScoutConfig formats the scout configuration for display.
func (f *Formatter) FormatScoutConfig(cfg client.ScoutConfigResponse) string {
	switch f.format {
	case FormatJSON:
		return toJSON(cfg)
	default:
		return f.scoutConfigTable(cfg)
	}
}

// FormatProviderList formats a list of providers for display.
func (f *Formatter) FormatProviderList(resp client.ProviderListResponse) string {
	switch f.format {
	case FormatJSON:
		return toJSON(resp)
	default:
		return f.providerListTable(resp)
	}
}

// FormatProviderStatus formats detailed provider status for display.
func (f *Formatter) FormatProviderStatus(resp client.ProviderStatusResponse) string {
	switch f.format {
	case FormatJSON:
		return toJSON(resp)
	default:
		return f.providerStatusTable(resp)
	}
}

func (f *Formatter) healthTable(h client.HealthResponse) string {
	var buf bytes.Buffer
	w := tabwriter.NewWriter(&buf, 0, 0, 2, ' ', 0)
	fmt.Fprintln(w, "FIELD\tVALUE")
	fmt.Fprintf(w, "Status\t%s\n", h.Status)
	if h.Service != "" {
		fmt.Fprintf(w, "Service\t%s\n", h.Service)
	}
	if h.Uptime != "" {
		fmt.Fprintf(w, "Uptime\t%s\n", h.Uptime)
	}
	for k, v := range h.Details {
		fmt.Fprintf(w, "%s\t%s\n", k, v)
	}
	w.Flush()
	return buf.String()
}

func (f *Formatter) healthText(h client.HealthResponse) string {
	var sb strings.Builder
	if h.Service != "" {
		sb.WriteString(fmt.Sprintf("%s: %s", h.Service, h.Status))
	} else {
		sb.WriteString(fmt.Sprintf("Gateway: %s", h.Status))
	}
	if h.Uptime != "" {
		sb.WriteString(fmt.Sprintf(" (uptime: %s)", h.Uptime))
	}
	return sb.String()
}

func (f *Formatter) statusTable(s client.StatusResponse) string {
	var buf bytes.Buffer
	w := tabwriter.NewWriter(&buf, 0, 0, 2, ' ', 0)
	fmt.Fprintln(w, "SERVICE\tSTATUS")
	fmt.Fprintf(w, "gateway\t%s\n", s.Gateway.Status)
	for name, svc := range s.Services {
		fmt.Fprintf(w, "%s\t%s\n", name, svc.Status)
	}
	w.Flush()
	return buf.String()
}

func (f *Formatter) statusText(s client.StatusResponse) string {
	var sb strings.Builder
	sb.WriteString(fmt.Sprintf("Gateway: %s\n", s.Gateway.Status))
	for name, svc := range s.Services {
		sb.WriteString(fmt.Sprintf("  %s: %s\n", name, svc.Status))
	}
	return sb.String()
}

func (f *Formatter) serviceHealthTable(entries []ServiceHealthEntry) string {
	var buf bytes.Buffer
	w := tabwriter.NewWriter(&buf, 0, 0, 2, ' ', 0)
	fmt.Fprintln(w, "SERVICE\tSTATUS")
	for _, e := range entries {
		status := e.Status
		if e.Error != "" {
			status += " (" + e.Error + ")"
		}
		fmt.Fprintf(w, "%s\t%s\n", e.Name, status)
	}
	w.Flush()
	return buf.String()
}

func (f *Formatter) systemStatusText(s client.SystemStatusResponse) string {
	var sb strings.Builder
	sb.WriteString(fmt.Sprintf("Mode:           %s\n", s.Mode))
	sb.WriteString(fmt.Sprintf("GPU Available:  %v\n", s.GPUAvailable))
	sb.WriteString(fmt.Sprintf("Queue Depth:    %d\n", s.QueueDepth))
	sb.WriteString(fmt.Sprintf("Active Content: %d\n", s.ActiveCount))
	return sb.String()
}

func (f *Formatter) contentListTable(resp client.ContentListResponse) string {
	var buf bytes.Buffer
	w := tabwriter.NewWriter(&buf, 0, 0, 2, ' ', 0)
	fmt.Fprintln(w, "ID\tTITLE\tSTATUS\tSCORE\tCREATED")
	for _, item := range resp.Items {
		fmt.Fprintf(w, "%s\t%s\t%s\t%.2f\t%s\n",
			item.ID,
			truncate(item.Title, 40),
			item.Status,
			item.ConfidenceScore,
			item.CreatedAt.Format("2006-01-02 15:04"),
		)
	}
	w.Flush()

	if resp.Total > 0 {
		buf.WriteString(fmt.Sprintf("\nTotal: %d\n", resp.Total))
	}
	return buf.String()
}

func (f *Formatter) contentDetailText(item client.ContentItem) string {
	var sb strings.Builder
	sb.WriteString(fmt.Sprintf("ID:         %s\n", item.ID))
	sb.WriteString(fmt.Sprintf("Title:      %s\n", item.Title))
	sb.WriteString(fmt.Sprintf("Status:     %s\n", item.Status))
	sb.WriteString(fmt.Sprintf("Score:      %.2f\n", item.ConfidenceScore))
	sb.WriteString(fmt.Sprintf("Created:    %s\n", item.CreatedAt.Format("2006-01-02 15:04:05")))
	if !item.UpdatedAt.IsZero() {
		sb.WriteString(fmt.Sprintf("Updated:    %s\n", item.UpdatedAt.Format("2006-01-02 15:04:05")))
	}
	sb.WriteString("\n--- Body ---\n")
	sb.WriteString(item.Body)
	sb.WriteString("\n")

	if len(item.Assets) > 0 {
		sb.WriteString("\n--- Assets ---\n")
		for _, a := range item.Assets {
			sb.WriteString(fmt.Sprintf("  [%s] %s — %s\n", a.Type, a.Name, a.URL))
		}
	}
	return sb.String()
}

func (f *Formatter) trendListTable(resp client.TrendListResponse) string {
	var buf bytes.Buffer
	w := tabwriter.NewWriter(&buf, 0, 0, 2, ' ', 0)
	fmt.Fprintln(w, "TOPIC\tSOURCE\tSCORE\tDETECTED AT\tSTATUS")
	for _, t := range resp.Items {
		fmt.Fprintf(w, "%s\t%s\t%.2f\t%s\t%s\n",
			truncate(t.Topic, 40),
			t.Source,
			t.Score,
			t.DetectedAt,
			t.Status,
		)
	}
	w.Flush()

	if resp.Total > 0 {
		buf.WriteString(fmt.Sprintf("\nTotal: %d\n", resp.Total))
	}
	return buf.String()
}

func (f *Formatter) scoutConfigTable(cfg client.ScoutConfigResponse) string {
	var buf bytes.Buffer
	w := tabwriter.NewWriter(&buf, 0, 0, 2, ' ', 0)
	fmt.Fprintln(w, "KEY\tVALUE")
	for k, v := range cfg.Settings {
		fmt.Fprintf(w, "%s\t%s\n", k, v)
	}
	w.Flush()
	return buf.String()
}

func (f *Formatter) providerListTable(resp client.ProviderListResponse) string {
	var buf bytes.Buffer
	w := tabwriter.NewWriter(&buf, 0, 0, 2, ' ', 0)
	fmt.Fprintln(w, "SERVICE\tPROVIDER\tMODE\tMODEL\tSTATUS")
	for _, p := range resp.Providers {
		fmt.Fprintf(w, "%s\t%s\t%s\t%s\t%s\n",
			p.Service,
			p.Provider,
			p.Mode,
			p.Model,
			p.Status,
		)
	}
	w.Flush()
	return buf.String()
}

func (f *Formatter) providerStatusTable(resp client.ProviderStatusResponse) string {
	var buf bytes.Buffer
	w := tabwriter.NewWriter(&buf, 0, 0, 2, ' ', 0)
	fmt.Fprintln(w, "SERVICE\tPROVIDER\tMODE\tMODEL\tSTATUS\tLATENCY\tCOST/CALL\tTOTAL COST\tCALLS")
	for _, p := range resp.Providers {
		fmt.Fprintf(w, "%s\t%s\t%s\t%s\t%s\t%s\t$%.4f\t$%.2f\t%d\n",
			p.Service,
			p.Provider,
			p.Mode,
			p.Model,
			p.Status,
			p.Latency,
			p.CostPerCall,
			p.TotalCost,
			p.CallCount,
		)
	}
	w.Flush()
	return buf.String()
}

func truncate(s string, maxLen int) string {
	if len(s) <= maxLen {
		return s
	}
	return s[:maxLen-3] + "..."
}

func toJSON(v any) string {
	data, err := json.MarshalIndent(v, "", "  ")
	if err != nil {
		return fmt.Sprintf(`{"error": "%s"}`, err.Error())
	}
	return string(data)
}
