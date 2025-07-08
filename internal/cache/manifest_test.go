package cache

import (
	"testing"
	"time"
)

func TestParseManifest_Success(t *testing.T) {
	// Use test helper to create valid manifest
	testData := testManifest()
	jsonData, err := testData.ToJSON()
	if err != nil {
		t.Fatalf("Failed to create test JSON: %v", err)
	}

	manifest, err := ParseManifest(jsonData)
	if err != nil {
		t.Fatalf("ParseManifest() failed: %v", err)
	}

	// Verify parsed manifest matches test data
	if manifest.Version != testData.Version {
		t.Errorf("Expected version '%s', got '%s'", testData.Version, manifest.Version)
	}

	if !manifest.Updated.Equal(testData.Updated) {
		t.Errorf("Expected updated time %v, got %v", testData.Updated, manifest.Updated)
	}

	if len(manifest.Commands) != len(testData.Commands) {
		t.Errorf("Expected %d commands, got %d", len(testData.Commands), len(manifest.Commands))
	}

	if len(manifest.Commands) > 0 {
		cmd := manifest.Commands[0]
		expected := testData.Commands[0]
		if cmd.Name != expected.Name {
			t.Errorf("Expected command name '%s', got '%s'", expected.Name, cmd.Name)
		}
		if cmd.Description != expected.Description {
			t.Errorf("Expected description '%s', got '%s'", expected.Description, cmd.Description)
		}
		if cmd.File != expected.File {
			t.Errorf("Expected file '%s', got '%s'", expected.File, cmd.File)
		}
	}
}

func TestParseManifest_InvalidJSON(t *testing.T) {
	samples := invalidJSONSamples()

	for _, sample := range samples {
		t.Run(sample.name, func(t *testing.T) {
			_, err := ParseManifest([]byte(sample.json))
			if err == nil {
				t.Fatalf("ParseManifest() should have failed with %s", sample.name)
			}

			// Should return a descriptive error message
			if err.Error() == "" {
				t.Error("ParseManifest() should return a descriptive error message")
			}
		})
	}
}

func TestParseManifest_EmptyData(t *testing.T) {
	_, err := ParseManifest([]byte(""))
	if err == nil {
		t.Fatal("ParseManifest() should have failed with empty data")
	}

	_, err = ParseManifest(nil)
	if err == nil {
		t.Fatal("ParseManifest() should have failed with nil data")
	}
}

func TestParseManifest_MissingFields(t *testing.T) {
	tests := []struct {
		name     string
		manifest *Manifest
		wantErr  bool
	}{
		{
			name:     "missing version",
			manifest: testManifest(withVersion("")),
			wantErr:  true,
		},
		{
			name: "missing commands",
			manifest: &Manifest{
				Version: "1.0.0",
				Updated: time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC),
				// Commands is nil
			},
			wantErr: true,
		},
		{
			name:     "command missing name",
			manifest: testManifest(withCommands(invalidCommand("name"))),
			wantErr:  true,
		},
		{
			name:     "command missing description",
			manifest: testManifest(withCommands(invalidCommand("description"))),
			wantErr:  true,
		},
		{
			name:     "command missing file",
			manifest: testManifest(withCommands(invalidCommand("file"))),
			wantErr:  true,
		},
		{
			name:     "valid manifest",
			manifest: testManifest(),
			wantErr:  false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			jsonData, err := tt.manifest.ToJSON()
			if err != nil && !tt.wantErr {
				t.Fatalf("Failed to marshal test manifest: %v", err)
			}

			_, err = ParseManifest(jsonData)
			if tt.wantErr && err == nil {
				t.Errorf("ParseManifest() should have failed for %s", tt.name)
			} else if !tt.wantErr && err != nil {
				t.Errorf("ParseManifest() should not have failed for %s: %v", tt.name, err)
			}
		})
	}
}

func TestParseManifest_AllowedTools(t *testing.T) {
	// Test that allowed-tools field is properly parsed
	testData := testManifest(withCommands(Command{
		Name:         "test-command",
		Description:  "A test command",
		File:         "test-command.md",
		AllowedTools: []string{"Read", "Bash(git:*)", "Edit(src/**)"}, // Valid allowed-tools configuration
	}))

	jsonData, err := testData.ToJSON()
	if err != nil {
		t.Fatalf("Failed to create test JSON: %v", err)
	}

	manifest, err := ParseManifest(jsonData)
	if err != nil {
		t.Fatalf("ParseManifest() failed: %v", err)
	}

	// Verify allowed tools are parsed correctly
	if len(manifest.Commands) > 0 {
		cmd := manifest.Commands[0]
		expectedTools := []string{"Read", "Bash(git:*)", "Edit(src/**)"}
		if len(cmd.AllowedTools) != len(expectedTools) {
			t.Errorf("Expected %d allowed tools, got %d", len(expectedTools), len(cmd.AllowedTools))
		}
		for i, tool := range expectedTools {
			if i < len(cmd.AllowedTools) && cmd.AllowedTools[i] != tool {
				t.Errorf("Expected tool %s at index %d, got %s", tool, i, cmd.AllowedTools[i])
			}
		}
	}
}

func TestParseManifest_EmptyAllowedTools(t *testing.T) {
	// Test that empty allowed-tools field is handled correctly
	testData := testManifest(withCommands(Command{
		Name:         "test-command",
		Description:  "A test command",
		File:         "test-command.md",
		AllowedTools: []string{}, // Empty allowed-tools configuration
	}))

	jsonData, err := testData.ToJSON()
	if err != nil {
		t.Fatalf("Failed to create test JSON: %v", err)
	}

	manifest, err := ParseManifest(jsonData)
	if err != nil {
		t.Fatalf("ParseManifest() failed: %v", err)
	}

	// Verify empty allowed tools are handled correctly
	if len(manifest.Commands) > 0 {
		cmd := manifest.Commands[0]
		if len(cmd.AllowedTools) != 0 {
			t.Errorf("Expected empty allowed tools slice, got %v", cmd.AllowedTools)
		}
	}
}

func TestParseManifest_NoAllowedTools(t *testing.T) {
	// Test that missing allowed-tools field is handled correctly (should be optional)
	testData := testManifest() // Uses default command without AllowedTools

	jsonData, err := testData.ToJSON()
	if err != nil {
		t.Fatalf("Failed to create test JSON: %v", err)
	}

	manifest, err := ParseManifest(jsonData)
	if err != nil {
		t.Fatalf("ParseManifest() failed: %v", err)
	}

	// Verify missing allowed tools field doesn't break parsing
	if len(manifest.Commands) > 0 {
		cmd := manifest.Commands[0]
		// AllowedTools should be nil or empty when not provided
		if cmd.AllowedTools != nil && len(cmd.AllowedTools) != 0 {
			t.Errorf("Expected nil or empty allowed tools for command without field, got %v", cmd.AllowedTools)
		}
	}
}

func TestParseManifest_InvalidAllowedTools(t *testing.T) {
	// Test that allowed-tools with empty entries are filtered out
	testData := testManifest(withCommands(Command{
		Name:         "test-command",
		Description:  "A test command",
		File:         "test-command.md",
		AllowedTools: []string{"Read", "", "Edit"}, // Contains empty entry
	}))

	jsonData, err := testData.ToJSON()
	if err != nil {
		t.Fatalf("Failed to create test JSON: %v", err)
	}

	manifest, err := ParseManifest(jsonData)
	if err != nil {
		t.Fatalf("ParseManifest() failed: %v", err)
	}

	// Verify empty entries are filtered out
	if len(manifest.Commands) > 0 {
		cmd := manifest.Commands[0]
		expectedTools := []string{"Read", "Edit"}
		if len(cmd.AllowedTools) != len(expectedTools) {
			t.Errorf("Expected %d allowed tools, got %d", len(expectedTools), len(cmd.AllowedTools))
		}
		for i, tool := range expectedTools {
			if i < len(cmd.AllowedTools) && cmd.AllowedTools[i] != tool {
				t.Errorf("Expected tool %s at index %d, got %s", tool, i, cmd.AllowedTools[i])
			}
		}
	}
}

func TestParseManifest_WhitespaceAllowedTools(t *testing.T) {
	// Test that allowed-tools with whitespace-only entries are filtered out
	testData := testManifest(withCommands(Command{
		Name:         "test-command",
		Description:  "A test command",
		File:         "test-command.md",
		AllowedTools: []string{"Read", "  ", "Edit"}, // Contains whitespace-only entry
	}))

	jsonData, err := testData.ToJSON()
	if err != nil {
		t.Fatalf("Failed to create test JSON: %v", err)
	}

	manifest, err := ParseManifest(jsonData)
	if err != nil {
		t.Fatalf("ParseManifest() failed: %v", err)
	}

	// Verify whitespace-only entries are filtered out
	if len(manifest.Commands) > 0 {
		cmd := manifest.Commands[0]
		expectedTools := []string{"Read", "Edit"}
		if len(cmd.AllowedTools) != len(expectedTools) {
			t.Errorf("Expected %d allowed tools, got %d", len(expectedTools), len(cmd.AllowedTools))
		}
		for i, tool := range expectedTools {
			if i < len(cmd.AllowedTools) && cmd.AllowedTools[i] != tool {
				t.Errorf("Expected tool %s at index %d, got %s", tool, i, cmd.AllowedTools[i])
			}
		}
	}
}

func TestParseManifest_AllowedToolsStringFormat(t *testing.T) {
	// Test that comma-separated string format is properly parsed
	jsonData := []byte(`{
		"version": "1.0.0",
		"updated": "2025-01-01T00:00:00Z",
		"commands": [
			{
				"name": "test-command",
				"description": "A test command",
				"file": "test-command.md",
				"allowed-tools": "Read, Glob, Bash(git:*), Edit"
			}
		]
	}`)

	manifest, err := ParseManifest(jsonData)
	if err != nil {
		t.Fatalf("ParseManifest() failed: %v", err)
	}

	// Verify allowed tools are parsed correctly from string format
	if len(manifest.Commands) > 0 {
		cmd := manifest.Commands[0]
		expectedTools := []string{"Read", "Glob", "Bash(git:*)", "Edit"}
		if len(cmd.AllowedTools) != len(expectedTools) {
			t.Errorf("Expected %d allowed tools, got %d", len(expectedTools), len(cmd.AllowedTools))
		}
		for i, tool := range expectedTools {
			if i < len(cmd.AllowedTools) && cmd.AllowedTools[i] != tool {
				t.Errorf("Expected tool %s at index %d, got %s", tool, i, cmd.AllowedTools[i])
			}
		}
	}
}

func TestParseManifest_AllowedToolsStringFormatWithSpaces(t *testing.T) {
	// Test that comma-separated string format with extra spaces is properly parsed
	jsonData := []byte(`{
		"version": "1.0.0",
		"updated": "2025-01-01T00:00:00Z",
		"commands": [
			{
				"name": "test-command",
				"description": "A test command",
				"file": "test-command.md",
				"allowed-tools": "  Read  ,  Glob  ,  Bash(git:*)  ,  Edit  "
			}
		]
	}`)

	manifest, err := ParseManifest(jsonData)
	if err != nil {
		t.Fatalf("ParseManifest() failed: %v", err)
	}

	// Verify allowed tools are parsed correctly with spaces trimmed
	if len(manifest.Commands) > 0 {
		cmd := manifest.Commands[0]
		expectedTools := []string{"Read", "Glob", "Bash(git:*)", "Edit"}
		if len(cmd.AllowedTools) != len(expectedTools) {
			t.Errorf("Expected %d allowed tools, got %d", len(expectedTools), len(cmd.AllowedTools))
		}
		for i, tool := range expectedTools {
			if i < len(cmd.AllowedTools) && cmd.AllowedTools[i] != tool {
				t.Errorf("Expected tool %s at index %d, got %s", tool, i, cmd.AllowedTools[i])
			}
		}
	}
}

func TestParseManifest_AllowedToolsEmptyString(t *testing.T) {
	// Test that empty string for allowed-tools is handled correctly
	jsonData := []byte(`{
		"version": "1.0.0",
		"updated": "2025-01-01T00:00:00Z",
		"commands": [
			{
				"name": "test-command",
				"description": "A test command",
				"file": "test-command.md",
				"allowed-tools": ""
			}
		]
	}`)

	manifest, err := ParseManifest(jsonData)
	if err != nil {
		t.Fatalf("ParseManifest() failed: %v", err)
	}

	// Verify empty string results in nil allowed tools
	if len(manifest.Commands) > 0 {
		cmd := manifest.Commands[0]
		if cmd.AllowedTools != nil {
			t.Errorf("Expected nil allowed tools for empty string, got %v", cmd.AllowedTools)
		}
	}
}

func TestParseManifest_AllowedToolsStringWithEmptyEntries(t *testing.T) {
	// Test that comma-separated string with empty entries filters them out
	jsonData := []byte(`{
		"version": "1.0.0",
		"updated": "2025-01-01T00:00:00Z",
		"commands": [
			{
				"name": "test-command",
				"description": "A test command",
				"file": "test-command.md",
				"allowed-tools": "Read, , Glob, , Edit"
			}
		]
	}`)

	manifest, err := ParseManifest(jsonData)
	if err != nil {
		t.Fatalf("ParseManifest() failed: %v", err)
	}

	// Verify empty entries are filtered out
	if len(manifest.Commands) > 0 {
		cmd := manifest.Commands[0]
		expectedTools := []string{"Read", "Glob", "Edit"}
		if len(cmd.AllowedTools) != len(expectedTools) {
			t.Errorf("Expected %d allowed tools, got %d", len(expectedTools), len(cmd.AllowedTools))
		}
		for i, tool := range expectedTools {
			if i < len(cmd.AllowedTools) && cmd.AllowedTools[i] != tool {
				t.Errorf("Expected tool %s at index %d, got %s", tool, i, cmd.AllowedTools[i])
			}
		}
	}
}
