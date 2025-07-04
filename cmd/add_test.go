package cmd

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/claude-code-commands/claude-cmd/internal/cache"
	"github.com/spf13/afero"
)

// MockHTTPClient implements HTTPClientInterface for testing
type MockHTTPClient struct {
	response *http.Response
	err      error
}

func (m *MockHTTPClient) Get(url string) (*http.Response, error) {
	return m.response, m.err
}

// Helper function to create test manifest for add command
func createAddTestManifest() *cache.Manifest {
	return &cache.Manifest{
		Version: "1.0.0",
		Updated: time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC),
		Commands: []cache.Command{
			{
				Name:        "debug-issue",
				Description: "Debug a specific issue in your codebase",
				File:        "debug-issue.md",
			},
			{
				Name:        "write-tests",
				Description: "Generate comprehensive tests for code",
				File:        "write-tests.md",
			},
		},
	}
}

func TestAddCommand_ValidCommand(t *testing.T) {
	// GREEN Phase: Test with mock server for successful command installation
	fs := afero.NewMemMapFs()

	// Create test server
	testContent := `---
description: Debug a specific issue in your codebase
---

# Debug Issue

This command helps you debug issues in your codebase.
`

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.Contains(r.URL.Path, "/pages/en/debug-issue.md") {
			w.WriteHeader(http.StatusOK)
			w.Write([]byte(testContent))
		} else {
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	defer server.Close()

	// Create mock cache manager
	mockCache := &MockCacheManager{
		manifest: createAddTestManifest(),
		err:      nil,
	}

	// Create add command with test server
	cmd := newAddCommand(fs, WithAddCacheManager(mockCache), WithAddHTTPClient(&http.Client{}), WithAddBaseURL(server.URL))

	// Capture output
	var output bytes.Buffer
	cmd.SetOut(&output)
	cmd.SetErr(&output)

	// Execute command with valid command name
	cmd.SetArgs([]string{"debug-issue"})
	err := cmd.Execute()

	// GREEN Phase: Should succeed with mock server
	if err != nil {
		t.Fatalf("Expected add command to succeed with valid command, got error: %v", err)
	}

	// Should show successful installation message
	outputStr := output.String()
	if !strings.Contains(outputStr, "Successfully installed") {
		t.Errorf("Expected success message, got: %s", outputStr)
	}
	if !strings.Contains(outputStr, "debug-issue") {
		t.Errorf("Expected command name in output, got: %s", outputStr)
	}
}

func TestAddCommand_CommandNotFound(t *testing.T) {
	// RED Phase: This test should fail because add command doesn't exist yet
	fs := afero.NewMemMapFs()

	// Create mock cache manager
	mockCache := &MockCacheManager{
		manifest: createAddTestManifest(),
		err:      nil,
	}

	// Create add command with injected dependencies
	cmd := newAddCommand(fs, WithAddCacheManager(mockCache))

	// Capture output
	var output bytes.Buffer
	cmd.SetOut(&output)
	cmd.SetErr(&output)

	// Execute command with invalid command name
	cmd.SetArgs([]string{"nonexistent-command"})
	err := cmd.Execute()

	// RED Phase: Should fail with command not found error
	if err == nil {
		t.Fatal("Expected add command to fail with nonexistent command")
	}

	// Should show command not found error
	if !strings.Contains(err.Error(), "not found") {
		t.Errorf("Expected 'not found' error, got: %v", err)
	}
	if !strings.Contains(err.Error(), "nonexistent-command") {
		t.Errorf("Expected command name in error, got: %v", err)
	}
}

func TestAddCommand_DownloadContent(t *testing.T) {
	// RED Phase: This test should fail because download functionality doesn't exist yet
	fs := afero.NewMemMapFs()

	// Create test server
	testContent := `---
description: Debug a specific issue in your codebase
---

# Debug Issue

This command helps you debug issues in your codebase.
`

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.Contains(r.URL.Path, "/pages/en/debug-issue.md") {
			w.WriteHeader(http.StatusOK)
			w.Write([]byte(testContent))
		} else {
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	defer server.Close()

	// Create mock cache manager
	mockCache := &MockCacheManager{
		manifest: createAddTestManifest(),
		err:      nil,
	}

	// Create add command with test server
	cmd := newAddCommand(fs, WithAddCacheManager(mockCache), WithAddHTTPClient(&http.Client{}), WithAddBaseURL(server.URL))

	// Capture output
	var output bytes.Buffer
	cmd.SetOut(&output)
	cmd.SetErr(&output)

	// Execute command
	cmd.SetArgs([]string{"debug-issue"})
	err := cmd.Execute()

	// RED Phase: Should fail because download functionality doesn't exist yet
	if err != nil {
		t.Fatalf("Expected add command to succeed with download, got error: %v", err)
	}

	// Should download and install the command
	outputStr := output.String()
	if !strings.Contains(outputStr, "Successfully installed") {
		t.Errorf("Expected success message, got: %s", outputStr)
	}
}

func TestAddCommand_InstallToPersonal(t *testing.T) {
	// RED Phase: This test should fail because installation logic doesn't exist yet
	fs := afero.NewMemMapFs()

	// Create mock cache manager
	mockCache := &MockCacheManager{
		manifest: createAddTestManifest(),
		err:      nil,
	}

	// Create add command with mock server
	testContent := `---
description: Debug a specific issue in your codebase
---

# Debug Issue

This command helps you debug issues.
`

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(testContent))
	}))
	defer server.Close()

	cmd := newAddCommand(fs, WithAddCacheManager(mockCache), WithAddHTTPClient(&http.Client{}), WithAddBaseURL(server.URL))

	// Capture output
	var output bytes.Buffer
	cmd.SetOut(&output)
	cmd.SetErr(&output)

	// Execute command
	cmd.SetArgs([]string{"debug-issue"})
	err := cmd.Execute()

	// RED Phase: Should fail because installation doesn't exist yet
	if err != nil {
		t.Fatalf("Expected add command to succeed, got error: %v", err)
	}

	// Should install to personal directory and show path
	outputStr := output.String()
	if !strings.Contains(outputStr, ".claude/commands") {
		t.Errorf("Expected installation path in output, got: %s", outputStr)
	}
}

func TestAddCommand_NetworkError(t *testing.T) {
	// RED Phase: This test should fail because error handling doesn't exist yet
	fs := afero.NewMemMapFs()

	// Create mock cache manager
	mockCache := &MockCacheManager{
		manifest: createAddTestManifest(),
		err:      nil,
	}

	// Create server that returns error
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
		w.Write([]byte("Server Error"))
	}))
	defer server.Close()

	cmd := newAddCommand(fs, WithAddCacheManager(mockCache), WithAddHTTPClient(&http.Client{}), WithAddBaseURL(server.URL))

	// Capture output
	var output bytes.Buffer
	cmd.SetOut(&output)
	cmd.SetErr(&output)

	// Execute command
	cmd.SetArgs([]string{"debug-issue"})
	err := cmd.Execute()

	// RED Phase: Should fail with network error
	if err == nil {
		t.Fatal("Expected add command to fail with network error")
	}

	// Should show network error message
	if !strings.Contains(err.Error(), "download") || !strings.Contains(err.Error(), "failed") {
		t.Errorf("Expected download failure error, got: %v", err)
	}
}
