// Package cmd provides comprehensive testing for root command Status Dashboard integration.
// This file validates the complete integration between the root command and status functionality,
// ensuring backwards compatibility while testing new status display capabilities.
package cmd

import (
	"bytes"
	"errors"
	"strings"
	"testing"
	"time"

	"github.com/claude-code-commands/claude-cmd/internal/cache"
	"github.com/spf13/afero"
)

// RED PHASE: Test basic root command status functionality
func TestRootCommand_StatusIntegration_Success(t *testing.T) {
	fs := afero.NewMemMapFs()

	// Create a root command with status functionality
	cmd := newRootCommandWithOptions(fs, WithStatusEnabled(true))

	var output bytes.Buffer
	cmd.SetOut(&output)
	cmd.SetArgs([]string{})

	err := cmd.Execute()
	if err != nil {
		t.Fatalf("Expected no error executing root command with status, got: %v", err)
	}

	outputStr := output.String()
	if outputStr == "" {
		t.Fatal("Expected non-empty output for root command with status")
	}

	// Should contain status information
	expectedContent := []string{
		"Claude CMD Status",
		"Version:",
		"Cache Status:",
		"Installed Commands:",
	}

	for _, expected := range expectedContent {
		if !strings.Contains(outputStr, expected) {
			t.Errorf("Expected output to contain %q, got: %s", expected, outputStr)
		}
	}
}

// RED PHASE: Test root command with status disabled
func TestRootCommand_StatusIntegration_Disabled(t *testing.T) {
	fs := afero.NewMemMapFs()

	// Create a root command without status functionality (default behavior)
	cmd := newRootCommandWithOptions(fs, WithStatusEnabled(false))

	var output bytes.Buffer
	cmd.SetOut(&output)
	cmd.SetArgs([]string{})

	err := cmd.Execute()
	if err != nil {
		t.Fatalf("Expected no error executing root command without status, got: %v", err)
	}

	outputStr := output.String()
	if outputStr == "" {
		t.Fatal("Expected non-empty output for root command without status")
	}

	// Should contain basic help information, not status
	if strings.Contains(outputStr, "Cache Status:") {
		t.Errorf("Expected output to not contain status information when disabled, got: %s", outputStr)
	}

	// Should contain basic help text
	expectedContent := []string{
		"claude-cmd",
		"help",
	}

	for _, expected := range expectedContent {
		if !strings.Contains(outputStr, expected) {
			t.Errorf("Expected output to contain %q, got: %s", expected, outputStr)
		}
	}
}

// RED PHASE: Test root command with custom cache manager
func TestRootCommand_StatusIntegration_WithCustomCacheManager(t *testing.T) {
	fs := afero.NewMemMapFs()

	// Create mock cache manager with test data
	mockCache := &MockCacheManager{
		manifest: &cache.Manifest{
			Version: "1.0.0",
			Updated: time.Date(2024, 12, 1, 10, 0, 0, 0, time.UTC),
			Commands: []cache.Command{
				{Name: "test-cmd", Description: "Test command", File: "test-cmd.md"},
				{Name: "example", Description: "Example command", File: "example.md"},
			},
		},
	}

	// Create root command with custom cache manager
	cmd := newRootCommandWithOptions(fs,
		WithStatusEnabled(true),
		WithStatusCacheManager(mockCache),
	)

	var output bytes.Buffer
	cmd.SetOut(&output)
	cmd.SetArgs([]string{})

	err := cmd.Execute()
	if err != nil {
		t.Fatalf("Expected no error executing root command with custom cache, got: %v", err)
	}

	outputStr := output.String()

	// Should contain specific test data from mock cache
	expectedContent := []string{
		"Commands: 2",  // From mock cache
		"Language: en", // Default language
	}

	for _, expected := range expectedContent {
		if !strings.Contains(outputStr, expected) {
			t.Errorf("Expected output to contain %q, got: %s", expected, outputStr)
		}
	}
}

// RED PHASE: Test root command status format option
func TestRootCommand_StatusIntegration_FormatOption(t *testing.T) {
	fs := afero.NewMemMapFs()

	// Create root command with status functionality
	cmd := newRootCommandWithOptions(fs, WithStatusEnabled(true))

	testCases := []struct {
		name   string
		format string
		verify func(string) bool
	}{
		{
			name:   "default format",
			format: "default",
			verify: func(output string) bool {
				return strings.Contains(output, "Claude CMD Status") &&
					strings.Contains(output, "Cache Status:")
			},
		},
		{
			name:   "compact format",
			format: "compact",
			verify: func(output string) bool {
				return strings.Count(output, "\n") <= 3 &&
					strings.Contains(output, "|")
			},
		},
		{
			name:   "json format",
			format: "json",
			verify: func(output string) bool {
				return strings.Contains(output, `"version"`) &&
					strings.Contains(output, `"cache"`)
			},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			var output bytes.Buffer
			cmd.SetOut(&output)
			cmd.SetArgs([]string{"--format", tc.format})

			err := cmd.Execute()
			if err != nil {
				t.Fatalf("Expected no error for format %s, got: %v", tc.format, err)
			}

			outputStr := output.String()
			if !tc.verify(outputStr) {
				t.Errorf("Format verification failed for %s, got: %s", tc.format, outputStr)
			}
		})
	}
}

// RED PHASE: Test root command status error handling
func TestRootCommand_StatusIntegration_ErrorHandling(t *testing.T) {
	fs := afero.NewMemMapFs()

	// Create mock cache manager that returns cache miss error
	mockCache := &MockCacheManager{
		err: errors.New("cache miss"),
	}

	// Create root command with failing cache manager
	cmd := newRootCommandWithOptions(fs,
		WithStatusEnabled(true),
		WithStatusCacheManager(mockCache),
	)

	var output bytes.Buffer
	cmd.SetOut(&output)
	cmd.SetArgs([]string{})

	err := cmd.Execute()
	if err != nil {
		t.Fatalf("Expected no error even with cache failure, got: %v", err)
	}

	outputStr := output.String()

	// Should handle cache error gracefully and show no cache available
	cacheIndicators := []string{"0", "no cache", "cache miss", "not available", "(no cache available)"}
	hasIndicator := false
	for _, indicator := range cacheIndicators {
		if strings.Contains(strings.ToLower(outputStr), indicator) {
			hasIndicator = true
			break
		}
	}

	if !hasIndicator {
		t.Errorf("Expected output to indicate cache unavailable, got: %s", outputStr)
	}
}

// RED PHASE: Test root command backwards compatibility
func TestRootCommand_BackwardsCompatibility(t *testing.T) {
	fs := afero.NewMemMapFs()

	// Test that the original root command still works (without status)
	cmd := newRootCommand(fs)

	var output bytes.Buffer
	cmd.SetOut(&output)
	cmd.SetArgs([]string{})

	err := cmd.Execute()
	if err != nil {
		t.Fatalf("Expected no error for backwards compatible root command, got: %v", err)
	}

	outputStr := output.String()
	if outputStr == "" {
		t.Fatal("Expected non-empty output for backwards compatible root command")
	}

	// Should contain basic information
	expectedContent := []string{
		"claude-cmd",
		"help",
	}

	for _, expected := range expectedContent {
		if !strings.Contains(outputStr, expected) {
			t.Errorf("Expected output to contain %q for backwards compatibility, got: %s", expected, outputStr)
		}
	}
}
