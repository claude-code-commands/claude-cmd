package cmd

import (
	"fmt"
	"io"
	"strings"

	"github.com/claude-code-commands/claude-cmd/internal/cache"
	"github.com/claude-code-commands/claude-cmd/internal/command"
	"github.com/claude-code-commands/claude-cmd/internal/interfaces"
	"github.com/spf13/afero"
	"github.com/spf13/cobra"
)

// SearchOption configures the search command
type SearchOption func(*searchConfig)

// searchConfig holds configuration for the search command
type searchConfig struct {
	cacheManager interfaces.CacheManagerInterface
}

// WithSearchCacheManager sets a custom cache manager for testing
func WithSearchCacheManager(cm interfaces.CacheManagerInterface) SearchOption {
	return func(config *searchConfig) {
		config.cacheManager = cm
	}
}

// newSearchCommand creates the search command for finding commands
func newSearchCommand(fs afero.Fs, opts ...SearchOption) *cobra.Command {
	// Apply configuration options
	config := &searchConfig{}
	for _, opt := range opts {
		opt(config)
	}

	cmd := &cobra.Command{
		Use:   "search <query>",
		Short: "Search for Claude Code commands",
		Long: `Search finds Claude Code commands by name or description.
You can search by partial matches in command names or descriptions.`,
		Args: cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			query := args[0]
			category, _ := cmd.Flags().GetString("category")
			return runSearchCommand(cmd, fs, query, category, config.cacheManager)
		},
	}

	// Add category flag for filtering results
	cmd.Flags().StringP("category", "c", "", "Filter results by category")

	return cmd
}

// runSearchCommand executes the search command logic
func runSearchCommand(cmd *cobra.Command, fs afero.Fs, query, category string, cacheManager interfaces.CacheManagerInterface) error {
	// Use shared command setup utilities to eliminate duplication
	config := &command.BaseConfig{
		CacheManager: cacheManager,
		FileSystem:   fs,
	}

	manifest, _, err := command.CommonCommandSetup(config, getCurrentLanguage)
	if err != nil {
		return err
	}

	// Filter commands based on search query
	matchingCommands := filterCommands(manifest.Commands, query, category)

	// Handle no results
	if len(matchingCommands) == 0 {
		fmt.Fprintf(cmd.OutOrStdout(), "No commands found matching '%s'", query)
		if category != "" {
			fmt.Fprintf(cmd.OutOrStdout(), " in category '%s'", category)
		}
		fmt.Fprintln(cmd.OutOrStdout())
		fmt.Fprintln(cmd.OutOrStdout(), "Try a different search term or run 'claude-cmd list' to see all available commands.")
		return nil
	}

	// Render search results
	renderSearchResults(cmd.OutOrStdout(), matchingCommands, query)
	return nil
}

// filterCommands filters commands based on query and optional category
func filterCommands(commands []cache.Command, query, category string) []cache.Command {
	var results []cache.Command
	queryLower := strings.ToLower(query)

	for _, command := range commands {
		// Check if command matches the search query (name or description)
		nameMatch := strings.Contains(strings.ToLower(command.Name), queryLower)
		descMatch := strings.Contains(strings.ToLower(command.Description), queryLower)

		if !nameMatch && !descMatch {
			continue
		}

		// If category filter is specified, check if command belongs to that category
		if category != "" {
			// For now, we'll use a simple prefix-based category matching
			// This can be improved in the REFACTOR phase
			commandCategory := extractCategory(command.Name)
			if !strings.EqualFold(commandCategory, category) {
				continue
			}
		}

		results = append(results, command)
	}

	return results
}

// extractCategory extracts category from command name with improved logic.
// This implementation handles various naming patterns more robustly than the
// simple string split approach used previously.
func extractCategory(name string) string {
	if name == "" {
		return ""
	}

	// Handle kebab-case names (e.g., "debug-issue" -> "debug")
	parts := strings.Split(name, "-")
	if len(parts) > 0 && parts[0] != "" {
		return strings.ToLower(parts[0])
	}

	// Handle underscore names (e.g., "debug_issue" -> "debug")
	parts = strings.Split(name, "_")
	if len(parts) > 0 && parts[0] != "" {
		return strings.ToLower(parts[0])
	}

	// Fallback to the entire name if no separators found
	return strings.ToLower(name)
}

// renderSearchResults formats and displays the search results
func renderSearchResults(w io.Writer, commands []cache.Command, query string) {
	// Display search results with count
	fmt.Fprintf(w, "Found %d command(s) matching '%s':\n\n", len(commands), query)

	// Display commands in a simple list format
	for _, command := range commands {
		fmt.Fprintf(w, "  %-20s %s\n", command.Name, command.Description)
	}
}
