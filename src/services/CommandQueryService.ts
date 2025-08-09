import type IRepository from "../interfaces/IRepository.js";
import type { Command, CommandServiceOptions } from "../types/Command.js";
import { CommandNotFoundError } from "../types/Command.js";
import type { CacheManager } from "./CacheManager.js";
import type { LanguageDetector } from "./LanguageDetector.js";
import {
	resolveLanguage,
	validateCommandName,
	validateSearchQuery,
	withErrorHandling,
} from "./shared/CommandServiceHelpers.js";

/**
 * CommandQueryService handles command discovery and basic information retrieval.
 *
 * Responsibilities:
 * - List all available commands from repository
 * - Search commands by name/description
 * - Get specific command information
 * - Coordinate repository access with caching
 */
export class CommandQueryService {
	constructor(
		private readonly repository: IRepository,
		private readonly cacheManager: CacheManager,
		private readonly languageDetector: LanguageDetector,
	) {}

	/**
	 * List all available commands from the repository
	 */
	async listCommands(
		options?: CommandServiceOptions,
	): Promise<readonly Command[]> {
		const language = resolveLanguage(options, this.languageDetector);

		return withErrorHandling("listCommands", language, async () => {
			// Check cache first (unless force refresh)
			if (!options?.forceRefresh) {
				const cachedManifest = await this.cacheManager.get(language);
				if (cachedManifest && !(await this.cacheManager.isExpired(language))) {
					return cachedManifest.commands;
				}
			}

			// Fetch fresh manifest from repository
			const manifest = await this.repository.getManifest(language, {
				forceRefresh: options?.forceRefresh,
			});

			// Cache the fresh manifest
			await this.cacheManager.set(language, manifest);

			return manifest.commands;
		});
	}

	/**
	 * Search for commands by name or description
	 */
	async searchCommands(
		query: string,
		options?: CommandServiceOptions,
	): Promise<readonly Command[]> {
		validateSearchQuery(query);
		const language = resolveLanguage(options, this.languageDetector);

		return withErrorHandling("searchCommands", language, async () => {
			// Get all commands first
			const allCommands = await this.listCommands(options);

			// Filter by query (case-insensitive search in name and description)
			const queryLower = query.toLowerCase().trim();
			const matchingCommands = allCommands.filter(
				(command) =>
					command.name.toLowerCase().includes(queryLower) ||
					command.description.toLowerCase().includes(queryLower),
			);

			return matchingCommands;
		});
	}

	/**
	 * Get detailed information about a specific command
	 */
	async getCommandInfo(
		commandName: string,
		options?: CommandServiceOptions,
	): Promise<Command> {
		validateCommandName(commandName);
		const language = resolveLanguage(options, this.languageDetector);

		return withErrorHandling("getCommandInfo", language, async () => {
			// Get all commands first
			const allCommands = await this.listCommands(options);

			// Find the specific command
			const command = allCommands.find((cmd) => cmd.name === commandName);
			if (!command) {
				throw new CommandNotFoundError(commandName, language);
			}

			return command;
		});
	}
}
