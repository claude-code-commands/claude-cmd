package cmd

import (
	"bytes"
	"path/filepath"
	"strings"
	"testing"

	"github.com/claude-code-commands/claude-cmd/internal/install"
	"github.com/spf13/afero"
)

func TestInstalledCommand_DisplayFormat(t *testing.T) {
	fs := afero.NewMemMapFs()

	// Create project directory with commands
	projectDir := "./.claude/commands"
	err := fs.MkdirAll(projectDir, 0755)
	if err != nil {
		t.Fatalf("Failed to create project directory: %v", err)
	}

	// Create personal directory with commands (using actual personal dir path)
	personalDir, err := install.GetPersonalDir()
	if err != nil {
		t.Fatalf("Failed to get personal directory: %v", err)
	}
	err = fs.MkdirAll(personalDir, 0755)
	if err != nil {
		t.Fatalf("Failed to create personal directory: %v", err)
	}

	// Add commands to both directories
	projectCommands := []string{"debug-issue", "fix-bug"}
	personalCommands := []string{"optimize-code", "write-tests"}

	for _, cmd := range projectCommands {
		err = afero.WriteFile(fs, filepath.Join(projectDir, cmd+".md"), []byte("project content"), 0644)
		if err != nil {
			t.Fatalf("Failed to write project command %s: %v", cmd, err)
		}
	}

	for _, cmd := range personalCommands {
		err = afero.WriteFile(fs, filepath.Join(personalDir, cmd+".md"), []byte("personal content"), 0644)
		if err != nil {
			t.Fatalf("Failed to write personal command %s: %v", cmd, err)
		}
	}

	// Create installed command
	cmd := newInstalledCommand(fs)

	// Capture output
	var output bytes.Buffer
	cmd.SetOut(&output)
	cmd.SetErr(&output)

	// Execute command
	err = cmd.Execute()
	if err != nil {
		t.Fatalf("Expected command to succeed, got error: %v", err)
	}

	// Verify output format
	outputStr := output.String()

	// Should contain command count summary
	if !strings.Contains(outputStr, "4 total") {
		t.Errorf("Expected output to contain '4 total' commands, got: %s", outputStr)
	}

	// Should contain header
	if !strings.Contains(outputStr, "Installed Claude Code commands") {
		t.Errorf("Expected output to contain header, got: %s", outputStr)
	}

	// Should contain project commands with location
	if !strings.Contains(outputStr, "debug-issue") {
		t.Errorf("Expected output to contain 'debug-issue' command, got: %s", outputStr)
	}
	if !strings.Contains(outputStr, "(project)") {
		t.Errorf("Expected output to contain '(project)' location, got: %s", outputStr)
	}

	// Should contain personal commands with location
	if !strings.Contains(outputStr, "optimize-code") {
		t.Errorf("Expected output to contain 'optimize-code' command, got: %s", outputStr)
	}
	if !strings.Contains(outputStr, "(personal)") {
		t.Errorf("Expected output to contain '(personal)' location, got: %s", outputStr)
	}
}

func TestInstalledCommand_EmptyState(t *testing.T) {
	fs := afero.NewMemMapFs()

	// Create empty directories (no commands installed)
	projectDir := "./.claude/commands"
	err := fs.MkdirAll(projectDir, 0755)
	if err != nil {
		t.Fatalf("Failed to create project directory: %v", err)
	}

	personalDir := "/home/user/.claude/commands"
	err = fs.MkdirAll(personalDir, 0755)
	if err != nil {
		t.Fatalf("Failed to create personal directory: %v", err)
	}

	// Create installed command
	cmd := newInstalledCommand(fs)

	// Capture output
	var output bytes.Buffer
	cmd.SetOut(&output)
	cmd.SetErr(&output)

	// Execute command
	err = cmd.Execute()
	if err != nil {
		t.Fatalf("Expected command to succeed, got error: %v", err)
	}

	// Verify empty state message
	outputStr := output.String()
	if !strings.Contains(outputStr, "No commands installed") {
		t.Errorf("Expected output to contain 'No commands installed', got: %s", outputStr)
	}
}

func TestInstalledCommand_ProjectOnly(t *testing.T) {
	fs := afero.NewMemMapFs()

	// Create project directory with commands
	projectDir := "./.claude/commands"
	err := fs.MkdirAll(projectDir, 0755)
	if err != nil {
		t.Fatalf("Failed to create project directory: %v", err)
	}

	// Add commands to project directory only
	projectCommands := []string{"debug-issue", "fix-bug"}
	for _, cmd := range projectCommands {
		err = afero.WriteFile(fs, filepath.Join(projectDir, cmd+".md"), []byte("project content"), 0644)
		if err != nil {
			t.Fatalf("Failed to write project command %s: %v", cmd, err)
		}
	}

	// Create installed command
	cmd := newInstalledCommand(fs)

	// Capture output
	var output bytes.Buffer
	cmd.SetOut(&output)
	cmd.SetErr(&output)

	// Execute command
	err = cmd.Execute()
	if err != nil {
		t.Fatalf("Expected command to succeed, got error: %v", err)
	}

	// Verify output
	outputStr := output.String()

	// Should show 2 commands
	if !strings.Contains(outputStr, "2 total") {
		t.Errorf("Expected output to contain '2 total' commands, got: %s", outputStr)
	}

	// Both should be marked as project commands
	projectCount := strings.Count(outputStr, "(project)")
	if projectCount != 2 {
		t.Errorf("Expected 2 project commands, found %d in output: %s", projectCount, outputStr)
	}

	// Should not contain personal commands
	if strings.Contains(outputStr, "(personal)") {
		t.Errorf("Expected no personal commands, but found some in output: %s", outputStr)
	}
}

func TestInstalledCommand_PersonalOnly(t *testing.T) {
	fs := afero.NewMemMapFs()

	// Create personal directory with commands (no project directory)
	personalDir, err := install.GetPersonalDir()
	if err != nil {
		t.Fatalf("Failed to get personal directory: %v", err)
	}
	err = fs.MkdirAll(personalDir, 0755)
	if err != nil {
		t.Fatalf("Failed to create personal directory: %v", err)
	}

	// Add commands to personal directory only
	personalCommands := []string{"optimize-code", "write-tests"}
	for _, cmd := range personalCommands {
		err = afero.WriteFile(fs, filepath.Join(personalDir, cmd+".md"), []byte("personal content"), 0644)
		if err != nil {
			t.Fatalf("Failed to write personal command %s: %v", cmd, err)
		}
	}

	// Create installed command
	cmd := newInstalledCommand(fs)

	// Capture output
	var output bytes.Buffer
	cmd.SetOut(&output)
	cmd.SetErr(&output)

	// Execute command
	err = cmd.Execute()
	if err != nil {
		t.Fatalf("Expected command to succeed, got error: %v", err)
	}

	// Verify output
	outputStr := output.String()

	// Should show 2 commands
	if !strings.Contains(outputStr, "2 total") {
		t.Errorf("Expected output to contain '2 total' commands, got: %s", outputStr)
	}

	// Both should be marked as personal commands
	personalCount := strings.Count(outputStr, "(personal)")
	if personalCount != 2 {
		t.Errorf("Expected 2 personal commands, found %d in output: %s", personalCount, outputStr)
	}

	// Should not contain project commands
	if strings.Contains(outputStr, "(project)") {
		t.Errorf("Expected no project commands, but found some in output: %s", outputStr)
	}
}
