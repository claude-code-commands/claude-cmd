import { Command } from "commander";
import BunFileService from "../../services/BunFileService.js";
import BunHTTPClient from "../../services/BunHTTPClient.js";
import { CacheManager } from "../../services/CacheManager.js";
import { CommandService } from "../../services/CommandService.js";
import HTTPRepository from "../../services/HTTPRepository.js";
import { LanguageDetector } from "../../services/LanguageDetector.js";
import type { Command as CommandType } from "../../types/Command.js";

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

/**
 * Handle errors with user-friendly messages
 */
function handleError(error: unknown): void {
	let errorMessage = "Failed to list commands";

	if (error instanceof Error) {
		// Extract meaningful error messages for users
		if (error.name === "CommandServiceError") {
			errorMessage = `Error: ${error.message}`;
		} else if (error.name === "ManifestError") {
			errorMessage = "Error: Could not retrieve command list from repository";
		} else if (error.message.includes("timeout")) {
			errorMessage =
				"Error: Request timed out. Please check your internet connection";
		} else if (error.message.includes("network")) {
			errorMessage =
				"Error: Network error. Please check your internet connection";
		} else {
			errorMessage = `Error: ${error.message}`;
		}
	}

	console.error(errorMessage);
	process.exit(1);
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
			// Initialize dependencies (following existing service patterns)
			const fileService = new BunFileService();
			const httpClient = new BunHTTPClient();
			const repository = new HTTPRepository(httpClient, fileService);
			const cacheManager = new CacheManager(fileService);
			const languageDetector = new LanguageDetector();

			// Create CommandService
			const commandService = new CommandService(
				repository,
				cacheManager,
				languageDetector,
			);

			// Prepare options for CommandService
			const serviceOptions = {
				language: options.language,
				forceRefresh: options.force,
			};

			// Get commands from service
			const commands = await commandService.listCommands(serviceOptions);

			// Determine language used
			const language =
				options.language ??
				languageDetector.detect({
					cliFlag: "",
					envVar: process.env.CLAUDE_CMD_LANG ?? "",
					posixLocale: process.env.LANG ?? "",
				});

			// Format and display output
			const output = formatCommandList(commands, language);
			console.log(output);
		} catch (error) {
			handleError(error);
		}
	});
