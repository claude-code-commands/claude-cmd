import { Command } from "commander";

export const addCommand = new Command("add")
  .description("Add downloads and installs a Claude Code slash command from the repository.\nThe command will be installed to your personal or project Claude Code directory.")
  .argument("<command-name>", "Name of the command to install")
  .action((commandName, options) => {
    console.log(`Installing command: ${commandName}`);
    // TODO: Implement actual add functionality
  });