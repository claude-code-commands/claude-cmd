package config

import (
	"strings"
	"testing"
)

func TestGetVersion(t *testing.T) {
	tests := []struct {
		name           string
		version        string
		expectedPrefix string
		expectedSuffix string
	}{
		{
			name:           "development version",
			version:        "",
			expectedPrefix: "dev",
			expectedSuffix: "",
		},
		{
			name:           "release version",
			version:        "v1.2.3",
			expectedPrefix: "v1.2.3",
			expectedSuffix: "",
		},
		{
			name:           "prerelease version",
			version:        "v1.2.3-beta.1",
			expectedPrefix: "v1.2.3-beta.1",
			expectedSuffix: "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Set the version for this test
			originalVersion := Version
			Version = tt.version
			defer func() { Version = originalVersion }()

			result := GetVersion()

			if tt.expectedPrefix != "" {
				if !strings.HasPrefix(result, tt.expectedPrefix) {
					t.Errorf("GetVersion() = %q, expected to start with %q", result, tt.expectedPrefix)
				}
			}

			if tt.expectedSuffix != "" {
				if !strings.HasSuffix(result, tt.expectedSuffix) {
					t.Errorf("GetVersion() = %q, expected to end with %q", result, tt.expectedSuffix)
				}
			}
		})
	}
}

func TestVersionConstant(t *testing.T) {
	// Test that Version variable exists and can be set via build flags
	// This test ensures the variable is properly declared and accessible
	originalVersion := Version
	defer func() { Version = originalVersion }()

	// Test setting version
	testVersion := "test-version"
	Version = testVersion

	if Version != testVersion {
		t.Errorf("Version = %q, expected %q", Version, testVersion)
	}
}

func TestVersionBuildFlag(t *testing.T) {
	// Test that GetVersion handles empty version (development case)
	originalVersion := Version
	Version = ""
	defer func() { Version = originalVersion }()

	result := GetVersion()
	if result != "dev" {
		t.Errorf("GetVersion() with empty Version = %q, expected %q", result, "dev")
	}
}
