package cmd

import (
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"

	"github.com/claude-code-commands/claude-cmd/internal/cache"
	"github.com/claude-code-commands/claude-cmd/internal/interfaces"
	"github.com/spf13/afero"
	"github.com/spf13/cobra"
)

// ListOption configures the list command
type ListOption func(*listConfig)

// listConfig holds configuration for the list command
type listConfig struct {
	cacheManager interfaces.CacheManagerInterface
}

// WithCacheManager sets a custom cache manager for testing
func WithCacheManager(cm interfaces.CacheManagerInterface) ListOption {
	return func(config *listConfig) {
		config.cacheManager = cm
	}
}

// newListCommand creates the list command for displaying available commands
func newListCommand(fs afero.Fs, opts ...ListOption) *cobra.Command {
	// Apply configuration options
	config := &listConfig{}
	for _, opt := range opts {
		opt(config)
	}

	cmd := &cobra.Command{
		Use:   "list",
		Short: "List available Claude Code commands",
		Long: `List displays all available Claude Code slash commands from the repository.
Commands are organized by category and include descriptions to help you find what you need.`,
		RunE: func(cmd *cobra.Command, args []string) error {
			return runListCommand(cmd, fs, config.cacheManager)
		},
	}

	return cmd
}

// runListCommand executes the list command logic
func runListCommand(cmd *cobra.Command, fs afero.Fs, cacheManager interfaces.CacheManagerInterface) error {
	// If no cache manager provided, create default one
	if cacheManager == nil {
		cacheDir, err := os.UserCacheDir()
		if err != nil {
			return fmt.Errorf("failed to get user cache directory: %w", err)
		}
		cacheDir = filepath.Join(cacheDir, "claude-cmd")
		cacheManager = cache.NewCacheManager(fs, cacheDir)
	}

	// Get current language preference (defaults to "en" if not configured)
	lang := getCurrentLanguage(fs)

	// Get manifest from cache or fetch from network
	manifest, err := cacheManager.GetOrUpdateManifest(lang)
	if err != nil {
		// Handle different error types with user-friendly messages
		if cache.IsErrNetworkUnavailable(err) {
			return fmt.Errorf("unable to retrieve commands: network unavailable. Please check your internet connection")
		}
		if strings.Contains(err.Error(), "offline and no cached manifest") {
			return fmt.Errorf("no cached commands available. Please run 'claude-cmd update' when connected to the internet")
		}
		return fmt.Errorf("failed to retrieve commands: %w", err)
	}

	// Handle empty repository
	if len(manifest.Commands) == 0 {
		fmt.Fprintln(cmd.OutOrStdout(), "No commands available in the repository.")
		return nil
	}

	// Render command list using separate formatter
	renderCommandList(cmd.OutOrStdout(), manifest.Commands)
	return nil
}

// renderCommandList formats and displays the command list with count summary
func renderCommandList(w io.Writer, commands []cache.Command) {
	// Display commands with count summary
	fmt.Fprintf(w, "Available Claude Code commands (%d total):\n\n", len(commands))

	// For now, display commands in a simple list format
	// Category grouping will be implemented in later iteration
	for _, command := range commands {
		fmt.Fprintf(w, "  %-20s %s\n", command.Name, command.Description)
	}
}
