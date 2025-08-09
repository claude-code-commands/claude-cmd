import { Command } from "commander";
import type { CommandServiceOptions } from "../../services/CommandService.js";
import { getServices } from "../../services/serviceFactory.js";
import { handleError } from "../cliUtils.js";

/**
 * Cache update subcommand - refreshes cached command manifest from repository
 */
const cacheUpdateCommand = new Command("update")
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
			const result =
				await commandService.updateCacheWithChanges(serviceOptions);

			// Format and display the results
			const summary = changeDisplayFormatter.formatUpdateSummary(result);
			console.log(summary);

			// If detailed changes are requested and there were changes, show them
			if (options.showChanges && result.hasChanges && result.comparisonResult) {
				console.log(`\n${"=".repeat(50)}`);
				console.log("Detailed Changes:");
				console.log("=".repeat(50));

				// Use the ChangeDisplayFormatter to show the detailed changes
				const detailedOutput = changeDisplayFormatter.formatComparisonDetails(
					result.comparisonResult,
				);
				console.log(detailedOutput);
			}
		} catch (error) {
			handleError(error, "Failed to update command manifest");
		}
	});

/**
 * Cache clear subcommand - clears cached manifests
 */
const cacheClearCommand = new Command("clear")
	.description("Clear cached command manifests.")
	.option(
		"-l, --lang <language>",
		"Clear cache for specific language only (default: clear all languages)",
	)
	.action(async (options) => {
		try {
			const { cacheManager, languageDetector } = getServices();

			if (options.lang) {
				// Clear specific language cache
				await cacheManager.clear(options.lang);
				console.log(`Cache cleared for language: ${options.lang}`);
			} else {
				// Clear all language caches
				const supportedLanguages = ["en", "es", "fr", "de", "ja", "zh", "pt", "it", "ru", "ko"];
				
				let clearedCount = 0;
				for (const language of supportedLanguages) {
					try {
						const cachePath = cacheManager.getCachePath(language);
						const { fileService } = getServices();
						const exists = await fileService.exists(cachePath);
						if (exists) {
							await cacheManager.clear(language);
							clearedCount++;
						}
					} catch (error) {
						// Continue with other languages if one fails
						console.warn(`Warning: Failed to clear cache for ${language}`);
					}
				}
				
				if (clearedCount > 0) {
					console.log(`Cache cleared for ${clearedCount} languages`);
				} else {
					console.log("No cached manifests found to clear");
				}
			}
		} catch (error) {
			handleError(error, "Failed to clear cache");
		}
	});

/**
 * Main cache command with subcommands for cache management operations
 */
export const cacheCommand = new Command("cache")
	.description("Manage local cache for command manifests")
	.addCommand(cacheUpdateCommand)
	.addCommand(cacheClearCommand);