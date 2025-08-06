import type { LanguageDetector } from "../services/LanguageDetector.js";
import { getServices } from "../services/serviceFactory.js";

/**
 * Handle CLI command errors with user-friendly messages
 * Centralizes error handling patterns across all CLI commands
 */
export function handleError(error: unknown, defaultMessage: string): void {
	let errorMessage = defaultMessage;

	if (error instanceof Error) {
		// Extract meaningful error messages for users
		if (error.name === "CommandNotFoundError") {
			errorMessage =
				"Error: Command not found. Use 'claude-cmd list' to see available commands";
		} else if (error.name === "CommandServiceError") {
			errorMessage = `Error: ${error.message}`;
		} else if (error.name === "ManifestError") {
			errorMessage =
				"Error: Could not retrieve command information from repository";
		} else if (error.message.includes("timeout")) {
			errorMessage =
				"Error: Request timed out. Please check your internet connection";
		} else if (error.message.includes("network")) {
			errorMessage =
				"Error: Network error. Please check your internet connection";
		} else {
			errorMessage = `Error: ${error.message}`;
		}
	}

	console.error(errorMessage);
	process.exit(1);
}

/**
 * Detect effective language for command execution
 * Centralizes language detection logic across all CLI commands
 */
export async function detectLanguage(
	optionLanguage: string | undefined,
	_languageDetector: LanguageDetector,
): Promise<string> {
	if (optionLanguage) {
		return optionLanguage;
	}

	// Use ConfigManager for unified language detection
	const { configManager } = getServices();

	return await configManager.getEffectiveLanguage();
}
