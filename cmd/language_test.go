package cmd

import (
	"bytes"
	"path/filepath"
	"strings"
	"testing"

	"github.com/spf13/afero"
	"github.com/spf13/cobra"
)

func TestLanguageCommands_ListAndSet(t *testing.T) {
	tests := []struct {
		name           string
		args           []string
		setupConfig    func(fs afero.Fs, configDir string)
		expectedOutput string
		expectedError  string
	}{
		{
			name: "language list shows available languages",
			args: []string{"language", "list"},
			expectedOutput: `Available languages:
  en (English) - default
  fr (French)
  es (Spanish)
  de (German)
  pt (Portuguese)
  zh (Chinese)
  ja (Japanese)
  ko (Korean)`,
		},
		{
			name: "language list shows current language from global config",
			args: []string{"language", "list"},
			setupConfig: func(fs afero.Fs, configDir string) {
				configPath := filepath.Join(configDir, "claude-cmd", "config.yaml")
				fs.MkdirAll(filepath.Dir(configPath), 0755)
				afero.WriteFile(fs, configPath, []byte("language: fr\n"), 0644)
			},
			expectedOutput: `Available languages:
  en (English)
  fr (French) - current
  es (Spanish)
  de (German)
  pt (Portuguese)
  zh (Chinese)
  ja (Japanese)
  ko (Korean)`,
		},
		{
			name:           "language set updates global config",
			args:           []string{"language", "set", "fr"},
			expectedOutput: "Language set to: fr\nConfiguration saved to global config.",
		},
		{
			name:          "language set with invalid language code",
			args:          []string{"language", "set", "invalid"},
			expectedError: "invalid language code",
		},
		{
			name:          "language set with empty language code",
			args:          []string{"language", "set", ""},
			expectedError: "language code cannot be empty",
		},
		{
			name:          "language set with unsupported language",
			args:          []string{"language", "set", "qq"},
			expectedError: "unsupported language code",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Setup mock filesystem and config directory
			fs := afero.NewMemMapFs()
			configDir := "/home/user/.config"

			// Mock os.UserConfigDir for testing
			originalUserConfigDir := userConfigDir
			userConfigDir = func() (string, error) {
				return configDir, nil
			}
			defer func() { userConfigDir = originalUserConfigDir }()

			// Setup config if provided
			if tt.setupConfig != nil {
				tt.setupConfig(fs, configDir)
			}

			// Create command with mocked filesystem
			rootCmd := &cobra.Command{Use: "claude-cmd"}
			languageCmd := newLanguageCommand(fs)
			rootCmd.AddCommand(languageCmd)

			// Capture output
			var outBuf, errBuf bytes.Buffer
			rootCmd.SetOut(&outBuf)
			rootCmd.SetErr(&errBuf)
			rootCmd.SetArgs(tt.args)

			// Execute command
			err := rootCmd.Execute()

			// Check error expectations
			if tt.expectedError != "" {
				if err == nil {
					t.Errorf("expected error containing %q, got nil", tt.expectedError)
					return
				}
				if !strings.Contains(err.Error(), tt.expectedError) {
					t.Errorf("expected error containing %q, got %q", tt.expectedError, err.Error())
				}
				return
			}

			// Check for unexpected errors
			if err != nil {
				t.Errorf("unexpected error: %v", err)
				return
			}

			// Check output
			if tt.expectedOutput != "" {
				output := outBuf.String()
				if !strings.Contains(output, tt.expectedOutput) {
					t.Errorf("expected output to contain:\n%s\ngot:\n%s", tt.expectedOutput, output)
				}
			}
		})
	}
}

func TestLanguageCommandHelp(t *testing.T) {
	tests := []struct {
		name           string
		args           []string
		expectedOutput string
	}{
		{
			name:           "language command shows help",
			args:           []string{"language", "--help"},
			expectedOutput: "Manage language settings for claude-cmd",
		},
		{
			name:           "language list help",
			args:           []string{"language", "list", "--help"},
			expectedOutput: "List available languages and show current language setting",
		},
		{
			name:           "language set help",
			args:           []string{"language", "set", "--help"},
			expectedOutput: "Set the preferred language for command retrieval",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			fs := afero.NewMemMapFs()

			// Create command
			rootCmd := &cobra.Command{Use: "claude-cmd"}
			languageCmd := newLanguageCommand(fs)
			rootCmd.AddCommand(languageCmd)

			// Capture output
			var outBuf bytes.Buffer
			rootCmd.SetOut(&outBuf)
			rootCmd.SetArgs(tt.args)

			// Execute command (help commands don't return errors)
			rootCmd.Execute()

			// Check output
			output := outBuf.String()
			if !strings.Contains(output, tt.expectedOutput) {
				t.Errorf("expected output to contain %q, got:\n%s", tt.expectedOutput, output)
			}
		})
	}
}
