import { Command } from "commander";

export const addCommand = new Command("add")
  .description("Download and install a Claude Code slash command from the repository.")
  .argument("<command-name>", "Name of the command to install")
  .action((commandName, options) => {
    console.log(`Installing command: ${commandName}`);
    // TODO: Implement actual add functionality
  });