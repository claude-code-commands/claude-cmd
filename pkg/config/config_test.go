package config

import (
	"errors"
	"strings"
	"testing"

	"github.com/spf13/afero"
)

// TestDefaultLanguage verifies that the default language constant
// is properly set to a valid ISO 639-1 language code.
func TestDefaultLanguage(t *testing.T) {
	if DefaultLanguage == "" {
		t.Error("DefaultLanguage should not be empty")
	}
	if DefaultLanguage != "en" {
		t.Errorf("DefaultLanguage should be 'en', got %q", DefaultLanguage)
	}
	// Ensure it's a valid two-letter language code
	if len(DefaultLanguage) != 2 {
		t.Errorf("DefaultLanguage should be a 2-character ISO 639-1 code, got %q with length %d",
			DefaultLanguage, len(DefaultLanguage))
	}
}

// TestDefaultRepositoryURL verifies that the repository URL constant
// points to a valid GitHub raw content URL.
func TestDefaultRepositoryURL(t *testing.T) {
	if DefaultRepositoryURL == "" {
		t.Error("DefaultRepositoryURL should not be empty")
	}

	// Should be a GitHub raw content URL
	expectedPrefix := "https://raw.githubusercontent.com/"
	if !strings.HasPrefix(DefaultRepositoryURL, expectedPrefix) {
		t.Errorf("DefaultRepositoryURL should start with %q, got %q", expectedPrefix, DefaultRepositoryURL)
	}

	// Should point to the commands repository
	if !strings.Contains(DefaultRepositoryURL, "claude-code-commands/commands") {
		t.Errorf("DefaultRepositoryURL should reference claude-code-commands/commands repository, got %q",
			DefaultRepositoryURL)
	}

	// Should point to main branch
	if !strings.Contains(DefaultRepositoryURL, "/main") {
		t.Errorf("DefaultRepositoryURL should reference main branch, got %q", DefaultRepositoryURL)
	}
}

// TestConstantsAreExported verifies that all constants are properly exported
// and accessible from other packages.
func TestConstantsAreExported(t *testing.T) {
	// These should compile without errors if constants are properly exported
	_ = DefaultLanguage
	_ = DefaultRepositoryURL
}

// TestConfig_LoadSave tests the Config struct with YAML marshal/unmarshal functionality
func TestConfig_LoadSave(t *testing.T) {
	tests := []struct {
		name         string
		config       Config
		expectedYAML string
		shouldFail   bool
	}{
		{
			name: "Default configuration",
			config: Config{
				Language:      "en",
				RepositoryURL: "https://example.com/commands",
			},
			expectedYAML: "language: en\nrepository_url: https://example.com/commands\n",
			shouldFail:   false,
		},
		{
			name: "Custom language configuration",
			config: Config{
				Language:      "fr",
				RepositoryURL: "https://example.com/commands/fr",
			},
			expectedYAML: "language: fr\nrepository_url: https://example.com/commands/fr\n",
			shouldFail:   false,
		},
		{
			name:         "Empty configuration should use defaults",
			config:       Config{},
			expectedYAML: "language: \"\"\nrepository_url: \"\"\n",
			shouldFail:   false,
		},
	}

	// Create in-memory filesystem for testing
	fs := afero.NewMemMapFs()

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Test Save functionality
			configPath := "/test/config.yaml"
			err := tt.config.Save(fs, configPath)

			if tt.shouldFail {
				if err == nil {
					t.Error("Save() expected error, got nil")
				}
				return
			}

			if err != nil {
				t.Errorf("Save() unexpected error: %v", err)
				return
			}

			// Verify file was created
			exists, err := afero.Exists(fs, configPath)
			if err != nil {
				t.Errorf("Error checking file existence: %v", err)
				return
			}
			if !exists {
				t.Error("Config file was not created")
				return
			}

			// Test Load functionality
			var loadedConfig Config
			err = loadedConfig.Load(fs, configPath)
			if err != nil {
				t.Errorf("Load() unexpected error: %v", err)
				return
			}

			// Verify loaded config matches original
			if loadedConfig.Language != tt.config.Language {
				t.Errorf("Load() Language = %q, expected %q", loadedConfig.Language, tt.config.Language)
			}
			if loadedConfig.RepositoryURL != tt.config.RepositoryURL {
				t.Errorf("Load() RepositoryURL = %q, expected %q", loadedConfig.RepositoryURL, tt.config.RepositoryURL)
			}
		})
	}
}

func TestConfig_LoadMissingFile(t *testing.T) {
	fs := afero.NewMemMapFs()
	var config Config

	err := config.Load(fs, "/nonexistent/config.yaml")
	if err == nil {
		t.Error("Load() expected error for missing file, got nil")
	}
}

func TestConfig_SaveInvalidPath(t *testing.T) {
	// Use a read-only filesystem to simulate permission error
	fs := afero.NewReadOnlyFs(afero.NewMemMapFs())
	config := Config{
		Language:      "en",
		RepositoryURL: "https://example.com",
	}

	// Try to save to read-only filesystem
	err := config.Save(fs, "/config.yaml")
	if err == nil {
		t.Error("Save() expected error for read-only filesystem, got nil")
	}
}

func TestConfig_Validation(t *testing.T) {
	tests := []struct {
		name       string
		config     Config
		shouldFail bool
	}{
		{
			name: "Valid configuration",
			config: Config{
				Language:      "en",
				RepositoryURL: "https://example.com",
			},
			shouldFail: false,
		},
		{
			name: "Invalid language code",
			config: Config{
				Language:      "invalid-lang-code",
				RepositoryURL: "https://example.com",
			},
			shouldFail: true,
		},
		{
			name: "Invalid repository URL",
			config: Config{
				Language:      "en",
				RepositoryURL: "not-a-url",
			},
			shouldFail: true,
		},
		{
			name: "Empty fields should be valid (will use defaults)",
			config: Config{
				Language:      "",
				RepositoryURL: "",
			},
			shouldFail: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.config.Validate()

			if tt.shouldFail && err == nil {
				t.Error("Validate() expected error, got nil")
			}
			if !tt.shouldFail && err != nil {
				t.Errorf("Validate() unexpected error: %v", err)
			}
		})
	}
}

// TestFindConfigFiles_ProjectAndGlobal tests configuration file location with precedence
func TestFindConfigFiles_ProjectAndGlobal(t *testing.T) {
	// Save original userConfigDir function and defer its restoration
	originalUserConfigDir := userConfigDir
	defer func() { userConfigDir = originalUserConfigDir }()

	tests := []struct {
		name                string
		setupFiles          map[string]string // path -> content
		mockConfigDir       string            // mocked user config directory
		mockConfigDirError  error             // error to return from userConfigDir
		expectedProjectPath string
		expectedGlobalPath  string
		expectError         bool
	}{
		{
			name: "Both project and global config exist",
			setupFiles: map[string]string{
				".claude/config.yaml":                       "language: en\n",
				"/home/user/.config/claude-cmd/config.yaml": "language: fr\n",
			},
			mockConfigDir:       "/home/user/.config",
			expectedProjectPath: ".claude/config.yaml",
			expectedGlobalPath:  "/home/user/.config/claude-cmd/config.yaml",
			expectError:         false,
		},
		{
			name: "Only project config exists",
			setupFiles: map[string]string{
				".claude/config.yaml": "language: en\n",
			},
			mockConfigDir:       "/home/user/.config",
			expectedProjectPath: ".claude/config.yaml",
			expectedGlobalPath:  "",
			expectError:         false,
		},
		{
			name: "Only global config exists",
			setupFiles: map[string]string{
				"/home/user/.config/claude-cmd/config.yaml": "language: fr\n",
			},
			mockConfigDir:       "/home/user/.config",
			expectedProjectPath: "",
			expectedGlobalPath:  "/home/user/.config/claude-cmd/config.yaml",
			expectError:         false,
		},
		{
			name:                "No config files exist",
			setupFiles:          map[string]string{},
			mockConfigDir:       "/home/user/.config",
			expectedProjectPath: "",
			expectedGlobalPath:  "",
			expectError:         false,
		},
		{
			name: "User config directory unavailable",
			setupFiles: map[string]string{
				".claude/config.yaml": "language: en\n",
			},
			mockConfigDirError:  errors.New("user config dir not available"),
			expectedProjectPath: ".claude/config.yaml",
			expectedGlobalPath:  "",
			expectError:         false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Create in-memory filesystem for testing
			fs := afero.NewMemMapFs()

			// Mock userConfigDir function
			userConfigDir = func() (string, error) {
				if tt.mockConfigDirError != nil {
					return "", tt.mockConfigDirError
				}
				return tt.mockConfigDir, nil
			}

			// Set up test files
			for path, content := range tt.setupFiles {
				err := afero.WriteFile(fs, path, []byte(content), 0644)
				if err != nil {
					t.Fatalf("Failed to setup test file %s: %v", path, err)
				}
			}

			// Call FindConfigFiles function
			projectPath, globalPath, err := FindConfigFiles(fs)

			if tt.expectError && err == nil {
				t.Error("FindConfigFiles() expected error, got nil")
				return
			}
			if !tt.expectError && err != nil {
				t.Errorf("FindConfigFiles() unexpected error: %v", err)
				return
			}

			// Verify project path
			if projectPath != tt.expectedProjectPath {
				t.Errorf("FindConfigFiles() project path = %q, expected %q", projectPath, tt.expectedProjectPath)
			}

			// Verify global path
			if globalPath != tt.expectedGlobalPath {
				t.Errorf("FindConfigFiles() global path = %q, expected %q", globalPath, tt.expectedGlobalPath)
			}
		})
	}
}

// TestLoadConfig_MergeOrder tests configuration loading with project override of global
func TestLoadConfig_MergeOrder(t *testing.T) {
	// Save original userConfigDir function and defer its restoration
	originalUserConfigDir := userConfigDir
	defer func() { userConfigDir = originalUserConfigDir }()

	tests := []struct {
		name           string
		setupFiles     map[string]string // path -> content
		mockConfigDir  string            // mocked user config directory
		expectedConfig Config
		expectError    bool
	}{
		{
			name: "Project config overrides global config",
			setupFiles: map[string]string{
				".claude/config.yaml":                       "language: en\nrepository_url: https://project.example.com\n",
				"/home/user/.config/claude-cmd/config.yaml": "language: fr\nrepository_url: https://global.example.com\n",
			},
			mockConfigDir: "/home/user/.config",
			expectedConfig: Config{
				Language:      "en",                          // from project config
				RepositoryURL: "https://project.example.com", // from project config
			},
			expectError: false,
		},
		{
			name: "Global config used when project config missing",
			setupFiles: map[string]string{
				"/home/user/.config/claude-cmd/config.yaml": "language: fr\nrepository_url: https://global.example.com\n",
			},
			mockConfigDir: "/home/user/.config",
			expectedConfig: Config{
				Language:      "fr",
				RepositoryURL: "https://global.example.com",
			},
			expectError: false,
		},
		{
			name: "Project config only (partial) merged with global config",
			setupFiles: map[string]string{
				".claude/config.yaml":                       "language: en\n", // missing repository_url
				"/home/user/.config/claude-cmd/config.yaml": "language: fr\nrepository_url: https://global.example.com\n",
			},
			mockConfigDir: "/home/user/.config",
			expectedConfig: Config{
				Language:      "en",                         // from project config
				RepositoryURL: "https://global.example.com", // from global config
			},
			expectError: false,
		},
		{
			name:          "Defaults used when no config files exist",
			setupFiles:    map[string]string{},
			mockConfigDir: "/home/user/.config",
			expectedConfig: Config{
				Language:      DefaultLanguage,
				RepositoryURL: DefaultRepositoryURL,
			},
			expectError: false,
		},
		{
			name: "Invalid project config should fail",
			setupFiles: map[string]string{
				".claude/config.yaml":                       "language: invalid-lang\nrepository_url: https://project.example.com\n",
				"/home/user/.config/claude-cmd/config.yaml": "language: fr\nrepository_url: https://global.example.com\n",
			},
			mockConfigDir:  "/home/user/.config",
			expectedConfig: Config{}, // should not be populated due to error
			expectError:    true,
		},
		{
			name: "Invalid global config should fail",
			setupFiles: map[string]string{
				"/home/user/.config/claude-cmd/config.yaml": "language: invalid-lang\nrepository_url: not-a-url\n",
			},
			mockConfigDir:  "/home/user/.config",
			expectedConfig: Config{}, // should not be populated due to error
			expectError:    true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Create in-memory filesystem for testing
			fs := afero.NewMemMapFs()

			// Mock userConfigDir function
			userConfigDir = func() (string, error) {
				return tt.mockConfigDir, nil
			}

			// Set up test files
			for path, content := range tt.setupFiles {
				err := afero.WriteFile(fs, path, []byte(content), 0644)
				if err != nil {
					t.Fatalf("Failed to setup test file %s: %v", path, err)
				}
			}

			// Call LoadConfig function
			config, err := LoadConfig(fs)

			if tt.expectError && err == nil {
				t.Error("LoadConfig() expected error, got nil")
				return
			}
			if !tt.expectError && err != nil {
				t.Errorf("LoadConfig() unexpected error: %v", err)
				return
			}

			if tt.expectError {
				return // Skip config verification for error cases
			}

			// Verify loaded config matches expected
			if config.Language != tt.expectedConfig.Language {
				t.Errorf("LoadConfig() Language = %q, expected %q", config.Language, tt.expectedConfig.Language)
			}
			if config.RepositoryURL != tt.expectedConfig.RepositoryURL {
				t.Errorf("LoadConfig() RepositoryURL = %q, expected %q", config.RepositoryURL, tt.expectedConfig.RepositoryURL)
			}
		})
	}
}
