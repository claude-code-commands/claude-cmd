package language

import (
	"testing"
)

// TestDetect_PrecedenceOrder verifies that language detection follows the correct precedence order:
// --language flag → CLAUDE_CMD_LANG env → project config → global config → POSIX locale → fallback
func TestDetect_PrecedenceOrder(t *testing.T) {
	tests := []struct {
		name     string
		context  DetectionContext
		expected string
	}{
		{
			name: "CLI flag takes highest precedence",
			context: DetectionContext{
				CLIFlag:       "fr",
				EnvVar:        "de",
				ProjectConfig: "es",
				GlobalConfig:  "it",
				POSIXLocale:   "pt_BR",
			},
			expected: "fr",
		},
		{
			name: "Environment variable when no CLI flag",
			context: DetectionContext{
				CLIFlag:       "",
				EnvVar:        "de",
				ProjectConfig: "es",
				GlobalConfig:  "it",
				POSIXLocale:   "pt_BR",
			},
			expected: "de",
		},
		{
			name: "Project config when no CLI flag or env var",
			context: DetectionContext{
				CLIFlag:       "",
				EnvVar:        "",
				ProjectConfig: "es",
				GlobalConfig:  "it",
				POSIXLocale:   "pt_BR",
			},
			expected: "es",
		},
		{
			name: "Global config when no higher precedence sources",
			context: DetectionContext{
				CLIFlag:       "",
				EnvVar:        "",
				ProjectConfig: "",
				GlobalConfig:  "it",
				POSIXLocale:   "pt_BR",
			},
			expected: "it",
		},
		{
			name: "POSIX locale when no config sources",
			context: DetectionContext{
				CLIFlag:       "",
				EnvVar:        "",
				ProjectConfig: "",
				GlobalConfig:  "",
				POSIXLocale:   "pt_BR",
			},
			expected: "pt",
		},
		{
			name: "Fallback when all sources empty",
			context: DetectionContext{
				CLIFlag:       "",
				EnvVar:        "",
				ProjectConfig: "",
				GlobalConfig:  "",
				POSIXLocale:   "",
			},
			expected: "en",
		},
		{
			name: "Empty strings are treated as unset",
			context: DetectionContext{
				CLIFlag:       "",
				EnvVar:        "",
				ProjectConfig: "",
				GlobalConfig:  "",
				POSIXLocale:   "",
			},
			expected: "en",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := Detect(tt.context)
			if result != tt.expected {
				t.Errorf("Detect() = %q, expected %q", result, tt.expected)
			}
		})
	}
}

func TestDetect_POSIXLocaleExtraction(t *testing.T) {
	tests := []struct {
		name        string
		posixLocale string
		expected    string
	}{
		{
			name:        "Standard locale format",
			posixLocale: "en_US.UTF-8",
			expected:    "en",
		},
		{
			name:        "Language only",
			posixLocale: "fr",
			expected:    "fr",
		},
		{
			name:        "Language with country",
			posixLocale: "pt_BR",
			expected:    "pt",
		},
		{
			name:        "Complex locale with encoding",
			posixLocale: "zh_CN.GB2312",
			expected:    "zh",
		},
		{
			name:        "Invalid locale format",
			posixLocale: "invalid-locale",
			expected:    "en", // Should fallback
		},
		{
			name:        "Empty locale",
			posixLocale: "",
			expected:    "en", // Should fallback
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			context := DetectionContext{
				CLIFlag:       "",
				EnvVar:        "",
				ProjectConfig: "",
				GlobalConfig:  "",
				POSIXLocale:   tt.posixLocale,
			}
			result := Detect(context)
			if result != tt.expected {
				t.Errorf("Detect() with POSIX locale %q = %q, expected %q", 
					tt.posixLocale, result, tt.expected)
			}
		})
	}
}

func TestDetectionContext_Struct(t *testing.T) {
	// Test that DetectionContext struct has the expected fields
	context := DetectionContext{
		CLIFlag:       "test",
		EnvVar:        "test",
		ProjectConfig: "test", 
		GlobalConfig:  "test",
		POSIXLocale:   "test",
	}
	
	// Verify fields are accessible
	if context.CLIFlag != "test" {
		t.Error("CLIFlag field not accessible")
	}
	if context.EnvVar != "test" {
		t.Error("EnvVar field not accessible")
	}
	if context.ProjectConfig != "test" {
		t.Error("ProjectConfig field not accessible")
	}
	if context.GlobalConfig != "test" {
		t.Error("GlobalConfig field not accessible")
	}
	if context.POSIXLocale != "test" {
		t.Error("POSIXLocale field not accessible")
	}
}

func TestNormalizeLanguageCode(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected string
	}{
		{
			name:     "Lowercase already normalized",
			input:    "en",
			expected: "en",
		},
		{
			name:     "Uppercase should be normalized",
			input:    "FR",
			expected: "fr",
		},
		{
			name:     "Mixed case should be normalized",
			input:    "Es",
			expected: "es",
		},
		{
			name:     "Three letter code",
			input:    "deu",
			expected: "deu",
		},
		{
			name:     "With whitespace",
			input:    " en ",
			expected: "en",
		},
		{
			name:     "Empty string",
			input:    "",
			expected: "",
		},
		{
			name:     "Too short",
			input:    "e",
			expected: "",
		},
		{
			name:     "Too long",
			input:    "english",
			expected: "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := normalizeLanguageCode(tt.input)
			if result != tt.expected {
				t.Errorf("normalizeLanguageCode(%q) = %q, expected %q", 
					tt.input, result, tt.expected)
			}
		})
	}
}

func TestExtractLanguageFromLocale_WithGolangTextPackage(t *testing.T) {
	tests := []struct {
		name     string
		locale   string
		expected string
	}{
		{
			name:     "Standard en_US locale",
			locale:   "en-US",
			expected: "en",
		},
		{
			name:     "German locale",
			locale:   "de-DE",
			expected: "de",
		},
		{
			name:     "Chinese simplified",
			locale:   "zh-CN",
			expected: "zh",
		},
		{
			name:     "Portuguese Brazil",
			locale:   "pt-BR",
			expected: "pt",
		},
		{
			name:     "Language only",
			locale:   "fr",
			expected: "fr",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := extractLanguageFromLocale(tt.locale)
			if result != tt.expected {
				t.Errorf("extractLanguageFromLocale(%q) = %q, expected %q", 
					tt.locale, result, tt.expected)
			}
		})
	}
}

// TestParseLocale_VariousFormats tests the ParseLocale function with various locale formats and edge cases
func TestParseLocale_VariousFormats(t *testing.T) {
	tests := []struct {
		name         string
		localeString string
		expectedLang string
		expectedErr  bool
	}{
		{
			name:         "Standard POSIX locale en_US.UTF-8",
			localeString: "en_US.UTF-8",
			expectedLang: "en",
			expectedErr:  false,
		},
		{
			name:         "Standard POSIX locale with modifier",
			localeString: "en_US.UTF-8@euro",
			expectedLang: "en",
			expectedErr:  false,
		},
		{
			name:         "ISO format en-US",
			localeString: "en-US",
			expectedLang: "en",
			expectedErr:  false,
		},
		{
			name:         "Language only",
			localeString: "fr",
			expectedLang: "fr",
			expectedErr:  false,
		},
		{
			name:         "Language with country underscore",
			localeString: "pt_BR",
			expectedLang: "pt",
			expectedErr:  false,
		},
		{
			name:         "Language with country hyphen",
			localeString: "pt-BR",
			expectedLang: "pt",
			expectedErr:  false,
		},
		{
			name:         "Complex locale with encoding",
			localeString: "zh_CN.GB2312",
			expectedLang: "zh",
			expectedErr:  false,
		},
		{
			name:         "Three letter language code",
			localeString: "deu_DE.UTF-8",
			expectedLang: "deu",
			expectedErr:  false,
		},
		{
			name:         "Case insensitive",
			localeString: "EN_US.UTF-8",
			expectedLang: "en",
			expectedErr:  false,
		},
		{
			name:         "Lowercase with hyphen",
			localeString: "es-es",
			expectedLang: "es",
			expectedErr:  false,
		},
		{
			name:         "Empty string",
			localeString: "",
			expectedLang: "",
			expectedErr:  true,
		},
		{
			name:         "Invalid format",
			localeString: "invalid-locale-format",
			expectedLang: "",
			expectedErr:  true,
		},
		{
			name:         "Numeric locale",
			localeString: "123_456",
			expectedLang: "",
			expectedErr:  true,
		},
		{
			name:         "Special characters",
			localeString: "@#$%_US",
			expectedLang: "",
			expectedErr:  true,
		},
		{
			name:         "C locale",
			localeString: "C",
			expectedLang: "",
			expectedErr:  true,
		},
		{
			name:         "POSIX locale",
			localeString: "POSIX",
			expectedLang: "",
			expectedErr:  true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			lang, err := ParseLocale(tt.localeString)
			
			if tt.expectedErr {
				if err == nil {
					t.Errorf("ParseLocale(%q) expected error, got nil", tt.localeString)
				}
				if lang != "" {
					t.Errorf("ParseLocale(%q) expected empty language on error, got %q", tt.localeString, lang)
				}
			} else {
				if err != nil {
					t.Errorf("ParseLocale(%q) unexpected error: %v", tt.localeString, err)
				}
				if lang != tt.expectedLang {
					t.Errorf("ParseLocale(%q) = %q, expected %q", tt.localeString, lang, tt.expectedLang)
				}
			}
		})
	}
}

func TestParseLocale_EdgeCases(t *testing.T) {
	tests := []struct {
		name         string
		localeString string
		expectedLang string
		expectedErr  bool
	}{
		{
			name:         "Very long valid locale",
			localeString: "en_US.UTF-8@currency=USD,collation=phonebook",
			expectedLang: "en",
			expectedErr:  false,
		},
		{
			name:         "Whitespace around locale",
			localeString: "  en_US.UTF-8  ",
			expectedLang: "en",
			expectedErr:  false,
		},
		{
			name:         "Mixed separators",
			localeString: "zh-Hans_CN.UTF-8",
			expectedLang: "zh",
			expectedErr:  false,
		},
		{
			name:         "Single character",
			localeString: "a",
			expectedLang: "",
			expectedErr:  true,
		},
		{
			name:         "Only separators",
			localeString: "_-.",
			expectedLang: "",
			expectedErr:  true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			lang, err := ParseLocale(tt.localeString)
			
			if tt.expectedErr {
				if err == nil {
					t.Errorf("ParseLocale(%q) expected error, got nil", tt.localeString)
				}
			} else {
				if err != nil {
					t.Errorf("ParseLocale(%q) unexpected error: %v", tt.localeString, err)
				}
				if lang != tt.expectedLang {
					t.Errorf("ParseLocale(%q) = %q, expected %q", tt.localeString, lang, tt.expectedLang)
				}
			}
		})
	}
}