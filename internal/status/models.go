// Package status provides data models and structures for representing
// the current status of the claude-cmd CLI tool, including cache state,
// installed commands, and version information.
package status

import (
	"fmt"
	"time"
)

// CacheStatus represents the current state of the command cache.
// It includes information about the number of available commands,
// when the cache was last updated, and the language of cached commands.
type CacheStatus struct {
	// CommandCount is the number of commands available in the cache
	CommandCount int `json:"command_count"`

	// LastUpdated is when the cache was last refreshed from the repository
	LastUpdated time.Time `json:"last_updated"`

	// Language is the language code for the cached commands (e.g., "en", "fr")
	Language string `json:"language"`
}

// Validate checks if the CacheStatus has valid values.
// Returns an error if any field contains invalid data.
func (c CacheStatus) Validate() error {
	if c.CommandCount < 0 {
		return fmt.Errorf("command count cannot be negative: %d", c.CommandCount)
	}

	if c.Language == "" {
		return fmt.Errorf("language cannot be empty")
	}

	if c.LastUpdated.IsZero() {
		return fmt.Errorf("last updated time cannot be zero")
	}

	return nil
}

// InstalledStatus represents the current state of installed commands
// in the user's Claude Code directories with detailed breakdown by location.
type InstalledStatus struct {
	// Count is the total number of installed commands across all directories
	// This field is maintained for backward compatibility
	Count int `json:"count"`

	// TotalCount is the total number of installed commands (same as Count)
	// This field provides clearer naming for new code
	TotalCount int `json:"total_count"`

	// ProjectCount is the number of commands installed in the project directory (./.claude/commands/)
	ProjectCount int `json:"project_count"`

	// PersonalCount is the number of commands installed in the personal directory (~/.claude/commands/)
	PersonalCount int `json:"personal_count"`

	// PrimaryLocation indicates whether commands are primarily installed
	// in "personal" (~/.claude/commands/) or "project" (./.claude/commands/) directory
	PrimaryLocation string `json:"primary_location"`
}

// Validate checks if the InstalledStatus has valid values.
// Returns an error if any field contains invalid data.
func (i InstalledStatus) Validate() error {
	if i.Count < 0 {
		return fmt.Errorf("installed count cannot be negative: %d", i.Count)
	}

	if i.TotalCount < 0 {
		return fmt.Errorf("total count cannot be negative: %d", i.TotalCount)
	}

	if i.ProjectCount < 0 {
		return fmt.Errorf("project count cannot be negative: %d", i.ProjectCount)
	}

	if i.PersonalCount < 0 {
		return fmt.Errorf("personal count cannot be negative: %d", i.PersonalCount)
	}

	// Check if we're using the legacy format (new fields all zero)
	isLegacyFormat := i.TotalCount == 0 && i.ProjectCount == 0 && i.PersonalCount == 0

	if !isLegacyFormat {
		// For new format, verify that TotalCount equals the sum of ProjectCount and PersonalCount
		expectedTotal := i.ProjectCount + i.PersonalCount
		if i.TotalCount != expectedTotal {
			return fmt.Errorf("total count (%d) does not match sum of project (%d) and personal (%d) counts",
				i.TotalCount, i.ProjectCount, i.PersonalCount)
		}

		// Verify backward compatibility: Count should equal TotalCount
		if i.Count != i.TotalCount {
			return fmt.Errorf("count (%d) does not match total count (%d) for backward compatibility",
				i.Count, i.TotalCount)
		}
	}

	if i.PrimaryLocation == "" {
		return fmt.Errorf("primary location cannot be empty")
	}

	// Validate that primary location is one of the expected values
	if i.PrimaryLocation != "personal" && i.PrimaryLocation != "project" {
		return fmt.Errorf("primary location must be 'personal' or 'project', got: %q", i.PrimaryLocation)
	}

	return nil
}

// FullStatus aggregates all status information for display in the status dashboard.
// It combines version information, cache status, and installed command status.
type FullStatus struct {
	// Version is the current version of claude-cmd (e.g., "v1.0.0" or "dev")
	Version string `json:"version"`

	// Cache contains information about the command cache state
	Cache CacheStatus `json:"cache"`

	// Installed contains information about installed commands
	Installed InstalledStatus `json:"installed"`
}

// Validate checks if the FullStatus has valid values.
// Returns an error if any field contains invalid data.
func (f FullStatus) Validate() error {
	if f.Version == "" {
		return fmt.Errorf("version cannot be empty")
	}

	if err := f.Cache.Validate(); err != nil {
		return fmt.Errorf("cache status validation failed: %w", err)
	}

	if err := f.Installed.Validate(); err != nil {
		return fmt.Errorf("installed status validation failed: %w", err)
	}

	return nil
}
