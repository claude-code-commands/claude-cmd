package language

import (
	"testing"

	"github.com/spf13/afero"
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

func TestSanitizeLanguageCode(t *testing.T) {
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
			result := sanitizeLanguageCode(tt.input)
			if result != tt.expected {
				t.Errorf("sanitizeLanguageCode(%q) = %q, expected %q", 
					tt.input, result, tt.expected)
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

// TestNormalizeLanguage_ExactAndFallback tests the NormalizeLanguage function for exact matches and base language fallback
func TestNormalizeLanguage_ExactAndFallback(t *testing.T) {
	supportedLanguages := []string{"en", "fr", "es", "de", "pt", "zh"}
	
	tests := []struct {
		name         string
		inputLang    string
		supported    []string
		expectedLang string
		expectedOk   bool
	}{
		{
			name:         "Exact match - English",
			inputLang:    "en",
			supported:    supportedLanguages,
			expectedLang: "en",
			expectedOk:   true,
		},
		{
			name:         "Exact match - French",
			inputLang:    "fr",
			supported:    supportedLanguages,
			expectedLang: "fr",
			expectedOk:   true,
		},
		{
			name:         "Exact match - Chinese",
			inputLang:    "zh",
			supported:    supportedLanguages,
			expectedLang: "zh",
			expectedOk:   true,
		},
		{
			name:         "Case insensitive exact match",
			inputLang:    "EN",
			supported:    supportedLanguages,
			expectedLang: "en",
			expectedOk:   true,
		},
		{
			name:         "Mixed case exact match",
			inputLang:    "Fr",
			supported:    supportedLanguages,
			expectedLang: "fr",
			expectedOk:   true,
		},
		{
			name:         "Language with country code fallback to base",
			inputLang:    "en-US",
			supported:    supportedLanguages,
			expectedLang: "en",
			expectedOk:   true,
		},
		{
			name:         "Language with underscore country fallback to base",
			inputLang:    "pt_BR",
			supported:    supportedLanguages,
			expectedLang: "pt",
			expectedOk:   true,
		},
		{
			name:         "Complex language tag fallback to base",
			inputLang:    "zh-Hans-CN",
			supported:    supportedLanguages,
			expectedLang: "zh",
			expectedOk:   true,
		},
		{
			name:         "Language not supported",
			inputLang:    "ja",
			supported:    supportedLanguages,
			expectedLang: "",
			expectedOk:   false,
		},
		{
			name:         "Complex unsupported language",
			inputLang:    "ja-JP",
			supported:    supportedLanguages,
			expectedLang: "",
			expectedOk:   false,
		},
		{
			name:         "Empty input language",
			inputLang:    "",
			supported:    supportedLanguages,
			expectedLang: "",
			expectedOk:   false,
		},
		{
			name:         "Empty supported languages list",
			inputLang:    "en",
			supported:    []string{},
			expectedLang: "",
			expectedOk:   false,
		},
		{
			name:         "Nil supported languages list",
			inputLang:    "en",
			supported:    nil,
			expectedLang: "",
			expectedOk:   false,
		},
		{
			name:         "Whitespace in input",
			inputLang:    " en ",
			supported:    supportedLanguages,
			expectedLang: "en",
			expectedOk:   true,
		},
		{
			name:         "Three letter language code supported",
			inputLang:    "deu",
			supported:    []string{"en", "deu", "fra"},
			expectedLang: "deu",
			expectedOk:   true,
		},
		{
			name:         "Three letter language code with fallback",
			inputLang:    "deu-DE",
			supported:    []string{"en", "deu", "fra"},
			expectedLang: "deu",
			expectedOk:   true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, ok := NormalizeLanguage(tt.inputLang, tt.supported)
			
			if ok != tt.expectedOk {
				t.Errorf("NormalizeLanguage(%q, %v) ok = %v, expected %v", 
					tt.inputLang, tt.supported, ok, tt.expectedOk)
			}
			
			if result != tt.expectedLang {
				t.Errorf("NormalizeLanguage(%q, %v) = %q, expected %q", 
					tt.inputLang, tt.supported, result, tt.expectedLang)
			}
		})
	}
}

func TestNormalizeLanguage_EdgeCases(t *testing.T) {
	tests := []struct {
		name         string
		inputLang    string
		supported    []string
		expectedLang string
		expectedOk   bool
	}{
		{
			name:         "Multiple hyphens in language tag",
			inputLang:    "zh-Hans-CN-x-private",
			supported:    []string{"en", "zh", "fr"},
			expectedLang: "zh",
			expectedOk:   true,
		},
		{
			name:         "Invalid characters in input",
			inputLang:    "en@variant",
			supported:    []string{"en", "fr"},
			expectedLang: "",
			expectedOk:   false,
		},
		{
			name:         "Only separator characters",
			inputLang:    "-_",
			supported:    []string{"en", "fr"},
			expectedLang: "",
			expectedOk:   false,
		},
		{
			name:         "Supported list with duplicates",
			inputLang:    "en",
			supported:    []string{"en", "fr", "en", "de"},
			expectedLang: "en",
			expectedOk:   true,
		},
		{
			name:         "Supported list with mixed case",
			inputLang:    "en",
			supported:    []string{"EN", "FR", "DE"},
			expectedLang: "en",
			expectedOk:   true,
		},
		{
			name:         "Very long language code",
			inputLang:    "toolongtobevalid",
			supported:    []string{"en", "fr"},
			expectedLang: "",
			expectedOk:   false,
		},
		{
			name:         "Single character input",
			inputLang:    "e",
			supported:    []string{"en", "fr"},
			expectedLang: "",
			expectedOk:   false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, ok := NormalizeLanguage(tt.inputLang, tt.supported)
			
			if ok != tt.expectedOk {
				t.Errorf("NormalizeLanguage(%q, %v) ok = %v, expected %v", 
					tt.inputLang, tt.supported, ok, tt.expectedOk)
			}
			
			if result != tt.expectedLang {
				t.Errorf("NormalizeLanguage(%q, %v) = %q, expected %q", 
					tt.inputLang, tt.supported, result, tt.expectedLang)
			}
		})
	}
}

// setupMockFilesystem creates a mock filesystem with the given files for testing
func setupMockFilesystem(files map[string]string) afero.Fs {
	fs := afero.NewMemMapFs()
	
	for path, content := range files {
		err := afero.WriteFile(fs, path, []byte(content), 0644)
		if err != nil {
			panic("Failed to setup test file: " + err.Error())
		}
	}
	
	return fs
}

// TestResolveLanguage_AllSources tests the ResolveLanguage function with comprehensive scenarios
// integrating language detection with configuration system
func TestResolveLanguage_AllSources(t *testing.T) {
	tests := []struct {
		name           string
		configFiles    map[string]string // path -> content
		mockConfigDir  string           // mocked user config directory
		envVar         string           // CLAUDE_CMD_LANG environment variable
		cliFlag        string           // --language flag value
		posixLocale    string           // POSIX locale
		expectedLang   string
		expectError    bool
	}{
		{
			name: "CLI flag overrides all other sources",
			configFiles: map[string]string{
				".claude/config.yaml": "language: en\n",
				"/home/user/.config/claude-cmd/config.yaml": "language: fr\n",
			},
			mockConfigDir: "/home/user/.config",
			envVar:        "de",
			cliFlag:       "es",
			posixLocale:   "pt_BR",
			expectedLang:  "es",
			expectError:   false,
		},
		{
			name: "Environment variable when no CLI flag",
			configFiles: map[string]string{
				".claude/config.yaml": "language: en\n",
				"/home/user/.config/claude-cmd/config.yaml": "language: fr\n",
			},
			mockConfigDir: "/home/user/.config",
			envVar:        "de",
			cliFlag:       "",
			posixLocale:   "pt_BR",
			expectedLang:  "de",
			expectError:   false,
		},
		{
			name: "Project config when no CLI flag or env var",
			configFiles: map[string]string{
				".claude/config.yaml": "language: en\n",
				"/home/user/.config/claude-cmd/config.yaml": "language: fr\n",
			},
			mockConfigDir: "/home/user/.config",
			envVar:        "",
			cliFlag:       "",
			posixLocale:   "pt_BR",
			expectedLang:  "en",
			expectError:   false,
		},
		{
			name: "Global config when no higher precedence sources",
			configFiles: map[string]string{
				"/home/user/.config/claude-cmd/config.yaml": "language: fr\n",
			},
			mockConfigDir: "/home/user/.config",
			envVar:        "",
			cliFlag:       "",
			posixLocale:   "pt_BR",
			expectedLang:  "fr",
			expectError:   false,
		},
		{
			name: "POSIX locale when no config files",
			configFiles: map[string]string{},
			mockConfigDir: "/home/user/.config",
			envVar:        "",
			cliFlag:       "",
			posixLocale:   "pt_BR.UTF-8",
			expectedLang:  "pt",
			expectError:   false,
		},
		{
			name: "Default fallback when all sources empty or invalid",
			configFiles: map[string]string{},
			mockConfigDir: "/home/user/.config",
			envVar:        "",
			cliFlag:       "",
			posixLocale:   "",
			expectedLang:  "en", // Should fall back to config.DefaultLanguage
			expectError:   false,
		},
		{
			name: "Invalid project config should not fail resolution",
			configFiles: map[string]string{
				".claude/config.yaml": "language: invalid-lang-code\n",
				"/home/user/.config/claude-cmd/config.yaml": "language: fr\n",
			},
			mockConfigDir: "/home/user/.config",
			envVar:        "",
			cliFlag:       "",
			posixLocale:   "pt_BR",
			expectedLang:  "fr", // Should fall back to global config
			expectError:   false,
		},
		{
			name: "Partial project config merged with global config",
			configFiles: map[string]string{
				".claude/config.yaml": "repository_url: https://project.example.com\n", // missing language
				"/home/user/.config/claude-cmd/config.yaml": "language: fr\nrepository_url: https://global.example.com\n",
			},
			mockConfigDir: "/home/user/.config",
			envVar:        "",
			cliFlag:       "",
			posixLocale:   "pt_BR",
			expectedLang:  "fr", // Should use global config language
			expectError:   false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Call ResolveLanguage function (to be implemented)
			lang, err := ResolveLanguage(ResolveContext{
				Filesystem:     setupMockFilesystem(tt.configFiles),
				UserConfigDir:  tt.mockConfigDir,
				CLIFlag:        tt.cliFlag,
				EnvVar:         tt.envVar,
				POSIXLocale:    tt.posixLocale,
			})
			
			if tt.expectError && err == nil {
				t.Error("ResolveLanguage() expected error, got nil")
				return
			}
			if !tt.expectError && err != nil {
				t.Errorf("ResolveLanguage() unexpected error: %v", err)
				return
			}
			
			if tt.expectError {
				return // Skip language verification for error cases
			}

			// Verify resolved language matches expected
			if lang != tt.expectedLang {
				t.Errorf("ResolveLanguage() = %q, expected %q", lang, tt.expectedLang)
			}
		})
	}
}