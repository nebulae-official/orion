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

func toJSON(v any) string {
	data, err := json.MarshalIndent(v, "", "  ")
	if err != nil {
		return fmt.Sprintf(`{"error": "%s"}`, err.Error())
	}
	return string(data)
}
