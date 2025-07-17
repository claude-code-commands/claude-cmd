import { Command } from "commander";

export const installedCommand = new Command("installed")
  .description("Installed displays all Claude Code slash commands currently installed on your system.\nCommands are shown with their installation location (project or personal directory).")
  .action(() => {
    console.log("Listing installed commands...");
    // TODO: Implement actual installed functionality
  });