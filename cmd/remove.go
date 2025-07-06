package cmd

import (
	"bufio"
	"fmt"
	"os"
	"strings"

	"github.com/claude-code-commands/claude-cmd/internal/install"
	"github.com/spf13/afero"
	"github.com/spf13/cobra"
)

// NewRemoveCommand creates the remove command for removing installed Claude Code commands.
func NewRemoveCommand(fs afero.Fs) *cobra.Command {
	var skipConfirmation bool

	cmd := &cobra.Command{
		Use:   "remove <command-name>",
		Short: "Remove an installed Claude Code command",
		Long: `Remove an installed Claude Code command from your local system.

This command will search for the specified command in both project-specific
(./.claude/commands/) and personal (~/.claude/commands/) directories and
remove it after confirmation.`,
		Args: cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			commandName := args[0]
			return removeCommand(fs, commandName, skipConfirmation, cmd)
		},
	}

	cmd.Flags().BoolVarP(&skipConfirmation, "yes", "y", false, "Skip confirmation prompt")

	return cmd
}

// removeCommand handles the removal of a Claude Code command.
func removeCommand(fs afero.Fs, commandName string, skipConfirmation bool, cmd *cobra.Command) error {
	// Find the command using the shared utility (includes security validation)
	location, err := install.FindInstalledCommand(fs, commandName)
	if err != nil {
		return err
	}

	if !location.Installed {
		return fmt.Errorf("command '%s' is not installed", commandName)
	}

	// Confirm deletion unless --yes flag is provided
	if !skipConfirmation {
		confirmed, err := confirmDeletion(commandName, location.Path)
		if err != nil {
			return err
		}
		if !confirmed {
			cmd.Println("Removal cancelled.")
			return nil
		}
	}

	// Delete the command file
	err = fs.Remove(location.Path)
	if err != nil {
		return fmt.Errorf("failed to remove command file: %w", err)
	}

	cmd.Printf("Command '%s' has been removed from %s\n", commandName, location.Path)
	return nil
}

// confirmDeletion prompts the user for confirmation before deleting a command.
func confirmDeletion(commandName, commandPath string) (bool, error) {
	fmt.Printf("Are you sure you want to remove command '%s' from %s? (y/N): ", commandName, commandPath)

	reader := bufio.NewReader(os.Stdin)
	response, err := reader.ReadString('\n')
	if err != nil {
		return false, fmt.Errorf("reading confirmation: %w", err)
	}

	response = strings.TrimSpace(strings.ToLower(response))
	return response == "y" || response == "yes", nil
}
