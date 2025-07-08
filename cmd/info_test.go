package cmd

import (
	"fmt"
	"io"
	"net/http"
	"strings"
	"testing"

	"github.com/claude-code-commands/claude-cmd/internal/cache"
	"github.com/spf13/afero"
)

// RED PHASE: Test basic command structure
func TestInfoCommand_BasicStructure(t *testing.T) {
	fs := afero.NewMemMapFs()
	cmd := newInfoCommand(fs)

	if cmd == nil {
		t.Fatal("newInfoCommand returned nil")
	}

	if cmd.Use != "info <command-name>" {
		t.Errorf("expected Use to be 'info <command-name>', got %q", cmd.Use)
	}

	if cmd.Short == "" {
		t.Error("expected Short description to be set")
	}

	if cmd.Long == "" {
		t.Error("expected Long description to be set")
	}

	// Test that command accepts exactly one argument
	if err := cmd.Args(cmd, []string{}); err == nil {
		t.Error("expected error with no arguments")
	}

	if err := cmd.Args(cmd, []string{"test-command"}); err != nil {
		t.Errorf("expected no error with one argument, got %v", err)
	}

	if err := cmd.Args(cmd, []string{"test", "extra"}); err == nil {
		t.Error("expected error with too many arguments")
	}
}

// RED PHASE: Test --detailed flag exists and works
func TestInfoCommand_DetailedFlag(t *testing.T) {
	fs := afero.NewMemMapFs()
	cmd := newInfoCommand(fs)

	// Check that detailed flag exists
	detailedFlag := cmd.Flags().Lookup("detailed")
	if detailedFlag == nil {
		t.Fatal("--detailed flag not found")
	}

	// Test flag parsing
	cmd.SetArgs([]string{"test-command", "--detailed"})
	err := cmd.ParseFlags([]string{"test-command", "--detailed"})
	if err != nil {
		t.Fatalf("failed to parse --detailed flag: %v", err)
	}

	detailed, err := cmd.Flags().GetBool("detailed")
	if err != nil {
		t.Fatalf("failed to get detailed flag value: %v", err)
	}

	if !detailed {
		t.Error("expected --detailed flag to be true")
	}
}

// RED PHASE: Test command runs without panicking (even if it fails)
func TestInfoCommand_RunsWithoutPanic(t *testing.T) {
	fs := afero.NewMemMapFs()
	cmd := newInfoCommand(fs)

	// Capture output to prevent test noise
	var output strings.Builder
	cmd.SetOut(&output)
	cmd.SetErr(&output)

	// Set args and try to run - should not panic
	cmd.SetArgs([]string{"nonexistent-command"})

	// This will likely fail since we haven't implemented the logic yet,
	// but it should not panic
	defer func() {
		if r := recover(); r != nil {
			t.Errorf("command panicked: %v", r)
		}
	}()

	// Expect this to fail during RED phase, but not panic
	_ = cmd.Execute()
}

// GREEN PHASE: Test valid command lookup from manifest
func TestInfoCommand_ValidCommand(t *testing.T) {
	fs := afero.NewMemMapFs()

	// Create a mock cache manager with test data
	mockCacheManager := &MockCacheManager{
		manifest: &cache.Manifest{
			Version: "1.0.0",
			Commands: []cache.Command{
				{
					Name:        "debug-help",
					Description: "Provide systematic debugging assistance for code issues",
					File:        "debug-help.md",
				},
			},
		},
	}

	cmd := newInfoCommand(fs, WithInfoCacheManager(mockCacheManager))

	var output strings.Builder
	cmd.SetOut(&output)
	cmd.SetErr(&output)

	cmd.SetArgs([]string{"debug-help"})
	err := cmd.Execute()

	if err != nil {
		t.Fatalf("expected no error for valid command, got: %v", err)
	}

	outputStr := output.String()

	// Verify the output contains expected information
	if !strings.Contains(outputStr, "Command: debug-help") {
		t.Error("expected output to contain command name")
	}

	if !strings.Contains(outputStr, "Description: Provide systematic debugging assistance") {
		t.Error("expected output to contain command description")
	}

	if !strings.Contains(outputStr, "Repository File: debug-help.md") {
		t.Error("expected output to contain repository file")
	}
}

// GREEN PHASE: Test command not found error
func TestInfoCommand_CommandNotFound(t *testing.T) {
	fs := afero.NewMemMapFs()

	// Create a mock cache manager with limited test data
	mockCacheManager := &MockCacheManager{
		manifest: &cache.Manifest{
			Version: "1.0.0",
			Commands: []cache.Command{
				{
					Name:        "debug-help",
					Description: "Provide systematic debugging assistance for code issues",
					File:        "debug-help.md",
				},
			},
		},
	}

	cmd := newInfoCommand(fs, WithInfoCacheManager(mockCacheManager))

	var output strings.Builder
	cmd.SetOut(&output)
	cmd.SetErr(&output)

	cmd.SetArgs([]string{"nonexistent-command"})
	err := cmd.Execute()

	// Should fail with the command name mentioned and helpful message
	if err == nil {
		t.Error("expected error for nonexistent command")
	}

	if !strings.Contains(err.Error(), "nonexistent-command") {
		t.Errorf("expected error to mention command name 'nonexistent-command', got: %v", err)
	}

	if !strings.Contains(err.Error(), "not found") {
		t.Errorf("expected error to mention 'not found', got: %v", err)
	}

	if !strings.Contains(err.Error(), "claude-cmd list") {
		t.Errorf("expected error to suggest 'claude-cmd list', got: %v", err)
	}
}

// RED PHASE: Test installation status - not installed
func TestInfoCommand_NotInstalled(t *testing.T) {
	fs := afero.NewMemMapFs()

	// Create a mock cache manager with test data
	mockCacheManager := &MockCacheManager{
		manifest: &cache.Manifest{
			Version: "1.0.0",
			Commands: []cache.Command{
				{
					Name:        "debug-help",
					Description: "Provide systematic debugging assistance for code issues",
					File:        "debug-help.md",
				},
			},
		},
	}

	cmd := newInfoCommand(fs, WithInfoCacheManager(mockCacheManager))

	var output strings.Builder
	cmd.SetOut(&output)
	cmd.SetErr(&output)

	cmd.SetArgs([]string{"debug-help"})
	err := cmd.Execute()

	if err != nil {
		t.Fatalf("expected no error, got: %v", err)
	}

	outputStr := output.String()

	// Should show that command is not installed
	if !strings.Contains(outputStr, "Installation Status: Not installed") {
		t.Error("expected output to show 'Not installed' status")
	}
}

// Helper to create HTTP response with content (reusing existing MockHTTPClient from add_test.go)
func createMockResponse(content string, statusCode int) *http.Response {
	return &http.Response{
		StatusCode: statusCode,
		Body:       io.NopCloser(strings.NewReader(content)),
		Header:     make(http.Header),
	}
}

// TODO: Test for personal directory installation
// This requires mocking os.UserHomeDir() which is challenging with the current architecture.
// The install.GetPersonalDir() function directly calls os.UserHomeDir().
// For now, the core functionality is tested through project directory and "not installed" cases.

// RED PHASE: Test installation status - installed in project directory
func TestInfoCommand_InstalledProject(t *testing.T) {
	fs := afero.NewMemMapFs()

	// Create project directory and install command file
	projectDir := "./.claude/commands"
	afero.WriteFile(fs, projectDir+"/debug-help.md", []byte("test content"), 0644)

	// Create a mock cache manager with test data
	mockCacheManager := &MockCacheManager{
		manifest: &cache.Manifest{
			Version: "1.0.0",
			Commands: []cache.Command{
				{
					Name:        "debug-help",
					Description: "Provide systematic debugging assistance for code issues",
					File:        "debug-help.md",
				},
			},
		},
	}

	cmd := newInfoCommand(fs, WithInfoCacheManager(mockCacheManager))

	var output strings.Builder
	cmd.SetOut(&output)
	cmd.SetErr(&output)

	cmd.SetArgs([]string{"debug-help"})
	err := cmd.Execute()

	if err != nil {
		t.Fatalf("expected no error, got: %v", err)
	}

	outputStr := output.String()

	// Should show that command is installed in project directory (takes precedence)
	if !strings.Contains(outputStr, "Installation Status: Installed at") {
		t.Error("expected output to show installed status with location")
	}

	if !strings.Contains(outputStr, ".claude/commands/debug-help.md") {
		t.Errorf("expected output to show project directory path, got: %s", outputStr)
	}
}

// GREEN PHASE: Test detailed mode fetches content
func TestInfoCommand_DetailedMode(t *testing.T) {
	fs := afero.NewMemMapFs()

	// Create a mock cache manager with test data
	mockCacheManager := &MockCacheManager{
		manifest: &cache.Manifest{
			Version: "1.0.0",
			Commands: []cache.Command{
				{
					Name:        "debug-help",
					Description: "Provide systematic debugging assistance for code issues",
					File:        "debug-help.md",
				},
			},
		},
	}

	// Create mock HTTP client with test content
	testContent := `---
description: Provide systematic debugging assistance for code issues
---

## Your task

Debug code issues by:
- Analyzing error messages and stack traces
- Suggesting debugging strategies
- Providing step-by-step troubleshooting guidance
- Recommending tools and techniques`

	mockHTTPClient := &MockHTTPClient{
		response: createMockResponse(testContent, 200),
	}

	cmd := newInfoCommand(fs,
		WithInfoCacheManager(mockCacheManager),
		WithInfoHTTPClient(mockHTTPClient),
		WithInfoBaseURL("https://test.example.com"),
	)

	var output strings.Builder
	cmd.SetOut(&output)
	cmd.SetErr(&output)

	cmd.SetArgs([]string{"debug-help", "--detailed"})
	err := cmd.Execute()

	if err != nil {
		t.Fatalf("expected no error, got: %v", err)
	}

	outputStr := output.String()

	// Should show basic info plus detailed content
	if !strings.Contains(outputStr, "Command: debug-help") {
		t.Error("expected output to contain command name")
	}

	// Should show that detailed mode was attempted (even if not fully implemented yet)
	if !strings.Contains(outputStr, "Content Preview:") || !strings.Contains(outputStr, "---") {
		t.Error("expected output to show detailed content with YAML frontmatter")
	}
}

// GREEN PHASE: Test detailed mode handles network errors
func TestInfoCommand_DetailedNetworkError(t *testing.T) {
	fs := afero.NewMemMapFs()

	// Create a mock cache manager
	mockCacheManager := &MockCacheManager{
		manifest: &cache.Manifest{
			Version: "1.0.0",
			Commands: []cache.Command{
				{
					Name:        "debug-help",
					Description: "Provide systematic debugging assistance for code issues",
					File:        "debug-help.md",
				},
			},
		},
	}

	// Mock HTTP client that returns network error
	mockHTTPClient := &MockHTTPClient{
		err: fmt.Errorf("network error: connection timeout"),
	}

	cmd := newInfoCommand(fs,
		WithInfoCacheManager(mockCacheManager),
		WithInfoHTTPClient(mockHTTPClient),
	)

	var output strings.Builder
	cmd.SetOut(&output)
	cmd.SetErr(&output)

	cmd.SetArgs([]string{"debug-help", "--detailed"})
	err := cmd.Execute()

	// Should handle network error gracefully - show basic info with warning
	if err != nil {
		t.Fatalf("expected no error (network errors should be handled gracefully), got: %v", err)
	}

	outputStr := output.String()

	// Should show basic info even on network failure
	if !strings.Contains(outputStr, "Command: debug-help") {
		t.Error("expected output to contain basic command info even on network failure")
	}

	// Should show warning about failed detailed content fetch
	if !strings.Contains(outputStr, "Warning: Failed to fetch detailed content") {
		t.Error("expected warning message about failed detailed content fetch")
	}
}

// RED PHASE: Test allowed-tools display in basic info mode
func TestInfoCommand_AllowedToolsDisplay(t *testing.T) {
	fs := afero.NewMemMapFs()

	// Create a mock cache manager with test data including allowed-tools
	mockCacheManager := &MockCacheManager{
		manifest: &cache.Manifest{
			Version: "1.0.0",
			Commands: []cache.Command{
				{
					Name:         "debug-help",
					Description:  "Provide systematic debugging assistance for code issues",
					File:         "debug-help.md",
					AllowedTools: []string{"Read", "Bash(git:*)", "Edit(src/**)"}, // This will fail since info command doesn't display this yet
				},
			},
		},
	}

	cmd := newInfoCommand(fs, WithInfoCacheManager(mockCacheManager))

	var output strings.Builder
	cmd.SetOut(&output)
	cmd.SetErr(&output)

	cmd.SetArgs([]string{"debug-help"})
	err := cmd.Execute()

	if err != nil {
		t.Fatalf("expected no error for valid command, got: %v", err)
	}

	outputStr := output.String()

	// Verify the output contains allowed-tools information
	if !strings.Contains(outputStr, "Allowed Tools:") {
		t.Error("expected output to contain 'Allowed Tools:' section")
	}

	if !strings.Contains(outputStr, "Read") {
		t.Error("expected output to contain 'Read' tool")
	}

	if !strings.Contains(outputStr, "Bash(git:*)") {
		t.Error("expected output to contain 'Bash(git:*)' tool")
	}

	if !strings.Contains(outputStr, "Edit(src/**)") {
		t.Error("expected output to contain 'Edit(src/**)' tool")
	}
}

// RED PHASE: Test allowed-tools display when empty
func TestInfoCommand_EmptyAllowedTools(t *testing.T) {
	fs := afero.NewMemMapFs()

	// Create a mock cache manager with test data with empty allowed-tools
	mockCacheManager := &MockCacheManager{
		manifest: &cache.Manifest{
			Version: "1.0.0",
			Commands: []cache.Command{
				{
					Name:         "debug-help",
					Description:  "Provide systematic debugging assistance for code issues",
					File:         "debug-help.md",
					AllowedTools: []string{}, // Empty allowed-tools
				},
			},
		},
	}

	cmd := newInfoCommand(fs, WithInfoCacheManager(mockCacheManager))

	var output strings.Builder
	cmd.SetOut(&output)
	cmd.SetErr(&output)

	cmd.SetArgs([]string{"debug-help"})
	err := cmd.Execute()

	if err != nil {
		t.Fatalf("expected no error for valid command, got: %v", err)
	}

	outputStr := output.String()

	// Should show appropriate message for empty allowed-tools
	if !strings.Contains(outputStr, "Allowed Tools:") {
		t.Error("expected output to contain 'Allowed Tools:' section")
	}

	if !strings.Contains(outputStr, "None specified") {
		t.Error("expected output to contain 'None specified' for empty allowed-tools")
	}
}

// RED PHASE: Test allowed-tools display when nil
func TestInfoCommand_NilAllowedTools(t *testing.T) {
	fs := afero.NewMemMapFs()

	// Create a mock cache manager with test data with nil allowed-tools
	mockCacheManager := &MockCacheManager{
		manifest: &cache.Manifest{
			Version: "1.0.0",
			Commands: []cache.Command{
				{
					Name:         "debug-help",
					Description:  "Provide systematic debugging assistance for code issues",
					File:         "debug-help.md",
					AllowedTools: nil, // nil allowed-tools
				},
			},
		},
	}

	cmd := newInfoCommand(fs, WithInfoCacheManager(mockCacheManager))

	var output strings.Builder
	cmd.SetOut(&output)
	cmd.SetErr(&output)

	cmd.SetArgs([]string{"debug-help"})
	err := cmd.Execute()

	if err != nil {
		t.Fatalf("expected no error for valid command, got: %v", err)
	}

	outputStr := output.String()

	// Should show appropriate message for nil allowed-tools
	if !strings.Contains(outputStr, "Allowed Tools:") {
		t.Error("expected output to contain 'Allowed Tools:' section")
	}

	if !strings.Contains(outputStr, "None specified") {
		t.Error("expected output to contain 'None specified' for nil allowed-tools")
	}
}
