package status

import (
	"encoding/json"
	"fmt"
	"strings"
	"testing"
	"time"

	"github.com/claude-code-commands/claude-cmd/pkg/config"
	"github.com/spf13/afero"
)

// IntegrationCacheManager implements CacheManagerInterface for integration testing.
// This simulates the real cache manager behavior without causing import cycles.
// It reads manifest files from the filesystem to provide realistic testing scenarios
// while maintaining the interface contract expected by StatusService.
type IntegrationCacheManager struct {
	fs        afero.Fs
	cacheDir  string
	manifests map[string]*mockManifest
}

type mockManifest struct {
	Version  string        `json:"version"`
	Updated  time.Time     `json:"updated"`
	Commands []mockCommand `json:"commands"`
}

type mockCommand struct {
	Name        string `json:"name"`
	Description string `json:"description"`
	File        string `json:"file"`
}

// NewIntegrationCacheManager creates a new IntegrationCacheManager for testing.
// It provides a cache manager implementation that reads from the filesystem
// without requiring the actual cache package, avoiding import cycles.
//
// Parameters:
//   - fs: Filesystem abstraction for reading manifest files
//   - cacheDir: Base cache directory path for manifest files
//
// Returns:
//   - *IntegrationCacheManager: Configured cache manager for integration testing
func NewIntegrationCacheManager(fs afero.Fs, cacheDir string) *IntegrationCacheManager {
	return &IntegrationCacheManager{
		fs:        fs,
		cacheDir:  cacheDir,
		manifests: make(map[string]*mockManifest),
	}
}

// GetCacheStatus retrieves cache status by reading manifest files from the filesystem.
// This method simulates the real cache manager behavior by parsing manifest files
// from the expected cache directory structure: {cacheDir}/pages/{lang}/index.json
//
// Parameters:
//   - lang: Language code for the cache to retrieve
//
// Returns:
//   - *CacheStatus: Cache status information with command count and metadata
//   - error: ErrCacheMiss if manifest file doesn't exist, or parsing errors
func (m *IntegrationCacheManager) GetCacheStatus(lang string) (*CacheStatus, error) {
	// Read manifest from filesystem using the expected cache directory structure
	manifestPath := m.cacheDir + "/pages/" + lang + "/index.json"
	data, err := afero.ReadFile(m.fs, manifestPath)
	if err != nil {
		// Return cache miss error to simulate missing cache
		return nil, fmt.Errorf("cache miss")
	}

	var manifest mockManifest
	if err := json.Unmarshal(data, &manifest); err != nil {
		return nil, fmt.Errorf("failed to parse manifest: %w", err)
	}

	return &CacheStatus{
		CommandCount: len(manifest.Commands),
		LastUpdated:  manifest.Updated,
		Language:     lang,
	}, nil
}

// RED PHASE: Test complete integration workflow with real cache manager
func TestStatusIntegration_CompleteWorkflow_Success(t *testing.T) {
	// Setup in-memory filesystem
	fs := afero.NewMemMapFs()

	// Create cache directory structure
	cacheDir := "/tmp/claude-cmd-test"
	err := fs.MkdirAll(cacheDir+"/pages/en", 0755)
	if err != nil {
		t.Fatalf("Failed to create cache directory: %v", err)
	}

	// Create test manifest file
	manifestData := `{
		"version": "1.0.0",
		"updated": "2024-12-01T10:00:00Z",
		"commands": [
			{"name": "test-cmd", "description": "Test command", "file": "test-cmd.md"},
			{"name": "example", "description": "Example command", "file": "example.md"}
		]
	}`
	err = afero.WriteFile(fs, cacheDir+"/pages/en/index.json", []byte(manifestData), 0644)
	if err != nil {
		t.Fatalf("Failed to write manifest file: %v", err)
	}

	// Create some installed commands in project directory
	projectDir := "./.claude/commands"
	err = fs.MkdirAll(projectDir, 0755)
	if err != nil {
		t.Fatalf("Failed to create project directory: %v", err)
	}

	// Write test command files
	err = afero.WriteFile(fs, projectDir+"/installed-cmd1.md", []byte("# Test Command 1"), 0644)
	if err != nil {
		t.Fatalf("Failed to write test command 1: %v", err)
	}
	err = afero.WriteFile(fs, projectDir+"/installed-cmd2.md", []byte("# Test Command 2"), 0644)
	if err != nil {
		t.Fatalf("Failed to write test command 2: %v", err)
	}

	// Create cache manager
	cacheManager := NewIntegrationCacheManager(fs, cacheDir)

	// Create status service with real cache manager
	statusService := NewStatusService(fs, cacheManager)

	// Create formatter
	formatter := NewStatusFormatter()

	// Execute complete workflow
	fullStatus, err := statusService.GetFullStatus("en")
	if err != nil {
		t.Fatalf("Expected no error in complete workflow, got: %v", err)
	}

	// Verify status components
	if fullStatus.Version != config.GetVersion() {
		t.Errorf("Expected version %q, got %q", config.GetVersion(), fullStatus.Version)
	}

	if fullStatus.Cache.CommandCount != 2 {
		t.Errorf("Expected cache command count 2, got %d", fullStatus.Cache.CommandCount)
	}

	if fullStatus.Cache.Language != "en" {
		t.Errorf("Expected cache language 'en', got %q", fullStatus.Cache.Language)
	}

	if fullStatus.Installed.TotalCount != 2 {
		t.Errorf("Expected installed count 2, got %d", fullStatus.Installed.TotalCount)
	}

	if fullStatus.Installed.ProjectCount != 2 {
		t.Errorf("Expected project count 2, got %d", fullStatus.Installed.ProjectCount)
	}

	if fullStatus.Installed.PersonalCount != 0 {
		t.Errorf("Expected personal count 0, got %d", fullStatus.Installed.PersonalCount)
	}

	// Test all format outputs
	formats := []string{"default", "compact", "detailed", "json"}
	for _, format := range formats {
		output, err := formatter.Format(fullStatus, format)
		if err != nil {
			t.Errorf("Expected no error for format %q, got: %v", format, err)
		}
		if output == "" {
			t.Errorf("Expected non-empty output for format %q", format)
		}

		// Format-specific validations
		switch format {
		case "json":
			var parsed map[string]interface{}
			if err := json.Unmarshal([]byte(output), &parsed); err != nil {
				t.Errorf("Expected valid JSON for format %q, got parse error: %v", format, err)
			}
		case "compact":
			if strings.Count(output, "\n") > 1 {
				t.Errorf("Expected compact format to be single line, got: %s", output)
			}
		case "detailed", "default":
			if !strings.Contains(output, config.GetVersion()) {
				t.Errorf("Expected format %q to contain version, got: %s", format, output)
			}
		}
	}
}

// RED PHASE: Test integration with cache miss scenario
func TestStatusIntegration_CacheMissScenario(t *testing.T) {
	// Setup in-memory filesystem with no cache
	fs := afero.NewMemMapFs()
	cacheDir := "/tmp/claude-cmd-nocache"

	// Create some installed commands
	projectDir := "./.claude/commands"
	err := fs.MkdirAll(projectDir, 0755)
	if err != nil {
		t.Fatalf("Failed to create project directory: %v", err)
	}

	err = afero.WriteFile(fs, projectDir+"/cmd1.md", []byte("# Command 1"), 0644)
	if err != nil {
		t.Fatalf("Failed to write command file: %v", err)
	}

	// Create cache manager (no cache file exists)
	cacheManager := NewIntegrationCacheManager(fs, cacheDir)

	// Create status service
	statusService := NewStatusService(fs, cacheManager)

	// Create formatter
	formatter := NewStatusFormatter()

	// Execute workflow - should handle cache miss gracefully
	fullStatus, err := statusService.GetFullStatus("en")
	if err != nil {
		t.Fatalf("Expected no error with cache miss, got: %v", err)
	}

	// Verify cache miss is handled properly
	if fullStatus.Cache.CommandCount != 0 {
		t.Errorf("Expected cache command count 0 for cache miss, got %d", fullStatus.Cache.CommandCount)
	}

	if !fullStatus.Cache.LastUpdated.IsZero() {
		t.Errorf("Expected zero time for cache miss, got %v", fullStatus.Cache.LastUpdated)
	}

	// Verify installed commands still work
	if fullStatus.Installed.TotalCount != 1 {
		t.Errorf("Expected installed count 1, got %d", fullStatus.Installed.TotalCount)
	}

	// Test that all formats handle cache miss appropriately
	output, err := formatter.Format(fullStatus, "default")
	if err != nil {
		t.Fatalf("Expected no error formatting cache miss, got: %v", err)
	}

	// Should indicate cache is not available
	cacheIndicators := []string{"no cache", "cache miss", "not available", "(no cache available)"}
	hasIndicator := false
	for _, indicator := range cacheIndicators {
		if strings.Contains(strings.ToLower(output), indicator) {
			hasIndicator = true
			break
		}
	}
	if !hasIndicator {
		t.Errorf("Expected output to indicate cache miss, got: %s", output)
	}
}

// RED PHASE: Test integration with mixed directory scenarios
func TestStatusIntegration_MixedDirectoryScenario(t *testing.T) {
	fs := afero.NewMemMapFs()
	cacheDir := "/tmp/claude-cmd-mixed"

	// Create cache with manifest
	err := fs.MkdirAll(cacheDir+"/pages/fr", 0755)
	if err != nil {
		t.Fatalf("Failed to create cache directory: %v", err)
	}

	manifestData := `{
		"version": "1.0.0",
		"updated": "2024-12-01T15:30:00Z",
		"commands": [
			{"name": "cmd1", "description": "Command 1", "file": "cmd1.md"},
			{"name": "cmd2", "description": "Command 2", "file": "cmd2.md"},
			{"name": "cmd3", "description": "Command 3", "file": "cmd3.md"}
		]
	}`
	err = afero.WriteFile(fs, cacheDir+"/pages/fr/index.json", []byte(manifestData), 0644)
	if err != nil {
		t.Fatalf("Failed to write manifest: %v", err)
	}

	// Create project directory with some commands
	projectDir := "./.claude/commands"
	err = fs.MkdirAll(projectDir, 0755)
	if err != nil {
		t.Fatalf("Failed to create project directory: %v", err)
	}

	err = afero.WriteFile(fs, projectDir+"/project-cmd1.md", []byte("# Project Command 1"), 0644)
	if err != nil {
		t.Fatalf("Failed to write project command: %v", err)
	}
	err = afero.WriteFile(fs, projectDir+"/project-cmd2.md", []byte("# Project Command 2"), 0644)
	if err != nil {
		t.Fatalf("Failed to write project command: %v", err)
	}

	// Create custom install counter with personal directory commands
	personalDir := "/home/user/.claude/commands"
	err = fs.MkdirAll(personalDir, 0755)
	if err != nil {
		t.Fatalf("Failed to create personal directory: %v", err)
	}

	err = afero.WriteFile(fs, personalDir+"/personal-cmd1.md", []byte("# Personal Command 1"), 0644)
	if err != nil {
		t.Fatalf("Failed to write personal command: %v", err)
	}
	err = afero.WriteFile(fs, personalDir+"/personal-cmd2.md", []byte("# Personal Command 2"), 0644)
	if err != nil {
		t.Fatalf("Failed to write personal command: %v", err)
	}
	err = afero.WriteFile(fs, personalDir+"/personal-cmd3.md", []byte("# Personal Command 3"), 0644)
	if err != nil {
		t.Fatalf("Failed to write personal command: %v", err)
	}

	// Create cache manager and custom install counter
	cacheManager := NewIntegrationCacheManager(fs, cacheDir)
	installCounter := NewInstallCounterWithPersonalDir(fs, personalDir)

	// Create status service with custom install counter
	statusService := NewStatusServiceWithInstallCounter(fs, cacheManager, installCounter)

	// Execute workflow with French language
	fullStatus, err := statusService.GetFullStatus("fr")
	if err != nil {
		t.Fatalf("Expected no error in mixed directory scenario, got: %v", err)
	}

	// Verify cache status
	if fullStatus.Cache.CommandCount != 3 {
		t.Errorf("Expected cache command count 3, got %d", fullStatus.Cache.CommandCount)
	}

	if fullStatus.Cache.Language != "fr" {
		t.Errorf("Expected cache language 'fr', got %q", fullStatus.Cache.Language)
	}

	// Verify install counts
	expectedTotal := 5 // 2 project + 3 personal
	if fullStatus.Installed.TotalCount != expectedTotal {
		t.Errorf("Expected total count %d, got %d", expectedTotal, fullStatus.Installed.TotalCount)
	}

	if fullStatus.Installed.ProjectCount != 2 {
		t.Errorf("Expected project count 2, got %d", fullStatus.Installed.ProjectCount)
	}

	if fullStatus.Installed.PersonalCount != 3 {
		t.Errorf("Expected personal count 3, got %d", fullStatus.Installed.PersonalCount)
	}

	if fullStatus.Installed.PrimaryLocation != "personal" {
		t.Errorf("Expected primary location 'personal', got %q", fullStatus.Installed.PrimaryLocation)
	}

	// Test detailed format includes all information
	formatter := NewStatusFormatter()
	output, err := formatter.Format(fullStatus, "detailed")
	if err != nil {
		t.Fatalf("Expected no error formatting detailed view, got: %v", err)
	}

	// Verify all key information is present
	expectedContent := []string{
		"3", "2", "personal", "fr", // counts and location
		"VERSION INFORMATION", "CACHE STATUS", "INSTALLATION STATUS", "SUMMARY", // sections
	}

	for _, expected := range expectedContent {
		if !strings.Contains(output, expected) {
			t.Errorf("Expected detailed output to contain %q, got: %s", expected, output)
		}
	}
}

// RED PHASE: Test integration error handling and recovery
func TestStatusIntegration_ErrorHandlingAndRecovery(t *testing.T) {
	fs := afero.NewMemMapFs()
	cacheDir := "/tmp/claude-cmd-errors"

	// Create cache manager
	cacheManager := NewIntegrationCacheManager(fs, cacheDir)

	// Create status service
	statusService := NewStatusService(fs, cacheManager)

	// Test with invalid language (should be handled gracefully)
	_, err := statusService.GetFullStatus("")
	if err == nil {
		t.Fatal("Expected error for empty language, got nil")
	}

	if !strings.Contains(err.Error(), "language cannot be empty") {
		t.Errorf("Expected language validation error, got: %v", err)
	}

	// Test with valid language but no cache (should work with graceful degradation)
	fullStatus, err := statusService.GetFullStatus("en")
	if err != nil {
		t.Fatalf("Expected no error for missing cache, got: %v", err)
	}

	// Should have default cache status
	if fullStatus.Cache.CommandCount != 0 {
		t.Errorf("Expected cache count 0 for missing cache, got %d", fullStatus.Cache.CommandCount)
	}

	if fullStatus.Cache.Language != "en" {
		t.Errorf("Expected cache language 'en', got %q", fullStatus.Cache.Language)
	}

	// Test formatter error handling
	formatter := NewStatusFormatter()

	// Test with nil status
	_, err = formatter.Format(nil, "default")
	if err == nil {
		t.Fatal("Expected error for nil status, got nil")
	}

	// Test with invalid format
	_, err = formatter.Format(fullStatus, "invalid-format")
	if err == nil {
		t.Fatal("Expected error for invalid format, got nil")
	}

	if !strings.Contains(err.Error(), "unsupported format") {
		t.Errorf("Expected unsupported format error, got: %v", err)
	}
}

// RED PHASE: Test integration with different languages
func TestStatusIntegration_MultiLanguageSupport(t *testing.T) {
	fs := afero.NewMemMapFs()
	cacheDir := "/tmp/claude-cmd-multilang"

	// Create cache files for multiple languages
	languages := []string{"en", "fr", "es", "de"}
	for i, lang := range languages {
		langDir := cacheDir + "/pages/" + lang
		err := fs.MkdirAll(langDir, 0755)
		if err != nil {
			t.Fatalf("Failed to create directory for language %s: %v", lang, err)
		}

		commandCount := (i + 1) * 5 // Different counts for each language
		manifestData := `{
			"version": "1.0.0",
			"updated": "2024-12-01T10:00:00Z",
			"commands": [`

		for j := 0; j < commandCount; j++ {
			if j > 0 {
				manifestData += ","
			}
			manifestData += `{"name": "cmd` + string(rune('0'+j)) + `", "description": "Command ` + string(rune('0'+j)) + `", "file": "cmd` + string(rune('0'+j)) + `.md"}`
		}

		manifestData += `]}`

		err = afero.WriteFile(fs, langDir+"/index.json", []byte(manifestData), 0644)
		if err != nil {
			t.Fatalf("Failed to write manifest for language %s: %v", lang, err)
		}
	}

	// Create cache manager and status service
	cacheManager := NewIntegrationCacheManager(fs, cacheDir)
	statusService := NewStatusService(fs, cacheManager)
	formatter := NewStatusFormatter()

	// Test each language
	for i, lang := range languages {
		expectedCount := (i + 1) * 5

		fullStatus, err := statusService.GetFullStatus(lang)
		if err != nil {
			t.Fatalf("Expected no error for language %s, got: %v", lang, err)
		}

		if fullStatus.Cache.CommandCount != expectedCount {
			t.Errorf("Expected cache count %d for language %s, got %d", expectedCount, lang, fullStatus.Cache.CommandCount)
		}

		if fullStatus.Cache.Language != lang {
			t.Errorf("Expected cache language %s, got %q", lang, fullStatus.Cache.Language)
		}

		// Test JSON output includes correct language
		output, err := formatter.Format(fullStatus, "json")
		if err != nil {
			t.Fatalf("Expected no error formatting JSON for language %s, got: %v", lang, err)
		}

		if !strings.Contains(output, `"language": "`+lang+`"`) {
			t.Errorf("Expected JSON to contain language %s, got: %s", lang, output)
		}
	}
}

// RED PHASE: Test integration with time-based scenarios
func TestStatusIntegration_TimeBasedScenarios(t *testing.T) {
	fs := afero.NewMemMapFs()
	cacheDir := "/tmp/claude-cmd-time"

	// Create cache with specific timestamp
	err := fs.MkdirAll(cacheDir+"/pages/en", 0755)
	if err != nil {
		t.Fatalf("Failed to create cache directory: %v", err)
	}

	// Use a specific past timestamp
	pastTime := time.Date(2024, 11, 15, 14, 30, 0, 0, time.UTC)
	manifestData := `{
		"version": "1.0.0",
		"updated": "` + pastTime.Format(time.RFC3339) + `",
		"commands": [
			{"name": "old-cmd", "description": "Old command", "file": "old-cmd.md"}
		]
	}`

	err = afero.WriteFile(fs, cacheDir+"/pages/en/index.json", []byte(manifestData), 0644)
	if err != nil {
		t.Fatalf("Failed to write manifest: %v", err)
	}

	// Create status service
	cacheManager := NewIntegrationCacheManager(fs, cacheDir)
	statusService := NewStatusService(fs, cacheManager)
	formatter := NewStatusFormatter()

	// Get status
	fullStatus, err := statusService.GetFullStatus("en")
	if err != nil {
		t.Fatalf("Expected no error, got: %v", err)
	}

	// Verify timestamp is preserved
	if !fullStatus.Cache.LastUpdated.Equal(pastTime) {
		t.Errorf("Expected timestamp %v, got %v", pastTime, fullStatus.Cache.LastUpdated)
	}

	// Test detailed format includes cache age
	output, err := formatter.Format(fullStatus, "detailed")
	if err != nil {
		t.Fatalf("Expected no error formatting detailed view, got: %v", err)
	}

	// Should include cache age information
	if !strings.Contains(output, "Cache Age:") {
		t.Errorf("Expected detailed output to contain cache age, got: %s", output)
	}

	// Should include formatted timestamp
	expectedDate := pastTime.Format("2006-01-02")
	if !strings.Contains(output, expectedDate) {
		t.Errorf("Expected output to contain date %s, got: %s", expectedDate, output)
	}
}
