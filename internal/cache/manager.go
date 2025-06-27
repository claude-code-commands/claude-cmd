package cache

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/spf13/afero"
)

// Cache errors
var (
	// ErrCacheMiss indicates the requested cache file was not found
	ErrCacheMiss = errors.New("cache miss")
	// ErrCacheCorrupted indicates the cache file exists but is corrupted
	ErrCacheCorrupted = errors.New("cache corrupted")
)

// IsErrCacheMiss checks if an error is a cache miss.
func IsErrCacheMiss(err error) bool {
	return errors.Is(err, ErrCacheMiss)
}

// IsErrCacheCorrupted checks if an error indicates cache corruption.
func IsErrCacheCorrupted(err error) bool {
	return errors.Is(err, ErrCacheCorrupted)
}

// CacheManager handles manifest caching operations with filesystem abstraction.
type CacheManager struct {
	fs       afero.Fs
	cacheDir string
}

// ManagerOption configures the cache manager.
type ManagerOption func(*CacheManager)

// NewCacheManager creates a new cache manager with the specified filesystem and cache directory.
// The cache directory will be created if it doesn't exist.
func NewCacheManager(fs afero.Fs, cacheDir string, opts ...ManagerOption) *CacheManager {
	// Clean and validate cache directory path
	cacheDir = filepath.Clean(cacheDir)
	if strings.TrimSpace(cacheDir) == "" {
		cacheDir = filepath.Join(os.TempDir(), "claude-cmd")
	}
	
	m := &CacheManager{
		fs:       fs,
		cacheDir: cacheDir,
	}
	
	for _, opt := range opts {
		opt(m)
	}
	
	return m
}

// manifestPath returns the full path to the manifest file.
func (c *CacheManager) manifestPath() string {
	return filepath.Join(c.cacheDir, "manifest.json")
}

// ensureCacheDir creates the cache directory if it doesn't exist.
func (c *CacheManager) ensureCacheDir() error {
	return c.fs.MkdirAll(c.cacheDir, 0755)
}

// ReadManifest reads and parses the manifest from cache.
// Returns ErrCacheMiss if the cache file doesn't exist.
// Returns ErrCacheCorrupted if the cache file exists but can't be parsed.
func (c *CacheManager) ReadManifest() (*Manifest, error) {
	manifestPath := c.manifestPath()
	
	data, err := afero.ReadFile(c.fs, manifestPath)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, ErrCacheMiss
		}
		return nil, fmt.Errorf("failed to read manifest from cache: %w", err)
	}
	
	manifest, err := ParseManifest(data)
	if err != nil {
		// Cache file exists but is corrupted
		return nil, fmt.Errorf("%w: %v", ErrCacheCorrupted, err)
	}
	
	return manifest, nil
}

// WriteManifest writes the manifest to cache.
// Creates the cache directory if it doesn't exist.
func (c *CacheManager) WriteManifest(manifest *Manifest) error {
	if manifest == nil {
		return fmt.Errorf("manifest cannot be nil")
	}
	
	// Validate manifest before writing
	if err := manifest.Validate(); err != nil {
		return fmt.Errorf("invalid manifest: %w", err)
	}
	
	// Ensure cache directory exists
	if err := c.ensureCacheDir(); err != nil {
		return fmt.Errorf("failed to create cache directory: %w", err)
	}
	
	// Marshal manifest to JSON
	data, err := manifest.ToJSON()
	if err != nil {
		return fmt.Errorf("failed to marshal manifest: %w", err)
	}
	
	// Write to cache file
	manifestPath := c.manifestPath()
	if err := afero.WriteFile(c.fs, manifestPath, data, 0644); err != nil {
		return fmt.Errorf("failed to write manifest to cache: %w", err)
	}
	
	return nil
}