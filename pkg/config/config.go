// Package config provides centralized configuration constants, defaults, and
// configuration file management for the claude-cmd CLI tool.
//
// The package supports a hierarchical configuration system with the following precedence:
//  1. Project-level configuration: .claude/config.yaml
//  2. Global configuration: ~/.config/claude-cmd/config.yaml
//  3. Built-in defaults
//
// Configuration files use YAML format and support the following fields:
//   - language: ISO 639-1 language code for command retrieval
//   - repository_url: HTTPS URL pointing to the command repository
//
// Example configuration file:
//
//	language: en
//	repository_url: https://raw.githubusercontent.com/claude-code-commands/commands/main
package config

import (
	"fmt"
	"net/url"
	"os"
	"path/filepath"
	"regexp"

	"github.com/spf13/afero"
	"gopkg.in/yaml.v3"
)

// userConfigDir allows mocking os.UserConfigDir in tests.
var userConfigDir = os.UserConfigDir

// langCodeRegex is a compiled regular expression for validating language codes.
// Valid language codes are 2-3 lowercase letters only (ISO 639-1/639-2).
var langCodeRegex = regexp.MustCompile("^[a-z]{2,3}$")

const (
	// DefaultLanguage is the fallback language code used when no language
	// is detected through environment variables, configuration files, or
	// system locale settings. This follows ISO 639-1 language codes.
	DefaultLanguage = "en"

	// DefaultRepositoryURL is the base URL for the command repository.
	// This points to the GitHub raw content URL for the main branch of
	// the claude-code-commands/commands repository where command definitions
	// and manifests are stored.
	DefaultRepositoryURL = "https://raw.githubusercontent.com/claude-code-commands/commands/main"
)

// Config represents the configuration structure for claude-cmd.
// It supports both project-level (.claude/config.yaml) and global
// (~/.config/claude-cmd/config.yaml) configuration files.
type Config struct {
	// Language specifies the preferred language for command retrieval.
	// Should be a valid ISO 639-1 language code (e.g., "en", "fr", "es").
	Language string `yaml:"language"`

	// RepositoryURL specifies the base URL for the command repository.
	// This should be a valid HTTPS URL pointing to the command source.
	RepositoryURL string `yaml:"repository_url"`

	// FirstUse tracks whether this is the first time the tool is being used.
	// Used for displaying informational messages on initial use.
	FirstUse bool `yaml:"first_use"`
}

// Load reads a configuration file from the filesystem and unmarshals it into the Config struct.
// It uses the provided afero.Fs for filesystem operations to support testing with mock filesystems.
//
// The function performs the following operations:
//  1. Reads the file from the specified path
//  2. Unmarshals the YAML content into the Config struct
//  3. Validates the configuration values
//
// Returns an error if:
//   - The file cannot be read
//   - The YAML content is malformed
//   - The configuration values fail validation
func (c *Config) Load(fs afero.Fs, configPath string) error {
	data, err := afero.ReadFile(fs, configPath)
	if err != nil {
		return fmt.Errorf("failed to read config file %q: %w", configPath, err)
	}

	if err := yaml.Unmarshal(data, c); err != nil {
		return fmt.Errorf("failed to parse config file %q: %w", configPath, err)
	}

	if err := c.Validate(); err != nil {
		return fmt.Errorf("invalid configuration in %q: %w", configPath, err)
	}

	return nil
}

// Save marshals the Config struct to YAML and writes it to the filesystem.
// It creates the parent directory if it doesn't exist.
func (c *Config) Save(fs afero.Fs, configPath string) error {
	// Validate config before saving
	if err := c.Validate(); err != nil {
		return err
	}

	// Create parent directory if it doesn't exist (cross-platform)
	dir := filepath.Dir(configPath)
	if err := fs.MkdirAll(dir, 0755); err != nil {
		return fmt.Errorf("failed to create directory %q: %w", dir, err)
	}

	data, err := yaml.Marshal(c)
	if err != nil {
		return fmt.Errorf("failed to marshal config to YAML: %w", err)
	}

	return afero.WriteFile(fs, configPath, data, 0644)
}

// merge merges configuration values from another Config into this one.
// Only non-empty values from the other Config will override values in this Config.
// This enables proper precedence handling where higher-priority configs
// override lower-priority ones while preserving existing values for empty fields.
func (c *Config) merge(other Config) {
	if other.Language != "" {
		c.Language = other.Language
	}
	if other.RepositoryURL != "" {
		c.RepositoryURL = other.RepositoryURL
	}
	// Note: FirstUse is not merged as it should only be set by the first-use detection logic
}

// Validate checks if the configuration values are valid.
// It performs basic validation on language codes and repository URLs.
func (c *Config) Validate() error {
	// Allow empty values (they will use defaults)
	if c.Language == "" && c.RepositoryURL == "" {
		return nil
	}

	// Validate language code if provided
	if c.Language != "" {
		if !isValidLanguageCode(c.Language) {
			return fmt.Errorf("invalid language code %q: must be 2-3 lowercase letters", c.Language)
		}
	}

	// Validate repository URL if provided
	if c.RepositoryURL != "" {
		parsedURL, err := url.Parse(c.RepositoryURL)
		if err != nil {
			return fmt.Errorf("invalid repository URL %q: %w", c.RepositoryURL, err)
		}
		if parsedURL.Scheme != "https" {
			return fmt.Errorf("repository URL %q must use HTTPS", c.RepositoryURL)
		}
	}

	return nil
}

// isValidLanguageCode checks if a string is a valid language code format.
// Valid language codes are 2-3 lowercase letters only (ISO 639-1/639-2).
func isValidLanguageCode(code string) bool {
	return langCodeRegex.MatchString(code)
}

// FindConfigFiles locates project and global configuration files with XDG-compliant path resolution.
// It returns the paths to project-level (.claude/config.yaml) and global configuration files if they exist.
// The project-level path is relative to the filesystem's current working directory.
// The global-level path is an absolute path using XDG Base Directory Specification.
//
// Returns:
//   - projectPath: path to project-level config file, empty string if not found
//   - globalPath: path to global config file, empty string if not found
//   - error: any error encountered during file system operations
func FindConfigFiles(fs afero.Fs) (projectPath, globalPath string, err error) {
	// Check for project-level configuration
	projectConfigPath := filepath.Join(".claude", "config.yaml")
	if exists, err := afero.Exists(fs, projectConfigPath); err != nil {
		return "", "", fmt.Errorf("failed to check project config existence: %w", err)
	} else if exists {
		projectPath = projectConfigPath
	}

	// Check for global configuration using XDG-compliant paths
	configDir, err := userConfigDir()
	if err != nil {
		// If we can't get the user config dir, we can't find the global config.
		// This is not a fatal error; we proceed without a global config path.
		return projectPath, "", nil
	}

	globalConfigPath := filepath.Join(configDir, "claude-cmd", "config.yaml")
	if exists, err := afero.Exists(fs, globalConfigPath); err != nil {
		return projectPath, "", fmt.Errorf("failed to check global config at %q: %w", globalConfigPath, err)
	} else if exists {
		globalPath = globalConfigPath
	}

	return projectPath, globalPath, nil
}

// LoadConfig loads and merges configuration from project and global config files with fallback to defaults.
// It follows the precedence order: project config overrides global config, both override built-in defaults.
// If a field in a higher-precedence config (e.g., project) is empty, the value
// from a lower-precedence source (e.g., global or default) is retained.
// If no config files exist, built-in defaults are used.
//
// Returns:
//   - Config: merged configuration with all fields populated
//   - error: any error encountered during loading or validation
func LoadConfig(fs afero.Fs) (Config, error) {
	// Start with built-in defaults
	config := Config{
		Language:      DefaultLanguage,
		RepositoryURL: DefaultRepositoryURL,
	}

	// Find configuration files
	projectPath, globalPath, err := FindConfigFiles(fs)
	if err != nil {
		return Config{}, fmt.Errorf("failed to locate config files: %w", err)
	}

	// Load and merge global config first (lower precedence)
	if globalPath != "" {
		var globalConfig Config
		if err := globalConfig.Load(fs, globalPath); err != nil {
			return Config{}, fmt.Errorf("failed to load global config: %w", err)
		}
		config.merge(globalConfig)
	}

	// Load and merge project config last (higher precedence)
	if projectPath != "" {
		var projectConfig Config
		if err := projectConfig.Load(fs, projectPath); err != nil {
			return Config{}, fmt.Errorf("failed to load project config: %w", err)
		}
		config.merge(projectConfig)
	}

	// Validate the final merged configuration
	if err := config.Validate(); err != nil {
		return Config{}, fmt.Errorf("merged configuration is invalid: %w", err)
	}

	return config, nil
}
