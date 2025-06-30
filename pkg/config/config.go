// Package config provides centralized configuration constants and defaults
// for the claude-cmd CLI tool.
package config

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