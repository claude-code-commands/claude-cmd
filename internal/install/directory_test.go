package install

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/spf13/afero"
)

func TestGetPersonalDir_Success(t *testing.T) {
	// Test that GetPersonalDir returns the correct path for personal Claude Code directory
	personalDir, err := GetPersonalDir()
	if err != nil {
		t.Fatalf("Expected GetPersonalDir to succeed, got error: %v", err)
	}

	// Should return ~/.claude/commands/ path
	homeDir, err := os.UserHomeDir()
	if err != nil {
		t.Fatalf("Failed to get user home directory: %v", err)
	}

	expectedPath := filepath.Join(homeDir, CommandsSubPath)
	if personalDir != expectedPath {
		t.Errorf("Expected personal directory to be %s, got %s", expectedPath, personalDir)
	}
}

func TestGetProjectDir_Exists(t *testing.T) {
	// Create a mock filesystem with project directory
	fs := afero.NewMemMapFs()

	// Create the project Claude Code directory
	projectDir := CommandsSubPath
	err := fs.MkdirAll(projectDir, 0755)
	if err != nil {
		t.Fatalf("Failed to create mock project directory: %v", err)
	}

	// Test that GetProjectDir detects existing directory
	dir, exists, err := GetProjectDir(fs)
	if err != nil {
		t.Fatalf("Expected GetProjectDir to succeed, got error: %v", err)
	}

	if !exists {
		t.Error("Expected GetProjectDir to detect existing project directory")
	}

	expectedPath := filepath.Join(".", CommandsSubPath)
	if dir != expectedPath {
		t.Errorf("Expected project directory to be %s, got %s", expectedPath, dir)
	}
}

func TestGetProjectDir_NotExists(t *testing.T) {
	// Create a mock filesystem without project directory
	fs := afero.NewMemMapFs()

	// Test that GetProjectDir handles missing directory
	dir, exists, err := GetProjectDir(fs)
	if err != nil {
		t.Fatalf("Expected GetProjectDir to succeed even when directory doesn't exist, got error: %v", err)
	}

	if exists {
		t.Error("Expected GetProjectDir to report directory as not existing")
	}

	// Should still return the expected path even if it doesn't exist
	expectedPath := filepath.Join(".", CommandsSubPath)
	if dir != expectedPath {
		t.Errorf("Expected project directory path to be %s, got %s", expectedPath, dir)
	}
}

func TestEnsureDir_CreateDirectories(t *testing.T) {
	// Create a mock filesystem
	fs := afero.NewMemMapFs()

	// Test creating personal directory
	personalDir := filepath.Join("home", "user", ".claude", "commands")
	err := EnsureDir(fs, personalDir)
	if err != nil {
		t.Fatalf("Expected EnsureDir to succeed, got error: %v", err)
	}

	// Verify directory was created
	exists, err := afero.DirExists(fs, personalDir)
	if err != nil {
		t.Fatalf("Failed to check if directory exists: %v", err)
	}
	if !exists {
		t.Errorf("Expected directory %s to be created", personalDir)
	}
}

func TestEnsureDir_AlreadyExists(t *testing.T) {
	// Create a mock filesystem with existing directory
	fs := afero.NewMemMapFs()

	existingDir := filepath.Join("home", "user", ".claude", "commands")
	err := fs.MkdirAll(existingDir, 0755)
	if err != nil {
		t.Fatalf("Failed to create existing directory: %v", err)
	}

	// Test that EnsureDir handles existing directory gracefully
	err = EnsureDir(fs, existingDir)
	if err != nil {
		t.Fatalf("Expected EnsureDir to succeed with existing directory, got error: %v", err)
	}

	// Verify directory still exists
	exists, err := afero.DirExists(fs, existingDir)
	if err != nil {
		t.Fatalf("Failed to check if directory exists: %v", err)
	}
	if !exists {
		t.Errorf("Expected existing directory %s to remain", existingDir)
	}
}

// Test SelectInstallDir function

func TestSelectInstallDir_ProjectAvailable(t *testing.T) {
	// Create a mock filesystem with project directory
	fs := afero.NewMemMapFs()

	// Create the project Claude Code directory
	projectDir := CommandsSubPath
	err := fs.MkdirAll(projectDir, 0755)
	if err != nil {
		t.Fatalf("Failed to create mock project directory: %v", err)
	}

	// Test that SelectInstallDir chooses project directory when available
	selectedDir, err := SelectInstallDir(fs)
	if err != nil {
		t.Fatalf("Expected SelectInstallDir to succeed, got error: %v", err)
	}

	expectedPath := filepath.Join(".", CommandsSubPath)
	if selectedDir != expectedPath {
		t.Errorf("Expected SelectInstallDir to choose project directory %s, got %s", expectedPath, selectedDir)
	}
}

func TestSelectInstallDir_PersonalFallback(t *testing.T) {
	// Create a mock filesystem without project directory
	fs := afero.NewMemMapFs()

	// Test that SelectInstallDir falls back to personal directory
	selectedDir, err := SelectInstallDir(fs)
	if err != nil {
		t.Fatalf("Expected SelectInstallDir to succeed, got error: %v", err)
	}

	// Should return personal directory path (will include actual home dir)
	homeDir, err := os.UserHomeDir()
	if err != nil {
		t.Fatalf("Failed to get user home directory: %v", err)
	}

	expectedPath := filepath.Join(homeDir, CommandsSubPath)
	if selectedDir != expectedPath {
		t.Errorf("Expected SelectInstallDir to choose personal directory %s, got %s", expectedPath, selectedDir)
	}
}

// Test InstallCommand function

func TestInstallCommand_Success(t *testing.T) {
	// Create a mock filesystem
	fs := afero.NewMemMapFs()

	// Create target directory
	targetDir := filepath.Join("test", "commands")
	err := fs.MkdirAll(targetDir, 0755)
	if err != nil {
		t.Fatalf("Failed to create target directory: %v", err)
	}

	// Test command content
	commandName := "test-command"
	commandContent := `---
description: Test command for unit testing
---

# Test Command

This is a test command for validating installation functionality.
`

	// Test installing command
	err = InstallCommand(fs, targetDir, commandName, commandContent)
	if err != nil {
		t.Fatalf("Expected InstallCommand to succeed, got error: %v", err)
	}

	// Verify file was created with correct content
	expectedPath := filepath.Join(targetDir, commandName+".md")
	exists, err := afero.Exists(fs, expectedPath)
	if err != nil {
		t.Fatalf("Failed to check if command file exists: %v", err)
	}
	if !exists {
		t.Errorf("Expected command file %s to be created", expectedPath)
	}

	// Verify content is correct
	actualContent, err := afero.ReadFile(fs, expectedPath)
	if err != nil {
		t.Fatalf("Failed to read command file: %v", err)
	}
	if string(actualContent) != commandContent {
		t.Errorf("Expected command content %q, got %q", commandContent, string(actualContent))
	}
}

func TestInstallCommand_FileExists(t *testing.T) {
	// Create a mock filesystem with existing command file
	fs := afero.NewMemMapFs()

	// Create target directory
	targetDir := filepath.Join("test", "commands")
	err := fs.MkdirAll(targetDir, 0755)
	if err != nil {
		t.Fatalf("Failed to create target directory: %v", err)
	}

	// Create existing command file
	commandName := "existing-command"
	existingContent := "# Existing Command\nThis command already exists."
	existingPath := filepath.Join(targetDir, commandName+".md")
	err = afero.WriteFile(fs, existingPath, []byte(existingContent), 0644)
	if err != nil {
		t.Fatalf("Failed to create existing command file: %v", err)
	}

	// Test installing command with same name
	newContent := "# New Command\nThis would overwrite the existing command."
	err = InstallCommand(fs, targetDir, commandName, newContent)

	// Should return an error indicating file exists
	if err == nil {
		t.Fatal("Expected InstallCommand to fail when file exists, but it succeeded")
	}

	// Verify the error message indicates file conflict
	if !strings.Contains(err.Error(), "already exists") {
		t.Errorf("Expected error to mention file already exists, got: %v", err)
	}

	// Verify original content is preserved
	actualContent, err := afero.ReadFile(fs, existingPath)
	if err != nil {
		t.Fatalf("Failed to read existing command file: %v", err)
	}
	if string(actualContent) != existingContent {
		t.Errorf("Expected existing content to be preserved, got %q", string(actualContent))
	}
}

func TestInstallCommand_DirectoryNotExists(t *testing.T) {
	// Create a mock filesystem without target directory
	fs := afero.NewMemMapFs()

	// Test installing command to non-existent directory
	targetDir := filepath.Join("nonexistent", "commands")
	commandName := "test-command"
	commandContent := "# Test Command"

	err := InstallCommand(fs, targetDir, commandName, commandContent)
	if err == nil {
		t.Fatal("Expected InstallCommand to fail when target directory doesn't exist")
	}

	// Should return an error about directory not existing
	if !strings.Contains(err.Error(), "directory") && !strings.Contains(err.Error(), "not exist") {
		t.Errorf("Expected error to mention directory not existing, got: %v", err)
	}
}

func TestInstallCommand_PathTraversalProtection(t *testing.T) {
	// Create a mock filesystem with target directory
	fs := afero.NewMemMapFs()

	// Create target directory
	targetDir := filepath.Join("test", "commands")
	err := fs.MkdirAll(targetDir, 0755)
	if err != nil {
		t.Fatalf("Failed to create target directory: %v", err)
	}

	// Test cases for malicious command names
	maliciousNames := []string{
		"../../../etc/passwd",
		"..\\..\\windows\\system32\\hosts",
		"../malicious",
		"sub/directory/command",
		"command..with..dots",
		"command/with/slashes",
		"command\\with\\backslashes",
	}

	commandContent := "# Malicious Command"

	for _, commandName := range maliciousNames {
		t.Run("malicious_name_"+commandName, func(t *testing.T) {
			err := InstallCommand(fs, targetDir, commandName, commandContent)
			if err == nil {
				t.Fatalf("Expected InstallCommand to reject malicious command name %q", commandName)
			}

			// Should return an error about invalid command name
			if !strings.Contains(err.Error(), "invalid command name") {
				t.Errorf("Expected error to mention invalid command name, got: %v", err)
			}
		})
	}
}

func TestInstallCommand_ValidCommandNames(t *testing.T) {
	// Create a mock filesystem with target directory
	fs := afero.NewMemMapFs()

	// Create target directory
	targetDir := filepath.Join("test", "commands")
	err := fs.MkdirAll(targetDir, 0755)
	if err != nil {
		t.Fatalf("Failed to create target directory: %v", err)
	}

	// Test cases for valid command names
	validNames := []string{
		"debug-issue",
		"write_tests",
		"command123",
		"UPPERCASE",
		"mixed-Case_Name123",
		"a",
		"simple",
	}

	commandContent := "# Valid Command"

	for _, commandName := range validNames {
		t.Run("valid_name_"+commandName, func(t *testing.T) {
			err := InstallCommand(fs, targetDir, commandName, commandContent)
			if err != nil {
				t.Errorf("Expected InstallCommand to accept valid command name %q, got error: %v", commandName, err)
			}

			// Verify file was created
			expectedPath := filepath.Join(targetDir, commandName+".md")
			exists, err := afero.Exists(fs, expectedPath)
			if err != nil {
				t.Fatalf("Failed to check if command file exists: %v", err)
			}
			if !exists {
				t.Errorf("Expected command file %s to be created for valid name %q", expectedPath, commandName)
			}

			// Clean up for next test
			fs.Remove(expectedPath)
		})
	}
}

// TestFindInstalledCommand_ProjectDirectory tests finding command in project directory
func TestFindInstalledCommand_ProjectDirectory(t *testing.T) {
	fs := afero.NewMemMapFs()

	// Create project directory with a command
	projectDir := "./.claude/commands"
	err := fs.MkdirAll(projectDir, 0755)
	if err != nil {
		t.Fatalf("Failed to create project directory: %v", err)
	}

	testCommand := "test-command"
	err = afero.WriteFile(fs, projectDir+"/"+testCommand+".md", []byte("test content"), 0644)
	if err != nil {
		t.Fatalf("Failed to write test command: %v", err)
	}

	// Test finding the command
	location, err := FindInstalledCommand(fs, testCommand)
	if err != nil {
		t.Fatalf("Expected FindInstalledCommand to succeed, got error: %v", err)
	}

	if !location.Installed {
		t.Error("Expected command to be found")
	}

	expectedPath := filepath.Join(projectDir, testCommand+".md")
	if location.Path != expectedPath {
		t.Errorf("Expected path %s, got %s", expectedPath, location.Path)
	}
}

// TestFindInstalledCommand_PersonalDirectory tests finding command in personal directory
func TestFindInstalledCommand_PersonalDirectory(t *testing.T) {
	fs := afero.NewMemMapFs()

	// Create personal directory with a command
	personalDir, err := GetPersonalDir()
	if err != nil {
		t.Fatalf("Failed to get personal dir: %v", err)
	}

	err = fs.MkdirAll(personalDir, 0755)
	if err != nil {
		t.Fatalf("Failed to create personal directory: %v", err)
	}

	testCommand := "test-command"
	err = afero.WriteFile(fs, personalDir+"/"+testCommand+".md", []byte("test content"), 0644)
	if err != nil {
		t.Fatalf("Failed to write test command: %v", err)
	}

	// Test finding the command
	location, err := FindInstalledCommand(fs, testCommand)
	if err != nil {
		t.Fatalf("Expected FindInstalledCommand to succeed, got error: %v", err)
	}

	if !location.Installed {
		t.Error("Expected command to be found")
	}

	expectedPath := filepath.Join(personalDir, testCommand+".md")
	if location.Path != expectedPath {
		t.Errorf("Expected path %s, got %s", expectedPath, location.Path)
	}
}

// TestFindInstalledCommand_NotFound tests handling of non-existent command
func TestFindInstalledCommand_NotFound(t *testing.T) {
	fs := afero.NewMemMapFs()

	// Create empty directories
	personalDir, err := GetPersonalDir()
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

	// Test finding non-existent command
	location, err := FindInstalledCommand(fs, "non-existent-command")
	if err != nil {
		t.Fatalf("Expected FindInstalledCommand to succeed, got error: %v", err)
	}

	if location.Installed {
		t.Error("Expected command not to be found")
	}
}

// TestFindInstalledCommand_InvalidName tests command name validation
func TestFindInstalledCommand_InvalidName(t *testing.T) {
	fs := afero.NewMemMapFs()

	// Test with invalid command name
	_, err := FindInstalledCommand(fs, "../../../etc/passwd")
	if err == nil {
		t.Error("Expected error for invalid command name")
	}

	if !strings.Contains(err.Error(), "invalid command name") {
		t.Errorf("Expected error message about invalid command name, got: %v", err)
	}
}

// TestFindInstalledCommand_Precedence tests that project directory takes precedence
func TestFindInstalledCommand_Precedence(t *testing.T) {
	fs := afero.NewMemMapFs()

	// Create both directories with the same command
	personalDir, err := GetPersonalDir()
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

	testCommand := "test-command"

	// Add command to both directories
	err = afero.WriteFile(fs, personalDir+"/"+testCommand+".md", []byte("personal content"), 0644)
	if err != nil {
		t.Fatalf("Failed to write personal command: %v", err)
	}

	err = afero.WriteFile(fs, projectDir+"/"+testCommand+".md", []byte("project content"), 0644)
	if err != nil {
		t.Fatalf("Failed to write project command: %v", err)
	}

	// Test finding the command - should return project directory
	location, err := FindInstalledCommand(fs, testCommand)
	if err != nil {
		t.Fatalf("Expected FindInstalledCommand to succeed, got error: %v", err)
	}

	if !location.Installed {
		t.Error("Expected command to be found")
	}

	expectedPath := filepath.Join(projectDir, testCommand+".md")
	if location.Path != expectedPath {
		t.Errorf("Expected project path %s, got %s", expectedPath, location.Path)
	}
}

// TestListInstalledCommands_BothDirectories tests listing commands from both project and personal directories
func TestListInstalledCommands_BothDirectories(t *testing.T) {
	fs := afero.NewMemMapFs()

	// Create project directory with commands
	projectDir := "./.claude/commands"
	err := fs.MkdirAll(projectDir, 0755)
	if err != nil {
		t.Fatalf("Failed to create project directory: %v", err)
	}

	// Create personal directory with commands
	personalDir, err := GetPersonalDir()
	if err != nil {
		t.Fatalf("Failed to get personal dir: %v", err)
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

	// Test listing all installed commands
	commands, err := ListInstalledCommands(fs)
	if err != nil {
		t.Fatalf("Expected ListInstalledCommands to succeed, got error: %v", err)
	}

	// Should find all 4 commands
	expectedCount := 4
	if len(commands) != expectedCount {
		t.Errorf("Expected %d commands, got %d", expectedCount, len(commands))
	}

	// Verify commands are sorted alphabetically and have correct locations
	expectedCommands := []struct {
		name     string
		location string
	}{
		{"debug-issue", filepath.Join(projectDir, "debug-issue.md")},
		{"fix-bug", filepath.Join(projectDir, "fix-bug.md")},
		{"optimize-code", filepath.Join(personalDir, "optimize-code.md")},
		{"write-tests", filepath.Join(personalDir, "write-tests.md")},
	}

	for i, expected := range expectedCommands {
		if i >= len(commands) {
			t.Errorf("Missing command %s at index %d", expected.name, i)
			continue
		}

		commandName := strings.TrimSuffix(filepath.Base(commands[i].Path), ".md")
		if commandName != expected.name {
			t.Errorf("Expected command %s at index %d, got %s", expected.name, i, commandName)
		}

		if commands[i].Path != expected.location {
			t.Errorf("Expected path %s for command %s, got %s", expected.location, expected.name, commands[i].Path)
		}

		if !commands[i].Installed {
			t.Errorf("Expected command %s to be marked as installed", expected.name)
		}
	}
}

// TestListInstalledCommands_ProjectOnly tests listing commands only from project directory
func TestListInstalledCommands_ProjectOnly(t *testing.T) {
	fs := afero.NewMemMapFs()

	// Create project directory with commands
	projectDir := "./.claude/commands"
	err := fs.MkdirAll(projectDir, 0755)
	if err != nil {
		t.Fatalf("Failed to create project directory: %v", err)
	}

	// Add commands to project directory
	projectCommands := []string{"debug-issue", "fix-bug"}
	for _, cmd := range projectCommands {
		err = afero.WriteFile(fs, filepath.Join(projectDir, cmd+".md"), []byte("project content"), 0644)
		if err != nil {
			t.Fatalf("Failed to write project command %s: %v", cmd, err)
		}
	}

	// Test listing commands
	commands, err := ListInstalledCommands(fs)
	if err != nil {
		t.Fatalf("Expected ListInstalledCommands to succeed, got error: %v", err)
	}

	// Should find 2 commands
	expectedCount := 2
	if len(commands) != expectedCount {
		t.Errorf("Expected %d commands, got %d", expectedCount, len(commands))
	}

	// Verify all commands are from project directory
	for _, command := range commands {
		if !strings.Contains(command.Path, ".claude/commands") {
			t.Errorf("Expected command %s to be from project directory, got path %s", filepath.Base(command.Path), command.Path)
		}
	}
}

// TestListInstalledCommands_PersonalOnly tests listing commands only from personal directory
func TestListInstalledCommands_PersonalOnly(t *testing.T) {
	fs := afero.NewMemMapFs()

	// Create personal directory with commands
	personalDir, err := GetPersonalDir()
	if err != nil {
		t.Fatalf("Failed to get personal dir: %v", err)
	}
	err = fs.MkdirAll(personalDir, 0755)
	if err != nil {
		t.Fatalf("Failed to create personal directory: %v", err)
	}

	// Add commands to personal directory
	personalCommands := []string{"optimize-code", "write-tests"}
	for _, cmd := range personalCommands {
		err = afero.WriteFile(fs, filepath.Join(personalDir, cmd+".md"), []byte("personal content"), 0644)
		if err != nil {
			t.Fatalf("Failed to write personal command %s: %v", cmd, err)
		}
	}

	// Test listing commands
	commands, err := ListInstalledCommands(fs)
	if err != nil {
		t.Fatalf("Expected ListInstalledCommands to succeed, got error: %v", err)
	}

	// Should find 2 commands
	expectedCount := 2
	if len(commands) != expectedCount {
		t.Errorf("Expected %d commands, got %d", expectedCount, len(commands))
	}

	// Verify all commands are from personal directory
	for _, command := range commands {
		if !strings.Contains(command.Path, personalDir) {
			t.Errorf("Expected command %s to be from personal directory, got path %s", filepath.Base(command.Path), command.Path)
		}
	}
}

// TestListInstalledCommands_EmptyDirectories tests handling when no commands are installed
func TestListInstalledCommands_EmptyDirectories(t *testing.T) {
	fs := afero.NewMemMapFs()

	// Create empty directories
	projectDir := "./.claude/commands"
	err := fs.MkdirAll(projectDir, 0755)
	if err != nil {
		t.Fatalf("Failed to create project directory: %v", err)
	}

	personalDir, err := GetPersonalDir()
	if err != nil {
		t.Fatalf("Failed to get personal dir: %v", err)
	}
	err = fs.MkdirAll(personalDir, 0755)
	if err != nil {
		t.Fatalf("Failed to create personal directory: %v", err)
	}

	// Test listing commands from empty directories
	commands, err := ListInstalledCommands(fs)
	if err != nil {
		t.Fatalf("Expected ListInstalledCommands to succeed, got error: %v", err)
	}

	// Should return empty slice
	if len(commands) != 0 {
		t.Errorf("Expected no commands in empty directories, got %d", len(commands))
	}
}

// TestListInstalledCommands_NoDirectories tests handling when no directories exist
func TestListInstalledCommands_NoDirectories(t *testing.T) {
	fs := afero.NewMemMapFs()

	// Test listing commands when directories don't exist
	commands, err := ListInstalledCommands(fs)
	if err != nil {
		t.Fatalf("Expected ListInstalledCommands to succeed, got error: %v", err)
	}

	// Should return empty slice gracefully
	if len(commands) != 0 {
		t.Errorf("Expected no commands when directories don't exist, got %d", len(commands))
	}
}
