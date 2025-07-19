import { Command } from "commander";

export const installedCommand = new Command("installed")
	.description(
		"Display all Claude Code slash commands currently installed on your system.",
	)
	.action(() => {
		console.log("Listing installed commands...");
		// TODO: Implement actual installed functionality
	});
