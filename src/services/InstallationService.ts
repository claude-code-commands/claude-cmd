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
		_options?: CommandServiceOptions,
	): Promise<readonly Command[]> {
		try {
			const directories = await this.directoryDetector.getClaudeDirectories();
			const commands: Command[] = [];
			const seenCommands = new Set<string>();

			// Check each directory for installed commands
			for (const dir of directories) {
				if (!dir.exists) continue;

				try {
					// Scan directory for .md files
					// For this implementation, we'll use a simple approach
					// In a real implementation, we'd need directory listing in IFileService
					await this.scanDirectoryForCommands(dir, commands, seenCommands);
				} catch {
					// Continue if directory scan fails
				}
			}

			return commands;
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
			// Determine location type based on path
			const isPersonal =
				path.isAbsolute(installationPath) &&
				(installationPath.includes(process.env.HOME || "") ||
					installationPath.includes(process.env.USERPROFILE || ""));

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
		} catch {
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

	/**
	 * Scan a directory for command files
	 */
	private async scanDirectoryForCommands(
		dir: DirectoryInfo,
		commands: Command[],
		seenCommands: Set<string>,
	): Promise<void> {
		try {
			// List all files in the directory
			const files = await this.fileService.listFiles(dir.path);

			// Filter for .md files only
			const markdownFiles = files.filter((file) => file.endsWith(".md"));

			for (const file of markdownFiles) {
				// Extract command name (remove .md extension)
				const commandName = file.replace(/\.md$/, "");

				// Skip if we've already seen this command (deduplication)
				if (seenCommands.has(commandName)) {
					continue;
				}

				try {
					// Read and parse the command file
					const filePath = path.join(dir.path, file);
					const content = await this.fileService.readFile(filePath);
					const command = await this.commandParser.parseCommandFile(
						content,
						commandName,
					);

					commands.push(command);
					seenCommands.add(commandName);
				} catch {}
			}
		} catch {
			// Directory doesn't exist or can't be read, continue silently
		}
	}
}
