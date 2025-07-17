import { Command } from "commander";

export const removeCommand = new Command("remove")
  .description("Remove an installed Claude Code command from your local system.")
  .argument("<command-name>", "Name of the command to remove")
  .option("-y, --yes", "Skip confirmation prompt")
  .action((commandName, options) => {
    console.log(`Removing command: ${commandName}`);
    if (options.yes) {
      console.log("Skipping confirmation prompt...");
    }
    // TODO: Implement actual remove functionality
  });