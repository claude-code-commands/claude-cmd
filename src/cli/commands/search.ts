import { Command } from "commander";
import { getServices } from "../../services/serviceFactory.js";
import type { Command as CommandType } from "../../types/Command.js";
import { detectLanguage, handleError } from "../cliUtils.js";

/**
 * Format search results for terminal output with enhanced UX
 * Provides clear result count, organized layout, and helpful messaging
 *
 * @param commands - Array of matching commands from search
 * @param query - Original search query for context
 * @param language - Language used for the search
 * @returns Formatted string ready for console output
 */
function formatSearchResults(
	commands: readonly CommandType[],
	query: string,
	language: string,
): string {
	// Handle empty results with helpful message
	if (commands.length === 0) {
		return `No commands found matching '${query}'.\n\nTip: Try a broader search term or use 'claude-cmd list' to see all available commands.`;
	}

	// Create header with result count and context
	const resultCount = commands.length;
	const plural = resultCount === 1 ? "command" : "commands";
	let output = `Found ${resultCount} ${plural} matching '${query}' (${language}):\n\n`;

	// Format each command with consistent spacing
	for (const command of commands) {
		// Use consistent tab spacing for alignment (matching list command)
		output += `${command.name}\t\t${command.description}\n`;
	}

	return output.trim();
}

/**
 * Search command for finding Claude Code commands by name or description.
 *
 * This command performs case-insensitive search across command names and descriptions,
 * providing users with a quick way to discover relevant commands. Results are formatted
 * in a user-friendly manner with helpful context and suggestions.
 *
 * Features:
 * - Case-insensitive search in names and descriptions
 * - Language-specific search with auto-detection
 * - Cache management with force refresh option
 * - Clear result formatting with count and context
 * - Graceful error handling with user-friendly messages
 *
 * @example
 * ```bash
 * # Basic search
 * claude-cmd search debug
 *
 * # Search with specific language
 * claude-cmd search test --language=en
 *
 * # Force refresh cache and search
 * claude-cmd search api --force
 * ```
 */
export const searchCommand = new Command("search")
	.description(
		"Find Claude Code commands by name or description.\nPerforms case-insensitive search to help you discover relevant commands.",
	)
	.argument(
		"<query>",
		"Search query to match against command names and descriptions",
	)
	.option(
		"-l, --language <lang>",
		"Language for commands (default: auto-detect from system)",
	)
	.option("-f, --force", "Force refresh cache to get latest commands")
	.action(async (query, options) => {
		try {
			// Get singleton service instances from factory
			const { commandQueryService, languageDetector } = getServices();

			// Prepare options for CommandService with proper typing
			const serviceOptions = {
				language: options.language,
				forceRefresh: options.force,
			};

			// Execute search through service layer
			const commands = await commandQueryService.searchCommands(
				query,
				serviceOptions,
			);

			// Determine effective language used for search
			const language = await detectLanguage(options.language, languageDetector);

			// Format results and display to user
			const output = formatSearchResults(commands, query, language);
			console.log(output);
		} catch (error) {
			// Handle errors with user-friendly messages and proper exit codes
			handleError(error, "Failed to search commands");
		}
	});
