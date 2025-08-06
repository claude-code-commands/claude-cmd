import type {
	Config,
	IConfigManager,
	IConfigService,
} from "../interfaces/IConfigService.js";
import type { LanguageDetector } from "./LanguageDetector.js";

/**
 * Service for managing configuration precedence and resolution
 *
 * Orchestrates the resolution of effective configuration by combining
 * user-level and project-level configurations according to precedence rules.
 * Also integrates environment variables and system locale for language detection.
 *
 * Configuration precedence order:
 * 1. CLI flag (handled externally)
 * 2. CLAUDE_CMD_LANG environment variable
 * 3. Project configuration (.claude/config.claude-cmd.json)
 * 4. User configuration (~/.config/claude-cmd/config.claude-cmd.json)
 * 5. System locale (LC_ALL, LC_MESSAGES, LANG)
 * 6. Fallback to English
 *
 * @example Basic usage
 * ```typescript
 * const manager = new ConfigManager(userConfigService, projectConfigService, languageDetector);
 *
 * // Get effective configuration with proper precedence
 * const config = await manager.getEffectiveConfig();
 *
 * // Get effective language for current context
 * const lang = await manager.getEffectiveLanguage(); // Uses all precedence sources
 * ```
 */
export class ConfigManager implements IConfigManager {
	/**
	 * Create a new ConfigManager instance
	 *
	 * @param userConfigService - Service for user-level configuration
	 * @param projectConfigService - Service for project-level configuration
	 * @param languageDetector - Language detector for precedence resolution
	 */
	constructor(
		private readonly userConfigService: IConfigService,
		private readonly projectConfigService: IConfigService,
		private readonly languageDetector: LanguageDetector,
	) {}

	/**
	 * Get the effective configuration based on precedence rules
	 *
	 * Merges project and user configurations with project taking precedence.
	 * Project configuration overrides user configuration for the same keys.
	 *
	 * @returns Merged configuration with proper precedence
	 */
	async getEffectiveConfig(): Promise<Config> {
		const [projectConfig, userConfig] = await Promise.all([
			this.projectConfigService.getConfig(),
			this.userConfigService.getConfig(),
		]);

		return this.mergeConfigs(userConfig, projectConfig);
	}

	/**
	 * Get the effective language to use based on all sources
	 *
	 * Follows the complete precedence order:
	 * 1. CLI flag (not applicable in this context)
	 * 2. CLAUDE_CMD_LANG environment variable
	 * 3. Project configuration
	 * 4. User configuration
	 * 5. System locale (LC_ALL, LC_MESSAGES, LANG)
	 * 6. Fallback to English
	 *
	 * @returns Language code that should be used
	 * @throws Never throws - always returns a valid language code
	 */
	async getEffectiveLanguage(): Promise<string> {
		const [projectConfig, userConfig] = await Promise.all([
			this.projectConfigService.getConfig(),
			this.userConfigService.getConfig(),
		]);

		// Build detection context with all sources
		const context = {
			cliFlag: "", // Not used in this context (CLI flag would override this method)
			envVar: process.env.CLAUDE_CMD_LANG || "",
			projectConfig: projectConfig?.preferredLanguage || "",
			userConfig: userConfig?.preferredLanguage || "",
			posixLocale:
				process.env.LC_ALL || process.env.LC_MESSAGES || process.env.LANG || "",
		};

		return this.languageDetector.detect(context);
	}

	/**
	 * Merge two configurations with the second taking precedence
	 *
	 * @param baseConfig - Lower precedence configuration
	 * @param overrideConfig - Higher precedence configuration
	 * @returns Merged configuration object
	 */
	private mergeConfigs(
		baseConfig: Config | null,
		overrideConfig: Config | null,
	): Config {
		if (!baseConfig && !overrideConfig) {
			return {};
		}

		if (!baseConfig) {
			return { ...overrideConfig };
		}

		if (!overrideConfig) {
			return { ...baseConfig };
		}

		// Deep merge with override config taking precedence
		return this.deepMerge(baseConfig, overrideConfig);
	}

	/**
	 * Deep merge two objects, with the second object taking precedence
	 *
	 * @param target - Base object (lower precedence)
	 * @param source - Override object (higher precedence)
	 * @returns Merged object
	 */
	private deepMerge(target: any, source: any): any {
		const result = { ...target };

		for (const key in source) {
			if (
				source[key] !== null &&
				typeof source[key] === "object" &&
				!Array.isArray(source[key])
			) {
				// Recursively merge nested objects
				result[key] = this.deepMerge(result[key] || {}, source[key]);
			} else {
				// Override primitive values and arrays
				result[key] = source[key];
			}
		}

		return result;
	}
}
