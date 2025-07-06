package cmd

import (
	"bytes"
	"strings"
	"testing"

	"github.com/claude-code-commands/claude-cmd/internal/install"
	"github.com/spf13/afero"
)

func TestRemoveCommand_FindInstalled(t *testing.T) {
	// RED Phase: Test finding installed command in personal/project directories
	fs := afero.NewMemMapFs()

	// Create personal directory with a command
	personalDir, err := install.GetPersonalDir()
	if err != nil {
		t.Fatalf("Failed to get personal dir: %v", err)
	}

	err = fs.MkdirAll(personalDir, 0755)
	if err != nil {
		t.Fatalf("Failed to create personal directory: %v", err)
	}

	// Install a test command
	testCommand := `---
description: Test command for removal
---
This is a test command.`

	err = afero.WriteFile(fs, personalDir+"/debug-issue.md", []byte(testCommand), 0644)
	if err != nil {
		t.Fatalf("Failed to write test command: %v", err)
	}

	// Test the remove command with --yes flag to avoid confirmation prompt
	cmd := NewRemoveCommand(fs)
	cmd.SetArgs([]string{"debug-issue", "--yes"})

	var output bytes.Buffer
	cmd.SetOut(&output)
	cmd.SetErr(&output)

	err = cmd.Execute()
	if err != nil {
		t.Errorf("Remove command failed: %v", err)
	}

	// Verify command was found and removed
	exists, err := afero.Exists(fs, personalDir+"/debug-issue.md")
	if err != nil {
		t.Fatalf("Failed to check file existence: %v", err)
	}
	if exists {
		t.Error("Expected command file to be removed")
	}
}

func TestRemoveCommand_ConfirmationPrompt(t *testing.T) {
	// RED Phase: Test confirmation before deletion
	fs := afero.NewMemMapFs()

	// Create personal directory with a command
	personalDir, err := install.GetPersonalDir()
	if err != nil {
		t.Fatalf("Failed to get personal dir: %v", err)
	}

	err = fs.MkdirAll(personalDir, 0755)
	if err != nil {
		t.Fatalf("Failed to create personal directory: %v", err)
	}

	testCommand := `---
description: Test command for removal
---
This is a test command.`

	err = afero.WriteFile(fs, personalDir+"/debug-issue.md", []byte(testCommand), 0644)
	if err != nil {
		t.Fatalf("Failed to write test command: %v", err)
	}

	// Test with --yes flag to skip confirmation
	cmd := NewRemoveCommand(fs)
	cmd.SetArgs([]string{"debug-issue", "--yes"})

	var output bytes.Buffer
	cmd.SetOut(&output)
	cmd.SetErr(&output)

	err = cmd.Execute()
	if err != nil {
		t.Errorf("Remove command failed: %v", err)
	}

	// Verify command was removed without prompting
	exists, err := afero.Exists(fs, personalDir+"/debug-issue.md")
	if err != nil {
		t.Fatalf("Failed to check file existence: %v", err)
	}
	if exists {
		t.Error("Expected command file to be removed")
	}

	// Verify no confirmation prompt in output (since --yes was used)
	outputStr := output.String()
	if strings.Contains(outputStr, "Are you sure") {
		t.Error("Expected no confirmation prompt when using --yes flag")
	}
}

func TestRemoveCommand_DeleteFile(t *testing.T) {
	// RED Phase: Test file deletion from filesystem
	fs := afero.NewMemMapFs()

	// Create project directory with a command
	projectDir := "./.claude/commands"
	err := fs.MkdirAll(projectDir, 0755)
	if err != nil {
		t.Fatalf("Failed to create project directory: %v", err)
	}

	testCommand := `---
description: Test command for removal
---
This is a test command.`

	err = afero.WriteFile(fs, projectDir+"/test-command.md", []byte(testCommand), 0644)
	if err != nil {
		t.Fatalf("Failed to write test command: %v", err)
	}

	// Test the remove command
	cmd := NewRemoveCommand(fs)
	cmd.SetArgs([]string{"test-command", "--yes"})

	var output bytes.Buffer
	cmd.SetOut(&output)
	cmd.SetErr(&output)

	err = cmd.Execute()
	if err != nil {
		t.Errorf("Remove command failed: %v", err)
	}

	// Verify command file was deleted
	exists, err := afero.Exists(fs, projectDir+"/test-command.md")
	if err != nil {
		t.Fatalf("Failed to check file existence: %v", err)
	}
	if exists {
		t.Error("Expected command file to be deleted")
	}

	// Verify success message
	outputStr := output.String()
	if !strings.Contains(outputStr, "removed") {
		t.Error("Expected success message about command removal")
	}
}

func TestRemoveCommand_NotInstalled(t *testing.T) {
	// RED Phase: Test error when trying to remove non-existent command
	fs := afero.NewMemMapFs()

	// Create empty directories
	personalDir, err := install.GetPersonalDir()
	if err != nil {
		t.Fatalf("Failed to get personal dir: %v", err)
	}

	err = fs.MkdirAll(personalDir, 0755)
	if err != nil {
		t.Fatalf("Failed to create personal directory: %v", err)
	}

	projectDir := "./.claude/commands"
	err = fs.MkdirAll(projectDir, 0755)
	if err != nil {
		t.Fatalf("Failed to create project directory: %v", err)
	}

	// Test the remove command with non-existent command
	cmd := NewRemoveCommand(fs)
	cmd.SetArgs([]string{"non-existent-command", "--yes"})

	var output bytes.Buffer
	cmd.SetOut(&output)
	cmd.SetErr(&output)

	err = cmd.Execute()
	if err == nil {
		t.Error("Expected error when trying to remove non-existent command")
	}

	// Verify error message
	outputStr := output.String()
	if !strings.Contains(outputStr, "not found") && !strings.Contains(outputStr, "not installed") {
		t.Error("Expected error message about command not being found/installed")
	}
}
