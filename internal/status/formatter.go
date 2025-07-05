// Package status provides functionality for formatting and displaying
// status information about the claude-cmd CLI tool in various output formats.
package status

import (
	"encoding/json"
	"fmt"
	"strings"
	"time"
)

// Format constants for consistent format identification
const (
	FormatDefault  = "default"
	FormatCompact  = "compact"
	FormatDetailed = "detailed"
	FormatJSON     = "json"
)

// Time format constants for consistent timestamp formatting
const (
	StandardTimeFormat = "2006-01-02 15:04:05"
	DetailedTimeFormat = "2006-01-02 15:04:05 MST"
)

// StatusFormatter handles formatting of FullStatus data into various output formats.
// It supports multiple output formats including default, compact, detailed, and JSON.
type StatusFormatter struct{}

// NewStatusFormatter creates a new StatusFormatter instance.
func NewStatusFormatter() *StatusFormatter {
	return &StatusFormatter{}
}

// Format formats the given FullStatus into the specified output format.
// Supported formats: default, compact, detailed, json (case-insensitive).
// Empty format defaults to "default".
func (f *StatusFormatter) Format(status *FullStatus, format string) (string, error) {
	if status == nil {
		return "", fmt.Errorf("status cannot be nil")
	}

	// Normalize format to lowercase, default to FormatDefault if empty
	normalizedFormat := strings.ToLower(strings.TrimSpace(format))
	if normalizedFormat == "" {
		normalizedFormat = FormatDefault
	}

	switch normalizedFormat {
	case FormatDefault:
		return f.formatDefault(status), nil
	case FormatCompact:
		return f.formatCompact(status), nil
	case FormatDetailed:
		return f.formatDetailed(status), nil
	case FormatJSON:
		return f.formatJSON(status)
	default:
		return "", fmt.Errorf("unsupported format: %q", format)
	}
}

// writeSection is a helper function to reduce code duplication in string building
func (f *StatusFormatter) writeSection(builder *strings.Builder, title string, content func(*strings.Builder)) {
	builder.WriteString(title)
	builder.WriteString("\n")
	content(builder)
	builder.WriteString("\n")
}

// writeLine is a helper function for consistent line writing
func (f *StatusFormatter) writeLine(builder *strings.Builder, format string, args ...interface{}) {
	builder.WriteString(fmt.Sprintf(format, args...))
	builder.WriteString("\n")
}

// formatCacheLastUpdated provides consistent cache timestamp formatting
func (f *StatusFormatter) formatCacheLastUpdated(lastUpdated time.Time, useDetailed bool) string {
	if lastUpdated.IsZero() {
		if useDetailed {
			return "never (cache miss)"
		}
		return "(no cache available)"
	}

	format := StandardTimeFormat
	if useDetailed {
		format = DetailedTimeFormat
	}
	return lastUpdated.Format(format)
}

// formatDefault formats status in the default human-readable format.
func (f *StatusFormatter) formatDefault(status *FullStatus) string {
	var result strings.Builder

	f.writeLine(&result, "Claude CMD Status")
	f.writeLine(&result, "Version: %s", status.Version)
	result.WriteString("\n")

	// Cache information
	f.writeSection(&result, "Cache Status:", func(b *strings.Builder) {
		if status.Cache.LastUpdated.IsZero() {
			f.writeLine(b, "  Commands: %d %s", status.Cache.CommandCount, f.formatCacheLastUpdated(status.Cache.LastUpdated, false))
		} else {
			f.writeLine(b, "  Commands: %d", status.Cache.CommandCount)
			f.writeLine(b, "  Last Updated: %s", f.formatCacheLastUpdated(status.Cache.LastUpdated, false))
		}
		f.writeLine(b, "  Language: %s", status.Cache.Language)
	})

	// Installed commands information
	f.writeSection(&result, "Installed Commands:", func(b *strings.Builder) {
		f.writeLine(b, "  Total: %d", status.Installed.TotalCount)
		f.writeLine(b, "  Project: %d", status.Installed.ProjectCount)
		f.writeLine(b, "  Personal: %d", status.Installed.PersonalCount)
		f.writeLine(b, "  Primary Location: %s", status.Installed.PrimaryLocation)
	})

	// Remove the extra newline at the end
	output := result.String()
	return strings.TrimSuffix(output, "\n")
}

// formatCompact formats status in a compact single-line format.
func (f *StatusFormatter) formatCompact(status *FullStatus) string {
	return fmt.Sprintf("%s | Cache: %d | Installed: %d",
		status.Version,
		status.Cache.CommandCount,
		status.Installed.TotalCount)
}

// formatDetailed formats status with comprehensive details.
func (f *StatusFormatter) formatDetailed(status *FullStatus) string {
	var result strings.Builder

	f.writeLine(&result, "=== Claude CMD Detailed Status ===")
	result.WriteString("\n")

	// Version section
	f.writeSection(&result, "VERSION INFORMATION:", func(b *strings.Builder) {
		f.writeLine(b, "  Version: %s", status.Version)
	})

	// Cache section
	f.writeSection(&result, "CACHE STATUS:", func(b *strings.Builder) {
		f.writeLine(b, "  Available Commands: %d", status.Cache.CommandCount)
		f.writeLine(b, "  Language: %s", status.Cache.Language)
		f.writeLine(b, "  Last Updated: %s", f.formatCacheLastUpdated(status.Cache.LastUpdated, true))
		if !status.Cache.LastUpdated.IsZero() {
			f.writeLine(b, "  Cache Age: %s", time.Since(status.Cache.LastUpdated).Truncate(time.Minute))
		}
	})

	// Installation section
	f.writeSection(&result, "INSTALLATION STATUS:", func(b *strings.Builder) {
		f.writeLine(b, "  Total Installed: %d", status.Installed.TotalCount)
		f.writeLine(b, "  Project Directory: %d commands", status.Installed.ProjectCount)
		f.writeLine(b, "  Personal Directory: %d commands", status.Installed.PersonalCount)
		f.writeLine(b, "  Primary Location: %s", status.Installed.PrimaryLocation)
	})

	// Summary
	f.writeSection(&result, "SUMMARY:", func(b *strings.Builder) {
		if status.Cache.CommandCount == 0 {
			f.writeLine(b, "  • No cached commands available")
		} else {
			f.writeLine(b, "  • %d commands available in cache", status.Cache.CommandCount)
		}
		f.writeLine(b, "  • %d commands currently installed", status.Installed.TotalCount)
	})

	// Remove the extra newline at the end
	output := result.String()
	return strings.TrimSuffix(output, "\n")
}

// formatJSON formats status as JSON output.
func (f *StatusFormatter) formatJSON(status *FullStatus) (string, error) {
	data, err := json.MarshalIndent(status, "", "  ")
	if err != nil {
		return "", fmt.Errorf("failed to marshal status to JSON: %w", err)
	}
	return string(data), nil
}
