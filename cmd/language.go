// Package cmd provides the CLI command implementations for claude-cmd.
// This file implements language management commands for configuring
// the preferred language for command retrieval.
package cmd

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/spf13/afero"
	"github.com/spf13/cobra"

	"github.com/claude-code-commands/cli/pkg/config"
)

// userConfigDir is a variable that can be mocked in tests to override
// the default user configuration directory behavior for testing purposes.
var userConfigDir = os.UserConfigDir

// supportedLanguages defines the list of supported language codes
// using ISO 639-1 standard language codes. This list determines which
// languages can be set via the 'language set' command.
var supportedLanguages = []string{"en", "fr", "es", "de", "pt", "zh", "ja", "ko"}

// languageNames maps language codes to their human-readable display names
// for use in the 'language list' command output. All supported languages
// must have corresponding entries in this map.
var languageNames = map[string]string{
	"en": "English",
	"fr": "French",
	"es": "Spanish",
	"de": "German",
	"pt": "Portuguese",
	"zh": "Chinese",
	"ja": "Japanese",
	"ko": "Korean",
}

// newLanguageCommand creates the language command with filesystem abstraction.
// This command provides subcommands for managing language settings including
// listing available languages and setting the preferred language for command retrieval.
//
// The filesystem parameter allows for dependency injection to support testing
// with mock filesystems while using the real filesystem in production.
//
// Returns a configured cobra.Command with 'list' and 'set' subcommands.
func newLanguageCommand(fs afero.Fs) *cobra.Command {
	languageCmd := &cobra.Command{
		Use:   "language",
		Short: "Manage language settings for claude-cmd",
		Long: `Manage language settings for claude-cmd.

Language settings determine which language-specific command repository
to use for command retrieval. The language can be set at the global level
via configuration files or overridden per-command via CLI flags.

Available subcommands:
  list - Show available languages and current setting
  set  - Update the global language preference`,
	}

	// Add subcommands with filesystem dependency injection
	languageCmd.AddCommand(newLanguageListCommand(fs))
	languageCmd.AddCommand(newLanguageSetCommand(fs))

	return languageCmd
}

// newLanguageListCommand creates the 'language list' subcommand.
// This command displays all supported languages with human-readable names
// and highlights the current language setting from configuration.
//
// The filesystem parameter enables testing with mock filesystems.
//
// Returns a configured cobra.Command for the 'list' subcommand.
func newLanguageListCommand(fs afero.Fs) *cobra.Command {
	return &cobra.Command{
		Use:   "list",
		Short: "List available languages and show current language setting",
		Long: `List available languages and show current language setting.

Displays all supported languages with their human-readable names.
The current language setting (from global configuration) is highlighted
with either "- current" for non-English languages or "- default" for English.

Example:
  claude-cmd language list`,
		RunE: func(cmd *cobra.Command, args []string) error {
			return runLanguageList(fs, cmd)
		},
	}
}

// newLanguageSetCommand creates the 'language set' subcommand.
// This command updates the global configuration file with the specified
// language preference for command retrieval.
//
// The filesystem parameter enables testing with mock filesystems.
//
// Returns a configured cobra.Command for the 'set' subcommand.
func newLanguageSetCommand(fs afero.Fs) *cobra.Command {
	return &cobra.Command{
		Use:   "set <language-code>",
		Short: "Set the preferred language for command retrieval",
		Long: `Set the preferred language for command retrieval.

Updates the global configuration file (~/.config/claude-cmd/config.yaml)
with the specified language preference. The language code must be one of
the supported ISO 639-1 language codes.

Supported languages: en, fr, es, de, pt, zh, ja, ko

Examples:
  claude-cmd language set fr     # Set language to French
  claude-cmd language set en     # Set language to English (default)`,
		Args: cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			return runLanguageSet(fs, cmd, args[0])
		},
	}
}

// runLanguageList executes the language list command.
// It displays all supported languages with their human-readable names
// and marks the current language setting from the global configuration.
//
// The function gracefully handles configuration loading errors by falling
// back to the default language ("en") to ensure the command always succeeds.
//
// Parameters:
//   - fs: Filesystem abstraction for configuration file access
//   - cmd: Cobra command instance for output operations
//
// Returns an error only if output operations fail (highly unlikely).
func runLanguageList(fs afero.Fs, cmd *cobra.Command) error {
	// Get current language from config (gracefully handles errors)
	currentLang := getCurrentLanguage(fs)

	cmd.Println("Available languages:")
	for _, lang := range supportedLanguages {
		name, exists := languageNames[lang]
		if !exists {
			// This should never happen with our hardcoded supported languages,
			// but defensive programming prevents potential panics
			name = "Unknown"
		}

		marker := ""

		// Mark current language appropriately
		if lang == currentLang {
			if lang == "en" {
				marker = " - default"
			} else {
				marker = " - current"
			}
		} else if lang == "en" && currentLang == "en" {
			marker = " - default"
		}

		cmd.Printf("  %s (%s)%s\n", lang, name, marker)
	}

	return nil
}

// runLanguageSet executes the language set command.
// It validates the provided language code, updates the global configuration,
// and provides user feedback on the operation's success.
//
// The function performs comprehensive validation including:
//   - Empty input validation
//   - Language code format validation (ISO 639-1 format)
//   - Support validation against the list of supported languages
//   - Configuration file update with proper error handling
//
// Parameters:
//   - fs: Filesystem abstraction for configuration file operations
//   - cmd: Cobra command instance for user output
//   - langCode: The language code to set (will be normalized to lowercase)
//
// Returns an error if validation fails or configuration update fails.
func runLanguageSet(fs afero.Fs, cmd *cobra.Command, langCode string) error {
	// Validate input - ensure language code is not empty or whitespace-only
	if strings.TrimSpace(langCode) == "" {
		return errors.New("language code cannot be empty")
	}

	// Normalize language code to lowercase for consistent processing
	langCode = strings.ToLower(strings.TrimSpace(langCode))

	// Validate language code format (2-3 lowercase letters per ISO 639-1/639-2)
	if !isValidLanguageFormat(langCode) {
		return fmt.Errorf("invalid language code %q: must be 2-3 lowercase letters", langCode)
	}

	// Validate that the language is supported by this tool
	if !isLanguageSupported(langCode) {
		supportedList := strings.Join(supportedLanguages, ", ")
		return fmt.Errorf("unsupported language code %q. Supported languages: %s", langCode, supportedList)
	}

	// Update global configuration with proper error handling and context
	if err := updateGlobalLanguage(fs, langCode); err != nil {
		return fmt.Errorf("failed to update configuration: %w", err)
	}

	// Provide user feedback on successful operation
	cmd.Printf("Language set to: %s\n", langCode)
	cmd.Println("Configuration saved to global config.")

	return nil
}

// getCurrentLanguage gets the current language from configuration.
// This function implements a graceful fallback strategy that always returns
// a valid language code, ensuring the language list command never fails.
//
// The function attempts to load the global configuration file and extract
// the language setting. If any step fails (missing config dir, missing file,
// invalid config, empty language), it falls back to the default "en".
//
// Parameters:
//   - fs: Filesystem abstraction for configuration file access
//
// Returns the current language code, or "en" as fallback.
func getCurrentLanguage(fs afero.Fs) string {
	// Attempt to get user config directory with graceful error handling
	configDir, err := userConfigDir()
	if err != nil {
		return "en" // fallback to default if config dir unavailable
	}

	globalConfigPath := filepath.Join(configDir, "claude-cmd", "config.yaml")

	// Check if config file exists before attempting to load
	exists, err := afero.Exists(fs, globalConfigPath)
	if err != nil || !exists {
		return "en" // fallback to default if file doesn't exist or can't be checked
	}

	// Attempt to load and parse configuration file
	var cfg config.Config
	if err := cfg.Load(fs, globalConfigPath); err != nil {
		return "en" // fallback to default if config can't be loaded or parsed
	}

	// Ensure language field is not empty
	if cfg.Language == "" {
		return "en" // fallback to default if language not set
	}

	return cfg.Language
}

// isValidLanguageFormat validates language code format according to ISO 639-1/639-2 standards.
// Valid language codes are 2-3 lowercase letters only (e.g., "en", "fr", "deu").
//
// This validation ensures that user input conforms to standard language code
// formats before attempting to use the code for configuration or validation.
//
// Parameters:
//   - lang: The language code to validate
//
// Returns true if the format is valid, false otherwise.
func isValidLanguageFormat(lang string) bool {
	// Check length constraints (ISO 639-1 uses 2 chars, ISO 639-2 uses 3)
	if len(lang) < 2 || len(lang) > 3 {
		return false
	}

	// Ensure all characters are lowercase letters
	for _, char := range lang {
		if char < 'a' || char > 'z' {
			return false
		}
	}

	return true
}

// isLanguageSupported checks if the language code is in the supported languages list.
// This function determines whether the tool can handle the specified language
// by checking against the hardcoded list of supported language codes.
//
// Parameters:
//   - lang: The language code to check for support
//
// Returns true if the language is supported, false otherwise.
func isLanguageSupported(lang string) bool {
	for _, supported := range supportedLanguages {
		if supported == lang {
			return true
		}
	}
	return false
}

// updateGlobalLanguage updates the global configuration file with a new language setting.
// This function handles both creating new configuration files and updating existing ones,
// ensuring that all other configuration values are preserved during the update.
//
// The function implements a robust strategy for configuration management:
//   - Creates the config directory if it doesn't exist
//   - Preserves existing configuration values when updating
//   - Falls back to defaults if existing config is corrupted
//   - Provides detailed error context for troubleshooting
//
// Parameters:
//   - fs: Filesystem abstraction for configuration file operations
//   - langCode: The new language code to set (must be pre-validated)
//
// Returns an error if directory creation, file operations, or config saving fails.
func updateGlobalLanguage(fs afero.Fs, langCode string) error {
	// Get user config directory with proper error context
	configDir, err := userConfigDir()
	if err != nil {
		return fmt.Errorf("failed to get user config directory: %w", err)
	}

	globalConfigPath := filepath.Join(configDir, "claude-cmd", "config.yaml")

	// Load existing configuration or initialize with defaults
	var cfg config.Config

	// Check if configuration file exists before attempting to load
	exists, err := afero.Exists(fs, globalConfigPath)
	if err != nil {
		return fmt.Errorf("failed to check config file existence at %q: %w", globalConfigPath, err)
	}

	if exists {
		// Load existing configuration to preserve other settings
		if err := cfg.Load(fs, globalConfigPath); err != nil {
			// If loading fails (corrupted file), start with defaults but continue
			// This ensures the command succeeds even with corrupted config
			cfg = config.Config{
				Language:      config.DefaultLanguage,
				RepositoryURL: config.DefaultRepositoryURL,
			}
		}
	} else {
		// Initialize new configuration with sensible defaults
		cfg = config.Config{
			Language:      config.DefaultLanguage,
			RepositoryURL: config.DefaultRepositoryURL,
		}
	}

	// Update only the language field, preserving other configuration
	cfg.Language = langCode

	// Save configuration with comprehensive error handling
	if err := cfg.Save(fs, globalConfigPath); err != nil {
		return fmt.Errorf("failed to save configuration to %q: %w", globalConfigPath, err)
	}

	return nil
}
