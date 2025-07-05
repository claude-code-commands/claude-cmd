// Package status provides functionality for tracking and reporting on Claude Code command installations.
// This package includes services for counting installed commands in both personal and project directories,
// with support for filtering and categorization of command files.
package status

import (
	"strings"

	"github.com/claude-code-commands/claude-cmd/internal/install"
	"github.com/spf13/afero"
)

// Constants for file filtering
const (
	// CommandFileExtension is the file extension for Claude Code command files
	CommandFileExtension = ".md"

	// HiddenFilePrefix is the prefix that indicates a hidden file
	HiddenFilePrefix = "."
)

// InstallCounter provides functionality for counting installed Claude Code commands
// across personal and project directories. It uses filesystem abstraction for testability
// and handles errors gracefully to provide reliable status information.
type InstallCounter struct {
	fs          afero.Fs
	personalDir string // Optional override for testing
}

// NewInstallCounter creates a new InstallCounter that uses the standard personal directory
// detection from the install package. This is the primary constructor for production use.
//
// Parameters:
//   - fs: Filesystem abstraction for testing and production use
//
// Returns:
//   - *InstallCounter: Configured install counter instance
//
// Example:
//
//	counter := NewInstallCounter(afero.NewOsFs())
//	status, err := counter.GetInstalledStatus("en")
func NewInstallCounter(fs afero.Fs) *InstallCounter {
	return &InstallCounter{
		fs: fs,
	}
}

// NewInstallCounterWithPersonalDir creates a new InstallCounter with a custom personal directory path.
// This constructor is primarily used for testing to avoid dependency on os.UserHomeDir().
//
// Parameters:
//   - fs: Filesystem abstraction for testing and production use
//   - personalDir: Custom path to use as personal directory for testing
//
// Returns:
//   - *InstallCounter: Configured install counter instance with custom personal directory
//
// Example:
//
//	counter := NewInstallCounterWithPersonalDir(fs, "/test/home/.claude/commands")
//	status, err := counter.GetInstalledStatus("en")
func NewInstallCounterWithPersonalDir(fs afero.Fs, personalDir string) *InstallCounter {
	return &InstallCounter{
		fs:          fs,
		personalDir: personalDir,
	}
}

// GetInstalledStatus counts installed Claude Code commands in both personal and project directories.
// It returns structured information about command counts and handles directory access errors gracefully.
//
// The function:
//   - Counts .md files in project directory (./.claude/commands/) if it exists
//   - Counts .md files in personal directory (~/.claude/commands/) if it exists
//   - Filters out hidden files (starting with .)
//   - Handles directory access errors by returning zero counts
//   - Provides total count as sum of personal and project counts
//
// Parameters:
//   - language: Language code for potential future i18n support (TODO: implement language-specific filtering)
//
// Returns:
//   - *InstalledStatus: Status information with counts for personal, project, and total commands
//   - error: Any error encountered during status retrieval (currently always nil for graceful handling)
//
// Example:
//
//	status, err := counter.GetInstalledStatus("en")
//	if err != nil {
//	    // handle error
//	}
//	fmt.Printf("Total commands: %d (Project: %d, Personal: %d)",
//	    status.TotalCount, status.ProjectCount, status.PersonalCount)
func (ic *InstallCounter) GetInstalledStatus(language string) (*InstalledStatus, error) {
	var projectCount, personalCount int

	// Count project directory commands
	projectDir, exists, err := install.GetProjectDir(ic.fs)
	if err == nil && exists {
		projectCount = ic.countCommandsInDirectory(projectDir)
	}

	// Count personal directory commands
	personalDir := ic.personalDir
	if personalDir == "" {
		// Use standard personal directory detection
		standardPersonalDir, err := install.GetPersonalDir()
		if err == nil {
			personalDir = standardPersonalDir
		}
	}

	if personalDir != "" {
		exists, err := afero.DirExists(ic.fs, personalDir)
		if err == nil && exists {
			personalCount = ic.countCommandsInDirectory(personalDir)
		}
	}

	totalCount := projectCount + personalCount
	primaryLocation := ic.determinePrimaryLocation(projectCount, personalCount)

	return &InstalledStatus{
		Count:           totalCount, // Backward compatibility
		TotalCount:      totalCount,
		ProjectCount:    projectCount,
		PersonalCount:   personalCount,
		PrimaryLocation: primaryLocation,
	}, nil
}

// determinePrimaryLocation determines the primary installation location based on command counts.
// It follows Claude Code installation precedence: project directory takes priority when commands
// exist in both locations, and personal directory is the default when no commands are installed.
//
// Parameters:
//   - projectCount: Number of commands in project directory
//   - personalCount: Number of commands in personal directory
//
// Returns:
//   - string: "project" or "personal" indicating the primary location
//
// Logic:
//   - If no commands exist anywhere, default to "personal"
//   - If project has commands and has >= personal count, prefer "project"
//   - Otherwise, use "personal"
func (ic *InstallCounter) determinePrimaryLocation(projectCount, personalCount int) string {
	totalCount := projectCount + personalCount

	// If no commands are installed anywhere, default to personal
	if totalCount == 0 {
		return "personal"
	}

	// In case of a tie, prefer project (since it takes precedence in installation)
	if projectCount >= personalCount && projectCount > 0 {
		return "project"
	}

	return "personal"
}

// countCommandsInDirectory counts .md files in the specified directory, excluding hidden files.
// This is an internal helper method that handles directory reading errors gracefully.
//
// The function:
//   - Reads the directory contents
//   - Filters for .md files
//   - Excludes hidden files (starting with .)
//   - Returns 0 on any error for graceful degradation
//
// Parameters:
//   - dir: Directory path to scan for command files
//
// Returns:
//   - int: Number of valid command files found
func (ic *InstallCounter) countCommandsInDirectory(dir string) int {
	files, err := afero.ReadDir(ic.fs, dir)
	if err != nil {
		// Return 0 on error for graceful handling
		return 0
	}

	count := 0
	for _, file := range files {
		name := file.Name()

		// Skip hidden files
		if strings.HasPrefix(name, HiddenFilePrefix) {
			continue
		}

		// Count only .md files
		if strings.HasSuffix(strings.ToLower(name), CommandFileExtension) && !file.IsDir() {
			count++
		}
	}

	return count
}
