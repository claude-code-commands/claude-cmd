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
		if normalized := sanitizeLanguageCode(context.CLIFlag); normalized != "" {
			return normalized
		}
	}
	
	// 2. Environment variable - user's explicit choice for all commands in session
	if context.EnvVar != "" {
		if normalized := sanitizeLanguageCode(context.EnvVar); normalized != "" {
			return normalized
		}
	}
	
	// 3. Project configuration - team/project-specific language setting
	if context.ProjectConfig != "" {
		if normalized := sanitizeLanguageCode(context.ProjectConfig); normalized != "" {
			return normalized
		}
	}
	
	// 4. Global configuration - user's persistent personal preference
	if context.GlobalConfig != "" {
		if normalized := sanitizeLanguageCode(context.GlobalConfig); normalized != "" {
			return normalized
		}
	}
	
	// 5. POSIX locale - system-level language preference
	if context.POSIXLocale != "" {
		if lang, err := ParseLocale(context.POSIXLocale); err == nil {
			return lang
		}
	}
	
	// 6. Fallback to English when no language source is available
	return "en"
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

// NormalizeLanguage matches a detected language code against a list of supported languages.
// It performs exact matching first, then falls back to base language matching using a
// two-phase approach for maximum compatibility.
// 
// The function handles:
//   - Exact matches (case-insensitive): "en" matches "en"
//   - Base language fallback: "en-US" matches "en", "pt_BR" matches "pt"
//   - Complex language tags: "zh-Hans-CN" matches "zh"
//   - Case normalization: input and supported languages are compared case-insensitively
//   - Whitespace trimming: leading/trailing whitespace is ignored
//   - Three-letter language codes: "deu" matches "deu", "deu-DE" matches "deu"
//
// The matching algorithm:
//   1. Normalize input and supported languages to lowercase
//   2. Try exact match for simple language codes
//   3. Extract base language from complex tags and try matching
//   4. Return the first successful match or empty if no match found
//
// Returns the normalized language code and true if a match is found,
// or empty string and false if no match is found or input is invalid.
//
// Example usage:
//   supported := []string{"en", "fr", "es", "de", "pt", "zh"}
//   lang, ok := NormalizeLanguage("en-US", supported)  // returns "en", true
//   lang, ok := NormalizeLanguage("ja", supported)     // returns "", false
func NormalizeLanguage(inputLang string, supportedLanguages []string) (string, bool) {
	// Early validation
	trimmed := strings.TrimSpace(inputLang)
	if trimmed == "" || len(supportedLanguages) == 0 {
		return "", false
	}
	
	// Normalize input language to lowercase
	normalized := strings.ToLower(trimmed)
	
	// Build efficient lookup map for supported languages
	supportedMap := buildSupportedLanguageMap(supportedLanguages)
	if len(supportedMap) == 0 {
		return "", false
	}
	
	// Phase 1: Try exact match for simple language codes (e.g., "en", "fr", "deu")
	if isValidLanguageCode(normalized) {
		if supported, exists := supportedMap[normalized]; exists {
			return supported, true
		}
	}
	
	// Phase 2: Extract base language and try matching (e.g., "en-US" -> "en")
	baseLang := extractBaseLanguage(normalized)
	if baseLang != "" && baseLang != normalized && isValidLanguageCode(baseLang) {
		if supported, exists := supportedMap[baseLang]; exists {
			return supported, true
		}
	}
	
	// No match found
	return "", false
}

// sanitizeLanguageCode ensures that language codes are in a consistent format.
// This function normalizes case and validates format, returning empty string for invalid codes.
func sanitizeLanguageCode(code string) string {
	if code == "" {
		return ""
	}
	
	// Convert to lowercase and trim whitespace for consistency
	normalized := strings.ToLower(strings.TrimSpace(code))
	
	// Validate language code format (2-3 lowercase letters)
	if !isValidLanguageCode(normalized) {
		return ""
	}
	
	return normalized
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
	if !isValidLanguageCode(lang) {
		return "", errors.New("invalid language code: must be 2-3 lowercase letters")
	}
	
	return lang, nil
}

// buildSupportedLanguageMap creates a normalized map of supported languages for efficient lookup.
// It filters out invalid language codes and normalizes case for consistent matching.
func buildSupportedLanguageMap(supportedLanguages []string) map[string]string {
	supportedMap := make(map[string]string, len(supportedLanguages))
	
	for _, lang := range supportedLanguages {
		normalizedSupported := strings.ToLower(strings.TrimSpace(lang))
		if normalizedSupported != "" && isValidLanguageCode(normalizedSupported) {
			// Use the normalized version as both key and value for consistency
			supportedMap[normalizedSupported] = normalizedSupported
		}
	}
	
	return supportedMap
}

// extractBaseLanguage extracts the base language code from a complex language tag.
// Examples: "en-US" -> "en", "zh-Hans-CN" -> "zh", "pt_BR" -> "pt"
func extractBaseLanguage(langTag string) string {
	// Split on common separators (hyphen and underscore)
	var parts []string
	if strings.Contains(langTag, "-") {
		parts = strings.Split(langTag, "-")
	} else if strings.Contains(langTag, "_") {
		parts = strings.Split(langTag, "_")
	} else {
		// No separators, return as-is if valid
		return langTag
	}
	
	if len(parts) == 0 || parts[0] == "" {
		return ""
	}
	
	baseLang := strings.ToLower(parts[0])
	
	// Validate the base language part
	if isValidLanguageCode(baseLang) {
		return baseLang
	}
	
	return ""
}

// isValidLanguageCode checks if a string is a valid language code format.
// Valid language codes are 2-3 lowercase letters only.
func isValidLanguageCode(code string) bool {
	if len(code) < 2 || len(code) > 3 {
		return false
	}
	
	// Check if it contains only lowercase letters
	for _, char := range code {
		if char < 'a' || char > 'z' {
			return false
		}
	}
	
	return true
}