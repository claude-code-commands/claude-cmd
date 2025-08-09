import type { Manifest, RepositoryOptions } from "../types/Command.js";

/**
 * Information about a language and its available commands
 */
export interface LanguageStatusInfo {
	/**
	 * ISO 639-1 language code (e.g., "en", "fr", "es")
	 */
	code: string;

	/**
	 * Human-readable language name (e.g., "English", "Français", "Español")
	 */
	name: string;

	/**
	 * Number of commands available for this language
	 */
	commandCount: number;

	/**
	 * When the language manifest was last updated (optional)
	 */
	lastUpdated?: Date;
}

/**
 * Cache configuration for repository operations
 *
 * Controls how repository content is cached locally to improve performance
 * and reduce network requests. Provides OS-specific defaults and validation.
 *
 * @example
 * ```typescript
 * // Use defaults
 * const cacheConfig = new CacheConfig();
 *
 * // Custom configuration
 * const cacheConfig = new CacheConfig({
 *   cacheDir: "~/.claude/cache",
 *   ttl: 3600000, // 1 hour
 * });
 * ```
 */
export class CacheConfig {
	/**
	 * Directory path for cached files
	 */
	readonly cacheDir: string;

	/**
	 * Time-to-live in milliseconds for cached content
	 * After this time, cache entries are considered stale and will be refreshed
	 */
	readonly ttl: number;

	/**
	 * Create cache configuration with OS-specific defaults and validation
	 *
	 * @param options - Optional configuration overrides
	 * @param options.cacheDir - Custom cache directory path
	 * @param options.ttl - Custom TTL in milliseconds
	 */
	constructor(options?: { cacheDir?: string; ttl?: number }) {
		// Set cache directory with OS-specific default
		this.cacheDir = options?.cacheDir ?? this.getDefaultCacheDir();

		// Set TTL with 2-week default
		this.ttl = options?.ttl ?? 1209600000; // 2 weeks (14 days) in milliseconds

		// Validate configuration
		this.validateCacheDir(this.cacheDir);
		this.validateTTL(this.ttl);
	}

	/**
	 * Get OS-specific cache directory
	 *
	 * @returns Default cache directory path for the current OS
	 */
	private getDefaultCacheDir(): string {
		const platform = process.platform;

		switch (platform) {
			case "darwin": // macOS
				return `${process.env.HOME}/Library/Caches/claude-cmd`;
			case "linux":
				return `${process.env.HOME}/.cache/claude-cmd`;
			case "win32": // Windows
				return `${process.env.LOCALAPPDATA}\\claude-cmd`;
			default:
				// Fallback for unknown platforms
				return "/tmp/claude-cmd-cache";
		}
	}

	/**
	 * Validate cache directory path
	 *
	 * @param cacheDir - Cache directory to validate
	 * @throws Error if cache directory is invalid
	 */
	private validateCacheDir(cacheDir: string): void {
		if (!cacheDir || typeof cacheDir !== "string") {
			throw new Error("Cache directory must be a non-empty string");
		}

		if (cacheDir.trim().length === 0) {
			throw new Error("Cache directory cannot be empty or whitespace");
		}

		// Check for potentially dangerous paths
		if (cacheDir.includes("..") || cacheDir.includes("\0")) {
			throw new Error("Cache directory contains invalid characters");
		}
	}

	/**
	 * Validate TTL value
	 *
	 * @param ttl - TTL value to validate
	 * @throws Error if TTL is invalid
	 */
	private validateTTL(ttl: number): void {
		if (typeof ttl !== "number" || !Number.isFinite(ttl)) {
			throw new Error("TTL must be a finite number");
		}

		if (ttl <= 0) {
			throw new Error("TTL must be greater than 0");
		}

		// Warn about unreasonably short or long TTL values
		if (ttl < 1000) {
			console.warn(
				"TTL is very short (< 1 second), this may cause excessive network requests",
			);
		} else if (ttl > 31536000000) {
			// 1 year
			console.warn("TTL is very long (> 1 year), cached data may become stale");
		}
	}
}

/**
 * Repository interface for command manifest and content operations
 *
 * Provides abstractions for fetching command manifests and individual command content
 * from a remote repository. Designed to support language-specific repositories and
 * caching optimizations.
 *
 * All operations are language-aware and support caching hints for performance optimization.
 *
 * Implementations must accept HTTPClient and FileService dependencies for proper
 * testability and adherence to the abstracted I/O architecture.
 */
export default interface IRepository {
	/**
	 * Retrieve the command manifest for a specific language
	 *
	 * The manifest contains metadata about all available commands including their names,
	 * descriptions, file paths, and allowed tools. This method supports caching
	 * optimizations through the options parameter.
	 *
	 * @param language - ISO 639-1 language code (e.g., "en", "fr", "es")
	 * @param options - Optional caching and refresh configuration
	 * @returns Promise resolving to the complete manifest for the language
	 * @throws ManifestError when manifest cannot be retrieved or parsed
	 * @throws RepositoryError for other repository-related failures
	 */
	getManifest(language: string, options?: RepositoryOptions): Promise<Manifest>;

	/**
	 * Retrieve the content of a specific command file
	 *
	 * Fetches the complete markdown content of a command file from the repository.
	 * The command must exist in the manifest for the specified language.
	 *
	 * @param commandName - Name of the command as it appears in the manifest
	 * @param language - ISO 639-1 language code (e.g., "en", "fr", "es")
	 * @param options - Optional caching and refresh configuration
	 * @returns Promise resolving to the raw markdown content of the command file
	 * @throws CommandNotFoundError when command doesn't exist in the manifest
	 * @throws CommandContentError when command file cannot be retrieved
	 * @throws RepositoryError for other repository-related failures
	 */
	getCommand(
		commandName: string,
		language: string,
		options?: RepositoryOptions,
	): Promise<string>;

	/**
	 * Discover available languages from the repository cache
	 *
	 * Dynamically discovers which languages have command manifests available by
	 * scanning the cache directory structure. Provides command counts for each
	 * language to help users assess the value of each language option.
	 *
	 * @returns Promise resolving to array of language information with command counts
	 * @throws RepositoryError for cache access failures
	 */
	getAvailableLanguages(): Promise<LanguageStatusInfo[]>;
}
