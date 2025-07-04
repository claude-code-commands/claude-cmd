// Package command provides shared utilities and base functionality for CLI commands.
// This package centralizes common operations like cache manager initialization,
// error handling patterns, and manifest retrieval to eliminate code duplication
// across command implementations.
package command

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/claude-code-commands/claude-cmd/internal/cache"
	"github.com/claude-code-commands/claude-cmd/internal/interfaces"
	"github.com/spf13/afero"
)

// BaseConfig holds common configuration for all commands
type BaseConfig struct {
	CacheManager interfaces.CacheManagerInterface
	FileSystem   afero.Fs
}

// SetupCacheManager creates and configures a cache manager if none is provided.
// This centralizes the cache manager initialization logic that was duplicated
// across search, list, and add commands.
//
// Parameters:
//   - fs: Filesystem abstraction for cache operations
//   - existingManager: Optional existing cache manager (for testing)
//
// Returns the configured cache manager or an error if setup fails.
func SetupCacheManager(fs afero.Fs, existingManager interfaces.CacheManagerInterface) (interfaces.CacheManagerInterface, error) {
	if existingManager != nil {
		return existingManager, nil
	}

	cacheDir, err := os.UserCacheDir()
	if err != nil {
		return nil, fmt.Errorf("failed to get user cache directory: %w", err)
	}

	cacheDir = filepath.Join(cacheDir, "claude-cmd")
	return cache.NewCacheManager(fs, cacheDir), nil
}

// GetManifestWithErrorHandling retrieves the manifest using standardized error handling.
// This centralizes the error handling patterns that were duplicated across commands.
//
// Parameters:
//   - cacheManager: The cache manager to use for manifest retrieval
//   - lang: Language code for the manifest
//
// Returns the manifest or a user-friendly error message.
func GetManifestWithErrorHandling(cacheManager interfaces.CacheManagerInterface, lang string) (*cache.Manifest, error) {
	manifest, err := cacheManager.GetOrUpdateManifest(lang)
	if err != nil {
		// Handle different error types with user-friendly messages
		if cache.IsErrNetworkUnavailable(err) {
			return nil, fmt.Errorf("unable to retrieve commands: network unavailable. Please check your internet connection")
		}
		if strings.Contains(err.Error(), "offline and no cached manifest") {
			return nil, fmt.Errorf("no cached commands available. Please run 'claude-cmd update' when connected to the internet")
		}
		return nil, fmt.Errorf("failed to retrieve commands: %w", err)
	}

	return manifest, nil
}

// CommonCommandSetup performs the standard setup operations for commands that need cache access.
// This function combines cache manager setup, language detection, and manifest retrieval
// with consistent error handling.
//
// Parameters:
//   - config: Base configuration with filesystem and optional cache manager
//   - getCurrentLanguage: Function to get the current language preference
//
// Returns the manifest and language, or an error if setup fails.
func CommonCommandSetup(config *BaseConfig, getCurrentLanguage func(afero.Fs) string) (*cache.Manifest, string, error) {
	// Set up cache manager
	cacheManager, err := SetupCacheManager(config.FileSystem, config.CacheManager)
	if err != nil {
		return nil, "", err
	}

	// Get current language preference
	lang := getCurrentLanguage(config.FileSystem)

	// Get manifest with standardized error handling
	manifest, err := GetManifestWithErrorHandling(cacheManager, lang)
	if err != nil {
		return nil, "", err
	}

	return manifest, lang, nil
}
