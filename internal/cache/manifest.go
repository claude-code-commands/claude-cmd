// Package cache handles manifest parsing, validation, and caching operations.
package cache

import (
	"encoding/json"
	"fmt"
	"strings"
	"time"
)

// Command represents a single command in the manifest.
type Command struct {
	Name        string `json:"name"`        // Unique command name
	Description string `json:"description"` // Human-readable description
	File        string `json:"file"`        // Filename in repository
}

// Validate checks if the command has all required fields.
func (c Command) Validate() error {
	var missing []string
	
	if strings.TrimSpace(c.Name) == "" {
		missing = append(missing, "name")
	}
	if strings.TrimSpace(c.Description) == "" {
		missing = append(missing, "description")
	}
	if strings.TrimSpace(c.File) == "" {
		missing = append(missing, "file")
	}
	
	if len(missing) > 0 {
		return &ValidationError{
			Type:   "command",
			Fields: missing,
		}
	}
	
	return nil
}

// Manifest represents the structure of the command manifest.
type Manifest struct {
	Version  string    `json:"version"`  // Semantic version of the manifest
	Updated  time.Time `json:"updated"`  // Last update timestamp
	Commands []Command `json:"commands"` // List of available commands
}

// Validate checks if the manifest has all required fields and valid structure.
func (m *Manifest) Validate() error {
	var missing []string
	
	if strings.TrimSpace(m.Version) == "" {
		missing = append(missing, "version")
	}
	if m.Updated.IsZero() {
		missing = append(missing, "updated")
	}
	if m.Commands == nil {
		missing = append(missing, "commands")
	}
	
	if len(missing) > 0 {
		return &ValidationError{
			Type:   "manifest",
			Fields: missing,
		}
	}
	
	// Validate each command
	for i, cmd := range m.Commands {
		if err := cmd.Validate(); err != nil {
			return fmt.Errorf("command %d: %w", i, err)
		}
	}
	
	return nil
}

// ToJSON converts the manifest to JSON bytes with proper formatting.
func (m *Manifest) ToJSON() ([]byte, error) {
	return json.MarshalIndent(m, "", "  ")
}

// ValidationError represents a validation error with structured information.
type ValidationError struct {
	Type   string   // The type of object being validated (manifest, command)
	Fields []string // Missing or invalid fields
}

// Error implements the error interface.
func (e *ValidationError) Error() string {
	if len(e.Fields) == 1 {
		return fmt.Sprintf("%s missing required field: %s", e.Type, e.Fields[0])
	}
	return fmt.Sprintf("%s missing required fields: %s", e.Type, strings.Join(e.Fields, ", "))
}

// ParseManifest parses JSON data into a validated Manifest struct.
// It returns an error if the JSON is malformed or validation fails.
func ParseManifest(data []byte) (*Manifest, error) {
	if len(data) == 0 {
		return nil, fmt.Errorf("empty manifest data")
	}
	
	var manifest Manifest
	if err := json.Unmarshal(data, &manifest); err != nil {
		return nil, fmt.Errorf("invalid JSON: %w", err)
	}
	
	// Validate the parsed manifest
	if err := manifest.Validate(); err != nil {
		return nil, fmt.Errorf("validation failed: %w", err)
	}
	
	return &manifest, nil
}