// Package cmd provides comprehensive testing for update command implementation.
// This file validates the complete update command functionality including
// force refresh, change detection, and up-to-date handling.
package cmd

import (
	"bytes"
	"errors"
	"strings"
	"testing"
	"time"

	"github.com/claude-code-commands/claude-cmd/internal/cache"
	"github.com/claude-code-commands/claude-cmd/internal/status"
	"github.com/spf13/afero"
)

// MockCacheManagerForUpdate implements CacheManagerInterface for testing update command
type MockCacheManagerForUpdate struct {
	oldManifest        *cache.Manifest
	newManifest        *cache.Manifest
	fetchError         error
	getOrUpdateErr     error
	shouldForceFail    bool
	forceRefreshCalled bool
	callCount          int
}

func (m *MockCacheManagerForUpdate) GetOrUpdateManifest(lang string) (*cache.Manifest, error) {
	m.callCount++

	if m.getOrUpdateErr != nil {
		return nil, m.getOrUpdateErr
	}

	// For force refresh testing, return newManifest if forceRefreshCalled
	if m.forceRefreshCalled && m.newManifest != nil {
		return m.newManifest, nil
	}

	// First call returns old manifest, subsequent calls return new manifest
	// This simulates the behavior where the first call gets cached version
	// and subsequent calls might get updated version
	if m.callCount == 1 && m.oldManifest != nil {
		return m.oldManifest, nil
	}

	return m.newManifest, nil
}

func (m *MockCacheManagerForUpdate) GetCacheStatus(lang string) (*status.CacheStatus, error) {
	return nil, errors.New("not implemented")
}

// FetchManifest simulates fetching the latest manifest from repository
func (m *MockCacheManagerForUpdate) FetchManifest(lang string) (*cache.Manifest, error) {
	if m.fetchError != nil {
		return nil, m.fetchError
	}
	if m.shouldForceFail {
		return nil, errors.New("force fetch failed")
	}
	return m.newManifest, nil
}

// ForceRefresh simulates forcing cache refresh
func (m *MockCacheManagerForUpdate) ForceRefresh(lang string) (*cache.Manifest, error) {
	m.forceRefreshCalled = true
	if m.shouldForceFail {
		return nil, errors.New("force refresh failed")
	}
	if m.fetchError != nil {
		return nil, m.fetchError
	}
	return m.newManifest, nil
}

// RED PHASE: Test basic update command structure
func TestUpdateCommand_Basic_Structure(t *testing.T) {
	fs := afero.NewMemMapFs()

	// This should fail because newUpdateCommand doesn't exist yet
	cmd := newUpdateCommand(fs)

	if cmd == nil {
		t.Fatal("Expected update command to be created, got nil")
	}

	if cmd.Use != "update" {
		t.Errorf("Expected command use to be 'update', got %q", cmd.Use)
	}

	if cmd.Short == "" {
		t.Error("Expected command to have short description")
	}

	if cmd.Long == "" {
		t.Error("Expected command to have long description")
	}
}

// RED PHASE: Test force refresh functionality
func TestUpdateCommand_ForceRefresh(t *testing.T) {
	fs := afero.NewMemMapFs()

	// Create mock with old and new manifests
	oldManifest := &cache.Manifest{
		Version: "1.0.0",
		Updated: time.Date(2024, 11, 1, 10, 0, 0, 0, time.UTC),
		Commands: []cache.Command{
			{Name: "old-cmd", Description: "Old command", File: "old-cmd.md"},
		},
	}

	newManifest := &cache.Manifest{
		Version: "1.1.0",
		Updated: time.Date(2024, 12, 1, 10, 0, 0, 0, time.UTC),
		Commands: []cache.Command{
			{Name: "old-cmd", Description: "Updated old command", File: "old-cmd.md"},
			{Name: "new-cmd", Description: "New command", File: "new-cmd.md"},
		},
	}

	mockCache := &MockCacheManagerForUpdate{
		oldManifest: oldManifest,
		newManifest: newManifest,
	}

	cmd := newUpdateCommandWithOptions(fs, WithUpdateCacheManager(mockCache))

	var output bytes.Buffer
	cmd.SetOut(&output)
	cmd.SetArgs([]string{"--force"})

	err := cmd.Execute()
	if err != nil {
		t.Fatalf("Expected no error executing update command with force, got: %v", err)
	}

	outputStr := output.String()
	if outputStr == "" {
		t.Fatal("Expected non-empty output for update command")
	}

	// Should indicate successful update
	expectedContent := []string{
		"update", "success", "1.1.0",
	}

	for _, expected := range expectedContent {
		if !strings.Contains(strings.ToLower(outputStr), expected) {
			t.Errorf("Expected output to contain %q, got: %s", expected, outputStr)
		}
	}
}

// RED PHASE: Test change detection and display
func TestUpdateCommand_ShowChanges(t *testing.T) {
	fs := afero.NewMemMapFs()

	oldManifest := &cache.Manifest{
		Version: "1.0.0",
		Updated: time.Date(2024, 11, 1, 10, 0, 0, 0, time.UTC),
		Commands: []cache.Command{
			{Name: "keep-cmd", Description: "Command to keep", File: "keep-cmd.md"},
			{Name: "modify-cmd", Description: "Original description", File: "modify-cmd.md"},
			{Name: "remove-cmd", Description: "Command to remove", File: "remove-cmd.md"},
		},
	}

	newManifest := &cache.Manifest{
		Version: "1.1.0",
		Updated: time.Date(2024, 12, 1, 10, 0, 0, 0, time.UTC),
		Commands: []cache.Command{
			{Name: "keep-cmd", Description: "Command to keep", File: "keep-cmd.md"},
			{Name: "modify-cmd", Description: "Updated description", File: "modify-cmd.md"},
			{Name: "add-cmd", Description: "New command", File: "add-cmd.md"},
		},
	}

	mockCache := &MockCacheManagerForUpdate{
		oldManifest: oldManifest,
		newManifest: newManifest,
	}

	cmd := newUpdateCommandWithOptions(fs, WithUpdateCacheManager(mockCache))

	var output bytes.Buffer
	cmd.SetOut(&output)
	cmd.SetArgs([]string{})

	err := cmd.Execute()
	if err != nil {
		t.Fatalf("Expected no error executing update command, got: %v", err)
	}

	outputStr := output.String()

	// Should show changes
	expectedChanges := []string{
		"add-cmd",    // Added
		"remove-cmd", // Removed
		"modify-cmd", // Modified
	}

	for _, expected := range expectedChanges {
		if !strings.Contains(outputStr, expected) {
			t.Errorf("Expected output to contain %q, got: %s", expected, outputStr)
		}
	}

	// Should not show unchanged commands in change summary
	if strings.Contains(outputStr, "keep-cmd") && !strings.Contains(outputStr, "unchanged") {
		t.Errorf("Expected unchanged commands not to be highlighted, got: %s", outputStr)
	}
}

// RED PHASE: Test already up-to-date handling
func TestUpdateCommand_AlreadyCurrent(t *testing.T) {
	fs := afero.NewMemMapFs()

	// Same manifest for both old and new
	manifest := &cache.Manifest{
		Version: "1.0.0",
		Updated: time.Date(2024, 12, 1, 10, 0, 0, 0, time.UTC),
		Commands: []cache.Command{
			{Name: "test-cmd", Description: "Test command", File: "test-cmd.md"},
		},
	}

	mockCache := &MockCacheManagerForUpdate{
		oldManifest: manifest,
		newManifest: manifest,
	}

	cmd := newUpdateCommandWithOptions(fs, WithUpdateCacheManager(mockCache))

	var output bytes.Buffer
	cmd.SetOut(&output)
	cmd.SetArgs([]string{})

	err := cmd.Execute()
	if err != nil {
		t.Fatalf("Expected no error executing update command, got: %v", err)
	}

	outputStr := output.String()

	// Should indicate already up-to-date
	upToDateIndicators := []string{"up-to-date", "current", "already", "latest"}
	hasIndicator := false
	for _, indicator := range upToDateIndicators {
		if strings.Contains(strings.ToLower(outputStr), indicator) {
			hasIndicator = true
			break
		}
	}

	if !hasIndicator {
		t.Errorf("Expected output to indicate up-to-date status, got: %s", outputStr)
	}
}

// RED PHASE: Test error handling
func TestUpdateCommand_ErrorHandling(t *testing.T) {
	fs := afero.NewMemMapFs()

	testCases := []struct {
		name        string
		mockCache   *MockCacheManagerForUpdate
		expectError bool
		errorCheck  func(string) bool
	}{
		{
			name: "network error",
			mockCache: &MockCacheManagerForUpdate{
				getOrUpdateErr: errors.New("network unavailable"),
			},
			expectError: true,
			errorCheck: func(output string) bool {
				return strings.Contains(strings.ToLower(output), "failed")
			},
		},
		{
			name: "force refresh failure",
			mockCache: &MockCacheManagerForUpdate{
				shouldForceFail: true,
			},
			expectError: true,
			errorCheck: func(output string) bool {
				return strings.Contains(strings.ToLower(output), "failed")
			},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			cmd := newUpdateCommandWithOptions(fs, WithUpdateCacheManager(tc.mockCache))

			var output bytes.Buffer
			cmd.SetOut(&output)
			cmd.SetErr(&output)
			cmd.SetArgs([]string{})

			err := cmd.Execute()

			if tc.expectError && err == nil {
				t.Errorf("Expected error for %s, got nil", tc.name)
			}

			if !tc.expectError && err != nil {
				t.Errorf("Expected no error for %s, got: %v", tc.name, err)
			}

			if tc.errorCheck != nil && !tc.errorCheck(output.String()) {
				t.Errorf("Error check failed for %s, output: %s", tc.name, output.String())
			}
		})
	}
}

// RED PHASE: Test update command with language support
func TestUpdateCommand_LanguageSupport(t *testing.T) {
	fs := afero.NewMemMapFs()

	manifest := &cache.Manifest{
		Version: "1.0.0",
		Updated: time.Date(2024, 12, 1, 10, 0, 0, 0, time.UTC),
		Commands: []cache.Command{
			{Name: "test-cmd", Description: "Test command", File: "test-cmd.md"},
		},
	}

	mockCache := &MockCacheManagerForUpdate{
		oldManifest: manifest,
		newManifest: manifest,
	}

	cmd := newUpdateCommandWithOptions(fs, WithUpdateCacheManager(mockCache))

	var output bytes.Buffer
	cmd.SetOut(&output)
	cmd.SetArgs([]string{"--language", "fr"})

	err := cmd.Execute()
	if err != nil {
		t.Fatalf("Expected no error executing update with language flag, got: %v", err)
	}

	// Should process successfully with language parameter
	outputStr := output.String()
	if outputStr == "" {
		t.Fatal("Expected non-empty output for update command with language")
	}
}

// Test update command with invalid language validation
func TestUpdateCommand_InvalidLanguage(t *testing.T) {
	fs := afero.NewMemMapFs()

	manifest := &cache.Manifest{
		Version: "1.0.0",
		Updated: time.Date(2024, 12, 1, 10, 0, 0, 0, time.UTC),
		Commands: []cache.Command{
			{Name: "test-cmd", Description: "Test command", File: "test-cmd.md"},
		},
	}

	mockCache := &MockCacheManagerForUpdate{
		oldManifest: manifest,
		newManifest: manifest,
	}

	cmd := newUpdateCommandWithOptions(fs, WithUpdateCacheManager(mockCache))

	var output bytes.Buffer
	cmd.SetOut(&output)
	cmd.SetErr(&output)
	cmd.SetArgs([]string{"--language", "invalid"})

	err := cmd.Execute()
	if err == nil {
		t.Fatal("Expected error for invalid language, got nil")
	}

	// Should contain error message about unsupported language
	if !strings.Contains(err.Error(), "unsupported language code") {
		t.Errorf("Expected error message about unsupported language, got: %v", err)
	}

	if !strings.Contains(err.Error(), "invalid") {
		t.Errorf("Expected error message to contain invalid language code, got: %v", err)
	}
}
