// Package language provides automatic language detection for the claude-cmd CLI tool.
// It implements a layered detection strategy with clear precedence order to determine
// the user's preferred language for command retrieval and display.
package language

import (
	"errors"
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

// ParseLocale parses a POSIX locale string and extracts the language code using
// golang.org/x/text/language for robust parsing. This function handles various
// locale formats and provides comprehensive error reporting.
//
// Supported locale formats:
//   - Standard POSIX: "en_US.UTF-8", "fr_FR.ISO-8859-1"
//   - With modifiers: "en_US.UTF-8@euro", "de_DE.UTF-8@currency=EUR"
//   - ISO format: "en-US", "pt-BR"
//   - Language only: "fr", "es", "deu"
//   - Mixed separators: "zh-Hans_CN.UTF-8"
//
// The function returns an error for:
//   - Empty or whitespace-only strings
//   - Invalid locale formats
//   - Special locale names like "C" and "POSIX"
//   - Locales that don't contain valid language codes
func ParseLocale(localeString string) (string, error) {
	// Trim whitespace and check for empty input
	trimmed := strings.TrimSpace(localeString)
	if trimmed == "" {
		return "", errors.New("locale string cannot be empty")
	}
	
	// Handle special locale names that should be rejected
	switch strings.ToUpper(trimmed) {
	case "C", "POSIX":
		return "", errors.New("special locale names 'C' and 'POSIX' are not supported")
	}
	
	// First try using golang.org/x/text/language for standards-compliant parsing
	tag, err := language.Parse(trimmed)
	if err == nil {
		// Extract the base language from the parsed tag
		base, confidence := tag.Base()
		if confidence == language.No {
			return "", errors.New("locale does not contain a recognizable language")
		}
		return base.String(), nil
	}
	
	// Fallback to custom parsing for non-standard POSIX formats
	lang, parseErr := parseLocaleBasic(trimmed)
	if parseErr != nil {
		return "", parseErr
	}
	
	return lang, nil
}

// parseLocaleBasic provides basic POSIX locale parsing as a fallback
// when golang.org/x/text/language parsing fails.
func parseLocaleBasic(locale string) (string, error) {
	// Remove modifiers (everything after @)
	if atIndex := strings.Index(locale, "@"); atIndex != -1 {
		locale = locale[:atIndex]
	}
	
	// Remove encoding (everything after .)
	if dotIndex := strings.Index(locale, "."); dotIndex != -1 {
		locale = locale[:dotIndex]
	}
	
	// For mixed separators like "zh-Hans_CN", try to parse with multiple separators
	// First split on hyphen, then on underscore
	var languagePart string
	
	// Split on hyphen first
	if strings.Contains(locale, "-") {
		parts := strings.Split(locale, "-")
		if len(parts) > 0 && parts[0] != "" {
			languagePart = parts[0]
		}
	}
	
	// If we didn't find a valid language part, try splitting on underscore
	if languagePart == "" && strings.Contains(locale, "_") {
		parts := strings.Split(locale, "_")
		if len(parts) > 0 && parts[0] != "" {
			languagePart = parts[0]
		}
	}
	
	// If still no language part, use the whole string (language only case)
	if languagePart == "" {
		languagePart = locale
	}
	
	if languagePart == "" {
		return "", errors.New("invalid locale format: missing language component")
	}
	
	// Take the language code and normalize it
	lang := strings.ToLower(languagePart)
	
	// Validate language code format
	if len(lang) < 2 || len(lang) > 3 {
		return "", errors.New("invalid language code: must be 2-3 characters")
	}
	
	// Check if it contains only letters
	for _, char := range lang {
		if char < 'a' || char > 'z' {
			return "", errors.New("invalid language code: must contain only letters")
		}
	}
	
	return lang, nil
}