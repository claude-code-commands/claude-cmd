// Package install provides Claude Code directory detection and installation functionality.
// This package handles the detection of Claude Code directories (personal and project),
// directory creation, and command installation for the claude-cmd CLI tool.
package install

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/spf13/afero"
)

// CommandsSubPath defines the relative path for Claude Code commands directory.
// This constant centralizes the path definition to ensure consistency across
// all directory detection and creation functions.
const CommandsSubPath = ".claude/commands"

// GetPersonalDir returns the path to the personal Claude Code commands directory.
// The personal directory is located at ~/.claude/commands/ and is used when
// no project-specific directory is available.
//
// Returns:
//   - string: The absolute path to the personal Claude Code directory
//   - error: Any error encountered while determining the home directory
//
// Example:
//
//	personalDir, err := GetPersonalDir()
//	if err != nil {
//	    // handle error
//	}
//	// personalDir = "/home/user/.claude/commands" (on Linux)
func GetPersonalDir() (string, error) {
	homeDir, err := os.UserHomeDir()
	if err != nil {
		return "", fmt.Errorf("detecting user home directory: %w", err)
	}

	return filepath.Join(homeDir, CommandsSubPath), nil
}

// GetProjectDir returns the path to the project Claude Code commands directory
// and whether it exists. The project directory is located at ./.claude/commands/
// relative to the current working directory.
//
// Parameters:
//   - fs: Filesystem abstraction for testing and production use
//
// Returns:
//   - string: The path to the project Claude Code directory
//   - bool: Whether the directory exists
//   - error: Any error encountered during directory checking
//
// Example:
//
//	projectDir, exists, err := GetProjectDir(fs)
//	if err != nil {
//	    // handle error
//	}
//	if exists {
//	    // use project directory
//	}
func GetProjectDir(fs afero.Fs) (string, bool, error) {
	projectDir := filepath.Join(".", CommandsSubPath)

	exists, err := afero.DirExists(fs, projectDir)
	if err != nil {
		return projectDir, false, fmt.Errorf("checking project directory existence: %w", err)
	}

	return projectDir, exists, nil
}

// EnsureDir creates the specified directory and all necessary parent directories
// if they don't exist. This function is safe to call on existing directories.
//
// Parameters:
//   - fs: Filesystem abstraction for testing and production use
//   - dir: The directory path to create
//
// Returns:
//   - error: Any error encountered during directory creation
//
// Example:
//
//	err := EnsureDir(fs, "/home/user/.claude/commands")
//	if err != nil {
//	    // handle error
//	}
func EnsureDir(fs afero.Fs, dir string) error {
	return fs.MkdirAll(dir, 0755)
}
