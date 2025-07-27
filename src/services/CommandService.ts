import type IRepository from "../interfaces/IRepository.js";
import type { Command } from "../types/Command.js";
import { CommandNotFoundError } from "../types/Command.js";
import type { CacheManager } from "./CacheManager.js";
import type { LanguageDetector } from "./LanguageDetector.js";

/**
 * Internal error for CommandService operations
 */
export class CommandServiceError extends Error {
	constructor(
		message: string,
		public readonly operation: string,
		public readonly language: string,
		public override readonly cause?: Error,
	) {
		super(message);
		this.name = this.constructor.name;
	}
}

/**
 * Options for CommandService operations that may affect language detection and caching
 */
export interface CommandServiceOptions {
	/** Override automatic language detection */
	readonly language?: string;
	/** Force refresh from remote source, bypassing cache */
	readonly forceRefresh?: boolean;
}

/**
 * CommandService coordinates repository access, caching, and language detection
 * to provide high-level operations for the CLI commands.
 *
 * This service acts as the central orchestrator that:
 * - Uses LanguageDetector to determine which language repository to access
 * - Coordinates with CacheManager for efficient caching
 * - Fetches from Repository when cache is stale or missing
 * - Provides clean error handling and user-friendly error messages
 * - Offers business logic operations like searching and filtering
 */
export interface ICommandService {
	/**
	 * List all available commands from the repository
	 * @param options - Optional language override and cache control
	 * @returns Promise resolving to array of all available commands
	 */
	listCommands(options?: CommandServiceOptions): Promise<readonly Command[]>;

	/**
	 * Search for commands by name or description
	 * @param query - Search query string
	 * @param options - Optional language override and cache control
	 * @returns Promise resolving to array of matching commands
	 */
	searchCommands(
		query: string,
		options?: CommandServiceOptions,
	): Promise<readonly Command[]>;

	/**
	 * Get detailed information about a specific command
	 * @param commandName - Name of the command to retrieve
	 * @param options - Optional language override and cache control
	 * @returns Promise resolving to the command metadata
	 */
	getCommandInfo(
		commandName: string,
		options?: CommandServiceOptions,
	): Promise<Command>;

	/**
	 * Get the full content of a command file
	 * @param commandName - Name of the command to retrieve content for
	 * @param options - Optional language override and cache control
	 * @returns Promise resolving to the raw markdown content
	 */
	getCommandContent(
		commandName: string,
		options?: CommandServiceOptions,
	): Promise<string>;
}

/**
 * Concrete implementation of CommandService that coordinates all dependencies
 */
export class CommandService implements ICommandService {
	constructor(
		private readonly repository: IRepository,
		private readonly cacheManager: CacheManager,
		private readonly languageDetector: LanguageDetector,
	) {}

	/**
	 * Determine the language to use for operations
	 * Centralizes language detection logic and reduces code duplication
	 */
	private resolveLanguage(options?: CommandServiceOptions): string {
		return (
			options?.language ??
			this.languageDetector.detect({
				cliFlag: "",
				envVar: process.env.CLAUDE_CMD_LANG ?? "",
				posixLocale: process.env.LANG ?? "",
			})
		);
	}

	/**
	 * Validate and sanitize command name input
	 */
	private validateCommandName(commandName: string): void {
		if (!commandName || typeof commandName !== "string") {
			throw new CommandServiceError(
				"Command name must be a non-empty string",
				"validation",
				"unknown",
			);
		}

		if (commandName.trim().length === 0) {
			throw new CommandServiceError(
				"Command name cannot be empty or whitespace",
				"validation",
				"unknown",
			);
		}
	}

	/**
	 * Validate and sanitize search query input
	 */
	private validateSearchQuery(query: string): void {
		if (typeof query !== "string") {
			throw new CommandServiceError(
				"Search query must be a string",
				"validation",
				"unknown",
			);
		}

		if (query.trim().length === 0) {
			throw new CommandServiceError(
				"Search query cannot be empty or whitespace",
				"validation",
				"unknown",
			);
		}
	}

	/**
	 * Wrap operations with consistent error handling and context
	 */
	private async withErrorHandling<T>(
		operation: string,
		language: string,
		fn: () => Promise<T>,
	): Promise<T> {
		try {
			return await fn();
		} catch (error) {
			if (
				error instanceof CommandNotFoundError ||
				error instanceof CommandServiceError ||
				(error instanceof Error && error.name === "ManifestError") ||
				(error instanceof Error && error.name === "CommandContentError") ||
				(error instanceof Error && error.name === "RepositoryError")
			) {
				// Re-throw known errors as-is
				throw error;
			}

			// Wrap unknown errors with context
			throw new CommandServiceError(
				`Operation '${operation}' failed: ${error instanceof Error ? error.message : String(error)}`,
				operation,
				language,
				error instanceof Error ? error : undefined,
			);
		}
	}

	async listCommands(
		options?: CommandServiceOptions,
	): Promise<readonly Command[]> {
		const language = this.resolveLanguage(options);

		return this.withErrorHandling("listCommands", language, async () => {
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

	async searchCommands(
		query: string,
		options?: CommandServiceOptions,
	): Promise<readonly Command[]> {
		this.validateSearchQuery(query);
		const language = this.resolveLanguage(options);

		return this.withErrorHandling("searchCommands", language, async () => {
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

	async getCommandInfo(
		commandName: string,
		options?: CommandServiceOptions,
	): Promise<Command> {
		this.validateCommandName(commandName);
		const language = this.resolveLanguage(options);

		return this.withErrorHandling("getCommandInfo", language, async () => {
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

	async getCommandContent(
		commandName: string,
		options?: CommandServiceOptions,
	): Promise<string> {
		this.validateCommandName(commandName);
		const language = this.resolveLanguage(options);

		return this.withErrorHandling("getCommandContent", language, async () => {
			// First verify the command exists in manifest
			await this.getCommandInfo(commandName, options);

			// Fetch command content from repository
			return await this.repository.getCommand(commandName, language, {
				forceRefresh: options?.forceRefresh,
			});
		});
	}
}
