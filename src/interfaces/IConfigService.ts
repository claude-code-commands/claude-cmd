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
 * Unified configuration structure for both user and project configs
 */
export interface Config {
	preferredLanguage?: string;
	repositoryURL?: string;
	[key: string]: any; // Allow additional fields for forward compatibility
}

/**
 * Service interface for managing configuration files
 *
 * Handles both user-level and project-level configuration with the same interface.
 * The only difference between instances is the configuration file path.
 */
export interface IConfigService {
	/**
	 * Get the current configuration
	 *
	 * @returns Configuration object, or null if not found or invalid
	 */
	getConfig(): Promise<Config | null>;

	/**
	 * Set the configuration
	 *
	 * @param config - Configuration object to save
	 * @throws Error if the configuration is invalid or cannot be written
	 */
	setConfig(config: Config): Promise<void>;

	/**
	 * Get list of all supported languages with their availability status
	 *
	 * @returns Array of language information including availability status
	 */
	getAvailableLanguages(): Promise<LanguageInfo[]>;

	/**
	 * Get the configuration file path
	 *
	 * @returns Path to the configuration file
	 */
	getConfigPath(): string;
}

/**
 * Service interface for managing configuration precedence and resolution
 */
export interface IConfigManager {
	/**
	 * Get the effective configuration based on precedence rules
	 *
	 * @returns Merged configuration with proper precedence
	 */
	getEffectiveConfig(): Promise<Config>;

	/**
	 * Get the effective language to use based on all sources
	 *
	 * @returns Language code that should be used
	 */
	getEffectiveLanguage(): Promise<string>;
}
