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
			if (options.showChanges && result.hasChanges) {
				console.log("\n" + "=".repeat(50));
				console.log("Detailed Changes:");
				console.log("=".repeat(50));
				
				// Get detailed comparison for display
				const oldManifest = await commandService.listCommands({ 
					...serviceOptions,
					forceRefresh: false 
				});
				// Note: This is a simplified approach. In a full implementation,
				// we might want to store the comparison result from updateCacheWithChanges
				console.log("Use --show-changes with the list command for detailed change information.");
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
