// Package interfaces provides shared interfaces for dependency injection across commands.
package interfaces

import (
	"github.com/claude-code-commands/claude-cmd/internal/cache"
	"github.com/claude-code-commands/claude-cmd/internal/status"
)

// CacheManagerInterface defines the interface for cache operations.
// This interface is shared across all commands that need cache functionality.
type CacheManagerInterface interface {
	// GetOrUpdateManifest retrieves the command manifest from cache or fetches it from the repository
	GetOrUpdateManifest(lang string) (*cache.Manifest, error)

	// GetCacheStatus provides information about the current cache state including
	// command count, last update time, and language
	GetCacheStatus(lang string) (*status.CacheStatus, error)
}
