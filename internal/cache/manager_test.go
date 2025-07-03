package cache

import (
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"

	"github.com/spf13/afero"
)

func TestReadManifest_Exists(t *testing.T) {
	manager, fs := setupMemCache("/cache")

	// Create and write test manifest
	testData := testManifest()
	manifestPath := filepath.Join("/cache", "manifest.json")
	err := writeTestManifest(fs, manifestPath, testData)
	if err != nil {
		t.Fatalf("Failed to write test manifest: %v", err)
	}

	// Read manifest
	manifest, err := manager.ReadManifest()
	if err != nil {
		t.Fatalf("ReadManifest() failed: %v", err)
	}

	// Verify manifest content
	if manifest.Version != testData.Version {
		t.Errorf("Expected version '%s', got '%s'", testData.Version, manifest.Version)
	}

	if len(manifest.Commands) != len(testData.Commands) {
		t.Errorf("Expected %d commands, got %d", len(testData.Commands), len(manifest.Commands))
	}
}

func TestReadManifest_NotFound(t *testing.T) {
	manager, _ := setupMemCache("/cache")

	// Try to read non-existent manifest
	_, err := manager.ReadManifest()
	if err == nil {
		t.Fatal("ReadManifest() should have failed with missing file")
	}

	// Should return ErrCacheMiss
	if !IsErrCacheMiss(err) {
		t.Errorf("Expected ErrCacheMiss, got: %v", err)
	}
}

func TestReadManifest_Corrupted(t *testing.T) {
	manager, fs := setupMemCache("/cache")

	// Write invalid JSON to cache
	manifestPath := filepath.Join("/cache", "manifest.json")
	err := afero.WriteFile(fs, manifestPath, []byte(`{"invalid": json}`), 0644)
	if err != nil {
		t.Fatalf("Failed to write corrupted manifest: %v", err)
	}

	// Try to read corrupted manifest
	_, err = manager.ReadManifest()
	if err == nil {
		t.Fatal("ReadManifest() should have failed with corrupted file")
	}

	// Should return ErrCacheCorrupted
	if !IsErrCacheCorrupted(err) {
		t.Errorf("Expected ErrCacheCorrupted, got: %v", err)
	}
}

func TestWriteManifest_Success(t *testing.T) {
	manager, fs := setupMemCache("/cache")

	// Create test manifest
	testData := testManifest(withVersion("2.0.0"))

	// Write manifest
	err := manager.WriteManifest(testData)
	if err != nil {
		t.Fatalf("WriteManifest() failed: %v", err)
	}

	// Verify file was written
	manifestPath := filepath.Join("/cache", "manifest.json")
	exists, err := afero.Exists(fs, manifestPath)
	if err != nil {
		t.Fatalf("Failed to check if manifest exists: %v", err)
	}
	if !exists {
		t.Fatal("Manifest file was not created")
	}

	// Read back and verify
	readBack, err := manager.ReadManifest()
	if err != nil {
		t.Fatalf("Failed to read back manifest: %v", err)
	}

	if readBack.Version != testData.Version {
		t.Errorf("Expected version '%s', got '%s'", testData.Version, readBack.Version)
	}
}

func TestWriteManifest_InvalidManifest(t *testing.T) {
	manager, _ := setupMemCache("/cache")

	// Try to write nil manifest
	err := manager.WriteManifest(nil)
	if err == nil {
		t.Fatal("WriteManifest() should have failed with nil manifest")
	}

	// Try to write invalid manifest
	invalidManifest := testManifest(withVersion("")) // missing version
	err = manager.WriteManifest(invalidManifest)
	if err == nil {
		t.Fatal("WriteManifest() should have failed with invalid manifest")
	}
}

// Test language-aware cache operations
func TestWriteManifestWithLanguage_Success(t *testing.T) {
	manager, fs := setupMemCache("/cache")

	// Create test manifest
	testData := testManifest(withVersion("2.0.0"))

	// Write manifest for English
	err := manager.WriteManifestWithLanguage(testData, "en")
	if err != nil {
		t.Fatalf("WriteManifestWithLanguage() failed: %v", err)
	}

	// Verify file was written to language-specific path
	expectedPath := filepath.Join("/cache", "pages", "en", "index.json")
	exists, err := afero.Exists(fs, expectedPath)
	if err != nil {
		t.Fatalf("Failed to check if manifest exists: %v", err)
	}
	if !exists {
		t.Fatal("Manifest file was not created at language-specific path")
	}

	// Write manifest for French
	err = manager.WriteManifestWithLanguage(testData, "fr")
	if err != nil {
		t.Fatalf("WriteManifestWithLanguage() failed for fr: %v", err)
	}

	// Verify French file was written
	frenchPath := filepath.Join("/cache", "pages", "fr", "index.json")
	exists, err = afero.Exists(fs, frenchPath)
	if err != nil {
		t.Fatalf("Failed to check if French manifest exists: %v", err)
	}
	if !exists {
		t.Fatal("French manifest file was not created")
	}
}

func TestReadManifestWithLanguage_Success(t *testing.T) {
	manager, fs := setupMemCache("/cache")

	// Create and write test manifest for English
	testData := testManifest(withVersion("2.1.0"))
	manifestPath := filepath.Join("/cache", "pages", "en", "index.json")

	// Create directory and write file
	err := fs.MkdirAll(filepath.Dir(manifestPath), 0755)
	if err != nil {
		t.Fatalf("Failed to create directory: %v", err)
	}

	err = writeTestManifest(fs, manifestPath, testData)
	if err != nil {
		t.Fatalf("Failed to write test manifest: %v", err)
	}

	// Read manifest with language
	manifest, err := manager.ReadManifestWithLanguage("en")
	if err != nil {
		t.Fatalf("ReadManifestWithLanguage() failed: %v", err)
	}

	// Verify manifest content
	if manifest.Version != testData.Version {
		t.Errorf("Expected version '%s', got '%s'", testData.Version, manifest.Version)
	}
}

func TestReadManifestWithLanguage_NotFound(t *testing.T) {
	manager, _ := setupMemCache("/cache")

	// Try to read non-existent manifest for Spanish
	_, err := manager.ReadManifestWithLanguage("es")
	if err == nil {
		t.Fatal("ReadManifestWithLanguage() should have failed with missing file")
	}

	// Should return ErrCacheMiss
	if !IsErrCacheMiss(err) {
		t.Errorf("Expected ErrCacheMiss, got: %v", err)
	}
}

func TestWriteManifestWithLanguage_InvalidLanguage(t *testing.T) {
	manager, _ := setupMemCache("/cache")
	testData := testManifest()

	// Try to write with empty language
	err := manager.WriteManifestWithLanguage(testData, "")
	if err == nil {
		t.Fatal("WriteManifestWithLanguage() should have failed with empty language")
	}

	// Try to write with invalid language code
	err = manager.WriteManifestWithLanguage(testData, "invalid-lang")
	if err == nil {
		t.Fatal("WriteManifestWithLanguage() should have failed with invalid language")
	}
}

// Test network operations
func TestFetchManifest_Success(t *testing.T) {
	// Create test manifest JSON
	testData := testManifest(withVersion("2.0.0"))
	manifestJSON, err := testData.ToJSON()
	if err != nil {
		t.Fatalf("Failed to marshal test manifest: %v", err)
	}

	// Create test server
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !strings.HasSuffix(r.URL.Path, "/en/index.json") {
			http.NotFound(w, r)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		w.Write(manifestJSON)
	}))
	defer server.Close()

	// Create cache manager with test server
	manager, _ := setupMemCache("/cache")
	manager.baseURL = server.URL

	// Fetch manifest from test server
	manifest, err := manager.FetchManifest("en")
	if err != nil {
		t.Fatalf("FetchManifest() failed: %v", err)
	}

	// Verify manifest content
	if manifest.Version != testData.Version {
		t.Errorf("Expected version '%s', got '%s'", testData.Version, manifest.Version)
	}
}

func TestFetchManifest_NotFound(t *testing.T) {
	// Create test server that returns 404
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.NotFound(w, r)
	}))
	defer server.Close()

	// Create cache manager with test server
	manager, _ := setupMemCache("/cache")
	manager.baseURL = server.URL

	// Try to fetch manifest - should get 404 error
	_, err := manager.FetchManifest("en")
	if err == nil {
		t.Fatal("FetchManifest() should have failed with 404")
	}

	// Should contain "manifest not found" in error message
	if !strings.Contains(err.Error(), "manifest not found") {
		t.Errorf("Expected 'manifest not found' error, got: %v", err)
	}
}

func TestFetchManifest_ServerError(t *testing.T) {
	// Create test server that returns 500
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, "Internal Server Error", http.StatusInternalServerError)
	}))
	defer server.Close()

	// Create cache manager with test server
	manager, _ := setupMemCache("/cache")
	manager.baseURL = server.URL

	// Try to fetch manifest - should get 500 error
	_, err := manager.FetchManifest("en")
	if err == nil {
		t.Fatal("FetchManifest() should have failed with 500")
	}

	// Should contain "HTTP 500" in error message
	if !strings.Contains(err.Error(), "HTTP 500") {
		t.Errorf("Expected 'HTTP 500' error, got: %v", err)
	}
}

func TestFetchManifest_InvalidLanguage(t *testing.T) {
	manager, _ := setupMemCache("/cache")

	// Try to fetch with invalid language - should get validation error
	_, err := manager.FetchManifest("")
	if err == nil {
		t.Fatal("FetchManifest() should have failed with validation error")
	}

	// Should contain "language validation failed" in error message
	if !strings.Contains(err.Error(), "language validation failed") {
		t.Errorf("Expected 'language validation failed' error, got: %v", err)
	}
}

// Test cache orchestration
func TestGetOrUpdateManifest_CacheHit(t *testing.T) {
	manager, fs := setupMemCache("/cache")

	// Create test manifest and write to cache
	testData := testManifest(withVersion("1.5.0"))
	manifestPath := filepath.Join("/cache", "pages", "en", "index.json")

	// Create directory and write cached file
	err := fs.MkdirAll(filepath.Dir(manifestPath), 0755)
	if err != nil {
		t.Fatalf("Failed to create directory: %v", err)
	}

	err = writeTestManifest(fs, manifestPath, testData)
	if err != nil {
		t.Fatalf("Failed to write test manifest: %v", err)
	}

	// Get manifest from cache
	manifest, err := manager.GetOrUpdateManifest("en")
	if err != nil {
		t.Fatalf("GetOrUpdateManifest() failed: %v", err)
	}

	// Verify manifest content
	if manifest.Version != testData.Version {
		t.Errorf("Expected version '%s', got '%s'", testData.Version, manifest.Version)
	}
}

func TestGetOrUpdateManifest_CacheMiss(t *testing.T) {
	// Create test manifest JSON
	testData := testManifest(withVersion("1.8.0"))
	manifestJSON, err := testData.ToJSON()
	if err != nil {
		t.Fatalf("Failed to marshal test manifest: %v", err)
	}

	// Create test server
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !strings.HasSuffix(r.URL.Path, "/en/index.json") {
			http.NotFound(w, r)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		w.Write(manifestJSON)
	}))
	defer server.Close()

	// Create cache manager with test server (empty cache)
	manager, _ := setupMemCache("/cache")
	manager.baseURL = server.URL

	// Get manifest - should fetch from network and cache it
	manifest, err := manager.GetOrUpdateManifest("en")
	if err != nil {
		t.Fatalf("GetOrUpdateManifest() failed: %v", err)
	}

	// Verify manifest content
	if manifest.Version != testData.Version {
		t.Errorf("Expected version '%s', got '%s'", testData.Version, manifest.Version)
	}

	// Verify it was cached
	cachedManifest, err := manager.ReadManifestWithLanguage("en")
	if err != nil {
		t.Fatalf("Failed to read cached manifest: %v", err)
	}
	if cachedManifest.Version != testData.Version {
		t.Errorf("Cached manifest version mismatch: expected '%s', got '%s'", testData.Version, cachedManifest.Version)
	}
}

func TestGetOrUpdateManifest_OfflineNoCacheError(t *testing.T) {
	// Create test server that's immediately closed (simulates offline)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// This won't be reached
	}))
	server.Close()

	// Create cache manager with closed server (empty cache)
	manager, _ := setupMemCache("/cache")
	manager.baseURL = server.URL

	// Try to get manifest - should fail with offline error
	_, err := manager.GetOrUpdateManifest("en")
	if err == nil {
		t.Fatal("GetOrUpdateManifest() should have failed when offline with no cache")
	}

	// Should contain "offline and no cached manifest" in error message
	if !strings.Contains(err.Error(), "offline and no cached manifest") {
		t.Errorf("Expected 'offline and no cached manifest' error, got: %v", err)
	}
}

func TestGetOrUpdateManifest_InvalidLanguage(t *testing.T) {
	manager, _ := setupMemCache("/cache")

	// Try to get with invalid language - should get validation error
	_, err := manager.GetOrUpdateManifest("")
	if err == nil {
		t.Fatal("GetOrUpdateManifest() should have failed with validation error")
	}

	// Should contain "language validation failed" in error message
	if !strings.Contains(err.Error(), "language validation failed") {
		t.Errorf("Expected 'language validation failed' error, got: %v", err)
	}
}
