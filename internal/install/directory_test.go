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
