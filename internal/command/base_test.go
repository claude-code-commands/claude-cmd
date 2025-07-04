package command

import (
	"errors"
	"strings"
	"testing"

	"github.com/claude-code-commands/claude-cmd/internal/cache"
	"github.com/spf13/afero"
)

// MockCacheManager implements interfaces.CacheManagerInterface for testing
type MockCacheManager struct {
	manifest *cache.Manifest
	err      error
}

func (m *MockCacheManager) GetOrUpdateManifest(lang string) (*cache.Manifest, error) {
	return m.manifest, m.err
}

func TestSetupCacheManager_WithExistingManager(t *testing.T) {
	fs := afero.NewMemMapFs()
	existingManager := &MockCacheManager{}

	result, err := SetupCacheManager(fs, existingManager)

	if err != nil {
		t.Fatalf("Expected no error, got: %v", err)
	}
	if result != existingManager {
		t.Error("Expected to return existing manager")
	}
}

func TestSetupCacheManager_CreateNew(t *testing.T) {
	fs := afero.NewMemMapFs()

	result, err := SetupCacheManager(fs, nil)

	if err != nil {
		t.Fatalf("Expected no error, got: %v", err)
	}
	if result == nil {
		t.Error("Expected cache manager to be created")
	}
}

func TestGetManifestWithErrorHandling_Success(t *testing.T) {
	manifest := &cache.Manifest{Version: "1.0.0"}
	mockManager := &MockCacheManager{
		manifest: manifest,
		err:      nil,
	}

	result, err := GetManifestWithErrorHandling(mockManager, "en")

	if err != nil {
		t.Fatalf("Expected no error, got: %v", err)
	}
	if result != manifest {
		t.Error("Expected to return the manifest")
	}
}

func TestGetManifestWithErrorHandling_NetworkError(t *testing.T) {
	mockManager := &MockCacheManager{
		manifest: nil,
		err:      cache.ErrNetworkUnavailable,
	}

	_, err := GetManifestWithErrorHandling(mockManager, "en")

	if err == nil {
		t.Fatal("Expected error")
	}
	if !strings.Contains(err.Error(), "network unavailable") {
		t.Errorf("Expected network error message, got: %v", err)
	}
}

func TestGetManifestWithErrorHandling_OfflineError(t *testing.T) {
	mockManager := &MockCacheManager{
		manifest: nil,
		err:      errors.New("offline and no cached manifest available"),
	}

	_, err := GetManifestWithErrorHandling(mockManager, "en")

	if err == nil {
		t.Fatal("Expected error")
	}
	if !strings.Contains(err.Error(), "no cached commands available") {
		t.Errorf("Expected offline error message, got: %v", err)
	}
}

func TestCommonCommandSetup_Success(t *testing.T) {
	fs := afero.NewMemMapFs()
	manifest := &cache.Manifest{Version: "1.0.0"}
	mockManager := &MockCacheManager{
		manifest: manifest,
		err:      nil,
	}

	config := &BaseConfig{
		CacheManager: mockManager,
		FileSystem:   fs,
	}

	mockGetLanguage := func(afero.Fs) string {
		return "en"
	}

	resultManifest, lang, err := CommonCommandSetup(config, mockGetLanguage)

	if err != nil {
		t.Fatalf("Expected no error, got: %v", err)
	}
	if resultManifest != manifest {
		t.Error("Expected to return the manifest")
	}
	if lang != "en" {
		t.Errorf("Expected language 'en', got: %s", lang)
	}
}
