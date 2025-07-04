// Package install provides Claude Code directory detection and installation functionality.
// This package handles the detection of Claude Code directories (personal and project),
// directory creation, and command installation for the claude-cmd CLI tool.
package install

import (
	"fmt"
	"os"
	"path/filepath"
	"regexp"

	"github.com/spf13/afero"
)

// CommandsSubPath defines the relative path for Claude Code commands directory.
// This constant centralizes the path definition to ensure consistency across
// all directory detection and creation functions.
const CommandsSubPath = ".claude/commands"

// validCommandName validates that command names contain only safe characters
// to prevent path traversal attacks. Only letters, numbers, underscores, and hyphens are allowed.
var validCommandName = regexp.MustCompile(`^[a-zA-Z0-9_-]+$`)

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

// SelectInstallDir chooses the appropriate directory for command installation
// based on context. It prioritizes project directories over personal directories
// to support project-specific command installations.
//
// The selection logic follows this precedence:
//  1. Project directory (./.claude/commands/) if it exists
//  2. Personal directory (~/.claude/commands/) as fallback
//
// Parameters:
//   - fs: Filesystem abstraction for testing and production use
//
// Returns:
//   - string: The selected directory path for command installation
//   - error: Any error encountered during directory detection
//
// Example:
//
//	installDir, err := SelectInstallDir(fs)
//	if err != nil {
//	    // handle error
//	}
//	// Use installDir for command installation
func SelectInstallDir(fs afero.Fs) (string, error) {
	// First, check if project directory exists and prefer it
	projectDir, exists, err := GetProjectDir(fs)
	if err != nil {
		return "", fmt.Errorf("checking project directory: %w", err)
	}

	if exists {
		// Ensure project directory is writable by creating it if needed
		if err := EnsureDir(fs, projectDir); err != nil {
			return "", fmt.Errorf("ensuring project directory: %w", err)
		}
		return projectDir, nil
	}

	// Fallback to personal directory
	personalDir, err := GetPersonalDir()
	if err != nil {
		return "", fmt.Errorf("getting personal directory: %w", err)
	}

	// Ensure personal directory is created and writable
	if err := EnsureDir(fs, personalDir); err != nil {
		return "", fmt.Errorf("ensuring personal directory: %w", err)
	}

	return personalDir, nil
}

// InstallCommand installs a Claude Code command to the specified directory.
// The command content is written to a file named <commandName>.md in the target directory.
//
// The function performs validation to ensure:
//   - The target directory exists
//   - No existing command file conflicts exist
//   - The command content is written with appropriate permissions
//
// Parameters:
//   - fs: Filesystem abstraction for testing and production use
//   - targetDir: The directory where the command should be installed
//   - commandName: The name of the command (used for filename)
//   - commandContent: The command content in Claude Code slash command format
//
// Returns:
//   - error: Any error encountered during installation, including conflicts
//
// Example:
//
//	err := InstallCommand(fs, "/home/user/.claude/commands", "debug-issue", commandContent)
//	if err != nil {
//	    // handle installation error
//	}
func InstallCommand(fs afero.Fs, targetDir, commandName, commandContent string) error {
	// Validate command name to prevent path traversal attacks
	if !validCommandName.MatchString(commandName) {
		return fmt.Errorf("invalid command name %q: only letters, numbers, underscores, and hyphens are allowed", commandName)
	}

	// Validate that target directory exists
	exists, err := afero.DirExists(fs, targetDir)
	if err != nil {
		return fmt.Errorf("checking target directory: %w", err)
	}
	if !exists {
		return fmt.Errorf("target directory %s does not exist", targetDir)
	}

	// Construct the command file path
	commandPath := filepath.Join(targetDir, commandName+".md")

	// Check if command file already exists
	exists, err = afero.Exists(fs, commandPath)
	if err != nil {
		return fmt.Errorf("checking command file existence: %w", err)
	}
	if exists {
		return fmt.Errorf("command %s already exists at %s", commandName, commandPath)
	}

	// Write the command content to file
	err = afero.WriteFile(fs, commandPath, []byte(commandContent), 0644)
	if err != nil {
		return fmt.Errorf("writing command file: %w", err)
	}

	return nil
}
