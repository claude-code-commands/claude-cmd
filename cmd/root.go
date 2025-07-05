package cmd

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/claude-code-commands/claude-cmd/internal/cache"
	"github.com/claude-code-commands/claude-cmd/internal/interfaces"
	"github.com/claude-code-commands/claude-cmd/internal/status"
	"github.com/spf13/afero"
	"github.com/spf13/cobra"
)

// RootOption configures the root command with various functional options.
// This pattern allows flexible configuration while maintaining backwards compatibility.
type RootOption func(*rootConfig)

// rootConfig holds configuration for the root command behavior.
// It supports optional status dashboard functionality alongside traditional help output.
type rootConfig struct {
	statusEnabled bool                             // Enable status dashboard display on root command
	statusFormat  string                           // Output format for status (default, compact, detailed, json)
	cacheManager  interfaces.CacheManagerInterface // Custom cache manager for dependency injection
}

// WithStatusEnabled enables or disables status display on root command.
// When enabled, the root command displays comprehensive status information
// including version, cache state, and installed command counts instead of basic help text.
//
// Parameters:
//   - enabled: true to show status dashboard, false for traditional help output
//
// Returns:
//   - RootOption: Configuration function for root command setup
func WithStatusEnabled(enabled bool) RootOption {
	return func(config *rootConfig) {
		config.statusEnabled = enabled
	}
}

// WithStatusCacheManager sets a custom cache manager for status functionality.
// This is primarily used for testing scenarios where you need to provide
// mock cache behavior or specific cache states for validation.
//
// Parameters:
//   - cm: Cache manager interface implementation for dependency injection
//
// Returns:
//   - RootOption: Configuration function for root command setup
func WithStatusCacheManager(cm interfaces.CacheManagerInterface) RootOption {
	return func(config *rootConfig) {
		config.cacheManager = cm
	}
}

var rootCmd = &cobra.Command{
	Use:   "claude-cmd",
	Short: "A CLI package manager for Claude Code slash commands",
	Long: `claude-cmd is a CLI tool that helps you discover, install, and manage 
Claude Code slash commands from a centralized repository. It provides a simple 
way to extend Claude Code with community-contributed commands.`,
	Run: func(cmd *cobra.Command, args []string) {
		fmt.Println("claude-cmd - CLI package manager for Claude Code slash commands")
		fmt.Println("Use 'claude-cmd --help' for more information.")
	},
}

// Execute runs the root command
func Execute() {
	if err := rootCmd.Execute(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

// newRootCommand creates a root command without status functionality (backwards compatibility).
// This constructor maintains the traditional behavior where the root command displays
// basic help information, ensuring existing integrations continue to work unchanged.
//
// Parameters:
//   - fs: Filesystem abstraction for testing and production use
//
// Returns:
//   - *cobra.Command: Configured root command with traditional help output
func newRootCommand(fs afero.Fs) *cobra.Command {
	return newRootCommandWithOptions(fs)
}

// newRootCommandWithOptions creates a root command with configurable options.
// This constructor supports the functional options pattern for flexible configuration
// while maintaining backwards compatibility. When no options are provided, it behaves
// identically to newRootCommand().
//
// Parameters:
//   - fs: Filesystem abstraction for testing and production use
//   - opts: Variadic functional options for configuring root command behavior
//
// Returns:
//   - *cobra.Command: Configured root command with optional status dashboard functionality
//
// Example:
//
//	// Traditional behavior (help output)
//	cmd := newRootCommandWithOptions(fs)
//
//	// With status dashboard enabled
//	cmd := newRootCommandWithOptions(fs, WithStatusEnabled(true))
//
//	// With custom cache manager for testing
//	cmd := newRootCommandWithOptions(fs,
//	    WithStatusEnabled(true),
//	    WithStatusCacheManager(mockCache))
func newRootCommandWithOptions(fs afero.Fs, opts ...RootOption) *cobra.Command {
	// Apply configuration options
	config := &rootConfig{
		statusEnabled: false, // Default to disabled for backwards compatibility
		statusFormat:  "default",
	}
	for _, opt := range opts {
		opt(config)
	}

	cmd := &cobra.Command{
		Use:   "claude-cmd",
		Short: "A CLI package manager for Claude Code slash commands",
		Long: `claude-cmd is a CLI tool that helps you discover, install, and manage 
Claude Code slash commands from a centralized repository. It provides a simple 
way to extend Claude Code with community-contributed commands.`,
		RunE: func(cmd *cobra.Command, args []string) error {
			return runRootCommand(cmd, fs, config)
		},
	}

	// Add format flag when status is enabled
	if config.statusEnabled {
		cmd.Flags().StringVar(&config.statusFormat, "format", "default", "Output format (default, compact, detailed, json)")
	}

	// Add subcommands
	cmd.AddCommand(newLanguageCommand(fs))
	cmd.AddCommand(newListCommand(fs))
	cmd.AddCommand(newAddCommand(fs))
	cmd.AddCommand(newSearchCommand(fs))
	cmd.AddCommand(newInfoCommand(fs))

	return cmd
}

// runRootCommand executes the root command logic with configurable behavior.
// This function routes execution based on configuration, either displaying traditional
// help output or comprehensive status information. It maintains backwards compatibility
// by defaulting to help output when status is disabled.
//
// Parameters:
//   - cmd: Cobra command instance for output and flag access
//   - fs: Filesystem abstraction for testing and production use
//   - config: Root command configuration determining execution behavior
//
// Returns:
//   - error: Any error encountered during execution (nil for help output)
func runRootCommand(cmd *cobra.Command, fs afero.Fs, config *rootConfig) error {
	if config.statusEnabled {
		return runRootCommandWithStatus(cmd, fs, config)
	}

	// Default behavior (backwards compatibility)
	fmt.Fprintln(cmd.OutOrStdout(), "claude-cmd - CLI package manager for Claude Code slash commands")
	fmt.Fprintln(cmd.OutOrStdout(), "Use 'claude-cmd --help' for more information.")
	return nil
}

// runRootCommandWithStatus executes the root command with status display.
// This function aggregates comprehensive status information including version,
// cache state, and installed command statistics, then formats and displays it
// according to the requested output format. It handles cache misses gracefully
// and provides meaningful error messages for operational issues.
//
// Parameters:
//   - cmd: Cobra command instance for output and flag access
//   - fs: Filesystem abstraction for testing and production use
//   - config: Root command configuration with status settings and cache manager
//
// Returns:
//   - error: Status retrieval or formatting errors (cache misses handled gracefully)
func runRootCommandWithStatus(cmd *cobra.Command, fs afero.Fs, config *rootConfig) error {
	// Create cache manager if not provided
	cacheManager := config.cacheManager
	if cacheManager == nil {
		cacheDir, err := os.UserCacheDir()
		if err != nil {
			return fmt.Errorf("failed to get user cache directory: %w", err)
		}
		cacheDir = filepath.Join(cacheDir, "claude-cmd")
		cacheManager = cache.NewCacheManager(fs, cacheDir)
	}

	// Create status service
	statusService := status.NewStatusService(fs, cacheManager)

	// Get current language preference (defaults to "en" if not configured)
	lang := getCurrentLanguage(fs)

	// Get full status
	fullStatus, err := statusService.GetFullStatus(lang)
	if err != nil {
		return fmt.Errorf("failed to get status: %w", err)
	}

	// Format and display status
	formatter := status.NewStatusFormatter()
	output, err := formatter.Format(fullStatus, config.statusFormat)
	if err != nil {
		return fmt.Errorf("failed to format status: %w", err)
	}

	fmt.Fprint(cmd.OutOrStdout(), output)
	return nil
}

func init() {
	// Global flags can be added here

	// Add subcommands using real filesystem for production
	fs := afero.NewOsFs()
	rootCmd.AddCommand(newLanguageCommand(fs))
	rootCmd.AddCommand(newListCommand(fs))
	rootCmd.AddCommand(newAddCommand(fs))
	rootCmd.AddCommand(newSearchCommand(fs))
	rootCmd.AddCommand(newInfoCommand(fs))
}
