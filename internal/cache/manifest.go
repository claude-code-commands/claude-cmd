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
	Name         string   `json:"name"`                    // Unique command name
	Description  string   `json:"description"`             // Human-readable description
	File         string   `json:"file"`                    // Filename in repository
	AllowedTools []string `json:"allowed-tools,omitempty"` // List of tools the command can use
}

// UnmarshalJSON implements custom JSON unmarshaling for Command to handle both
// string and array formats for allowed-tools field.
func (c *Command) UnmarshalJSON(data []byte) error {
	// Define a temporary struct to avoid infinite recursion
	type TempCommand struct {
		Name         string      `json:"name"`
		Description  string      `json:"description"`
		File         string      `json:"file"`
		AllowedTools interface{} `json:"allowed-tools,omitempty"`
	}

	var temp TempCommand
	if err := json.Unmarshal(data, &temp); err != nil {
		return err
	}

	// Copy basic fields
	c.Name = temp.Name
	c.Description = temp.Description
	c.File = temp.File

	// Parse allowed-tools field
	c.AllowedTools = parseAllowedTools(temp.AllowedTools)

	return nil
}

// parseAllowedTools converts various formats of allowed-tools into a string slice.
// Supports both comma-separated string format and array format for backward compatibility.
func parseAllowedTools(allowedTools interface{}) []string {
	if allowedTools == nil {
		return nil
	}

	switch v := allowedTools.(type) {
	case string:
		// Handle comma-separated string format
		if strings.TrimSpace(v) == "" {
			return nil
		}
		var result []string
		for _, tool := range strings.Split(v, ",") {
			tool = strings.TrimSpace(tool)
			if tool != "" {
				result = append(result, tool)
			}
		}
		return result
	case []interface{}:
		// Handle array format (from JSON)
		var result []string
		for _, item := range v {
			if str, ok := item.(string); ok {
				tool := strings.TrimSpace(str)
				if tool != "" {
					result = append(result, tool)
				}
			}
		}
		return result
	case []string:
		// Handle direct string slice
		var result []string
		for _, tool := range v {
			tool = strings.TrimSpace(tool)
			if tool != "" {
				result = append(result, tool)
			}
		}
		return result
	default:
		// Unsupported format, return empty slice
		return nil
	}
}

// Validate checks if the command has all required fields and valid allowed-tools.
// AllowedTools entries are validated to ensure they are not empty after trimming.
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

	// Validate AllowedTools - reject empty entries after trimming
	for _, tool := range c.AllowedTools {
		if strings.TrimSpace(tool) == "" {
			missing = append(missing, "allowed-tools contains empty entry")
			break // Don't report multiple empty entries
		}
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
