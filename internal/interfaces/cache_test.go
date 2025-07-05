package interfaces

import (
	"testing"
	"time"

	"github.com/claude-code-commands/claude-cmd/internal/cache"
	"github.com/claude-code-commands/claude-cmd/internal/status"
)

// MockCacheManager implements CacheManagerInterface for testing
type MockCacheManager struct {
	ManifestFunc    func(lang string) (*cache.Manifest, error)
	CacheStatusFunc func(lang string) (*status.CacheStatus, error)
}

func (m *MockCacheManager) GetOrUpdateManifest(lang string) (*cache.Manifest, error) {
	if m.ManifestFunc != nil {
		return m.ManifestFunc(lang)
	}
	return &cache.Manifest{}, nil
}

func (m *MockCacheManager) GetCacheStatus(lang string) (*status.CacheStatus, error) {
	if m.CacheStatusFunc != nil {
		return m.CacheStatusFunc(lang)
	}
	return &status.CacheStatus{
		CommandCount: 10,
		LastUpdated:  time.Now(),
		Language:     lang,
	}, nil
}

func TestCacheManagerInterface_GetOrUpdateManifest(t *testing.T) {
	// Test that existing interface method still works
	mock := &MockCacheManager{
		ManifestFunc: func(lang string) (*cache.Manifest, error) {
			return &cache.Manifest{
				Version:  "1.0.0",
				Commands: []cache.Command{},
			}, nil
		},
	}

	var cacheManager CacheManagerInterface = mock
	manifest, err := cacheManager.GetOrUpdateManifest("en")
	if err != nil {
		t.Fatalf("GetOrUpdateManifest() error = %v", err)
	}
	if manifest.Version != "1.0.0" {
		t.Errorf("GetOrUpdateManifest() version = %q, expected %q", manifest.Version, "1.0.0")
	}
}

func TestCacheManagerInterface_GetCacheStatus(t *testing.T) {
	// Test that new interface method works
	expectedStatus := &status.CacheStatus{
		CommandCount: 15,
		LastUpdated:  time.Date(2024, 1, 1, 12, 0, 0, 0, time.UTC),
		Language:     "fr",
	}

	mock := &MockCacheManager{
		CacheStatusFunc: func(lang string) (*status.CacheStatus, error) {
			if lang != "fr" {
				t.Errorf("GetCacheStatus() called with lang = %q, expected %q", lang, "fr")
			}
			return expectedStatus, nil
		},
	}

	var cacheManager CacheManagerInterface = mock
	status, err := cacheManager.GetCacheStatus("fr")
	if err != nil {
		t.Fatalf("GetCacheStatus() error = %v", err)
	}
	if status.CommandCount != expectedStatus.CommandCount {
		t.Errorf("GetCacheStatus() CommandCount = %d, expected %d", status.CommandCount, expectedStatus.CommandCount)
	}
	if status.Language != expectedStatus.Language {
		t.Errorf("GetCacheStatus() Language = %q, expected %q", status.Language, expectedStatus.Language)
	}
	if !status.LastUpdated.Equal(expectedStatus.LastUpdated) {
		t.Errorf("GetCacheStatus() LastUpdated = %v, expected %v", status.LastUpdated, expectedStatus.LastUpdated)
	}
}

func TestCacheManagerInterface_Completeness(t *testing.T) {
	// Test that interface has all expected methods
	// This test verifies that both old and new methods exist
	mock := &MockCacheManager{}
	var cacheManager CacheManagerInterface = mock

	// Test that we can call both methods (compilation test)
	_, _ = cacheManager.GetOrUpdateManifest("en")
	_, _ = cacheManager.GetCacheStatus("en")
}

func TestCacheManagerInterface_BackwardCompatibility(t *testing.T) {
	// Test that existing code using the interface still works
	// This simulates how existing commands use the interface
	mock := &MockCacheManager{
		ManifestFunc: func(lang string) (*cache.Manifest, error) {
			return &cache.Manifest{Version: "test"}, nil
		},
	}

	// Simulate existing usage pattern
	var cacheManager CacheManagerInterface = mock
	manifest, err := cacheManager.GetOrUpdateManifest("en")
	if err != nil {
		t.Fatalf("Backward compatibility test failed: %v", err)
	}
	if manifest.Version != "test" {
		t.Errorf("Backward compatibility test failed: version = %q", manifest.Version)
	}
}
