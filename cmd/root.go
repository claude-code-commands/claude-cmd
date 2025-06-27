package cmd

import (
	"fmt"
	"os"

	"github.com/spf13/cobra"
)

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

func init() {
	// Global flags can be added here
}