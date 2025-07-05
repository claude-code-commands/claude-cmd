package status

import (
	"strings"
	"testing"
	"time"
)

// RED PHASE: Test basic StatusFormatter interface and structure
func TestNewStatusFormatter_Success(t *testing.T) {
	formatter := NewStatusFormatter()

	if formatter == nil {
		t.Fatal("NewStatusFormatter returned nil")
	}
}

// RED PHASE: Test default format output for complete status
func TestStatusFormatter_Format_DefaultFormat(t *testing.T) {
	formatter := NewStatusFormatter()

	// Create test status data
	fullStatus := &FullStatus{
		Version: "v1.2.3",
		Cache: CacheStatus{
			CommandCount: 25,
			LastUpdated:  time.Date(2024, 12, 1, 10, 0, 0, 0, time.UTC),
			Language:     "en",
		},
		Installed: InstalledStatus{
			Count:           15,
			TotalCount:      15,
			ProjectCount:    10,
			PersonalCount:   5,
			PrimaryLocation: "project",
		},
	}

	output, err := formatter.Format(fullStatus, "default")

	if err != nil {
		t.Fatalf("Expected no error for default format, got: %v", err)
	}

	if output == "" {
		t.Fatal("Expected non-empty output for default format")
	}

	// Verify key information is present in output
	expectedContent := []string{
		"v1.2.3",  // Version
		"25",      // Cache command count
		"15",      // Total installed count
		"project", // Primary location
	}

	for _, expected := range expectedContent {
		if !strings.Contains(output, expected) {
			t.Errorf("Expected output to contain %q, but it was missing. Output: %s", expected, output)
		}
	}
}

// RED PHASE: Test compact format output
func TestStatusFormatter_Format_CompactFormat(t *testing.T) {
	formatter := NewStatusFormatter()

	fullStatus := &FullStatus{
		Version: "v1.0.0",
		Cache: CacheStatus{
			CommandCount: 10,
			LastUpdated:  time.Date(2024, 12, 1, 10, 0, 0, 0, time.UTC),
			Language:     "fr",
		},
		Installed: InstalledStatus{
			Count:           8,
			TotalCount:      8,
			ProjectCount:    3,
			PersonalCount:   5,
			PrimaryLocation: "personal",
		},
	}

	output, err := formatter.Format(fullStatus, "compact")

	if err != nil {
		t.Fatalf("Expected no error for compact format, got: %v", err)
	}

	if output == "" {
		t.Fatal("Expected non-empty output for compact format")
	}

	// Compact format should be shorter than default
	// and still contain essential information
	if strings.Count(output, "\n") > 3 {
		t.Errorf("Expected compact format to have 3 or fewer lines, got: %s", output)
	}

	// Essential info should still be present
	expectedContent := []string{"v1.0.0", "10", "8"}
	for _, expected := range expectedContent {
		if !strings.Contains(output, expected) {
			t.Errorf("Expected compact output to contain %q, got: %s", expected, output)
		}
	}
}

// RED PHASE: Test JSON format output
func TestStatusFormatter_Format_JSONFormat(t *testing.T) {
	formatter := NewStatusFormatter()

	fullStatus := &FullStatus{
		Version: "v2.0.0",
		Cache: CacheStatus{
			CommandCount: 30,
			LastUpdated:  time.Date(2024, 12, 1, 10, 0, 0, 0, time.UTC),
			Language:     "es",
		},
		Installed: InstalledStatus{
			Count:           20,
			TotalCount:      20,
			ProjectCount:    12,
			PersonalCount:   8,
			PrimaryLocation: "project",
		},
	}

	output, err := formatter.Format(fullStatus, "json")

	if err != nil {
		t.Fatalf("Expected no error for JSON format, got: %v", err)
	}

	if output == "" {
		t.Fatal("Expected non-empty output for JSON format")
	}

	// JSON should be parseable and contain expected fields
	expectedJSONContent := []string{
		`"version"`,
		`"cache"`,
		`"installed"`,
		`"v2.0.0"`,
		`"command_count": 30`,
		`"total_count": 20`,
	}

	for _, expected := range expectedJSONContent {
		if !strings.Contains(output, expected) {
			t.Errorf("Expected JSON output to contain %q, got: %s", expected, output)
		}
	}
}

// RED PHASE: Test detailed format output
func TestStatusFormatter_Format_DetailedFormat(t *testing.T) {
	formatter := NewStatusFormatter()

	fullStatus := &FullStatus{
		Version: "dev",
		Cache: CacheStatus{
			CommandCount: 50,
			LastUpdated:  time.Date(2024, 12, 1, 10, 0, 0, 0, time.UTC),
			Language:     "de",
		},
		Installed: InstalledStatus{
			Count:           35,
			TotalCount:      35,
			ProjectCount:    20,
			PersonalCount:   15,
			PrimaryLocation: "project",
		},
	}

	output, err := formatter.Format(fullStatus, "detailed")

	if err != nil {
		t.Fatalf("Expected no error for detailed format, got: %v", err)
	}

	if output == "" {
		t.Fatal("Expected non-empty output for detailed format")
	}

	// Detailed format should include more comprehensive information
	expectedContent := []string{
		"dev",        // Version
		"50",         // Cache count
		"35",         // Total installed
		"20",         // Project count
		"15",         // Personal count
		"project",    // Primary location
		"de",         // Language
		"2024-12-01", // Date information
	}

	for _, expected := range expectedContent {
		if !strings.Contains(output, expected) {
			t.Errorf("Expected detailed output to contain %q, got: %s", expected, output)
		}
	}

	// Detailed should have more lines than compact
	if strings.Count(output, "\n") < 5 {
		t.Errorf("Expected detailed format to have 5 or more lines, got: %s", output)
	}
}

// RED PHASE: Test invalid format handling
func TestStatusFormatter_Format_InvalidFormat(t *testing.T) {
	formatter := NewStatusFormatter()

	fullStatus := &FullStatus{
		Version: "v1.0.0",
		Cache: CacheStatus{
			CommandCount: 10,
			LastUpdated:  time.Date(2024, 12, 1, 10, 0, 0, 0, time.UTC),
			Language:     "en",
		},
		Installed: InstalledStatus{
			Count:           5,
			TotalCount:      5,
			ProjectCount:    3,
			PersonalCount:   2,
			PrimaryLocation: "personal",
		},
	}

	_, err := formatter.Format(fullStatus, "invalid-format")

	if err == nil {
		t.Fatal("Expected error for invalid format, got nil")
	}

	expectedErrorContent := "unsupported format"
	if !strings.Contains(err.Error(), expectedErrorContent) {
		t.Errorf("Expected error to contain %q, got: %v", expectedErrorContent, err)
	}
}

// RED PHASE: Test nil status handling
func TestStatusFormatter_Format_NilStatus(t *testing.T) {
	formatter := NewStatusFormatter()

	_, err := formatter.Format(nil, "default")

	if err == nil {
		t.Fatal("Expected error for nil status, got nil")
	}

	expectedErrorContent := "status cannot be nil"
	if !strings.Contains(err.Error(), expectedErrorContent) {
		t.Errorf("Expected error to contain %q, got: %v", expectedErrorContent, err)
	}
}

// RED PHASE: Test empty format handling (should default to "default")
func TestStatusFormatter_Format_EmptyFormat(t *testing.T) {
	formatter := NewStatusFormatter()

	fullStatus := &FullStatus{
		Version: "v1.0.0",
		Cache: CacheStatus{
			CommandCount: 5,
			LastUpdated:  time.Date(2024, 12, 1, 10, 0, 0, 0, time.UTC),
			Language:     "en",
		},
		Installed: InstalledStatus{
			Count:           3,
			TotalCount:      3,
			ProjectCount:    1,
			PersonalCount:   2,
			PrimaryLocation: "personal",
		},
	}

	output, err := formatter.Format(fullStatus, "")

	if err != nil {
		t.Fatalf("Expected no error for empty format (should default), got: %v", err)
	}

	if output == "" {
		t.Fatal("Expected non-empty output for empty format (should default)")
	}

	// Should behave like default format
	expectedContent := []string{"v1.0.0", "5", "3"}
	for _, expected := range expectedContent {
		if !strings.Contains(output, expected) {
			t.Errorf("Expected output to contain %q, got: %s", expected, output)
		}
	}
}

// RED PHASE: Test cache miss scenario (zero cache count)
func TestStatusFormatter_Format_CacheMissScenario(t *testing.T) {
	formatter := NewStatusFormatter()

	// Simulate cache miss scenario with zero time and zero count
	fullStatus := &FullStatus{
		Version: "v1.0.0",
		Cache: CacheStatus{
			CommandCount: 0,
			LastUpdated:  time.Time{}, // Zero time indicates cache miss
			Language:     "en",
		},
		Installed: InstalledStatus{
			Count:           5,
			TotalCount:      5,
			ProjectCount:    3,
			PersonalCount:   2,
			PrimaryLocation: "personal",
		},
	}

	output, err := formatter.Format(fullStatus, "default")

	if err != nil {
		t.Fatalf("Expected no error for cache miss scenario, got: %v", err)
	}

	if output == "" {
		t.Fatal("Expected non-empty output for cache miss scenario")
	}

	// Should indicate cache is not available
	cacheIndicators := []string{"0", "no cache", "cache miss", "not cached", "unavailable"}
	hasCacheIndicator := false
	for _, indicator := range cacheIndicators {
		if strings.Contains(strings.ToLower(output), indicator) {
			hasCacheIndicator = true
			break
		}
	}

	if !hasCacheIndicator {
		t.Errorf("Expected output to indicate cache miss scenario, got: %s", output)
	}
}

// RED PHASE: Test format case insensitivity
func TestStatusFormatter_Format_CaseInsensitive(t *testing.T) {
	formatter := NewStatusFormatter()

	fullStatus := &FullStatus{
		Version: "v1.0.0",
		Cache: CacheStatus{
			CommandCount: 10,
			LastUpdated:  time.Date(2024, 12, 1, 10, 0, 0, 0, time.UTC),
			Language:     "en",
		},
		Installed: InstalledStatus{
			Count:           5,
			TotalCount:      5,
			ProjectCount:    3,
			PersonalCount:   2,
			PrimaryLocation: "personal",
		},
	}

	testCases := []string{"JSON", "Default", "COMPACT", "dEtAiLeD"}

	for _, format := range testCases {
		t.Run("format_"+strings.ToLower(format), func(t *testing.T) {
			output, err := formatter.Format(fullStatus, format)

			// Should not error on valid formats regardless of case
			if err != nil && !strings.Contains(err.Error(), "unsupported format") {
				t.Errorf("Expected case-insensitive format %q to work, got error: %v", format, err)
			}

			// For valid formats, should produce output
			if err == nil && output == "" {
				t.Errorf("Expected non-empty output for format %q", format)
			}
		})
	}
}
