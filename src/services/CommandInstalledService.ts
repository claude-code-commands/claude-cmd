import type IInstallationService from "../interfaces/IInstallationService.js";
import type { Command, CommandServiceOptions } from "../types/Command.js";
import type { LanguageDetector } from "./LanguageDetector.js";
import {
	resolveLanguage,
	withErrorHandling,
} from "./shared/CommandServiceHelpers.js";

/**
 * CommandInstalledService handles operations related to locally installed commands.
 *
 * Responsibilities:
 * - List all installed commands from local Claude Code directories
 * - Coordinate with InstallationService
 */
export class CommandInstalledService {
	constructor(
		private readonly installationService: IInstallationService,
		private readonly languageDetector: LanguageDetector,
	) {}

	/**
	 * List all installed commands from local Claude Code directories
	 */
	async getInstalledCommands(
		options?: CommandServiceOptions,
	): Promise<readonly Command[]> {
		const language = resolveLanguage(options, this.languageDetector);

		return withErrorHandling("getInstalledCommands", language, async () => {
			// Use InstallationService to get installed commands
			// This checks both ~/.claude/commands/ (personal) and .claude/commands/ (project)
			// and returns parsed command metadata
			return await this.installationService.listInstalledCommands(options);
		});
	}
}
