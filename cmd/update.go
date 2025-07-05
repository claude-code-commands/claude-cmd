package cmd

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/claude-code-commands/claude-cmd/internal/cache"
	"github.com/claude-code-commands/claude-cmd/internal/interfaces"
	"github.com/spf13/afero"
	"github.com/spf13/cobra"
)

// UpdateOption configures the update command
type UpdateOption func(*updateConfig)

// updateConfig holds configuration for the update command
type updateConfig struct {
	cacheManager interfaces.CacheManagerInterface
}

// WithUpdateCacheManager sets a custom cache manager for testing
func WithUpdateCacheManager(cm interfaces.CacheManagerInterface) UpdateOption {
	return func(config *updateConfig) {
		config.cacheManager = cm
	}
}

// newUpdateCommand creates the update command for refreshing cached manifest
func newUpdateCommand(fs afero.Fs, opts ...UpdateOption) *cobra.Command {
	return newUpdateCommandWithOptions(fs, opts...)
}

// newUpdateCommandWithOptions creates the update command with configurable options
func newUpdateCommandWithOptions(fs afero.Fs, opts ...UpdateOption) *cobra.Command {
	// Apply configuration options
	config := &updateConfig{}
	for _, opt := range opts {
		opt(config)
	}

	cmd := &cobra.Command{
		Use:   "update",
		Short: "Update the cached command manifest",
		Long: `Update refreshes the cached command manifest from the repository.

This command downloads the latest command list and displays what changed.
Use --force to refresh even if the cache appears to be current.`,
		RunE: func(cmd *cobra.Command, args []string) error {
			// Get force flag
			force, _ := cmd.Flags().GetBool("force")

			// Get language flag
			langFlag, _ := cmd.Flags().GetString("language")

			return runUpdateCommand(cmd, fs, config.cacheManager, force, langFlag)
		},
	}

	// Add flags
	cmd.Flags().BoolP("force", "f", false, "Force refresh even if cache is current")
	cmd.Flags().StringP("language", "l", "", "Language for commands (default: auto-detect)")

	return cmd
}

// runUpdateCommand executes the update command logic
func runUpdateCommand(cmd *cobra.Command, fs afero.Fs, cacheManager interfaces.CacheManagerInterface, force bool, langFlag string) error {
	// Resolve language
	lang := "en" // Default for now, will implement proper language detection later
	if langFlag != "" {
		lang = langFlag
	}

	// Create cache manager if not provided
	if cacheManager == nil {
		cacheDir, err := os.UserCacheDir()
		if err != nil {
			return fmt.Errorf("failed to get user cache directory: %w", err)
		}
		cacheDir = filepath.Join(cacheDir, "claude-cmd")
		cacheManager = cache.NewCacheManager(fs, cacheDir)
	}

	// Get current cached manifest
	oldManifest, oldErr := cacheManager.GetOrUpdateManifest(lang)

	// Force refresh or get new manifest
	var newManifest *cache.Manifest
	var err error

	if force || oldErr != nil {
		// Force refresh by fetching directly from repository
		newManifest, err = fetchManifestForce(cacheManager, lang)
		if err != nil {
			return fmt.Errorf("failed to refresh manifest: %w", err)
		}
	} else {
		// Try to get updated manifest
		newManifest, err = cacheManager.GetOrUpdateManifest(lang)
		if err != nil {
			return fmt.Errorf("failed to get manifest: %w", err)
		}
	}

	// Compare and display changes
	if newManifest == nil {
		return fmt.Errorf("failed to get updated manifest")
	}

	if oldErr != nil || oldManifest == nil {
		// No previous manifest, show initial setup
		fmt.Fprintf(cmd.OutOrStdout(), "Successfully downloaded command manifest (version %s)\n", newManifest.Version)
		fmt.Fprintf(cmd.OutOrStdout(), "Found %d commands available\n", len(newManifest.Commands))
	} else if manifestsEqual(oldManifest, newManifest) {
		// No changes
		fmt.Fprintf(cmd.OutOrStdout(), "Command manifest is already up-to-date (version %s)\n", newManifest.Version)
		fmt.Fprintf(cmd.OutOrStdout(), "No changes detected\n")
	} else {
		// Show changes
		fmt.Fprintf(cmd.OutOrStdout(), "Successfully updated command manifest from %s to %s\n", oldManifest.Version, newManifest.Version)
		showManifestChanges(cmd, oldManifest, newManifest)
	}

	return nil
}

// fetchManifestForce fetches manifest directly from repository, bypassing cache
func fetchManifestForce(cacheManager interfaces.CacheManagerInterface, lang string) (*cache.Manifest, error) {
	// Check if the cache manager supports force refresh
	if forceRefresher, ok := cacheManager.(interface {
		ForceRefresh(string) (*cache.Manifest, error)
	}); ok {
		return forceRefresher.ForceRefresh(lang)
	}

	// Fallback to regular GetOrUpdateManifest for basic cache managers
	return cacheManager.GetOrUpdateManifest(lang)
}

// manifestsEqual checks if two manifests are equivalent
func manifestsEqual(old, new *cache.Manifest) bool {
	if old.Version != new.Version {
		return false
	}

	if len(old.Commands) != len(new.Commands) {
		return false
	}

	// Create maps for comparison
	oldCommands := make(map[string]cache.Command)
	for _, cmd := range old.Commands {
		oldCommands[cmd.Name] = cmd
	}

	for _, newCmd := range new.Commands {
		oldCmd, exists := oldCommands[newCmd.Name]
		if !exists || oldCmd.Description != newCmd.Description || oldCmd.File != newCmd.File {
			return false
		}
	}

	return true
}

// showManifestChanges displays the differences between old and new manifests
func showManifestChanges(cmd *cobra.Command, old, new *cache.Manifest) {
	// Create maps for efficient lookup
	oldCommands := make(map[string]cache.Command)
	for _, command := range old.Commands {
		oldCommands[command.Name] = command
	}

	newCommands := make(map[string]cache.Command)
	for _, command := range new.Commands {
		newCommands[command.Name] = command
	}

	// Find added commands
	var added []string
	for name := range newCommands {
		if _, exists := oldCommands[name]; !exists {
			added = append(added, name)
		}
	}

	// Find removed commands
	var removed []string
	for name := range oldCommands {
		if _, exists := newCommands[name]; !exists {
			removed = append(removed, name)
		}
	}

	// Find modified commands
	var modified []string
	for name, newCmd := range newCommands {
		if oldCmd, exists := oldCommands[name]; exists {
			if oldCmd.Description != newCmd.Description || oldCmd.File != newCmd.File {
				modified = append(modified, name)
			}
		}
	}

	// Display changes
	if len(added) > 0 {
		fmt.Fprintf(cmd.OutOrStdout(), "\nAdded commands:\n")
		for _, name := range added {
			fmt.Fprintf(cmd.OutOrStdout(), "  + %s\n", name)
		}
	}

	if len(removed) > 0 {
		fmt.Fprintf(cmd.OutOrStdout(), "\nRemoved commands:\n")
		for _, name := range removed {
			fmt.Fprintf(cmd.OutOrStdout(), "  - %s\n", name)
		}
	}

	if len(modified) > 0 {
		fmt.Fprintf(cmd.OutOrStdout(), "\nModified commands:\n")
		for _, name := range modified {
			fmt.Fprintf(cmd.OutOrStdout(), "  ~ %s\n", name)
		}
	}

	if len(added) == 0 && len(removed) == 0 && len(modified) == 0 {
		fmt.Fprintf(cmd.OutOrStdout(), "\nNo command changes detected (metadata updated)\n")
	}
}
