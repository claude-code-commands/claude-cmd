import { Command } from "commander";
import type { CommandServiceOptions } from "../../services/CommandService.js";
import { getServices } from "../../services/serviceFactory.js";

export const updateCommand = new Command("update")
	.description("Refresh the cached command manifest from the repository.")
	.option(
		"-l, --lang <language>",
		"Language for commands (default: auto-detect)",
	)
	.option(
		"--show-changes",
		"Display detailed information about changes detected in the update",
		false,
	)
	.action(async (options) => {
		try {
			console.log("Updating command manifest...");

			if (options.lang) {
				console.log(`Using language: ${options.lang}`);
			}

			const { commandService, changeDisplayFormatter } = getServices();

			const serviceOptions: CommandServiceOptions = options.lang
				? { language: options.lang }
				: {};

			// Use updateCacheWithChanges to get change information
			const result = await commandService.updateCacheWithChanges(serviceOptions);

			// Format and display the results
			const summary = changeDisplayFormatter.formatUpdateSummary(result);
			console.log(summary);

			// If detailed changes are requested and there were changes, show them
			if (options.showChanges && result.hasChanges && result.comparisonResult) {
				console.log("\n" + "=".repeat(50));
				console.log("Detailed Changes:");
				console.log("=".repeat(50));
				
				// Use the ChangeDisplayFormatter to show the detailed changes
				const detailedOutput = changeDisplayFormatter.formatComparisonDetails(result.comparisonResult);
				console.log(detailedOutput);
			}
		} catch (error) {
			console.error("Error updating command manifest:");
			if (error instanceof Error) {
				console.error(error.message);
			} else {
				console.error(String(error));
			}
			process.exit(1);
		}
	});
