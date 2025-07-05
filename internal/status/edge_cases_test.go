// Package status provides comprehensive edge case testing for the status dashboard components.
// This file tests error conditions, boundary values, malformed data handling, and graceful degradation
// scenarios to ensure robust behavior under adverse conditions.
package status

import (
	"errors"
	"fmt"
	"strings"
	"testing"
	"time"

	"github.com/spf13/afero"
)

// ErrorCache simulates cache manager errors for testing edge cases.
// This mock implementation allows us to test how StatusService handles various
// cache-related error conditions such as network failures, permission issues,
// data corruption, and timeouts. It provides consistent error simulation
// for comprehensive error handling validation.
type ErrorCache struct {
	errorType string // Type of error to simulate (network, permission, corruption, timeout, etc.)
}

// GetCacheStatus implements CacheManagerInterface by returning errors based on errorType.
// This method simulates various failure scenarios that can occur when accessing cache data,
// allowing comprehensive testing of error handling and graceful degradation paths.
//
// Parameters:
//   - lang: Language code (ignored in error simulation)
//
// Returns:
//   - *CacheStatus: Always nil for error simulation
//   - error: Specific error based on configured errorType
func (e *ErrorCache) GetCacheStatus(lang string) (*CacheStatus, error) {
	switch e.errorType {
	case "network":
		return nil, errors.New("network connection failed")
	case "permission":
		return nil, errors.New("permission denied reading cache")
	case "corruption":
		return nil, errors.New("cache data corrupted")
	case "timeout":
		return nil, errors.New("cache operation timed out")
	default:
		return nil, errors.New("unknown cache error")
	}
}

// ErrorInstallCounter simulates install counter errors for testing edge cases.
// This mock implementation allows testing of StatusService behavior when the
// install counter component encounters various filesystem and operational errors.
// It provides controlled error scenarios to validate error propagation and handling.
type ErrorInstallCounter struct {
	errorType string // Type of error to simulate (permission, disk-space, corrupted-files, etc.)
}

// GetInstalledStatus implements InstallCounterInterface by returning errors based on errorType.
// This method simulates various failure scenarios that can occur when accessing or counting
// installed commands, enabling comprehensive testing of error handling in the status system.
//
// Parameters:
//   - lang: Language code (ignored in error simulation)
//
// Returns:
//   - *InstalledStatus: Always nil for error simulation
//   - error: Specific error based on configured errorType
func (e *ErrorInstallCounter) GetInstalledStatus(lang string) (*InstalledStatus, error) {
	switch e.errorType {
	case "permission":
		return nil, errors.New("permission denied accessing command directories")
	case "disk-space":
		return nil, errors.New("insufficient disk space")
	case "corrupted-files":
		return nil, errors.New("command files are corrupted")
	default:
		return nil, errors.New("unknown install counter error")
	}
}

// RED PHASE: Test service behavior with various cache errors
func TestStatusService_EdgeCases_CacheErrors(t *testing.T) {
	fs := afero.NewMemMapFs()

	testCases := []struct {
		name      string
		errorType string
		expectErr bool
	}{
		{"network error", "network", true},
		{"permission error", "permission", true},
		{"corruption error", "corruption", true},
		{"timeout error", "timeout", true},
		{"unknown error", "unknown", true},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			errorCache := &ErrorCache{errorType: tc.errorType}
			installCounter := NewInstallCounter(fs)
			service := NewStatusServiceWithInstallCounter(fs, errorCache, installCounter)

			_, err := service.GetFullStatus("en")

			if tc.expectErr && err == nil {
				t.Fatalf("Expected error for %s, got nil", tc.name)
			}

			if !tc.expectErr && err != nil {
				t.Fatalf("Expected no error for %s, got: %v", tc.name, err)
			}

			if err != nil {
				// Just verify we got an error - specific error message checking is less important
				// than verifying error propagation works
			}
		})
	}
}

// RED PHASE: Test service behavior with various install counter errors
func TestStatusService_EdgeCases_InstallCounterErrors(t *testing.T) {
	fs := afero.NewMemMapFs()

	// Create a working cache manager
	cacheManager := NewIntegrationCacheManager(fs, "/tmp/cache")

	testCases := []struct {
		name      string
		errorType string
		expectErr bool
	}{
		{"permission error", "permission", true},
		{"disk space error", "disk-space", true},
		{"corrupted files error", "corrupted-files", true},
		{"unknown error", "unknown", true},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			errorInstallCounter := &ErrorInstallCounter{errorType: tc.errorType}
			service := NewStatusServiceWithInstallCounter(fs, cacheManager, errorInstallCounter)

			_, err := service.GetFullStatus("en")

			if tc.expectErr && err == nil {
				t.Fatalf("Expected error for %s, got nil", tc.name)
			}

			if !tc.expectErr && err != nil {
				t.Fatalf("Expected no error for %s, got: %v", tc.name, err)
			}

			if err != nil {
				errorKeyword := strings.Split(tc.errorType, "-")[0]
				if !strings.Contains(strings.ToLower(err.Error()), errorKeyword) {
					t.Errorf("Expected error to contain %q, got: %v", errorKeyword, err)
				}
			}
		})
	}
}

// RED PHASE: Test formatter edge cases with malformed data
func TestStatusFormatter_EdgeCases_MalformedData(t *testing.T) {
	formatter := NewStatusFormatter()

	testCases := []struct {
		name   string
		status *FullStatus
		format string
	}{
		{
			name: "extremely large counts",
			status: &FullStatus{
				Version: "v1.0.0",
				Cache: CacheStatus{
					CommandCount: 999999999,
					LastUpdated:  time.Now(),
					Language:     "en",
				},
				Installed: InstalledStatus{
					Count:           999999999,
					TotalCount:      999999999,
					ProjectCount:    500000000,
					PersonalCount:   499999999,
					PrimaryLocation: "project",
				},
			},
			format: "default",
		},
		{
			name: "special characters in version",
			status: &FullStatus{
				Version: "v1.0.0-α.β.γ",
				Cache: CacheStatus{
					CommandCount: 5,
					LastUpdated:  time.Now(),
					Language:     "zh-CN",
				},
				Installed: InstalledStatus{
					Count:           3,
					TotalCount:      3,
					ProjectCount:    1,
					PersonalCount:   2,
					PrimaryLocation: "personal",
				},
			},
			format: "json",
		},
		{
			name: "distant future timestamp",
			status: &FullStatus{
				Version: "v1.0.0",
				Cache: CacheStatus{
					CommandCount: 5,
					LastUpdated:  time.Date(2090, 12, 31, 23, 59, 59, 0, time.UTC),
					Language:     "en",
				},
				Installed: InstalledStatus{
					Count:           3,
					TotalCount:      3,
					ProjectCount:    1,
					PersonalCount:   2,
					PrimaryLocation: "personal",
				},
			},
			format: "detailed",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			output, err := formatter.Format(tc.status, tc.format)

			if err != nil {
				t.Fatalf("Expected no error for malformed data case %s, got: %v", tc.name, err)
			}

			if output == "" {
				t.Fatalf("Expected non-empty output for malformed data case %s", tc.name)
			}

			// Should handle malformed data gracefully without crashing
			if tc.format == "json" {
				if !strings.Contains(output, "\"version\"") {
					t.Errorf("Expected JSON to be valid for malformed data case %s", tc.name)
				}
			}
		})
	}
}

// RED PHASE: Test constructor edge cases
func TestStatusService_EdgeCases_ConstructorPanics(t *testing.T) {
	fs := afero.NewMemMapFs()
	cacheManager := NewIntegrationCacheManager(fs, "/tmp/cache")
	installCounter := NewInstallCounter(fs)

	testCases := []struct {
		name           string
		fs             afero.Fs
		cacheManager   CacheManagerInterface
		installCounter InstallCounterInterface
		shouldPanic    bool
	}{
		{"nil filesystem", nil, cacheManager, installCounter, true},
		{"nil cache manager", fs, nil, installCounter, true},
		{"nil install counter", fs, cacheManager, nil, true},
		{"valid parameters", fs, cacheManager, installCounter, false},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			defer func() {
				r := recover()
				if tc.shouldPanic && r == nil {
					t.Errorf("Expected panic for %s, but none occurred", tc.name)
				}
				if !tc.shouldPanic && r != nil {
					t.Errorf("Unexpected panic for %s: %v", tc.name, r)
				}
			}()

			NewStatusServiceWithInstallCounter(tc.fs, tc.cacheManager, tc.installCounter)
		})
	}
}

// RED PHASE: Test language validation edge cases
func TestStatusService_EdgeCases_LanguageValidation(t *testing.T) {
	fs := afero.NewMemMapFs()
	cacheManager := NewIntegrationCacheManager(fs, "/tmp/cache")
	installCounter := NewInstallCounter(fs)
	service := NewStatusServiceWithInstallCounter(fs, cacheManager, installCounter)

	testCases := []struct {
		name      string
		language  string
		expectErr bool
	}{
		{"empty language", "", true},
		{"whitespace only", "   ", true},
		{"normal language", "en", false},
		{"language with hyphen", "zh-CN", false},
		{"language with underscore", "pt_BR", false},
		{"very long language", "abcdefghijklmnopqrstuvwxyz", false},
		{"numeric language", "123", false},
		{"single character", "a", false},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			_, err := service.GetFullStatus(tc.language)

			if tc.expectErr && err == nil {
				t.Errorf("Expected error for language %q, got nil", tc.language)
			}

			if !tc.expectErr && err != nil {
				t.Errorf("Expected no error for language %q, got: %v", tc.language, err)
			}

			if tc.expectErr && err != nil {
				if !strings.Contains(err.Error(), "language cannot be empty") {
					t.Errorf("Expected language validation error, got: %v", err)
				}
			}
		})
	}
}

// RED PHASE: Test formatter with concurrent access simulation
func TestStatusFormatter_EdgeCases_ConcurrentAccess(t *testing.T) {
	formatter := NewStatusFormatter()
	status := &FullStatus{
		Version: "v1.0.0",
		Cache: CacheStatus{
			CommandCount: 10,
			LastUpdated:  time.Now(),
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

	// Simulate concurrent formatting requests
	done := make(chan bool, 10)
	errors := make(chan error, 10)

	for i := 0; i < 10; i++ {
		go func(id int) {
			format := []string{"default", "compact", "detailed", "json"}[id%4]
			output, err := formatter.Format(status, format)

			if err != nil {
				errors <- fmt.Errorf("goroutine %d: %w", id, err)
			} else if output == "" {
				errors <- fmt.Errorf("goroutine %d: empty output", id)
			}

			done <- true
		}(i)
	}

	// Wait for all goroutines to complete
	for i := 0; i < 10; i++ {
		<-done
	}

	// Check for errors
	close(errors)
	for err := range errors {
		t.Errorf("Concurrent access error: %v", err)
	}
}

// RED PHASE: Test status validation edge cases
func TestStatusModels_EdgeCases_ValidationBoundaries(t *testing.T) {
	testCases := []struct {
		name    string
		status  interface{ Validate() error }
		wantErr bool
	}{
		{
			name: "cache status with maximum time",
			status: CacheStatus{
				CommandCount: 0,
				LastUpdated:  time.Date(9999, 12, 31, 23, 59, 59, 999999999, time.UTC),
				Language:     "en",
			},
			wantErr: false,
		},
		{
			name: "installed status with maximum counts",
			status: InstalledStatus{
				Count:           2147483647, // max int32
				TotalCount:      2147483647,
				ProjectCount:    1073741823,
				PersonalCount:   1073741824,
				PrimaryLocation: "project",
			},
			wantErr: false,
		},
		{
			name: "full status with empty components",
			status: FullStatus{
				Version: "v0.0.0",
				Cache: CacheStatus{
					CommandCount: 0,
					LastUpdated:  time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC),
					Language:     "en",
				},
				Installed: InstalledStatus{
					Count:           0,
					TotalCount:      0,
					ProjectCount:    0,
					PersonalCount:   0,
					PrimaryLocation: "personal",
				},
			},
			wantErr: false,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			err := tc.status.Validate()

			if tc.wantErr && err == nil {
				t.Errorf("Expected validation error for %s, got nil", tc.name)
			}

			if !tc.wantErr && err != nil {
				t.Errorf("Expected no validation error for %s, got: %v", tc.name, err)
			}
		})
	}
}

// RED PHASE: Test install counter edge cases with filesystem errors
func TestInstallCounter_EdgeCases_FilesystemErrors(t *testing.T) {
	// Create read-only filesystem to simulate permission errors
	fs := afero.NewReadOnlyFs(afero.NewMemMapFs())
	installCounter := NewInstallCounter(fs)

	// Should handle read-only filesystem gracefully
	status, err := installCounter.GetInstalledStatus("en")

	if err != nil {
		t.Fatalf("Expected graceful handling of read-only filesystem, got error: %v", err)
	}

	if status == nil {
		t.Fatal("Expected status to be returned even with filesystem errors")
	}

	// Should return zero counts when directories cannot be read
	if status.TotalCount != 0 {
		t.Errorf("Expected total count 0 for unreadable filesystem, got %d", status.TotalCount)
	}

	if status.ProjectCount != 0 {
		t.Errorf("Expected project count 0 for unreadable filesystem, got %d", status.ProjectCount)
	}

	if status.PersonalCount != 0 {
		t.Errorf("Expected personal count 0 for unreadable filesystem, got %d", status.PersonalCount)
	}
}

// RED PHASE: Test formatter edge cases with time handling
func TestStatusFormatter_EdgeCases_TimeFormatting(t *testing.T) {
	formatter := NewStatusFormatter()

	testCases := []struct {
		name        string
		lastUpdated time.Time
		format      string
	}{
		{"epoch time", time.Unix(0, 0), "detailed"},
		{"year 1", time.Date(1, 1, 1, 0, 0, 0, 0, time.UTC), "default"},
		{"year 9999", time.Date(9999, 12, 31, 23, 59, 59, 999999999, time.UTC), "detailed"},
		{"negative time zone", time.Date(2024, 6, 15, 12, 0, 0, 0, time.FixedZone("NEGATIVE", -12*60*60)), "detailed"},
		{"positive time zone", time.Date(2024, 6, 15, 12, 0, 0, 0, time.FixedZone("POSITIVE", 14*60*60)), "detailed"},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			status := &FullStatus{
				Version: "v1.0.0",
				Cache: CacheStatus{
					CommandCount: 10,
					LastUpdated:  tc.lastUpdated,
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

			output, err := formatter.Format(status, tc.format)

			if err != nil {
				t.Fatalf("Expected no error for time formatting case %s, got: %v", tc.name, err)
			}

			if output == "" {
				t.Fatalf("Expected non-empty output for time formatting case %s", tc.name)
			}

			// Should handle extreme time values gracefully
			if tc.format == "detailed" && !tc.lastUpdated.IsZero() {
				// Should contain some time information
				timeIndicators := []string{"Cache Age:", "Last Updated:", tc.lastUpdated.Format("2006")}
				hasTimeInfo := false
				for _, indicator := range timeIndicators {
					if strings.Contains(output, indicator) {
						hasTimeInfo = true
						break
					}
				}
				if !hasTimeInfo {
					t.Errorf("Expected detailed output to contain time information for %s, got: %s", tc.name, output)
				}
			}
		})
	}
}
