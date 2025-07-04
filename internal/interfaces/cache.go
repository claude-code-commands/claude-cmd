// Package interfaces provides shared interfaces for dependency injection across commands.
package interfaces

import "github.com/claude-code-commands/claude-cmd/internal/cache"

// CacheManagerInterface defines the interface for cache operations.
// This interface is shared across all commands that need cache functionality.
type CacheManagerInterface interface {
	GetOrUpdateManifest(lang string) (*cache.Manifest, error)
}
