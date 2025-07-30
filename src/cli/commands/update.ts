import { Command } from "commander";
import { getServices } from "../../services/serviceFactory.js";
import type { CommandServiceOptions } from "../../services/CommandService.js";

export const updateCommand = new Command("update")
	.description("Refresh the cached command manifest from the repository.")
	.option(
		"-l, --lang <language>",
		"Language for commands (default: auto-detect)",
	)
	.action(async (options) => {
		try {
			console.log("Updating command manifest...");
			
			if (options.lang) {
				console.log(`Using language: ${options.lang}`);
			}

			const { commandService } = getServices();
			
			const serviceOptions: CommandServiceOptions = options.lang 
				? { language: options.lang }
				: {};

			const result = await commandService.updateCache(serviceOptions);

			console.log("Command manifest updated successfully!");
			console.log(`Language: ${result.language}`);
			console.log(`Commands available: ${result.commandCount}`);
			console.log(`Updated at: ${new Date(result.timestamp).toLocaleString()}`);
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
