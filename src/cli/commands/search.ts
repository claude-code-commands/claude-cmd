import { Command } from "commander";

export const searchCommand = new Command("search")
  .description("Search finds Claude Code commands by name or description.\nYou can search by partial matches in command names or descriptions.")
  .argument("<query>", "Search query")
  .option("-c, --category <category>", "Filter results by category")
  .action((query, options) => {
    console.log(`Searching for: ${query}`);
    if (options.category) {
      console.log(`Filtering by category: ${options.category}`);
    }
    // TODO: Implement actual search functionality
  });