import { Command } from "commander";
import { getServices } from "../../services/serviceFactory.ts";
import type { Command as CommandType } from "../../types/Command.js";
import { detectLanguage, handleError } from "../cliUtils.js";

/**
 * Format installed commands for terminal output
 * Handles presentation layer concerns for the installed command
 */
function formatInstalledCommands(
	commands: readonly CommandType[],
	language: string,
): string {
	if (commands.length === 0) {
		return "No commands are currently installed.";
	}

	let output = `${commands.length} installed Claude Code Commands (${language}):\n\n`;

	for (const command of commands) {
		output += `${command.name}\t\t${command.description}\n`;
	}

	return output.trim();
}

export const installedCommand = new Command("installed")
	.description(
		"List displays all installed Claude Code slash commands.\nShows commands that are available in your local Claude Code directories.",
	)
	.option(
		"-l, --language <lang>",
		"Language for commands (default: auto-detect)",
	)
	.option("-f, --force", "Force refresh cache even if current")
	.action(async (options) => {
		try {
			// Get singleton service instances from factory
			const { commandService, languageDetector } = getServices();

			// Prepare options for CommandService
			const serviceOptions = {
				language: options.language,
				forceRefresh: options.force,
			};

			// Get installed commands from service
			const commands =
				await commandService.getInstalledCommands(serviceOptions);

			// Determine language used
			const language = detectLanguage(options.language, languageDetector);

			// Format and display output
			const output = formatInstalledCommands(commands, language);
			console.log(output);
		} catch (error) {
			handleError(error, "Failed to list installed commands");
		}
	});
