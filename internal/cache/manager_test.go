package cache

import (
	"path/filepath"
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