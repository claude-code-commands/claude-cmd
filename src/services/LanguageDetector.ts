/**
 * DetectionContext contains all the language detection sources in precedence order.
 * Each field represents a different source of language information, with empty strings
 * indicating that the source is not available or not set.
 */
export interface DetectionContext {
	cliFlag: string; // --language flag value (highest precedence)
	envVar: string; // CLAUDE_CMD_LANG environment variable
	projectConfig?: string; // Project-level configuration (.claude/config.claude-cmd.json)
	userConfig?: string; // User-level configuration (~/.config/claude-cmd/config.claude-cmd.json)
	posixLocale: string; // POSIX locale from LC_ALL/LC_MESSAGES/LANG (lowest precedence)
}

/**
 * Custom error class for invalid locale strings
 */
export class InvalidLocaleError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "InvalidLocaleError";
	}
}

/**
 * Custom error class for invalid language codes
 */
export class InvalidLanguageCodeError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "InvalidLanguageCodeError";
	}
}

/**
 * LanguageDetector handles automatic language detection for the claude-cmd CLI tool.
 * It implements a layered detection strategy with clear precedence order to determine
 * the user's preferred language for command retrieval and display.
 */
export class LanguageDetector {
	/**
	 * Detect determines the language to use based on the detection context,
	 * following the precedence order: CLI flag → env var → project config → user config → POSIX locale → fallback.
	 */
	detect(context: DetectionContext): string {
		// Process string-based sources in precedence order
		const stringSources = [
			context.cliFlag,
			context.envVar,
			context.projectConfig ?? "",
			context.userConfig ?? "",
		];

		for (const source of stringSources) {
			if (source !== "") {
				const normalized = this.sanitizeLanguageCode(source);
				if (normalized !== "") {
					return normalized;
				}
			}
		}

		// 5. POSIX locale - system-level language preference (requires special parsing)
		if (context.posixLocale !== "") {
			try {
				const lang = this.parseLocale(context.posixLocale);
				return lang;
			} catch {
				// Ignore parsing errors and continue to fallback
			}
		}

		// 6. Fallback to English when no language source is available
		return "en";
	}

	/**
	 * ParseLocale parses a POSIX locale string and extracts the language code.
	 * Supports various locale formats and provides comprehensive error reporting.
	 */
	parseLocale(localeString: string): string {
		// Trim whitespace and check for empty input
		const trimmed = localeString.trim();
		if (trimmed === "") {
			throw new InvalidLocaleError("locale string cannot be empty");
		}

		// Handle special locale names that should be rejected
		const upper = trimmed.toUpperCase();
		if (upper === "C" || upper === "POSIX") {
			throw new InvalidLocaleError(
				"special locale names 'C' and 'POSIX' are not supported",
			);
		}

		// Remove modifiers (everything after @)
		let locale = trimmed;
		const atIndex = locale.indexOf("@");
		if (atIndex !== -1) {
			locale = locale.substring(0, atIndex);
		}

		// Remove encoding (everything after .)
		const dotIndex = locale.indexOf(".");
		if (dotIndex !== -1) {
			locale = locale.substring(0, dotIndex);
		}

		// Extract language part by splitting on the first occurrence of either `_` or `-`
		const parts = locale.split(/[_-]/);
		const languagePart = parts[0];

		if (!languagePart || languagePart === "") {
			throw new InvalidLocaleError(
				"invalid locale format: missing language component",
			);
		}

		// Take the language code and normalize it
		const lang = languagePart.toLowerCase();

		// Validate language code format
		if (!this.isValidLanguageCode(lang)) {
			throw new InvalidLanguageCodeError(
				"invalid language code: must be 2-3 lowercase letters",
			);
		}

		return lang;
	}

	/**
	 * SanitizeLanguageCode ensures that language codes are in a consistent format.
	 * This function normalizes case and validates format, returning empty string for invalid codes.
	 */
	sanitizeLanguageCode(code: string): string {
		if (code === "") {
			return "";
		}

		// Convert to lowercase and trim whitespace for consistency
		const normalized = code.toLowerCase().trim();

		// Validate language code format (2-3 lowercase letters)
		if (!this.isValidLanguageCode(normalized)) {
			return "";
		}

		return normalized;
	}

	/**
	 * IsValidLanguageCode checks if a string is a valid language code format.
	 * Valid language codes are 2-3 lowercase letters only.
	 */
	isValidLanguageCode(code: string): boolean {
		return /^[a-z]{2,3}$/.test(code);
	}
}
