import { Command } from "commander";

export const infoCommand = new Command("info")
	.description(
		"Display detailed information about a Claude Code slash command from the repository.",
	)
	.argument("<command-name>", "Name of the command to show info for")
	.option(
		"-d, --detailed",
		"Show detailed command content with full file preview",
	)
	.action((commandName, options) => {
		console.log(`Showing info for command: ${commandName}`);
		if (options.detailed) {
			console.log("Including detailed command content...");
		}
		// TODO: Implement actual info functionality
	});
