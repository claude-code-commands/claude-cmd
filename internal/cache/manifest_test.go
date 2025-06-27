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