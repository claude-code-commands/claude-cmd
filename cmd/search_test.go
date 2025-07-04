package cmd

import (
	"bytes"
	"strings"
	"testing"
	"time"

	"github.com/claude-code-commands/claude-cmd/internal/cache"
	"github.com/spf13/afero"
)

// Helper function to create test manifest for search command
func createSearchTestManifest() *cache.Manifest {
	return &cache.Manifest{
		Version: "1.0.0",
		Updated: time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC),
		Commands: []cache.Command{
			{
				Name:        "debug-issue",
				Description: "Debug a specific issue in your codebase",
				File:        "debug-issue.md",
			},
			{
				Name:        "debug-performance",
				Description: "Analyze and optimize application performance",
				File:        "debug-performance.md",
			},
			{
				Name:        "write-tests",
				Description: "Generate comprehensive tests for code",
				File:        "write-tests.md",
			},
			{
				Name:        "optimize-code",
				Description: "Optimize code for better performance and readability",
				File:        "optimize-code.md",
			},
			{
				Name:        "refactor-legacy",
				Description: "Modernize and refactor legacy codebase",
				File:        "refactor-legacy.md",
			},
		},
	}
}

func TestSearchCommand_NameMatch(t *testing.T) {
	// RED Phase: This test should fail because search command doesn't exist yet
	fs := afero.NewMemMapFs()

	// Create mock cache manager
	mockCache := &MockCacheManager{
		manifest: createSearchTestManifest(),
		err:      nil,
	}

	// Create search command with injected cache manager
	cmd := newSearchCommand(fs, WithSearchCacheManager(mockCache))

	// Capture output
	var output bytes.Buffer
	cmd.SetOut(&output)
	cmd.SetErr(&output)

	// Execute command with name search
	cmd.SetArgs([]string{"debug"})
	err := cmd.Execute()

	// RED Phase: Should fail because search command doesn't exist yet
	if err != nil {
		t.Fatalf("Expected search command to succeed with name match, got error: %v", err)
	}

	// Should contain commands with "debug" in the name
	outputStr := output.String()
	if !strings.Contains(outputStr, "debug-issue") {
		t.Errorf("Expected output to contain 'debug-issue' command, got: %s", outputStr)
	}
	if !strings.Contains(outputStr, "debug-performance") {
		t.Errorf("Expected output to contain 'debug-performance' command, got: %s", outputStr)
	}

	// Should NOT contain commands without "debug" in name
	if strings.Contains(outputStr, "write-tests") {
		t.Errorf("Expected output to NOT contain 'write-tests' command, got: %s", outputStr)
	}
}

func TestSearchCommand_DescriptionMatch(t *testing.T) {
	// RED Phase: This test should fail because description search doesn't exist yet
	fs := afero.NewMemMapFs()

	// Create mock cache manager
	mockCache := &MockCacheManager{
		manifest: createSearchTestManifest(),
		err:      nil,
	}

	// Create search command with injected cache manager
	cmd := newSearchCommand(fs, WithSearchCacheManager(mockCache))

	// Capture output
	var output bytes.Buffer
	cmd.SetOut(&output)
	cmd.SetErr(&output)

	// Execute command with description search
	cmd.SetArgs([]string{"performance"})
	err := cmd.Execute()

	// RED Phase: Should fail because description search doesn't exist yet
	if err != nil {
		t.Fatalf("Expected search command to succeed with description match, got error: %v", err)
	}

	// Should contain commands with "performance" in the description
	outputStr := output.String()
	if !strings.Contains(outputStr, "debug-performance") {
		t.Errorf("Expected output to contain 'debug-performance' command, got: %s", outputStr)
	}
	if !strings.Contains(outputStr, "optimize-code") {
		t.Errorf("Expected output to contain 'optimize-code' command, got: %s", outputStr)
	}

	// Should NOT contain commands without "performance" in name or description
	if strings.Contains(outputStr, "write-tests") {
		t.Errorf("Expected output to NOT contain 'write-tests' command, got: %s", outputStr)
	}
}

func TestSearchCommand_CategoryFilter(t *testing.T) {
	// RED Phase: This test should fail because category filtering doesn't exist yet
	fs := afero.NewMemMapFs()

	// Create mock cache manager with categorized commands
	mockCache := &MockCacheManager{
		manifest: createSearchTestManifest(),
		err:      nil,
	}

	// Create search command with injected cache manager
	cmd := newSearchCommand(fs, WithSearchCacheManager(mockCache))

	// Capture output
	var output bytes.Buffer
	cmd.SetOut(&output)
	cmd.SetErr(&output)

	// Execute command with category filter
	cmd.SetArgs([]string{"--category", "debug", "issue"})
	err := cmd.Execute()

	// RED Phase: Should fail because category filtering doesn't exist yet
	if err != nil {
		t.Fatalf("Expected search command to succeed with category filter, got error: %v", err)
	}

	// Should only contain debug category commands matching "issue"
	outputStr := output.String()
	if !strings.Contains(outputStr, "debug-issue") {
		t.Errorf("Expected output to contain 'debug-issue' command, got: %s", outputStr)
	}

	// Should NOT contain commands from other categories
	if strings.Contains(outputStr, "write-tests") {
		t.Errorf("Expected output to NOT contain 'write-tests' command when filtering by debug category, got: %s", outputStr)
	}
}

func TestSearchCommand_NoResults(t *testing.T) {
	// RED Phase: This test should fail because no results handling doesn't exist yet
	fs := afero.NewMemMapFs()

	// Create mock cache manager
	mockCache := &MockCacheManager{
		manifest: createSearchTestManifest(),
		err:      nil,
	}

	// Create search command with injected cache manager
	cmd := newSearchCommand(fs, WithSearchCacheManager(mockCache))

	// Capture output
	var output bytes.Buffer
	cmd.SetOut(&output)
	cmd.SetErr(&output)

	// Execute command with search term that won't match anything
	cmd.SetArgs([]string{"nonexistent-term-xyz"})
	err := cmd.Execute()

	// RED Phase: Should fail because no results handling doesn't exist yet
	if err != nil {
		t.Fatalf("Expected search command to succeed with no results, got error: %v", err)
	}

	// Should show helpful no results message
	outputStr := output.String()
	if !strings.Contains(outputStr, "No commands found") {
		t.Errorf("Expected output to contain 'No commands found' message, got: %s", outputStr)
	}
	if !strings.Contains(outputStr, "nonexistent-term-xyz") {
		t.Errorf("Expected output to contain search term in no results message, got: %s", outputStr)
	}
}

func TestSearchCommand_CacheError(t *testing.T) {
	// RED Phase: This test should fail because error handling doesn't exist yet
	fs := afero.NewMemMapFs()

	// Mock cache manager that returns network error
	mockCache := &MockCacheManager{
		manifest: nil,
		err:      cache.ErrNetworkUnavailable,
	}

	// Create search command with mock cache manager
	cmd := newSearchCommand(fs, WithSearchCacheManager(mockCache))

	// Capture output
	var output bytes.Buffer
	cmd.SetOut(&output)
	cmd.SetErr(&output)

	// Execute command - should fail with user-friendly error
	cmd.SetArgs([]string{"debug"})
	err := cmd.Execute()
	if err == nil {
		t.Fatal("Expected command to fail due to cache error")
	}

	// Should fail with user-friendly network error message
	if !strings.Contains(err.Error(), "unable to retrieve commands") {
		t.Errorf("Expected user-friendly network error, got: %v", err)
	}
}
