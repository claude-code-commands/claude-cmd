package cmd

import (
	"bytes"
	"strings"
	"testing"
	"time"

	"github.com/claude-code-commands/claude-cmd/internal/cache"
	"github.com/spf13/afero"
)

// Helper function to create test manifest
func createTestManifest() *cache.Manifest {
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
				Name:        "write-tests",
				Description: "Generate comprehensive tests for code",
				File:        "write-tests.md",
			},
			{
				Name:        "optimize-code",
				Description: "Optimize code for performance",
				File:        "optimize-code.md",
			},
		},
	}
}

func TestListCommand_Success(t *testing.T) {
	fs := afero.NewMemMapFs()

	// Create mock cache manager
	mockCache := &MockCacheManager{
		manifest: createTestManifest(),
		err:      nil,
	}

	// Create list command with injected cache manager
	cmd := newListCommand(fs, WithCacheManager(mockCache))

	// Capture output
	var output bytes.Buffer
	cmd.SetOut(&output)
	cmd.SetErr(&output)

	// Execute command - should now succeed in GREEN phase
	err := cmd.Execute()
	if err != nil {
		t.Fatalf("Expected command to succeed, got error: %v", err)
	}

	// GREEN phase: Verify successful output
	outputStr := output.String()

	// Should contain command count summary
	if !strings.Contains(outputStr, "3 total") {
		t.Errorf("Expected output to contain command count, got: %s", outputStr)
	}

	// Should contain command names from test manifest
	if !strings.Contains(outputStr, "debug-issue") {
		t.Errorf("Expected output to contain 'debug-issue' command, got: %s", outputStr)
	}
	if !strings.Contains(outputStr, "write-tests") {
		t.Errorf("Expected output to contain 'write-tests' command, got: %s", outputStr)
	}
}

func TestListCommand_CacheError(t *testing.T) {
	fs := afero.NewMemMapFs()

	// Mock cache manager that returns network error
	mockCache := &MockCacheManager{
		manifest: nil,
		err:      cache.ErrNetworkUnavailable,
	}

	// Create list command with mock cache manager
	cmd := newListCommand(fs, WithCacheManager(mockCache))

	// Capture output
	var output bytes.Buffer
	cmd.SetOut(&output)
	cmd.SetErr(&output)

	// Execute command - should fail with user-friendly error
	err := cmd.Execute()
	if err == nil {
		t.Fatal("Expected command to fail due to cache error")
	}

	// GREEN phase: Should fail with user-friendly network error message
	if !strings.Contains(err.Error(), "unable to retrieve commands: network unavailable") {
		t.Errorf("Expected user-friendly network error, got: %v", err)
	}
}

func TestListCommand_EmptyRepository(t *testing.T) {
	fs := afero.NewMemMapFs()

	// Create mock cache manager with empty manifest
	emptyManifest := &cache.Manifest{
		Version:  "1.0.0",
		Updated:  time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC),
		Commands: []cache.Command{}, // Empty commands list
	}

	mockCache := &MockCacheManager{
		manifest: emptyManifest,
		err:      nil,
	}

	// Create list command with mock cache manager
	cmd := newListCommand(fs, WithCacheManager(mockCache))

	// Capture output
	var output bytes.Buffer
	cmd.SetOut(&output)
	cmd.SetErr(&output)

	// Execute command
	err := cmd.Execute()

	// GREEN phase: Should succeed with empty repository message
	if err != nil {
		t.Fatalf("Expected command to succeed with empty repository, got error: %v", err)
	}

	// Check output contains "No commands available" message
	outputStr := output.String()
	if !strings.Contains(outputStr, "No commands available") {
		t.Errorf("Expected 'No commands available' message, got: %s", outputStr)
	}
}

func TestListCommand_ShowCount(t *testing.T) {
	fs := afero.NewMemMapFs()

	mockCache := &MockCacheManager{
		manifest: createTestManifest(),
		err:      nil,
	}

	// Create list command with mock cache manager
	cmd := newListCommand(fs, WithCacheManager(mockCache))

	// Capture output
	var output bytes.Buffer
	cmd.SetOut(&output)
	cmd.SetErr(&output)

	// Execute command
	err := cmd.Execute()

	// GREEN phase: Should succeed and show count summary
	if err != nil {
		t.Fatalf("Expected command to succeed, got error: %v", err)
	}

	// Check output contains count summary
	outputStr := output.String()
	if !strings.Contains(outputStr, "3 total") {
		t.Errorf("Expected output to contain '3 total' count, got: %s", outputStr)
	}
	if !strings.Contains(outputStr, "Available Claude Code commands") {
		t.Errorf("Expected output to contain header, got: %s", outputStr)
	}
}

func TestListCommand_CategoryGrouping(t *testing.T) {
	fs := afero.NewMemMapFs()

	// Mock cache manager - category grouping will be implemented in later iteration
	mockCache := &MockCacheManager{
		manifest: createTestManifest(),
		err:      nil,
	}

	// Create list command with mock cache manager
	cmd := newListCommand(fs, WithCacheManager(mockCache))

	// Capture output
	var output bytes.Buffer
	cmd.SetOut(&output)
	cmd.SetErr(&output)

	// Execute command
	err := cmd.Execute()

	// GREEN phase: Should succeed (category grouping to be implemented later)
	if err != nil {
		t.Fatalf("Expected command to succeed, got error: %v", err)
	}

	// For now, just verify basic output works
	// Category grouping will be implemented in subsequent TDD cycles
	outputStr := output.String()
	if !strings.Contains(outputStr, "debug-issue") {
		t.Errorf("Expected output to contain commands, got: %s", outputStr)
	}
}
