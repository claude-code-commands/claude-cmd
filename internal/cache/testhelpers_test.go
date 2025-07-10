package cache

import (
	"fmt"
	"time"

	"github.com/spf13/afero"
)

// testManifest creates a valid test manifest with optional customizations.
func testManifest(opts ...func(*Manifest)) *Manifest {
	manifest := &Manifest{
		Version: "1.0.0",
		Updated: time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC),
		Commands: []Command{
			{
				Name:        "test-command",
				Description: "A test command",
				File:        "test-command.md",
			},
		},
	}

	for _, opt := range opts {
		opt(manifest)
	}

	return manifest
}

// withVersion sets the manifest version.
func withVersion(version string) func(*Manifest) {
	return func(m *Manifest) {
		m.Version = version
	}
}

// withCommands sets the manifest commands.
func withCommands(commands ...Command) func(*Manifest) {
	return func(m *Manifest) {
		m.Commands = commands
	}
}

// withNoCommands sets an empty commands slice.
func withNoCommands() func(*Manifest) {
	return func(m *Manifest) {
		m.Commands = []Command{}
	}
}

// invalidCommand creates a command with missing fields for testing.
func invalidCommand(missingFields ...string) Command {
	cmd := Command{
		Name:        "test-command",
		Description: "A test command",
		File:        "test-command.md",
	}

	for _, field := range missingFields {
		switch field {
		case "name":
			cmd.Name = ""
		case "description":
			cmd.Description = ""
		case "file":
			cmd.File = ""
		}
	}

	return cmd
}

// setupMemCache creates an in-memory filesystem with cache manager for testing.
func setupMemCache(cacheDir string) (*CacheManager, afero.Fs) {
	if cacheDir == "" {
		cacheDir = "/cache"
	}
	fs := afero.NewMemMapFs()
	manager := NewCacheManager(fs, cacheDir)
	return manager, fs
}

// writeTestManifest writes a test manifest to the filesystem.
func writeTestManifest(fs afero.Fs, path string, manifest *Manifest) error {
	data, err := manifest.ToJSON()
	if err != nil {
		return fmt.Errorf("failed to marshal manifest: %w", err)
	}
	return afero.WriteFile(fs, path, data, 0644)
}

// invalidJSONSamples returns various invalid JSON strings for testing.
func invalidJSONSamples() []struct {
	name string
	json string
} {
	return []struct {
		name string
		json string
	}{
		{"malformed_json", `{"version": "1.0.0"` + "missing brace"},
		{"missing_comma", `{"version": "1.0.0" "updated": "2024-01-01T00:00:00Z"}`},
		{"invalid_timestamp", `{"version": "1.0.0", "updated": "not-a-date", "commands": []}`},
		{"null_commands", `{"version": "1.0.0", "updated": "2024-01-01T00:00:00Z", "commands": null}`},
	}
}
