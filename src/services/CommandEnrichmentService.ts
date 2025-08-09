import type {
	Command,
	CommandServiceOptions,
	EnhancedCommandInfo,
	InstallationStatus,
} from "../types/Command.js";
import { CommandNotFoundError } from "../types/Command.js";
import type { CommandQueryService } from "./CommandQueryService.js";
import type { DirectoryDetector } from "./DirectoryDetector.js";
import type { LanguageDetector } from "./LanguageDetector.js";
import type { LocalCommandRepository } from "./LocalCommandRepository.js";
import {
	resolveLanguage,
	validateCommandName,
	withErrorHandling,
} from "./shared/CommandServiceHelpers.js";

/**
 * CommandEnrichmentService handles enhanced command information with installation status.
 *
 * Responsibilities:
 * - Get enhanced command info with installation status
 * - Coordinate between repository and local sources
 * - Detect installation location and local changes
 * - Determine command source precedence
 */
export class CommandEnrichmentService {
	constructor(
		private readonly commandQueryService: CommandQueryService,
		private readonly localCommandRepository: LocalCommandRepository,
		private readonly directoryDetector: DirectoryDetector,
		private readonly languageDetector: LanguageDetector,
	) {}

	/**
	 * Get enhanced information about a specific command with installation status
	 */
	async getEnhancedCommandInfo(
		commandName: string,
		options?: CommandServiceOptions,
	): Promise<EnhancedCommandInfo> {
		validateCommandName(commandName);
		const language = resolveLanguage(options, this.languageDetector);

		return withErrorHandling("getEnhancedCommandInfo", language, async () => {
			// Try to get command from both repository and local sources
			let repositoryCommand: Command | undefined;
			let localCommand: Command | undefined;
			const availableInSources: ("repository" | "personal" | "project")[] = [];

			// Check repository first
			try {
				repositoryCommand = await this.commandQueryService.getCommandInfo(
					commandName,
					options,
				);
				availableInSources.push("repository");
			} catch (error) {
				if (!(error instanceof CommandNotFoundError)) {
					throw error;
				}
			}

			// Check local commands
			try {
				const localManifest =
					await this.localCommandRepository.getManifest(language);
				localCommand = localManifest.commands.find(
					(cmd) => cmd.name === commandName,
				);
				if (localCommand) {
					// Determine actual installation location by scanning directories
					const scanResult =
						await this.directoryDetector.scanAllClaudeDirectories();
					const personalFiles = scanResult.personal.filter((file: string) =>
						file.includes(`${commandName}.md`),
					);
					const projectFiles = scanResult.project.filter((file: string) =>
						file.includes(`${commandName}.md`),
					);

					if (personalFiles.length > 0) {
						availableInSources.push("personal");
					}
					if (projectFiles.length > 0) {
						availableInSources.push("project");
					}
				}
			} catch (_error) {
				// Ignore local repository errors
			}

			// Determine which command to use and its source
			let baseCommand: Command;
			let source: "repository" | "personal" | "project";
			let _installPath: string | undefined;

			if (localCommand) {
				// Local command takes precedence when available
				baseCommand = localCommand;
				// Personal directory takes precedence over project directory
				if (availableInSources.includes("personal")) {
					source = "personal";
					const personalDir =
						await this.directoryDetector.getPersonalDirectory();
					_installPath = `${personalDir}/${commandName}.md`;
				} else if (availableInSources.includes("project")) {
					source = "project";
					const projectDir = await this.directoryDetector.getProjectDirectory();
					_installPath = `${projectDir}/${commandName}.md`;
				} else {
					source = "personal"; // Fallback
				}
			} else if (repositoryCommand) {
				baseCommand = repositoryCommand;
				source = "repository";
			} else {
				throw new CommandNotFoundError(commandName, language);
			}

			// Build installation status if this is a repository command
			let installationStatus: InstallationStatus | undefined;
			if (repositoryCommand) {
				const isInstalled = localCommand !== undefined;
				let installLocation: "personal" | "project" | undefined;
				let detectedInstallPath: string | undefined;
				let hasLocalChanges = false;

				if (isInstalled && localCommand) {
					// Determine actual installation location
					if (availableInSources.includes("personal")) {
						installLocation = "personal";
						const personalDir =
							await this.directoryDetector.getPersonalDirectory();
						detectedInstallPath = `${personalDir}/${commandName}.md`;
					} else if (availableInSources.includes("project")) {
						installLocation = "project";
						const projectDir =
							await this.directoryDetector.getProjectDirectory();
						detectedInstallPath = `${projectDir}/${commandName}.md`;
					}

					// Compare content to detect local changes if both versions exist
					if (localCommand && repositoryCommand) {
						// Compare key metadata fields
						hasLocalChanges =
							localCommand.description !== repositoryCommand.description ||
							JSON.stringify(localCommand["allowed-tools"]) !==
								JSON.stringify(repositoryCommand["allowed-tools"]) ||
							(localCommand["argument-hint"] || "") !==
								(repositoryCommand["argument-hint"] || "");

						// For a more thorough comparison, we could also compare the actual file content
						// by fetching both the repository content and local content and comparing them
					}
				}

				installationStatus = {
					isInstalled,
					installLocation,
					installPath: detectedInstallPath,
					hasLocalChanges,
				};
			}

			const enhancedCommand: EnhancedCommandInfo = {
				...baseCommand,
				source,
				installationStatus,
				availableInSources,
			};

			return enhancedCommand;
		});
	}
}
