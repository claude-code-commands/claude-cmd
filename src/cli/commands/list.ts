import { Command } from "commander";
import { getServices } from "../../services/serviceFactory.ts";
import type { Command as CommandType } from "../../types/Command.js";
import { detectLanguage, handleError } from "../cliUtils.js";

/**
 * Format commands for terminal output
 * Handles presentation layer concerns for the list command
 */
function formatCommandList(
	commands: readonly CommandType[],
	language: string,
): string {
	if (commands.length === 0) {
		return "No commands available in the repository.";
	}

	let output = `${commands.length} available Claude Code Commands (${language}):\n\n`;

	for (const command of commands) {
		output += `${command.name}\t\t${command.description}\n`;
	}

	return output.trim();
}

export const listCommand = new Command("list")
	.description(
		"List displays all available Claude Code slash commands from the repository.\nCommands include descriptions to help you find what you need.",
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

			// Get commands from service
			const commands = await commandService.listCommands(serviceOptions);

			// Determine language used
			const language = detectLanguage(options.language, languageDetector);

			// Format and display output
			const output = formatCommandList(commands, language);
			console.log(output);
		} catch (error) {
			handleError(error, "Failed to list available commands");
		}
	});
