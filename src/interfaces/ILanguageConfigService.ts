/**
 * Available languages supported by claude-cmd
 */
export interface LanguageInfo {
	/** Language code (e.g., "en", "fr") */
	code: string;
	/** Human-readable name (e.g., "English", "Français") */
	name: string;
	/** Whether this language is currently available in the repository */
	available: boolean;
}

/**
 * Configuration service for managing language preferences
 */
export default interface ILanguageConfigService {
	/**
	 * Get the currently configured preferred language
	 *
	 * @returns Language code or null if no preference is set
	 */
	getCurrentLanguage(): Promise<string | null>;

	/**
	 * Set the preferred language
	 *
	 * @param language - Language code to set
	 * @throws Error if language code is invalid
	 */
	setLanguage(language: string): Promise<void>;

	/**
	 * Get list of all supported languages with availability status
	 *
	 * @returns Array of language information
	 */
	getAvailableLanguages(): Promise<LanguageInfo[]>;

	/**
	 * Get the effective language to use based on preferences and fallbacks
	 * Uses the precedence: saved preference → environment → locale → fallback (en)
	 *
	 * @returns Language code that should be used
	 */
	getEffectiveLanguage(): Promise<string>;
}
