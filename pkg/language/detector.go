// Package language provides automatic language detection for the claude-cmd CLI tool.
// It implements a layered detection strategy with clear precedence order to determine
// the user's preferred language for command retrieval and display.
package language

import (
	"strings"

	"golang.org/x/text/language"
)

// DetectionContext contains all the language detection sources in precedence order.
// Each field represents a different source of language information, with empty strings
// indicating that the source is not available or not set.
type DetectionContext struct {
	CLIFlag       string // --language flag value (highest precedence)
	EnvVar        string // CLAUDE_CMD_LANG environment variable
	ProjectConfig string // Language from project .claude/config.yaml
	GlobalConfig  string // Language from global ~/.config/claude-cmd/config.yaml
	POSIXLocale   string // POSIX locale from LC_ALL/LC_MESSAGES/LANG (lowest precedence)
}

// Detect determines the language to use based on the detection context,
// following the precedence order: CLI flag → env var → project config → global config → POSIX locale → fallback.
// The function returns a language code (e.g., "en", "fr", "es") that can be used
// to determine which language-specific command repository to access.
//
// The precedence order ensures that explicit user choices (CLI flags) override
// automatic detection, while still providing sensible defaults when no explicit
// choice is made.
func Detect(context DetectionContext) string {
	// 1. CLI flag has highest precedence - user's explicit choice for this command
	if context.CLIFlag != "" {
		return normalizeLanguageCode(context.CLIFlag)
	}
	
	// 2. Environment variable - user's explicit choice for all commands in session
	if context.EnvVar != "" {
		return normalizeLanguageCode(context.EnvVar)
	}
	
	// 3. Project configuration - team/project-specific language setting
	if context.ProjectConfig != "" {
		return normalizeLanguageCode(context.ProjectConfig)
	}
	
	// 4. Global configuration - user's persistent personal preference
	if context.GlobalConfig != "" {
		return normalizeLanguageCode(context.GlobalConfig)
	}
	
	// 5. POSIX locale - system-level language preference
	if context.POSIXLocale != "" {
		if lang := extractLanguageFromLocale(context.POSIXLocale); lang != "" {
			return normalizeLanguageCode(lang)
		}
	}
	
	// 6. Fallback to English when no language source is available
	return "en"
}

// extractLanguageFromLocale extracts the language code from a POSIX locale string
// using the golang.org/x/text/language package for robust parsing.
// 
// Examples:
//   - "en_US.UTF-8" -> "en"
//   - "fr" -> "fr"
//   - "pt_BR" -> "pt"
//   - "zh_CN.GB2312" -> "zh"
//
// The function handles various locale formats and returns an empty string
// for invalid or unparseable locale strings.
func extractLanguageFromLocale(locale string) string {
	if locale == "" {
		return ""
	}
	
	// Use golang.org/x/text/language for robust locale parsing
	tag, err := language.Parse(locale)
	if err != nil {
		// Fallback to basic parsing for non-standard formats
		return extractLanguageBasic(locale)
	}
	
	// Extract the base language from the parsed tag
	base, _ := tag.Base()
	return base.String()
}

// extractLanguageBasic provides basic language extraction as a fallback
// when golang.org/x/text/language parsing fails.
func extractLanguageBasic(locale string) string {
	// Split on underscore to separate language from country
	parts := strings.Split(locale, "_")
	if len(parts) == 0 {
		return ""
	}
	
	// Take the first part as the language code
	lang := strings.ToLower(parts[0])
	
	// Basic validation: language codes should be 2-3 lowercase letters
	if len(lang) < 2 || len(lang) > 3 {
		return ""
	}
	
	// Check if it's a valid language format (basic check)
	for _, char := range lang {
		if char < 'a' || char > 'z' {
			return ""
		}
	}
	
	return lang
}

// normalizeLanguageCode ensures that language codes are in a consistent format.
// This function can be extended in the future to handle language code variations
// and mappings (e.g., "eng" -> "en").
func normalizeLanguageCode(code string) string {
	if code == "" {
		return ""
	}
	
	// Convert to lowercase for consistency
	normalized := strings.ToLower(strings.TrimSpace(code))
	
	// Basic validation
	if len(normalized) < 2 || len(normalized) > 3 {
		return ""
	}
	
	return normalized
}