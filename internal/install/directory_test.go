package install

import (
	"os"
	"path/filepath"
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
