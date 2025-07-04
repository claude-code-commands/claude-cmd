package cache

import (
	"errors"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strings"

	"github.com/claude-code-commands/claude-cmd/pkg/httpclient"
	"github.com/spf13/afero"
)

// Cache errors
var (
	// ErrCacheMiss indicates the requested cache file was not found
	ErrCacheMiss = errors.New("cache miss")
	// ErrCacheCorrupted indicates the cache file exists but is corrupted
	ErrCacheCorrupted = errors.New("cache corrupted")
	// ErrNetworkUnavailable indicates network requests failed
	ErrNetworkUnavailable = errors.New("network unavailable")
)

// IsErrCacheMiss checks if an error is a cache miss.
func IsErrCacheMiss(err error) bool {
	return errors.Is(err, ErrCacheMiss)
}

// IsErrCacheCorrupted checks if an error indicates cache corruption.
func IsErrCacheCorrupted(err error) bool {
	return errors.Is(err, ErrCacheCorrupted)
}

// IsErrNetworkUnavailable checks if an error indicates network unavailability.
func IsErrNetworkUnavailable(err error) bool {
	return errors.Is(err, ErrNetworkUnavailable)
}

// CacheManager handles manifest caching operations with filesystem abstraction.
type CacheManager struct {
	fs         afero.Fs
	cacheDir   string
	httpClient httpclient.HTTPClient
	baseURL    string
}

// ManagerOption configures the cache manager.
type ManagerOption func(*CacheManager)

// WithHTTPClient configures the cache manager with a custom HTTP client.
func WithHTTPClient(client httpclient.HTTPClient) ManagerOption {
	return func(m *CacheManager) {
		m.httpClient = client
	}
}

// WithBaseURL configures the cache manager with a base URL for fetching manifests.
func WithBaseURL(baseURL string) ManagerOption {
	return func(m *CacheManager) {
		m.baseURL = baseURL
	}
}

// NewCacheManager creates a new cache manager with the specified filesystem and cache directory.
// The cache directory will be created if it doesn't exist.
func NewCacheManager(fs afero.Fs, cacheDir string, opts ...ManagerOption) *CacheManager {
	// Clean and validate cache directory path
	cacheDir = filepath.Clean(cacheDir)
	if strings.TrimSpace(cacheDir) == "" {
		cacheDir = filepath.Join(os.TempDir(), "claude-cmd")
	}

	m := &CacheManager{
		fs:         fs,
		cacheDir:   cacheDir,
		httpClient: httpclient.NewClient(),
		baseURL:    "https://raw.githubusercontent.com/claude-code-commands/commands/main/pages",
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

// langCodeRegex validates language codes according to ISO 639-1/639-2 standards.
// Accepts 2-3 lowercase letters only (e.g., "en", "fr", "deu").
var langCodeRegex = regexp.MustCompile("^[a-z]{2,3}$")

// manifestPathWithLanguage returns the full path to the language-specific manifest file.
// It constructs paths following the cache structure: {cacheDir}/pages/{lang}/index.json
// This enables multiple language caches to coexist independently.
//
// Parameters:
//   - lang: Language code (assumed to be pre-validated and normalized)
//
// Returns the complete file path for the language-specific manifest.
func (c *CacheManager) manifestPathWithLanguage(lang string) string {
	return filepath.Join(c.cacheDir, "pages", lang, "index.json")
}

// ensureCacheDirWithLanguage creates the language-specific cache directory structure.
// This function creates the entire directory hierarchy: {cacheDir}/pages/{lang}/
// with appropriate permissions for cache operations.
//
// Parameters:
//   - lang: Language code (assumed to be pre-validated and normalized)
//
// Returns an error if directory creation fails.
func (c *CacheManager) ensureCacheDirWithLanguage(lang string) error {
	langDir := filepath.Join(c.cacheDir, "pages", lang)
	if err := c.fs.MkdirAll(langDir, 0755); err != nil {
		return fmt.Errorf("failed to create language cache directory %q: %w", langDir, err)
	}
	return nil
}

// validateLanguageCode validates language code format and content.
// This function ensures language codes conform to ISO 639-1/639-2 standards
// and provides clear error messages for invalid inputs.
//
// Validation criteria:
//   - Must not be empty or whitespace-only
//   - Must be 2-3 lowercase letters only
//   - Follows ISO 639-1 (2 chars) or ISO 639-2 (3 chars) format
//
// Parameters:
//   - lang: The language code to validate
//
// Returns an error with specific validation failure details.
func validateLanguageCode(lang string) error {
	if strings.TrimSpace(lang) == "" {
		return fmt.Errorf("language code cannot be empty")
	}

	normalizedLang := normalizeLanguageCode(lang)
	if !langCodeRegex.MatchString(normalizedLang) {
		return fmt.Errorf("invalid language code %q: must be 2-3 lowercase letters (ISO 639-1/639-2)", lang)
	}

	return nil
}

// normalizeLanguageCode normalizes a language code to lowercase and trims whitespace.
// This function centralizes the language code normalization logic used throughout
// the cache manager for consistent handling.
//
// Parameters:
//   - lang: The language code to normalize
//
// Returns the normalized language code (lowercase, trimmed).
func normalizeLanguageCode(lang string) string {
	return strings.ToLower(strings.TrimSpace(lang))
}

// ReadManifestWithLanguage reads and parses the manifest from language-specific cache.
// This function provides language-aware cache access using the directory structure:
// {cacheDir}/pages/{lang}/index.json
//
// The language code is validated and normalized before use. Supported language codes
// follow ISO 639-1/639-2 standards (2-3 lowercase letters).
//
// Parameters:
//   - lang: Language code (e.g., "en", "fr", "deu"). Will be validated and normalized.
//
// Returns:
//   - *Manifest: Parsed and validated manifest data
//   - error: ErrCacheMiss if cache file doesn't exist, ErrCacheCorrupted if file
//     exists but can't be parsed, or validation error for invalid language codes
//
// Example:
//
//	manifest, err := cache.ReadManifestWithLanguage("en")
//	if IsErrCacheMiss(err) {
//	    // Handle cache miss - fetch from network
//	}
func (c *CacheManager) ReadManifestWithLanguage(lang string) (*Manifest, error) {
	if err := validateLanguageCode(lang); err != nil {
		return nil, fmt.Errorf("language validation failed: %w", err)
	}

	normalizedLang := normalizeLanguageCode(lang)
	manifestPath := c.manifestPathWithLanguage(normalizedLang)

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

// WriteManifestWithLanguage writes the manifest to language-specific cache.
// This function stores manifest data using the language-aware directory structure:
// {cacheDir}/pages/{lang}/index.json
//
// The function performs comprehensive validation of both the manifest content and
// language code before writing. It automatically creates the necessary directory
// structure if it doesn't exist.
//
// Parameters:
//   - manifest: The manifest to write (must not be nil and must pass validation)
//   - lang: Language code (e.g., "en", "fr", "deu"). Will be validated and normalized.
//
// Returns:
//   - error: Validation error for nil/invalid manifest, language validation error,
//     or filesystem error during directory creation or file writing
//
// Example:
//
//	err := cache.WriteManifestWithLanguage(manifest, "en")
//	if err != nil {
//	    // Handle write error - check permissions, disk space, etc.
//	}
func (c *CacheManager) WriteManifestWithLanguage(manifest *Manifest, lang string) error {
	if manifest == nil {
		return fmt.Errorf("manifest cannot be nil")
	}

	if err := validateLanguageCode(lang); err != nil {
		return fmt.Errorf("language validation failed: %w", err)
	}

	// Validate manifest before writing
	if err := manifest.Validate(); err != nil {
		return fmt.Errorf("invalid manifest: %w", err)
	}

	normalizedLang := normalizeLanguageCode(lang)

	// Ensure language-specific cache directory exists
	if err := c.ensureCacheDirWithLanguage(normalizedLang); err != nil {
		return fmt.Errorf("failed to create cache directory: %w", err)
	}

	// Marshal manifest to JSON
	data, err := manifest.ToJSON()
	if err != nil {
		return fmt.Errorf("failed to marshal manifest: %w", err)
	}

	// Write to language-specific cache file
	manifestPath := c.manifestPathWithLanguage(normalizedLang)
	if err := afero.WriteFile(c.fs, manifestPath, data, 0644); err != nil {
		return fmt.Errorf("failed to write manifest to cache: %w", err)
	}

	return nil
}

// FetchManifest fetches the manifest from the remote repository for the specified language.
// This function performs a network request to retrieve the latest manifest data from
// the configured repository URL using the language-aware URL structure:
// {baseURL}/{lang}/index.json
//
// The function provides comprehensive error handling for various failure scenarios:
// network connectivity issues, HTTP errors, malformed responses, and validation failures.
//
// Parameters:
//   - lang: Language code (e.g., "en", "fr", "deu"). Will be validated and normalized.
//
// Returns:
//   - *Manifest: Successfully fetched and validated manifest data
//   - error: Language validation error, ErrNetworkUnavailable for network issues,
//     specific HTTP error messages for 404/5xx responses, or parsing errors for
//     malformed manifest data
//
// Example:
//
//	manifest, err := cache.FetchManifest("en")
//	if IsErrNetworkUnavailable(err) {
//	    // Handle offline scenario - fallback to cache
//	} else if strings.Contains(err.Error(), "manifest not found") {
//	    // Handle unsupported language
//	}
func (c *CacheManager) FetchManifest(lang string) (*Manifest, error) {
	if err := validateLanguageCode(lang); err != nil {
		return nil, fmt.Errorf("language validation failed: %w", err)
	}

	normalizedLang := normalizeLanguageCode(lang)
	manifestURL := fmt.Sprintf("%s/%s/index.json", c.baseURL, normalizedLang)

	resp, err := c.httpClient.Get(manifestURL)
	if err != nil {
		return nil, fmt.Errorf("%w: failed to connect to repository: %v", ErrNetworkUnavailable, err)
	}
	defer func() {
		if closeErr := resp.Body.Close(); closeErr != nil {
			// In production, this would be logged
			_ = closeErr
		}
	}()

	if resp.StatusCode != http.StatusOK {
		switch resp.StatusCode {
		case http.StatusNotFound:
			return nil, fmt.Errorf("manifest not found for language %q: repository may not support this language", lang)
		case http.StatusTooManyRequests:
			return nil, fmt.Errorf("rate limited by repository server: please try again later")
		case http.StatusInternalServerError, http.StatusBadGateway, http.StatusServiceUnavailable:
			return nil, fmt.Errorf("repository server error (HTTP %d): please try again later", resp.StatusCode)
		default:
			return nil, fmt.Errorf("HTTP %d: failed to fetch manifest from repository", resp.StatusCode)
		}
	}

	data, err := httpclient.ReadResponseBody(resp)
	if err != nil {
		return nil, fmt.Errorf("failed to read response from repository: %w", err)
	}

	if len(data) == 0 {
		return nil, fmt.Errorf("received empty response from repository")
	}

	manifest, err := ParseManifest(data)
	if err != nil {
		return nil, fmt.Errorf("repository returned invalid manifest data: %w", err)
	}

	return manifest, nil
}

// GetOrUpdateManifest retrieves the manifest using a cache-first strategy with automatic fallback.
// This method implements intelligent manifest retrieval that optimizes for both performance and reliability:
//
// 1. Cache Hit: Returns cached manifest immediately (fastest path)
// 2. Cache Miss: Fetches from network and caches result for future use
// 3. Network Failure + Cache Miss: Returns offline error with actionable message
// 4. Cache Corruption: Returns error and suggests cache clearing
//
// The method automatically handles caching of network-fetched manifests to improve
// subsequent performance, with graceful degradation if cache writes fail.
//
// Parameters:
//   - lang: Language code (e.g., "en", "fr", "deu"). Will be validated and normalized.
//
// Returns:
//   - *Manifest: Successfully retrieved manifest data (from cache or network)
//   - error: Language validation error, offline error when network unavailable and no cache,
//     or specific errors for cache corruption or network failures
//
// Example usage:
//
//	manifest, err := cache.GetOrUpdateManifest("en")
//	if err != nil {
//	    if strings.Contains(err.Error(), "offline and no cached manifest") {
//	        // Handle offline scenario - suggest update when online
//	        return fmt.Errorf("please run 'claude-cmd update' when connected to the internet")
//	    }
//	    return err
//	}
//	// Use manifest...
func (c *CacheManager) GetOrUpdateManifest(lang string) (*Manifest, error) {
	if err := validateLanguageCode(lang); err != nil {
		return nil, fmt.Errorf("language validation failed: %w", err)
	}

	normalizedLang := normalizeLanguageCode(lang)

	// Try cache first (optimal path - no network required)
	manifest, err := c.ReadManifestWithLanguage(normalizedLang)
	if err == nil {
		return manifest, nil
	}

	// Handle cache miss - attempt network fetch
	if IsErrCacheMiss(err) {
		networkManifest, networkErr := c.FetchManifest(normalizedLang)
		if networkErr != nil {
			// Network failed and no cache available - provide actionable error
			if IsErrNetworkUnavailable(networkErr) {
				return nil, fmt.Errorf("offline and no cached manifest available for language %q: please connect to the internet to download command data", lang)
			}
			// Other network errors (404, 5xx, etc.) - pass through with context
			return nil, fmt.Errorf("failed to retrieve manifest for language %q: %w", lang, networkErr)
		}

		// Successfully fetched from network - cache it for future performance
		// Cache write failure is non-fatal since we have the manifest data
		if cacheErr := c.WriteManifestWithLanguage(networkManifest, normalizedLang); cacheErr != nil {
			// In production, this would be logged as a warning:
			// log.Warnf("Failed to cache manifest for language %q: %v", lang, cacheErr)
			_ = cacheErr
		}

		return networkManifest, nil
	}

	// Cache read failed for reasons other than cache miss (corruption, permissions, etc.)
	if IsErrCacheCorrupted(err) {
		return nil, fmt.Errorf("cached manifest for language %q is corrupted: please run 'claude-cmd update --force' to refresh", lang)
	}

	// Other cache errors - pass through with context
	return nil, fmt.Errorf("failed to read cached manifest for language %q: %w", lang, err)
}
