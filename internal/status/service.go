// Package status provides functionality for aggregating and reporting comprehensive
// status information about the claude-cmd CLI tool, including version, cache state,
// and installed command information.
package status

import (
	"errors"
	"fmt"
	"time"

	"github.com/claude-code-commands/claude-cmd/pkg/config"
	"github.com/spf13/afero"
)

// CacheManagerInterface defines the interface for cache operations needed by StatusService
type CacheManagerInterface interface {
	GetCacheStatus(lang string) (*CacheStatus, error)
}

// InstallCounterInterface defines the interface for install counting needed by StatusService
type InstallCounterInterface interface {
	GetInstalledStatus(lang string) (*InstalledStatus, error)
}

// StatusService aggregates status information from multiple sources to provide
// comprehensive status reporting for the claude-cmd CLI tool.
type StatusService struct {
	fs             afero.Fs
	cacheManager   CacheManagerInterface
	installCounter InstallCounterInterface
}

// NewStatusService creates a new StatusService with default InstallCounter.
// This is the primary constructor for production use that automatically
// configures the install counter with standard directory detection.
//
// Parameters:
//   - fs: Filesystem abstraction for testing and production use
//   - cacheManager: Cache manager interface for retrieving cache status
//
// Returns:
//   - *StatusService: Configured status service instance
//
// Example:
//
//	cacheManager := cache.NewCacheManager(fs, cacheDir)
//	service := NewStatusService(fs, cacheManager)
//	status, err := service.GetFullStatus("en")
func NewStatusService(fs afero.Fs, cacheManager CacheManagerInterface) *StatusService {
	if fs == nil {
		panic("filesystem cannot be nil")
	}
	if cacheManager == nil {
		panic("cache manager cannot be nil")
	}

	installCounter := NewInstallCounter(fs)
	return &StatusService{
		fs:             fs,
		cacheManager:   cacheManager,
		installCounter: installCounter,
	}
}

// NewStatusServiceWithInstallCounter creates a StatusService with custom install counter.
// This constructor is primarily used for testing scenarios where you need to provide
// a mock install counter with specific behavior.
//
// Parameters:
//   - fs: Filesystem abstraction for testing and production use
//   - cacheManager: Cache manager interface for retrieving cache status
//   - installCounter: Custom install counter interface for dependency injection
//
// Returns:
//   - *StatusService: Configured status service instance with custom install counter
//
// Example:
//
//	mockInstallCounter := &MockInstallCounter{...}
//	service := NewStatusServiceWithInstallCounter(fs, cacheManager, mockInstallCounter)
//	status, err := service.GetFullStatus("en")
func NewStatusServiceWithInstallCounter(fs afero.Fs, cacheManager CacheManagerInterface, installCounter InstallCounterInterface) *StatusService {
	if fs == nil {
		panic("filesystem cannot be nil")
	}
	if cacheManager == nil {
		panic("cache manager cannot be nil")
	}
	if installCounter == nil {
		panic("install counter cannot be nil")
	}

	return &StatusService{
		fs:             fs,
		cacheManager:   cacheManager,
		installCounter: installCounter,
	}
}

// GetFullStatus aggregates all status information from cache and install sources.
// This method combines version information, cache status, and installed command status
// into a unified FullStatus structure for comprehensive status reporting.
//
// The method handles cache misses gracefully by providing default cache status
// with zero command count, allowing the status dashboard to function even when
// no cache is available.
//
// Parameters:
//   - language: Language code for status retrieval (e.g., "en", "fr", "es")
//
// Returns:
//   - *FullStatus: Aggregated status information with version, cache, and install data
//   - error: Any error encountered during status retrieval (except cache misses which are handled gracefully)
//
// Example:
//
//	status, err := service.GetFullStatus("en")
//	if err != nil {
//	    return fmt.Errorf("failed to get status: %w", err)
//	}
//	fmt.Printf("Version: %s, Commands in cache: %d, Commands installed: %d",
//	    status.Version, status.Cache.CommandCount, status.Installed.TotalCount)
func (s *StatusService) GetFullStatus(language string) (*FullStatus, error) {
	// Validate input parameters
	if language == "" {
		return nil, fmt.Errorf("language cannot be empty")
	}
	// Get version information
	version := config.GetVersion()

	// Get cache status
	cacheStatus, err := s.getCacheStatus(language)
	if err != nil {
		return nil, err
	}

	// Get installed status
	installedStatus, err := s.installCounter.GetInstalledStatus(language)
	if err != nil {
		return nil, err
	}

	// Create full status
	fullStatus := &FullStatus{
		Version:   version,
		Cache:     *cacheStatus,
		Installed: *installedStatus,
	}

	return fullStatus, nil
}

// getCacheStatus handles cache status retrieval with graceful cache miss handling
func (s *StatusService) getCacheStatus(language string) (*CacheStatus, error) {
	cacheStatus, err := s.cacheManager.GetCacheStatus(language)
	if err != nil {
		// Check if it's a cache miss - handle gracefully
		if isCacheMiss(err) {
			// Return default cache status for cache miss
			return &CacheStatus{
				CommandCount: 0,
				LastUpdated:  time.Time{}, // Zero time for no cache
				Language:     language,
			}, nil
		}

		// Other errors should be propagated
		return nil, err
	}

	return cacheStatus, nil
}

// Define cache miss error locally to avoid import cycle
var ErrCacheMiss = errors.New("cache miss")

// isCacheMiss checks if the error represents a cache miss using proper error checking
func isCacheMiss(err error) bool {
	return errors.Is(err, ErrCacheMiss)
}
