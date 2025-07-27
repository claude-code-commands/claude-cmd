import { Command } from "commander";

export const searchCommand = new Command("search")
	.description("Find Claude Code commands by name or description.")
	.argument("<query>", "Search query")
	.action((query, options) => {
		console.log(`Searching for: ${query}`);
		// TODO: Implement actual search functionality
	});
