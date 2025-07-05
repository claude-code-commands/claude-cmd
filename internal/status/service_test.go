package status

import (
	"errors"
	"fmt"
	"testing"
	"time"

	"github.com/claude-code-commands/claude-cmd/pkg/config"
	"github.com/spf13/afero"
)

// Define network error locally to avoid import cycle
var (
	ErrNetworkUnavailable = errors.New("network unavailable")
)

// MockCacheManager implements CacheManagerInterface for testing StatusService
type MockCacheManager struct {
	cacheStatus *CacheStatus
	err         error
}

func (m *MockCacheManager) GetCacheStatus(lang string) (*CacheStatus, error) {
	return m.cacheStatus, m.err
}

// MockInstallCounter implements install counting for testing StatusService
type MockInstallCounter struct {
	installedStatus *InstalledStatus
	err             error
}

func (m *MockInstallCounter) GetInstalledStatus(lang string) (*InstalledStatus, error) {
	return m.installedStatus, m.err
}

// RED PHASE: Test basic StatusService interface and structure
func TestNewStatusService_Success(t *testing.T) {
	fs := afero.NewMemMapFs()
	cacheManager := &MockCacheManager{}

	service := NewStatusService(fs, cacheManager)

	if service == nil {
		t.Fatal("NewStatusService returned nil")
	}
}

// RED PHASE: Test getting full status with all components working
func TestStatusService_GetFullStatus_Success(t *testing.T) {
	fs := afero.NewMemMapFs()

	// Mock cache manager with test data
	cacheStatus := &CacheStatus{
		CommandCount: 25,
		LastUpdated:  time.Date(2024, 12, 1, 10, 0, 0, 0, time.UTC),
		Language:     "en",
	}
	cacheManager := &MockCacheManager{
		cacheStatus: cacheStatus,
		err:         nil,
	}

	service := NewStatusService(fs, cacheManager)

	fullStatus, err := service.GetFullStatus("en")

	if err != nil {
		t.Fatalf("Expected no error, got: %v", err)
	}

	if fullStatus == nil {
		t.Fatal("Expected FullStatus to be returned, got nil")
	}

	// Verify version information
	if fullStatus.Version != config.GetVersion() {
		t.Errorf("Expected version %q, got %q", config.GetVersion(), fullStatus.Version)
	}

	// Verify cache status
	if fullStatus.Cache.CommandCount != 25 {
		t.Errorf("Expected cache CommandCount 25, got %d", fullStatus.Cache.CommandCount)
	}

	if fullStatus.Cache.Language != "en" {
		t.Errorf("Expected cache Language 'en', got %q", fullStatus.Cache.Language)
	}

	// Verify installed status (should have values based on filesystem)
	if fullStatus.Installed.TotalCount < 0 {
		t.Errorf("Expected non-negative TotalCount, got %d", fullStatus.Installed.TotalCount)
	}
}

// RED PHASE: Test cache error handling
func TestStatusService_GetFullStatus_CacheError(t *testing.T) {
	fs := afero.NewMemMapFs()

	// Mock cache manager that returns an error
	cacheManager := &MockCacheManager{
		cacheStatus: nil,
		err:         ErrNetworkUnavailable,
	}

	service := NewStatusService(fs, cacheManager)

	_, err := service.GetFullStatus("en")

	if err == nil {
		t.Fatal("Expected error due to cache failure, got nil")
	}

	// Should propagate the cache error
	if !errors.Is(err, ErrNetworkUnavailable) {
		t.Errorf("Expected ErrNetworkUnavailable, got: %v", err)
	}
}

// RED PHASE: Test cache miss handling (should work gracefully)
func TestStatusService_GetFullStatus_CacheMiss(t *testing.T) {
	fs := afero.NewMemMapFs()

	// Mock cache manager that returns cache miss
	cacheManager := &MockCacheManager{
		cacheStatus: nil,
		err:         fmt.Errorf("cache miss"),
	}

	service := NewStatusService(fs, cacheManager)

	fullStatus, err := service.GetFullStatus("en")

	// Should handle cache miss gracefully by providing default cache status
	if err != nil {
		t.Fatalf("Expected no error on cache miss, got: %v", err)
	}

	if fullStatus == nil {
		t.Fatal("Expected FullStatus even on cache miss, got nil")
	}

	// Should have default cache status
	if fullStatus.Cache.CommandCount != 0 {
		t.Errorf("Expected cache CommandCount 0 on cache miss, got %d", fullStatus.Cache.CommandCount)
	}

	if fullStatus.Cache.Language != "en" {
		t.Errorf("Expected cache Language 'en', got %q", fullStatus.Cache.Language)
	}
}

// RED PHASE: Test with custom install counter
func TestStatusService_GetFullStatus_WithCustomInstallCounter(t *testing.T) {
	fs := afero.NewMemMapFs()

	// Mock components
	cacheStatus := &CacheStatus{
		CommandCount: 10,
		LastUpdated:  time.Date(2024, 12, 1, 10, 0, 0, 0, time.UTC),
		Language:     "fr",
	}
	cacheManager := &MockCacheManager{
		cacheStatus: cacheStatus,
		err:         nil,
	}

	installedStatus := &InstalledStatus{
		Count:           5,
		TotalCount:      5,
		ProjectCount:    3,
		PersonalCount:   2,
		PrimaryLocation: "project",
	}
	installCounter := &MockInstallCounter{
		installedStatus: installedStatus,
		err:             nil,
	}

	service := NewStatusServiceWithInstallCounter(fs, cacheManager, installCounter)

	fullStatus, err := service.GetFullStatus("fr")

	if err != nil {
		t.Fatalf("Expected no error, got: %v", err)
	}

	// Verify installed status uses custom counter
	if fullStatus.Installed.TotalCount != 5 {
		t.Errorf("Expected installed TotalCount 5, got %d", fullStatus.Installed.TotalCount)
	}

	if fullStatus.Installed.ProjectCount != 3 {
		t.Errorf("Expected installed ProjectCount 3, got %d", fullStatus.Installed.ProjectCount)
	}

	if fullStatus.Installed.PersonalCount != 2 {
		t.Errorf("Expected installed PersonalCount 2, got %d", fullStatus.Installed.PersonalCount)
	}

	if fullStatus.Installed.PrimaryLocation != "project" {
		t.Errorf("Expected installed PrimaryLocation 'project', got %q", fullStatus.Installed.PrimaryLocation)
	}
}

// RED PHASE: Test install counter error handling
func TestStatusService_GetFullStatus_InstallCounterError(t *testing.T) {
	fs := afero.NewMemMapFs()

	cacheStatus := &CacheStatus{
		CommandCount: 10,
		LastUpdated:  time.Date(2024, 12, 1, 10, 0, 0, 0, time.UTC),
		Language:     "en",
	}
	cacheManager := &MockCacheManager{
		cacheStatus: cacheStatus,
		err:         nil,
	}

	// Mock install counter that returns an error
	installCounter := &MockInstallCounter{
		installedStatus: nil,
		err:             errors.New("filesystem access denied"),
	}

	service := NewStatusServiceWithInstallCounter(fs, cacheManager, installCounter)

	_, err := service.GetFullStatus("en")

	if err == nil {
		t.Fatal("Expected error due to install counter failure, got nil")
	}

	// Should propagate the install counter error
	if err.Error() != "filesystem access denied" {
		t.Errorf("Expected install counter error, got: %v", err)
	}
}

// RED PHASE: Test language parameter propagation
func TestStatusService_GetFullStatus_LanguagePropagation(t *testing.T) {
	fs := afero.NewMemMapFs()

	testLanguages := []string{"en", "fr", "es", "de"}

	for _, lang := range testLanguages {
		t.Run("language_"+lang, func(t *testing.T) {
			cacheStatus := &CacheStatus{
				CommandCount: 15,
				LastUpdated:  time.Date(2024, 12, 1, 10, 0, 0, 0, time.UTC),
				Language:     lang,
			}
			cacheManager := &MockCacheManager{
				cacheStatus: cacheStatus,
				err:         nil,
			}

			service := NewStatusService(fs, cacheManager)

			fullStatus, err := service.GetFullStatus(lang)

			if err != nil {
				t.Fatalf("Expected no error for language %s, got: %v", lang, err)
			}

			// Verify language is propagated correctly
			if fullStatus.Cache.Language != lang {
				t.Errorf("Expected cache Language %s, got %q", lang, fullStatus.Cache.Language)
			}
		})
	}
}

// RED PHASE: Test FullStatus validation
func TestStatusService_GetFullStatus_ValidationPassing(t *testing.T) {
	fs := afero.NewMemMapFs()

	cacheStatus := &CacheStatus{
		CommandCount: 20,
		LastUpdated:  time.Date(2024, 12, 1, 10, 0, 0, 0, time.UTC),
		Language:     "en",
	}
	cacheManager := &MockCacheManager{
		cacheStatus: cacheStatus,
		err:         nil,
	}

	service := NewStatusService(fs, cacheManager)

	fullStatus, err := service.GetFullStatus("en")

	if err != nil {
		t.Fatalf("Expected no error, got: %v", err)
	}

	// Verify the returned status passes validation
	if err := fullStatus.Validate(); err != nil {
		t.Errorf("Expected FullStatus to pass validation, got error: %v", err)
	}
}
