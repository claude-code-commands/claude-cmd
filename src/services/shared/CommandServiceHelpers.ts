import type { CommandServiceOptions } from "../../types/Command.js";
import { CommandNotFoundError } from "../../types/Command.js";
import type { LanguageDetector } from "../LanguageDetector.js";
import { CommandServiceError } from "./CommandServiceError.js";

/**
 * Determine the language to use for operations
 * Centralizes language detection logic and reduces code duplication
 */
export function resolveLanguage(
	options: CommandServiceOptions | undefined,
	languageDetector: LanguageDetector,
): string {
	return (
		options?.language ??
		languageDetector.detect({
			cliFlag: "",
			envVar: process.env.CLAUDE_CMD_LANG ?? "",
			posixLocale: process.env.LANG ?? "",
		})
	);
}

/**
 * Validate and sanitize command name input
 */
export function validateCommandName(commandName: string): void {
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
export function validateSearchQuery(query: string): void {
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
export async function withErrorHandling<T>(
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
