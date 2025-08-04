import path from "node:path";
import type IFileService from "../interfaces/IFileService.js";
import { LanguageDetector } from "./LanguageDetector.js";

/**
 * Configuration structure for project-level settings
 */
export interface ProjectConfig {
	preferredLanguage?: string;
	[key: string]: any; // Allow additional fields for forward compatibility
}

/**
 * Service for managing project-level configuration stored in .claude/config.json
 * 
 * Provides functionality to read, write, and merge project-specific configuration
 * with user-level configuration. Project configuration takes precedence over
 * user configuration for the same settings.
 * 
 * The service follows this precedence for configuration resolution:
 * 1. Project config (.claude/config.json in current directory)
 * 2. User config (~/.config/claude-cmd/config.json)
 * 
 * Configuration is stored in the project's .claude directory at:
 * .claude/config.json
 * 
 * @example Basic usage
 * ```typescript
 * const service = new ProjectConfigService(fileService);
 * 
 * // Set project language preference
 * await service.setProjectConfig({ preferredLanguage: 'fr' });
 * 
 * // Get project configuration
 * const config = await service.getProjectConfig(); // { preferredLanguage: 'fr' }
 * 
 * // Merge with user config (project takes precedence)
 * const merged = service.mergeConfigs(projectConfig, userConfig);
 * ```
 */
export class ProjectConfigService {
	private readonly configPath: string;
	private readonly languageDetector = new LanguageDetector();

	/**
	 * Create a new ProjectConfigService instance
	 * 
	 * @param fileService - File service implementation for configuration persistence
	 */
	constructor(private readonly fileService: IFileService) {
		this.configPath = path.join(".claude", "config.json");
	}

	/**
	 * Get the project-level configuration
	 * 
	 * @returns Project configuration object, or null if not found or invalid
	 * @throws Never throws - returns null for any configuration errors
	 */
	async getProjectConfig(): Promise<ProjectConfig | null> {
		try {
			const configContent = await this.fileService.readFile(this.configPath);
			const config: ProjectConfig = JSON.parse(configContent);
			
			// Validate the configuration before returning
			if (!this.validateConfig(config)) {
				return null;
			}
			
			return config;
		} catch {
			// Return null for any errors (missing file, invalid JSON, etc.)
			// This provides graceful degradation to user config or defaults
			return null;
		}
	}

	/**
	 * Set the project-level configuration
	 * 
	 * @param config - Configuration object to save
	 * @throws Error if the configuration is invalid
	 * @throws Error if the configuration file cannot be written
	 */
	async setProjectConfig(config: ProjectConfig): Promise<void> {
		if (!this.validateConfig(config)) {
			throw new Error("Invalid project configuration");
		}

		try {
			// Ensure .claude directory exists
			await this.fileService.mkdir(path.dirname(this.configPath));
			
			// Write configuration file with pretty formatting
			await this.fileService.writeFile(
				this.configPath,
				JSON.stringify(config, null, 2)
			);
		} catch (error) {
			throw new Error(
				`Failed to save project configuration: ${error instanceof Error ? error.message : error}`
			);
		}
	}

	/**
	 * Merge project configuration with user configuration
	 * 
	 * Project configuration takes precedence over user configuration for the same keys.
	 * Nested objects are merged recursively.
	 * 
	 * @param projectConfig - Project-level configuration (higher precedence)
	 * @param userConfig - User-level configuration (lower precedence)
	 * @returns Merged configuration object
	 */
	mergeConfigs(
		projectConfig: ProjectConfig | null,
		userConfig: ProjectConfig | null
	): ProjectConfig {
		if (!projectConfig && !userConfig) {
			return {};
		}
		
		if (!projectConfig) {
			return { ...userConfig };
		}
		
		if (!userConfig) {
			return { ...projectConfig };
		}

		// Deep merge with project config taking precedence
		return this.deepMerge(userConfig, projectConfig);
	}

	/**
	 * Validate project configuration structure and values
	 * 
	 * @param config - Configuration object to validate
	 * @returns True if configuration is valid, false otherwise
	 */
	validateConfig(config: ProjectConfig): boolean {
		if (typeof config !== "object" || config === null) {
			return false;
		}

		// Validate preferredLanguage if present
		if (config.preferredLanguage !== undefined) {
			if (typeof config.preferredLanguage !== "string") {
				return false;
			}
			
			const sanitized = this.languageDetector.sanitizeLanguageCode(config.preferredLanguage);
			if (!sanitized) {
				return false;
			}
		}

		// Configuration is valid (unknown fields are allowed for forward compatibility)
		return true;
	}

	/**
	 * Get the configuration file path (for testing and debugging)
	 * 
	 * @returns Path to the project configuration file
	 */
	getConfigPath(): string {
		return this.configPath;
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
			if (source[key] !== null && typeof source[key] === "object" && !Array.isArray(source[key])) {
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