import { Command } from "commander";

export const listCommand = new Command("list")
  .description("List displays all available Claude Code slash commands from the repository.\nCommands are organized by category and include descriptions to help you find what you need.")
  .action(() => {
    console.log("Listing available commands...");
    // TODO: Implement actual list functionality
  });