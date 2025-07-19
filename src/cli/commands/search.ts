import { Command } from "commander";

export const searchCommand = new Command("search")
	.description("Find Claude Code commands by name or description.")
	.argument("<query>", "Search query")
	.option("-c, --category <category>", "Filter results by category")
	.action((query, options) => {
		console.log(`Searching for: ${query}`);
		if (options.category) {
			console.log(`Filtering by category: ${options.category}`);
		}
		// TODO: Implement actual search functionality
	});
