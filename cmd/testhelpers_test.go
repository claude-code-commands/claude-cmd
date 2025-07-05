package cmd

import (
	"github.com/claude-code-commands/claude-cmd/internal/cache"
	"github.com/claude-code-commands/claude-cmd/internal/status"
)

// MockCacheManager implements interfaces.CacheManagerInterface for testing
type MockCacheManager struct {
	manifest *cache.Manifest
	err      error
}

func (m *MockCacheManager) GetOrUpdateManifest(lang string) (*cache.Manifest, error) {
	return m.manifest, m.err
}

func (m *MockCacheManager) GetCacheStatus(lang string) (*status.CacheStatus, error) {
	if m.err != nil {
		return nil, m.err
	}
	if m.manifest == nil {
		return nil, cache.ErrCacheMiss
	}
	return &status.CacheStatus{
		CommandCount: len(m.manifest.Commands),
		LastUpdated:  m.manifest.Updated,
		Language:     lang,
	}, nil
}
