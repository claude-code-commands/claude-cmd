import path from "node:path";
import type { Config, IConfigService, LanguageStatus } from "../interfaces/IConfigService.js";
import type IFileService from "../interfaces/IFileService.js";
import type IRepository from "../interfaces/IRepository.js";
import type { IConfigManager } from "../interfaces/IConfigService.js";
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

import type { LanguageDetector } from "./LanguageDetector.js";

/**
 * Service for managing configuration files
 *
 * Provides functionality to store and retrieve configuration preferences,
 * discover available languages from the remote repository, and validate
 * configuration data. This service is path-agnostic and can handle both
 * user-level and project-level configurations.
 *
 * Configuration validation ensures that language codes are properly formatted
 * and that repository URLs are valid when provided.
 *
 * @example Basic usage
 * ```typescript
 * const userConfigPath = path.join(os.homedir(), ".config", "claude-cmd", "config.claude-cmd.json");
 * const service = new ConfigService(userConfigPath, fileService, repository, languageDetector);
 *
 * // Set configuration
 * await service.setConfig({ preferredLanguage: 'fr', repositoryURL: 'https://custom-repo.git' });
 *
 * // Get configuration
 * const config = await service.getConfig(); // { preferredLanguage: 'fr', repositoryURL: '...' }
 *
 * // List available languages
 * const languages = await service.getAvailableLanguages();
 * ```
 */
export class ConfigService implements IConfigService {
	private readonly configDir: string;

	/**
	 * Known languages with their display names
	 */
	private readonly knownLanguages: Map<string, string> = new Map([
		["en", "English"],
		["fr", "Français"],
		["es", "Español"],
		["de", "Deutsch"],
		["it", "Italiano"],
		["pt", "Português"],
		["ja", "日本語"],
		["ko", "한국어"],
		["zh", "中文"],
	]);

	/**
	 * Create a new ConfigService instance
	 *
	 * @param configPath - Path to the configuration file
	 * @param fileService - File service implementation for configuration persistence
	 * @param repository - Repository service for checking language availability
	 * @param languageDetector - Language detector for validation
	 * @param configManager - Optional config manager for getting effective language
	 */
	constructor(
		private readonly configPath: string,
		private readonly fileService: IFileService,
		private readonly repository: IRepository,
		private readonly languageDetector: LanguageDetector,
		private readonly configManager?: IConfigManager,
	) {
		this.configDir = path.dirname(configPath);
	}

	/**
	 * Get the current configuration
	 *
	 * @returns Configuration object, or null if not found or invalid
	 * @throws Never throws - returns null for any configuration errors
	 */
	async getConfig(): Promise<Config | null> {
		try {
			const configContent = await this.fileService.readFile(this.configPath);
			const config: Config = JSON.parse(configContent);

			// Validate the configuration before returning
			if (!this.validateConfig(config)) {
				return null;
			}

			return config;
		} catch {
			// Return null for any errors (missing file, invalid JSON, etc.)
			// This provides graceful degradation to defaults
			return null;
		}
	}

	/**
	 * Set the configuration
	 *
	 * @param config - Configuration object to save
	 * @throws Error if the configuration is invalid or cannot be written
	 */
	async setConfig(config: Config): Promise<void> {
		if (!this.validateConfig(config)) {
			throw new Error("Invalid configuration");
		}

		try {
			// Ensure config directory exists
			await this.fileService.mkdir(this.configDir);

			// Write configuration file with pretty formatting
			await this.fileService.writeFile(
				this.configPath,
				JSON.stringify(config, null, 2),
			);
		} catch (error) {
			throw new Error(
				`Failed to save configuration: ${error instanceof Error ? error.message : error}`,
			);
		}
	}

	/**
	 * Get list of all supported languages with their availability status
	 *
	 * Checks the remote repository to determine which languages have available
	 * command manifests. English is always considered available.
	 *
	 * @returns Array of language information including availability status
	 * @throws Never throws - network errors result in languages marked as unavailable
	 */
	async getAvailableLanguages(): Promise<LanguageInfo[]> {
		// Process each known language in parallel for better performance
		const availabilityChecks = Array.from(this.knownLanguages.entries()).map(
			async ([code, name]) => {
				let available = false;

				// English is always considered available as the fallback language
				if (code === "en") {
					available = true;
				} else {
					// Test availability by attempting to fetch the language manifest
					try {
						await this.repository.getManifest(code);
						available = true;
					} catch {
						// Language is not available in repository
						available = false;
					}
				}

				return { code, name, available };
			},
		);

		// Wait for all availability checks to complete
		const results = await Promise.all(availabilityChecks);
		return results;
	}

	/**
	 * Get the configuration file path
	 *
	 * @returns Path to the configuration file
	 */
	getConfigPath(): string {
		return this.configPath;
	}

	/**
	 * Get list of supported language codes
	 *
	 * @returns Array of valid language codes
	 */
	getSupportedLanguageCodes(): string[] {
		return Array.from(this.knownLanguages.keys());
	}

	/**
	 * Validate configuration structure and values
	 *
	 * @param config - Configuration object to validate
	 * @returns True if configuration is valid, false otherwise
	 */
	private validateConfig(config: Config): boolean {
		if (typeof config !== "object" || config === null) {
			return false;
		}

		// Validate preferredLanguage if present
		if (config.preferredLanguage !== undefined) {
			if (typeof config.preferredLanguage !== "string") {
				return false;
			}

			const sanitized = this.languageDetector.sanitizeLanguageCode(
				config.preferredLanguage,
			);
			if (!sanitized) {
				return false;
			}

			// Note: Allow any valid language code format
			// The repository will determine actual availability at runtime
		}

		// Validate repositoryURL if present
		if (config.repositoryURL !== undefined) {
			if (typeof config.repositoryURL !== "string") {
				return false;
			}

			// Basic URL validation
			try {
				new URL(config.repositoryURL);
			} catch {
				return false;
			}
		}

		// Configuration is valid (unknown fields are allowed for forward compatibility)
		return true;
	}

	/**
	 * Get comprehensive language status information
	 *
	 * Combines current language, repository-available languages with command counts,
	 * and common languages for contribution encouragement.
	 *
	 * @returns Language status with current, repository, and common languages
	 */
	async getLanguageStatus(): Promise<LanguageStatus> {
		// Get current language - use configManager if available, otherwise from config
		let currentLang: string;
		if (this.configManager) {
			currentLang = await this.configManager.getEffectiveLanguage();
		} else {
			const config = await this.getConfig();
			currentLang = config?.preferredLanguage || "en";
		}

		// Get repository languages with command counts
		const repositoryLanguages = await this.repository.getAvailableLanguages();
		
		// Create a set of repository language codes for efficient lookup
		const repoLangCodes = new Set(repositoryLanguages.map(l => l.code));
		
		// Get common languages that are not in the repository
		const commonNotInRepo = Array.from(this.knownLanguages.entries())
			.filter(([code]) => !repoLangCodes.has(code))
			.map(([code, name]) => ({
				code,
				name,
				commandCount: 0, // No commands yet for these languages
			}));

		return {
			current: currentLang,
			repository: repositoryLanguages,
			common: commonNotInRepo,
		};
	}
}
