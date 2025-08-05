import { Command } from "commander";
import { getServices } from "../../services/serviceFactory.js";
import type { Command as CommandType } from "../../types/Command.js";
import { detectLanguage, handleError } from "../cliUtils.js";

/**
 * Format command information for terminal output
 * Handles presentation layer concerns for the info command
 */
function formatCommandInfo(
	command: CommandType,
	language: string,
	content?: string,
): string {
	let output = `Command: ${command.name}\n`;
	output += `Description: ${command.description}\n`;
	output += `File: ${command.file}\n`;
	output += `Language: ${language}\n`;

	if (command["allowed-tools"] && command["allowed-tools"].length > 0) {
		const tools = Array.isArray(command["allowed-tools"])
			? command["allowed-tools"].join(", ")
			: command["allowed-tools"];
		output += `Allowed Tools: ${tools}\n`;
	}

	if (content) {
		output += `\n--- Command Content ---\n`;
		output += content;
	}

	return output.trim();
}

export const infoCommand = new Command("info")
	.description(
		"Display detailed information about a Claude Code slash command from the repository.",
	)
	.argument("<command-name>", "Name of the command to show info for")
	.option(
		"-d, --detailed",
		"Show detailed command content with full file preview",
	)
	.option(
		"-l, --language <lang>",
		"Language for commands (default: auto-detect)",
	)
	.option("-f, --force", "Force refresh cache even if current")
	.action(async (commandName, options) => {
		try {
			// Get singleton service instances from factory
			const { commandService, languageDetector } = getServices();

			// Prepare options for CommandService
			const serviceOptions = {
				language: options.language,
				forceRefresh: options.force,
			};

			// Get command info from service
			const command = await commandService.getCommandInfo(
				commandName,
				serviceOptions,
			);

			// Determine language used via shared utility
			const language = await detectLanguage(options.language, languageDetector);

			// Get command content if detailed flag is set
			let content: string | undefined;
			if (options.detailed) {
				content = await commandService.getCommandContent(
					commandName,
					serviceOptions,
				);
			}

			// Format and display output
			const output = formatCommandInfo(command, language, content);
			console.log(output);
		} catch (error) {
			handleError(error, "Failed to get command info");
		}
	});
