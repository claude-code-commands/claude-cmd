import path from "node:path";
import type IFileService from "../interfaces/IFileService.js";
import type IInstallationService from "../interfaces/IInstallationService.js";
import type IRepository from "../interfaces/IRepository.js";
import type IUserInteractionService from "../interfaces/IUserInteractionService.js";
import type { Command, CommandServiceOptions } from "../types/Command.js";
import type {
	InstallationInfo,
	InstallationSummary,
	InstallOptions,
	RemoveOptions,
} from "../types/Installation.js";
import {
	CommandExistsError,
	CommandNotInstalledError,
	InstallationError,
} from "../types/Installation.js";
import { installLogger } from "../utils/logger.js";
import type { CommandParser } from "./CommandParser.js";
import type { DirectoryDetector } from "./DirectoryDetector.js";
import type { LocalCommandRepository } from "./LocalCommandRepository.js";

// Re-export error classes for convenience
export { InstallationError, CommandExistsError, CommandNotInstalledError };

/**
 * InstallationService coordinates command installation, removal, and management
 * across personal and project-specific Claude directories.
 */
export class InstallationService implements IInstallationService {
	private readonly installationMetadataCache = new Map<
		string,
		{
			source: "repository" | "local";
			version?: string;
			metadata: any;
			installedAt: Date;
			location: "personal" | "project";
		}
	>();

	constructor(
		private readonly repository: IRepository,
		private readonly fileService: IFileService,
		private readonly directoryDetector: DirectoryDetector,
		private readonly commandParser: CommandParser,
		private readonly localCommandRepository: LocalCommandRepository,
		private readonly userInteractionService: IUserInteractionService,
	) {}

	/**
	 * Install a command from the repository to local directory
	 *
	 * Downloads and validates command content, creates necessary directory structure,
	 * and stores installation metadata for tracking. Includes security validation
	 * to prevent path traversal attacks.
	 *
	 * @param commandName Name of the command to install (supports namespaced commands)
	 * @param options Installation options (target directory, force overwrite, language)
	 * @throws InstallationError if installation fails or command name is invalid
	 * @throws CommandExistsError if command already exists and force is not specified
	 */
	async installCommand(
		commandName: string,
		options?: InstallOptions,
	): Promise<void> {
		try {
			// Get command content from repository
			const language = options?.language ?? "en";
			const content = await this.repository.getCommand(commandName, language);

			// Get repository manifest for version info
			const manifest = await this.repository.getManifest(language);

			// Validate command content
			const isValid = await this.commandParser.validateCommandFile(content);
			if (!isValid) {
				throw new InstallationError(
					`Invalid command file format for '${commandName}'`,
					"install",
					commandName,
				);
			}

			// Determine installation location
			const targetDir =
				await this.directoryDetector.getPreferredInstallLocation(
					options?.target ?? "personal",
				);

			// Ensure target directory exists
			await this.directoryDetector.ensureDirectoryExists(targetDir);

			// Check for existing installation
			const filePath = path.join(targetDir, `${commandName}.md`);
			const exists = await this.fileService.exists(filePath);

			if (exists && !options?.force) {
				throw new CommandExistsError(commandName, filePath);
			}

			// Validate command name for security (prevent path traversal attacks)
			this.validateCommandName(commandName);

			// Install the command
			const installedAt = new Date();
			await this.fileService.writeFile(filePath, content);

			// Determine the installation location type
			const personalDir = await this.directoryDetector.getPersonalDirectory();
			const isPersonal = !path.relative(personalDir, filePath).startsWith("..");
			const locationType = isPersonal ? "personal" : "project";

			// Store installation metadata in cache (use location-aware key)
			const cacheKey = `${commandName}#${locationType}`;
			this.installationMetadataCache.set(cacheKey, {
				source: "repository",
				version: manifest.version,
				metadata: {
					repositoryVersion: manifest.version,
					language,
					installationOptions: options || {},
				},
				installedAt,
				location: locationType,
			});

			installLogger.info(
				"installCommand success: {commandName} installed to {filePath} ({locationType})",
				{ commandName, filePath, locationType },
			);
		} catch (error) {
			if (error instanceof InstallationError) {
				throw error;
			}

			throw new InstallationError(
				`Failed to install command '${commandName}': ${error instanceof Error ? error.message : String(error)}`,
				"install",
				commandName,
				error instanceof Error ? error : undefined,
			);
		}
	}

	async removeCommand(
		commandName: string,
		options?: RemoveOptions,
	): Promise<void> {
		try {
			const installationPath = await this.getInstallationPath(commandName);

			if (!installationPath) {
				throw new CommandNotInstalledError(commandName);
			}

			// Set --yes mode on user interaction service
			this.userInteractionService.setYesMode(options?.yes ?? false);

			// If --yes flag is provided, skip confirmation entirely
			if (!options?.yes) {
				// Get installation info for detailed confirmation message
				const installationInfo = await this.getInstallationInfo(commandName);
				const locationText = installationInfo
					? installationInfo.location
					: "unknown";
				const pathText = installationInfo
					? installationInfo.filePath
					: installationPath;

				// Ask for confirmation
				const confirmMessage = `Are you sure you want to remove '${commandName}' from ${locationText} directory: ${pathText}?`;
				const shouldRemove = await this.userInteractionService.confirmAction({
					message: confirmMessage,
					defaultResponse: false,
					skipWithYes: true,
				});

				if (!shouldRemove) {
					installLogger.info("command removal canceled: {commandName}", {
						commandName,
					});
					return;
				}
			}

			// Remove the file
			if (await this.fileService.exists(installationPath)) {
				await this.fileService.deleteFile(installationPath);

				// Clear cache entries for this command
				this.invalidateCommandCache(commandName);

				installLogger.info(
					"command removed successfully: {commandName} (path: {path})",
					{ commandName, path: installationPath },
				);
			}
		} catch (error) {
			if (error instanceof InstallationError) {
				throw error;
			}

			throw new InstallationError(
				`Failed to remove command '${commandName}': ${error instanceof Error ? error.message : String(error)}`,
				"remove",
				commandName,
				error instanceof Error ? error : undefined,
			);
		}
	}

	async listInstalledCommands(
		options?: CommandServiceOptions,
	): Promise<readonly Command[]> {
		try {
			// Use LocalCommandRepository for sophisticated local command discovery
			// This provides proper namespace support and consistent metadata extraction
			const manifest = await this.localCommandRepository.getManifest("en", {
				forceRefresh: options?.forceRefresh,
			});

			return manifest.commands;
		} catch (error) {
			throw new InstallationError(
				`Failed to list installed commands: ${error instanceof Error ? error.message : String(error)}`,
				"list",
				undefined,
				error instanceof Error ? error : undefined,
			);
		}
	}

	/**
	 * Get detailed information about an installed command
	 *
	 * Returns comprehensive metadata including installation source, location,
	 * timestamp, and repository information. When a command exists in multiple
	 * locations, returns information for the most recently installed version.
	 *
	 * @param commandName Name of the command (supports namespaced commands with : or / separators)
	 * @returns Promise resolving to installation info or null if not found
	 * @throws InstallationError if command name validation fails
	 */
	async getInstallationInfo(
		commandName: string,
	): Promise<InstallationInfo | null> {
		try {
			// Check both locations and return the most recently installed one
			const directories = await this.directoryDetector.getClaudeDirectories();
			let mostRecentInfo: InstallationInfo | null = null;
			let mostRecentTime = new Date(0); // Epoch

			for (const dir of directories) {
				if (!dir.exists) continue;

				// Build potential file path using consolidated helper
				const filePath = this.buildCommandPath(commandName, dir.path);

				if (await this.fileService.exists(filePath)) {
					const info = await this.getInstallationInfoFromPath(
						commandName,
						filePath,
						dir.type as "personal" | "project",
					);
					if (info && info.installedAt > mostRecentTime) {
						mostRecentInfo = info;
						mostRecentTime = info.installedAt;
					}
				}
			}

			return mostRecentInfo;
		} catch (error) {
			installLogger.error(
				"failed to get installation info: {commandName} (error: {error})",
				{
					commandName,
					error: error instanceof Error ? error.message : String(error),
				},
			);
			return null;
		}
	}

	async isInstalled(commandName: string): Promise<boolean> {
		const installationPath = await this.getInstallationPath(commandName);
		return installationPath !== null;
	}

	async getInstallationPath(commandName: string): Promise<string | null> {
		const directories = await this.directoryDetector.getClaudeDirectories();

		// Check personal directory first, then project directory
		for (const dir of directories) {
			if (!dir.exists) continue;

			// Build the full path using consolidated helper
			const fullPath = this.buildCommandPath(commandName, dir.path);

			if (await this.fileService.exists(fullPath)) {
				return fullPath;
			}
		}

		return null;
	}

	/**
	 * Validates command name to prevent path traversal attacks
	 * @param commandName Command name to validate
	 * @throws InstallationError if command name is invalid
	 */
	private validateCommandName(commandName: string): void {
		if (!commandName || commandName.trim() === "") {
			throw new InstallationError(
				"Command name cannot be empty",
				"validation",
				commandName,
			);
		}

		// Check for dangerous path segments that could enable directory traversal
		const unsafe = /(^\\.{1,2}$|[\\\\\\/]{2,}|^\\s*$)/;
		const segments = commandName.split(/[:/]/);

		if (segments.some((segment) => unsafe.test(segment))) {
			throw new InstallationError(
				`Invalid command name '${commandName}': contains dangerous path segments`,
				"validation",
				commandName,
			);
		}

		// Additional validation: reject absolute paths
		if (path.isAbsolute(commandName)) {
			throw new InstallationError(
				`Invalid command name '${commandName}': absolute paths not allowed`,
				"validation",
				commandName,
			);
		}
	}

	/**
	 * Builds a safe file path for a command in a given directory
	 * Consolidates namespace parsing and path construction logic
	 * @param commandName Command name (may include namespace)
	 * @param baseDir Base directory path
	 * @returns Safe file path for the command
	 */
	private buildCommandPath(commandName: string, baseDir: string): string {
		this.validateCommandName(commandName);

		let filePath: string;
		if (commandName.includes(":") || commandName.includes("/")) {
			// Handle namespaced commands
			const parts = commandName.split(/[:/]/);
			const actualCommandName = parts.pop() || commandName;
			const namespacePath = parts.join("/");
			filePath = namespacePath
				? path.join(baseDir, namespacePath, `${actualCommandName}.md`)
				: path.join(baseDir, `${actualCommandName}.md`);
		} else {
			filePath = path.join(baseDir, `${commandName}.md`);
		}

		// Security check: ensure result is within the base directory
		const resolvedBase = path.resolve(baseDir);
		const resolvedFile = path.resolve(filePath);
		if (!resolvedFile.startsWith(resolvedBase)) {
			throw new InstallationError(
				`Invalid command name '${commandName}': path escapes base directory`,
				"validation",
				commandName,
			);
		}

		return filePath;
	}

	/**
	 * Invalidates cache entries for a command across all locations
	 * @param commandName Command name to invalidate cache for
	 */
	private invalidateCommandCache(commandName: string): void {
		// Remove location-aware cache entries for all possible locations
		for (const location of ["personal", "project"] as const) {
			const cacheKey = `${commandName}#${location}`;
			this.installationMetadataCache.delete(cacheKey);
		}
	}

	private async getInstallationInfoFromPath(
		commandName: string,
		filePath: string,
		locationType: "personal" | "project",
	): Promise<InstallationInfo | null> {
		try {
			// Get file stats
			const content = await this.fileService.readFile(filePath);
			const size = content.length;

			// Check if we have cached metadata for this command + location
			const cacheKey = `${commandName}#${locationType}`;
			const cachedMetadata = this.installationMetadataCache.get(cacheKey);

			// Determine source - if we have cache info, use it; otherwise, assume local
			const source = cachedMetadata ? cachedMetadata.source : "local";
			const version = cachedMetadata?.version;
			const installedAt = cachedMetadata?.installedAt || new Date(); // Fallback for existing files

			// Build metadata object
			const metadata = cachedMetadata?.metadata || {
				language: "en",
				repositoryVersion: undefined,
				installationOptions: undefined,
			};

			return {
				name: commandName,
				filePath,
				location: locationType,
				installedAt,
				size,
				source,
				version,
				metadata,
			};
		} catch (_error) {
			return null;
		}
	}

	/**
	 * Get detailed information about all installed commands
	 *
	 * Scans all Claude directories and returns comprehensive metadata for every
	 * installed command. Commands existing in multiple locations are included
	 * separately with their respective location metadata.
	 *
	 * @returns Promise resolving to array of installation info objects
	 * @throws InstallationError if scanning fails
	 */
	async getAllInstallationInfo(): Promise<InstallationInfo[]> {
		try {
			// Get all installed commands first
			const commands = await this.listInstalledCommands();
			const installationInfos: InstallationInfo[] = [];

			// For each command, check both locations
			for (const command of commands) {
				const directories = await this.directoryDetector.getClaudeDirectories();

				for (const dir of directories) {
					if (!dir.exists) continue;

					// Build potential file path using consolidated helper
					const filePath = this.buildCommandPath(command.name, dir.path);

					if (await this.fileService.exists(filePath)) {
						const info = await this.getInstallationInfoFromPath(
							command.name,
							filePath,
							dir.type as "personal" | "project",
						);
						if (info) {
							installationInfos.push(info);
						}
					}
				}
			}

			return installationInfos;
		} catch (error) {
			throw new InstallationError(
				`Failed to get all installation info: ${error instanceof Error ? error.message : String(error)}`,
				"getAllInstallationInfo",
				undefined,
				error instanceof Error ? error : undefined,
			);
		}
	}

	/**
	 * Get summary statistics about all installed commands
	 *
	 * Provides aggregate information including total command count,
	 * commands per location, and available installation locations.
	 * Useful for displaying overview information to users.
	 *
	 * @returns Promise resolving to installation summary
	 * @throws InstallationError if summary generation fails
	 */
	async getInstallationSummary(): Promise<InstallationSummary> {
		try {
			const allInfo = await this.getAllInstallationInfo();

			const personalCount = allInfo.filter(
				(info) => info.location === "personal",
			).length;
			const projectCount = allInfo.filter(
				(info) => info.location === "project",
			).length;

			const locations: Array<"personal" | "project"> = [];
			if (personalCount > 0) locations.push("personal");
			if (projectCount > 0) locations.push("project");

			return {
				totalCommands: allInfo.length,
				personalCount,
				projectCount,
				locations,
			};
		} catch (error) {
			throw new InstallationError(
				`Failed to get installation summary: ${error instanceof Error ? error.message : String(error)}`,
				"getInstallationSummary",
				undefined,
				error instanceof Error ? error : undefined,
			);
		}
	}
}
