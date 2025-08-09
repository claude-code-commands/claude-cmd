import path from "node:path";
import type IRepository from "../interfaces/IRepository.js";
import type { LanguageStatusInfo } from "../interfaces/IRepository.js";
import type { Command, Manifest, RepositoryOptions } from "../types/Command.js";
import { CommandNotFoundError } from "../types/Command.js";
import type { CommandParser } from "./CommandParser.js";
import type { DirectoryDetector } from "./DirectoryDetector.js";

/**
 * Local command repository implementation
 *
 * This class provides a concrete implementation of the IRepository interface that scans
 * local Claude command directories for installed commands. It discovers commands from both
 * personal (~/.claude/commands) and project (.claude/commands) directories with full
 * namespace support.
 *
 * The repository follows these architectural principles:
 * - Namespace-aware command discovery using the established namespace infrastructure
 * - Integration with existing CommandParser for consistent metadata extraction
 * - Personal directory takes precedence over project directory for duplicate commands
 * - Language-agnostic operation (local commands are not language-specific)
 * - Graceful error handling for malformed command files
 *
 * @example Basic usage
 * ```typescript
 * const directoryDetector = new DirectoryDetector(fileService);
 * const commandParser = new CommandParser(namespaceService);
 * const repository = new LocalCommandRepository(directoryDetector, commandParser);
 *
 * // Get manifest of all local commands
 * const manifest = await repository.getManifest('en');
 * console.log(`Found ${manifest.commands.length} local commands`);
 *
 * // Fetch specific command content
 * const content = await repository.getCommand('my-helper', 'en');
 * console.log(content); // Markdown content of the command
 * ```
 */
export class LocalCommandRepository implements IRepository {
	constructor(
		private readonly directoryDetector: DirectoryDetector,
		private readonly commandParser: CommandParser,
	) {}

	/**
	 * Retrieve the command manifest from local directories
	 *
	 * Scans both personal and project directories for command files, parses their metadata,
	 * and creates a manifest. Personal directory commands take precedence over project
	 * directory commands if there are naming conflicts.
	 *
	 * @param language - Language code (ignored for local commands)
	 * @param options - Repository options (ignored for local commands)
	 * @returns Promise resolving to the complete manifest of local commands
	 */
	async getManifest(
		_language: string,
		_options?: RepositoryOptions,
	): Promise<Manifest> {
		try {
			// Scan all Claude directories for command files
			const scanResult =
				await this.directoryDetector.scanAllClaudeDirectories();

			// Combine files from both directories, with personal taking precedence
			const allFiles = [...scanResult.personal, ...scanResult.project];

			// Parse each command file and collect valid commands
			const commands: Command[] = [];
			const processedNames = new Set<string>(); // Track processed command names for deduplication

			for (const filePath of allFiles) {
				try {
					// Read and parse the command file first to get the actual command name
					const content =
						await this.directoryDetector.fileService.readFile(filePath);

					// Create relative path for proper namespace extraction
					const relativePath = await this.getRelativeCommandPath(filePath);
					const command = await this.commandParser.parseCommandFile(
						content,
						relativePath,
					);

					// Use the actual command name (which includes namespace if present) for deduplication
					// (personal directory files are processed first, so they take precedence)
					if (processedNames.has(command.name)) {
						continue;
					}

					commands.push(command);
					processedNames.add(command.name);
				} catch (_error) {}
			}

			// Create manifest with current timestamp
			const manifest: Manifest = {
				version: "1.0.0",
				updated: new Date().toISOString(),
				commands: commands,
			};

			return manifest;
		} catch (_error) {
			// If directory scanning fails, return empty manifest
			return {
				version: "1.0.0",
				updated: new Date().toISOString(),
				commands: [],
			};
		}
	}

	/**
	 * Retrieve the content of a specific local command file
	 *
	 * Searches both personal and project directories for the specified command,
	 * with personal directory taking precedence. Returns the raw markdown content.
	 *
	 * @param commandName - Name of the command to retrieve
	 * @param language - Language code (ignored for local commands)
	 * @param options - Repository options (ignored for local commands)
	 * @returns Promise resolving to the raw markdown content of the command file
	 * @throws CommandNotFoundError when command doesn't exist locally
	 */
	async getCommand(
		commandName: string,
		language: string,
		_options?: RepositoryOptions,
	): Promise<string> {
		try {
			// Get the manifest which now has properly namespaced command names
			const manifest = await this.getManifest(language);

			// Find command by exact name match only (strict matching)
			const matchingCommand = manifest.commands.find(
				(cmd) => cmd.name === commandName,
			);

			if (!matchingCommand) {
				throw new CommandNotFoundError(commandName, language);
			}

			// Now find the actual file path for this command
			const scanResult =
				await this.directoryDetector.scanAllClaudeDirectories();
			const allFiles = [...scanResult.personal, ...scanResult.project];

			for (const filePath of allFiles) {
				try {
					const content =
						await this.directoryDetector.fileService.readFile(filePath);
					const relativePath = await this.getRelativeCommandPath(filePath);
					const parsedCommand = await this.commandParser.parseCommandFile(
						content,
						relativePath,
					);

					// Match by the parsed command name
					if (parsedCommand.name === matchingCommand.name) {
						return content;
					}
				} catch (_error) {
					// Skip files that can't be parsed
				}
			}

			// This shouldn't happen if manifest is in sync, but handle gracefully
			throw new CommandNotFoundError(commandName, language);
		} catch (error) {
			if (error instanceof CommandNotFoundError) {
				throw error;
			}

			// For other errors (I/O issues, etc.), treat as command not found
			throw new CommandNotFoundError(commandName, language);
		}
	}

	/**
	 * Convert absolute file path to relative path within command directory
	 * This ensures proper namespace extraction by the CommandParser
	 *
	 * @param absolutePath - Absolute path to the command file
	 * @returns Relative path within the command directory
	 */
	private async getRelativeCommandPath(absolutePath: string): Promise<string> {
		try {
			const personalDir = await this.directoryDetector.getPersonalDirectory();
			const projectDir =
				await this.directoryDetector.getProjectDirectory(false); // Use relative path for consistency

			// Check if path is in personal directory
			if (absolutePath.startsWith(personalDir)) {
				const relativePath = path.relative(personalDir, absolutePath);
				return relativePath;
			}

			// Check if path is in project directory
			// For project directory, we need to handle both absolute and relative paths
			const absoluteProjectDir = path.resolve(projectDir);
			if (
				absolutePath.startsWith(absoluteProjectDir) ||
				absolutePath.startsWith(projectDir)
			) {
				const baseDir = absolutePath.startsWith(absoluteProjectDir)
					? absoluteProjectDir
					: projectDir;
				const relativePath = path.relative(baseDir, absolutePath);
				return relativePath;
			}

			// Fallback - extract relative path from filename if path doesn't match expected directories
			return path.basename(absolutePath);
		} catch (_error) {
			// Fallback to just the filename
			return path.basename(absolutePath);
		}
	}

	/**
	 * Get available languages - for local repository, always returns just 'en'
	 * since local commands don't have language variants
	 */
	async getAvailableLanguages(): Promise<LanguageStatusInfo[]> {
		// Local commands are language-agnostic, so we return a single entry
		const manifest = await this.getManifest("en");
		return [
			{
				code: "en",
				name: "English",
				commandCount: manifest.commands.length,
			},
		];
	}
}
