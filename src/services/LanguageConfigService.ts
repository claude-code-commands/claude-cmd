import * as os from "node:os";
import * as path from "node:path";
import type IFileService from "../interfaces/IFileService.js";
import type IRepository from "../interfaces/IRepository.js";
import type ILanguageConfigService from "../interfaces/ILanguageConfigService.js";
import type { LanguageInfo } from "../interfaces/ILanguageConfigService.js";
import { LanguageDetector } from "./LanguageDetector.js";

/**
 * Configuration structure stored in the config file
 */
interface LanguageConfig {
	preferredLanguage?: string;
}

/**
 * Service for managing language configuration preferences
 * 
 * Provides functionality to store and retrieve user language preferences,
 * discover available languages from the remote repository, and determine
 * the effective language to use based on preferences and environment.
 * 
 * The service follows this precedence order for language detection:
 * 1. Saved user preference (via setLanguage)
 * 2. Environment variable (CLAUDE_CMD_LANG)
 * 3. System locale (LC_ALL, LC_MESSAGES, LANG)
 * 4. Fallback to English (en)
 * 
 * Configuration is stored in the user's cache directory at:
 * ~/.cache/claude-cmd/config.json
 * 
 * @example Basic usage
 * ```typescript
 * const service = new LanguageConfigService(fileService, repository);
 * 
 * // Set preferred language
 * await service.setLanguage('fr');
 * 
 * // Get effective language for current context
 * const lang = await service.getEffectiveLanguage(); // 'fr'
 * 
 * // List available languages
 * const languages = await service.getAvailableLanguages();
 * ```
 */
export class LanguageConfigService implements ILanguageConfigService {
	private readonly configDir: string;
	private readonly configFile: string;
	private readonly languageDetector = new LanguageDetector();

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
	 * Create a new LanguageConfigService instance
	 *
	 * @param fileService - File service implementation for configuration persistence
	 * @param repository - Repository service for checking language availability
	 */
	constructor(
		private readonly fileService: IFileService,
		private readonly repository: IRepository,
	) {
		this.configDir = path.join(os.homedir(), ".cache", "claude-cmd");
		this.configFile = path.join(this.configDir, "config.json");
	}

	/**
	 * Get the currently saved language preference
	 *
	 * @returns The saved language code, or null if no preference is configured
	 * @throws Never throws - returns null for any configuration errors
	 */
	async getCurrentLanguage(): Promise<string | null> {
		try {
			const configContent = await this.fileService.readFile(this.configFile);
			const config: LanguageConfig = JSON.parse(configContent);
			return config.preferredLanguage || null;
		} catch {
			// Return null for any errors (missing file, invalid JSON, etc.)
			// This provides graceful degradation to auto-detection
			return null;
		}
	}

	/**
	 * Set the preferred language for command retrieval
	 *
	 * @param language - Language code to set (e.g., 'en', 'fr', 'es')
	 * @throws Error if the language code is invalid or malformed
	 * @throws Error if the configuration file cannot be written
	 */
	async setLanguage(language: string): Promise<void> {
		const sanitized = this.languageDetector.sanitizeLanguageCode(language);
		if (!sanitized) {
			throw new Error(`Invalid language code: ${language}. Expected format: 2-3 lowercase letters (e.g., 'en', 'fr', 'es')`);
		}

		const config: LanguageConfig = {
			preferredLanguage: sanitized,
		};

		try {
			// Ensure config directory exists
			await this.fileService.mkdir(this.configDir);
			await this.fileService.writeFile(this.configFile, JSON.stringify(config, null, 2));
		} catch (error) {
			throw new Error(`Failed to save language preference: ${error instanceof Error ? error.message : error}`);
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
		// Check availability by attempting to fetch each language's manifest
		const languages: LanguageInfo[] = [];
		
		// Process each known language in parallel for better performance
		const availabilityChecks = Array.from(this.knownLanguages.entries()).map(async ([code, name]) => {
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
		});

		// Wait for all availability checks to complete
		const results = await Promise.all(availabilityChecks);
		return results;
	}

	/**
	 * Get the effective language to use for the current context
	 *
	 * Follows the precedence order:
	 * 1. Saved user preference (highest priority)
	 * 2. CLAUDE_CMD_LANG environment variable  
	 * 3. System locale (LC_ALL, LC_MESSAGES, LANG)
	 * 4. Fallback to English (lowest priority)
	 *
	 * @returns Language code that should be used for command retrieval
	 * @throws Never throws - always returns a valid language code
	 */
	async getEffectiveLanguage(): Promise<string> {
		// Priority 1: Check for saved user preference
		const saved = await this.getCurrentLanguage();
		if (saved) {
			return saved;
		}

		// Priority 2-4: Fall back to environment-based detection
		const context = {
			cliFlag: "", // Not used in this context (CLI flag would override this method)
			envVar: process.env.CLAUDE_CMD_LANG || "",
			posixLocale: process.env.LC_ALL || process.env.LC_MESSAGES || process.env.LANG || "",
		};

		return this.languageDetector.detect(context);
	}

	/**
	 * Get the configuration file path (for testing)
	 */
	getConfigPath(): string {
		return this.configFile;
	}
}