package cmd

import (
	"fmt"
	"io"
	"net/http"
	"os"
	"path"
	"path/filepath"
	"strings"
	"time"

	"github.com/claude-code-commands/cli/internal/cache"
	"github.com/claude-code-commands/cli/internal/install"
	"github.com/claude-code-commands/cli/internal/interfaces"
	"github.com/spf13/afero"
	"github.com/spf13/cobra"
)

// HTTPClientInterface defines the interface for HTTP operations
type HTTPClientInterface interface {
	Get(url string) (*http.Response, error)
}

// AddOption configures the add command
type AddOption func(*addConfig)

// addConfig holds configuration for the add command
type addConfig struct {
	cacheManager interfaces.CacheManagerInterface
	httpClient   HTTPClientInterface
	baseURL      string
}

// WithAddCacheManager sets a custom cache manager for testing
func WithAddCacheManager(cm interfaces.CacheManagerInterface) AddOption {
	return func(config *addConfig) {
		config.cacheManager = cm
	}
}

// WithAddHTTPClient sets a custom HTTP client for testing
func WithAddHTTPClient(client HTTPClientInterface) AddOption {
	return func(config *addConfig) {
		config.httpClient = client
	}
}

// WithAddBaseURL sets a custom base URL for testing
func WithAddBaseURL(url string) AddOption {
	return func(config *addConfig) {
		config.baseURL = url
	}
}

// newAddCommand creates the add command for installing commands
func newAddCommand(fs afero.Fs, opts ...AddOption) *cobra.Command {
	// Apply configuration options
	config := &addConfig{
		baseURL: "https://raw.githubusercontent.com/claude-commands/commands/main",
	}
	for _, opt := range opts {
		opt(config)
	}

	cmd := &cobra.Command{
		Use:   "add <command-name>",
		Short: "Install a Claude Code command",
		Long: `Add downloads and installs a Claude Code slash command from the repository.
The command will be installed to your personal or project Claude Code directory.`,
		Args: cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			commandName := args[0]
			return runAddCommand(cmd, fs, commandName, config)
		},
	}

	return cmd
}

// runAddCommand executes the add command logic
func runAddCommand(cmd *cobra.Command, fs afero.Fs, commandName string, config *addConfig) error {
	// Set up default cache manager if not provided
	if config.cacheManager == nil {
		cacheDir, err := os.UserCacheDir()
		if err != nil {
			return fmt.Errorf("failed to get user cache directory: %w", err)
		}
		cacheDir = filepath.Join(cacheDir, "claude-cmd")
		config.cacheManager = cache.NewCacheManager(fs, cacheDir)
	}

	// Set up default HTTP client if not provided
	if config.httpClient == nil {
		config.httpClient = &http.Client{
			Timeout: 15 * time.Second,
			Transport: &http.Transport{
				Proxy: http.ProxyFromEnvironment,
			},
		}
	}

	// Get current language preference
	lang := getCurrentLanguage(fs)

	// Get manifest from cache or fetch from network
	manifest, err := config.cacheManager.GetOrUpdateManifest(lang)
	if err != nil {
		return fmt.Errorf("failed to retrieve command manifest: %w", err)
	}

	// Look up command in manifest
	var targetCommand *cache.Command
	for _, command := range manifest.Commands {
		if command.Name == commandName {
			targetCommand = &command
			break
		}
	}

	if targetCommand == nil {
		return fmt.Errorf("command %q not found. Run 'claude-cmd list' to see available commands", commandName)
	}

	// Sanitize file path to prevent path traversal attacks
	cleanFile := filepath.ToSlash(path.Clean("/" + targetCommand.File))[1:] // guarantees no leading slash
	if strings.Contains(cleanFile, "..") {
		return fmt.Errorf("invalid file path in manifest: %s", targetCommand.File)
	}

	// Download command content
	commandURL := fmt.Sprintf("%s/%s", config.baseURL, cleanFile)
	resp, err := config.httpClient.Get(commandURL)
	if err != nil {
		return fmt.Errorf("failed to download command: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("download failed: server returned status %d", resp.StatusCode)
	}

	// Read command content
	content, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("failed to read command content: %w", err)
	}

	// Select installation directory
	installDir, err := install.SelectInstallDir(fs)
	if err != nil {
		return fmt.Errorf("failed to determine installation directory: %w", err)
	}

	// Install command
	err = install.InstallCommand(fs, installDir, commandName, string(content))
	if err != nil {
		return fmt.Errorf("failed to install command: %w", err)
	}

	// Show success message
	commandPath := filepath.Join(installDir, commandName+".md")
	fmt.Fprintf(cmd.OutOrStdout(), "Successfully installed command '%s' to %s\n", commandName, commandPath)

	return nil
}
