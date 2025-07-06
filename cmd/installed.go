package cmd

import (
	"fmt"
	"io"
	"path/filepath"
	"strings"

	"github.com/claude-code-commands/claude-cmd/internal/install"
	"github.com/spf13/afero"
	"github.com/spf13/cobra"
)

// InstalledOption configures the installed command
type InstalledOption func(*installedConfig)

// installedConfig holds configuration for the installed command
type installedConfig struct {
	// Future extension point for options like filtering by location
}

// newInstalledCommand creates the installed command for displaying locally installed commands
func newInstalledCommand(fs afero.Fs, opts ...InstalledOption) *cobra.Command {
	// Apply configuration options
	config := &installedConfig{}
	for _, opt := range opts {
		opt(config)
	}

	cmd := &cobra.Command{
		Use:   "installed",
		Short: "List installed Claude Code commands",
		Long: `Installed displays all Claude Code slash commands currently installed on your system.
Commands are shown with their installation location (project or personal directory).`,
		RunE: func(cmd *cobra.Command, args []string) error {
			return runInstalledCommand(cmd, fs)
		},
	}

	return cmd
}

// runInstalledCommand executes the installed command logic
func runInstalledCommand(cmd *cobra.Command, fs afero.Fs) error {
	// Get all installed commands
	commands, err := install.ListInstalledCommands(fs)
	if err != nil {
		return fmt.Errorf("failed to list installed commands: %w", err)
	}

	// Handle no installed commands
	if len(commands) == 0 {
		fmt.Fprintln(cmd.OutOrStdout(), "No commands installed.")
		return nil
	}

	// Render installed command list using separate formatter
	renderInstalledList(cmd.OutOrStdout(), commands)
	return nil
}

// renderInstalledList formats and displays the installed command list with count summary
func renderInstalledList(w io.Writer, commands []install.CommandLocation) {
	// Display commands with count summary
	fmt.Fprintf(w, "Installed Claude Code commands (%d total):\n\n", len(commands))

	// Display each command with its location
	for _, command := range commands {
		commandName := strings.TrimSuffix(filepath.Base(command.Path), ".md")
		location := getLocationLabel(command.Path)
		fmt.Fprintf(w, "  %-20s (%s)\n", commandName, location)
	}
}

// getLocationLabel determines if a command is from personal or project directory
// using canonical path comparison for robust location detection
func getLocationLabel(commandPath string) string {
	// Get absolute path for reliable comparison
	absCommandPath, err := filepath.Abs(commandPath)
	if err != nil {
		// Fallback to original logic if path resolution fails
		if strings.Contains(commandPath, ".claude/commands") &&
			(strings.HasPrefix(commandPath, "./") || strings.HasPrefix(commandPath, ".claude/")) {
			return "project"
		}
		return "personal"
	}

	// Try to determine project directory and compare
	projectDir, err := filepath.Abs(filepath.Join(".", ".claude", "commands"))
	if err == nil {
		if strings.HasPrefix(absCommandPath, projectDir) {
			return "project"
		}
	}

	// Try to determine personal directory and compare
	personalDir, err := install.GetPersonalDir()
	if err == nil {
		absPersonalDir, err := filepath.Abs(personalDir)
		if err == nil && strings.HasPrefix(absCommandPath, absPersonalDir) {
			return "personal"
		}
	}

	// Default fallback to personal if location cannot be determined
	return "personal"
}
