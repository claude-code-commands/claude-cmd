import path from "node:path";
import type IFileService from "../interfaces/IFileService.js";
import type IInstallationService from "../interfaces/IInstallationService.js";
import type IRepository from "../interfaces/IRepository.js";
import type { Command } from "../types/Command.js";
import type {
	DirectoryInfo,
	InstallationInfo,
	InstallOptions,
	RemoveOptions,
} from "../types/Installation.js";
import {
	CommandExistsError,
	CommandNotInstalledError,
	InstallationError,
} from "../types/Installation.js";
import type { CommandParser } from "./CommandParser.js";
import type { CommandServiceOptions } from "./CommandService.js";
import type { DirectoryDetector } from "./DirectoryDetector.js";
import type { LocalCommandRepository } from "./LocalCommandRepository.js";

// Re-export error classes for convenience
export { InstallationError, CommandExistsError, CommandNotInstalledError };

/**
 * InstallationService coordinates command installation, removal, and management
 * across personal and project-specific Claude directories.
 */
export class InstallationService implements IInstallationService {
	constructor(
		private readonly repository: IRepository,
		private readonly fileService: IFileService,
		private readonly directoryDetector: DirectoryDetector,
		private readonly commandParser: CommandParser,
		private readonly localCommandRepository: LocalCommandRepository,
	) {}

	async installCommand(
		commandName: string,
		options?: InstallOptions,
	): Promise<void> {
		try {
			// Get command content from repository
			const language = options?.language ?? "en";
			const content = await this.repository.getCommand(commandName, language);

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

			// Install the command
			await this.fileService.writeFile(filePath, content);
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
		_options?: RemoveOptions,
	): Promise<void> {
		try {
			const installationPath = await this.getInstallationPath(commandName);

			if (!installationPath) {
				throw new CommandNotInstalledError(commandName);
			}

			// For simplicity, we'll skip the confirmation prompt in this implementation
			// In a real CLI, we would prompt the user unless options.yes is true

			// Remove the file
			if (await this.fileService.exists(installationPath)) {
				await this.fileService.deleteFile(installationPath);
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
			const manifest = await this.localCommandRepository.getManifest('en', {
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

	async getInstallationInfo(
		commandName: string,
	): Promise<InstallationInfo | null> {
		const installationPath = await this.getInstallationPath(commandName);

		if (!installationPath) {
			return null;
		}

		try {
			// Determine location type based on path using secure path comparison
			const personalDir = await this.directoryDetector.getPersonalDirectory();
			const isPersonal =
				path.isAbsolute(installationPath) &&
				!path.relative(personalDir, installationPath).startsWith("..");

			const location = isPersonal ? "personal" : "project";

			// Get file stats (simplified)
			const content = await this.fileService.readFile(installationPath);
			const size = content.length;

			return {
				name: commandName,
				filePath: installationPath,
				location,
				installedAt: new Date(), // Simplified - would need file stats
				size,
			};
		} catch (error) {
			console.error(
				`Failed to get installation info for '${commandName}':`,
				error,
			);
			return null;
		}
	}

	async isInstalled(commandName: string): Promise<boolean> {
		const path = await this.getInstallationPath(commandName);
		return path !== null;
	}

	async getInstallationPath(commandName: string): Promise<string | null> {
		const directories = await this.directoryDetector.getClaudeDirectories();

		// Check personal directory first, then project directory
		for (const dir of directories) {
			if (!dir.exists) continue;

			const filePath = path.join(dir.path, `${commandName}.md`);
			if (await this.fileService.exists(filePath)) {
				return filePath;
			}
		}

		return null;
	}

}
