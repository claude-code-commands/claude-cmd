import { Command } from "commander";

export const listCommand = new Command("list")
	.description(
		"Display all available Claude Code slash commands from the repository.",
	)
	.action(() => {
		console.log("Listing available commands...");
		// TODO: Implement actual list functionality
	});
