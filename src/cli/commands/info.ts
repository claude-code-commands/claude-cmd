import { Command } from "commander";
import { getServices } from "../../services/serviceFactory.js";
import type {
	Command as CommandType,
	EnhancedCommandInfo,
} from "../../types/Command.js";
import { detectLanguage, handleError } from "../cliUtils.js";

/**
 * Format command information for terminal output
 * Handles presentation layer concerns for the info command
 */
function _formatCommandInfo(
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

/**
 * Format enhanced command information for terminal output
 * Includes source attribution and installation status
 */
function formatEnhancedCommandInfo(
	command: EnhancedCommandInfo,
	language: string,
	content?: string,
): string {
	let output = `Command: ${command.name}\n`;
	output += `Description: ${command.description}\n`;
	output += `File: ${command.file}\n`;
	output += `Language: ${language}\n`;

	// Source information
	output += `Source: ${command.source}`;
	if (command.availableInSources.length > 1) {
		const otherSources = command.availableInSources.filter(
			(s) => s !== command.source,
		);
		output += ` (also available in: ${otherSources.join(", ")})`;
	}
	output += "\n";

	// Installation status for repository commands
	if (command.installationStatus) {
		const status = command.installationStatus;
		if (status.isInstalled) {
			output += `Installation Status: Installed (${status.installLocation})`;
			if (status.hasLocalChanges) {
				output += " [Local changes detected]";
			}
			output += "\n";
			if (status.installPath) {
				output += `Installation Path: ${status.installPath}\n`;
			}
		} else {
			output += `Installation Status: Not installed\n`;
		}
	}

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

			// Get enhanced command info from service (includes installation status)
			const enhancedCommand = await commandService.getEnhancedCommandInfo(
				commandName,
				serviceOptions,
			);

			// Determine language used via shared utility
			const language = await detectLanguage(options.language, languageDetector);

			// Get command content if detailed flag is set
			let content: string | undefined;
			if (options.detailed) {
				// Try to get content from the primary source (repository or local)
				if (enhancedCommand.source === "repository") {
					content = await commandService.getCommandContent(
						commandName,
						serviceOptions,
					);
				} else {
					// For local commands, get content from the LocalCommandRepository
					const { localCommandRepository } = getServices();
					try {
						content = await localCommandRepository.getCommand(
							commandName,
							language,
							serviceOptions,
						);
					} catch (_error) {
						// Fallback to repository if local content isn't available
						content = await commandService.getCommandContent(
							commandName,
							serviceOptions,
						);
					}
				}
			}

			// Format and display output using enhanced formatting
			const output = formatEnhancedCommandInfo(
				enhancedCommand,
				language,
				content,
			);
			console.log(output);
		} catch (error) {
			handleError(error, "Failed to get command info");
		}
	});
