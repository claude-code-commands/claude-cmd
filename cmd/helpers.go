package cmd

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/claude-code-commands/claude-cmd/internal/cache"
	"github.com/claude-code-commands/claude-cmd/internal/interfaces"
	"github.com/spf13/afero"
)

// setupCacheManager creates a default cache manager if none is provided.
// This helper centralizes the cache manager initialization logic that was
// duplicated across multiple commands (add, list, update, root).
//
// Parameters:
//   - fs: Filesystem abstraction for testing and production use
//   - cm: Existing cache manager (can be nil)
//
// Returns:
//   - interfaces.CacheManagerInterface: The provided cache manager or a new default one
//   - error: Any error encountered during cache directory setup
func setupCacheManager(fs afero.Fs, cm interfaces.CacheManagerInterface) (interfaces.CacheManagerInterface, error) {
	if cm != nil {
		return cm, nil
	}

	cacheDir, err := os.UserCacheDir()
	if err != nil {
		return nil, fmt.Errorf("failed to get user cache directory: %w", err)
	}
	cacheDir = filepath.Join(cacheDir, "claude-cmd")
	return cache.NewCacheManager(fs, cacheDir), nil
}
