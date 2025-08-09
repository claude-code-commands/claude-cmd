import type IRepository from "../interfaces/IRepository.js";
import type { CommandServiceOptions } from "../types/Command.js";
import type { CommandQueryService } from "./CommandQueryService.js";
import type { LanguageDetector } from "./LanguageDetector.js";
import {
	resolveLanguage,
	validateCommandName,
	withErrorHandling,
} from "./shared/CommandServiceHelpers.js";

/**
 * CommandContentService handles command content retrieval operations.
 *
 * Responsibilities:
 * - Get full content of command files
 * - Verify command exists before content retrieval
 * - Handle content-specific errors
 */
export class CommandContentService {
	constructor(
		private readonly repository: IRepository,
		private readonly languageDetector: LanguageDetector,
		private readonly commandQueryService: CommandQueryService,
	) {}

	/**
	 * Get the full content of a command file
	 */
	async getCommandContent(
		commandName: string,
		options?: CommandServiceOptions,
	): Promise<string> {
		validateCommandName(commandName);
		const language = resolveLanguage(options, this.languageDetector);

		return withErrorHandling("getCommandContent", language, async () => {
			// First verify the command exists in manifest
			await this.commandQueryService.getCommandInfo(commandName, options);

			// Fetch command content from repository
			return await this.repository.getCommand(commandName, language, {
				forceRefresh: options?.forceRefresh,
			});
		});
	}
}
