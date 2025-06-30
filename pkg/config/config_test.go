package config

import (
	"strings"
	"testing"
)

// TestDefaultLanguage verifies that the default language constant
// is properly set to a valid ISO 639-1 language code.
func TestDefaultLanguage(t *testing.T) {
	if DefaultLanguage == "" {
		t.Error("DefaultLanguage should not be empty")
	}
	if DefaultLanguage != "en" {
		t.Errorf("DefaultLanguage should be 'en', got %q", DefaultLanguage)
	}
	// Ensure it's a valid two-letter language code
	if len(DefaultLanguage) != 2 {
		t.Errorf("DefaultLanguage should be a 2-character ISO 639-1 code, got %q with length %d", 
			DefaultLanguage, len(DefaultLanguage))
	}
}

// TestDefaultRepositoryURL verifies that the repository URL constant
// points to a valid GitHub raw content URL.
func TestDefaultRepositoryURL(t *testing.T) {
	if DefaultRepositoryURL == "" {
		t.Error("DefaultRepositoryURL should not be empty")
	}
	
	// Should be a GitHub raw content URL
	expectedPrefix := "https://raw.githubusercontent.com/"
	if !strings.HasPrefix(DefaultRepositoryURL, expectedPrefix) {
		t.Errorf("DefaultRepositoryURL should start with %q, got %q", expectedPrefix, DefaultRepositoryURL)
	}
	
	// Should point to the commands repository
	if !strings.Contains(DefaultRepositoryURL, "claude-code-commands/commands") {
		t.Errorf("DefaultRepositoryURL should reference claude-code-commands/commands repository, got %q", 
			DefaultRepositoryURL)
	}
	
	// Should point to main branch
	if !strings.Contains(DefaultRepositoryURL, "/main") {
		t.Errorf("DefaultRepositoryURL should reference main branch, got %q", DefaultRepositoryURL)
	}
}

// TestConstantsAreExported verifies that all constants are properly exported
// and accessible from other packages.
func TestConstantsAreExported(t *testing.T) {
	// These should compile without errors if constants are properly exported
	_ = DefaultLanguage
	_ = DefaultRepositoryURL
}