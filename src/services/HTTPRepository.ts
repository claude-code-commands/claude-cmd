import { join } from "node:path";
import type IFileService from "../interfaces/IFileService.js";
import type IHTTPClient from "../interfaces/IHTTPClient.js";
import {
	HTTPNetworkError,
	HTTPStatusError,
	HTTPTimeoutError,
} from "../interfaces/IHTTPClient.js";
import type IRepository from "../interfaces/IRepository.js";
import {
	CacheConfig,
	type LanguageStatusInfo,
} from "../interfaces/IRepository.js";
import type { Manifest, RepositoryOptions } from "../types/Command.js";
import {
	CommandContentError,
	CommandNotFoundError,
	ManifestError,
} from "../types/Command.js";
import { repoLogger } from "../utils/logger.js";

/**
 * GitHub-based HTTP repository implementation
 *
 * This class provides a concrete implementation of the IRepository interface that fetches
 * command manifests and content from GitHub's raw content API. It implements intelligent
 * caching with TTL support to minimize network requests and improve performance.
 *
 * The repository follows these architectural principles:
 * - Dependency injection for HTTPClient and FileService to enable comprehensive testing
 * - Error transformation from HTTP errors to domain-specific repository errors
 * - Cache-first strategy with configurable TTL and force-refresh capabilities
 * - Path sanitization to prevent directory traversal attacks
 * - Graceful cache failure handling to ensure HTTP operations continue working
 *
 * @example Basic usage
 * ```typescript
 * const httpClient = new BunHTTPClient();
 * const fileService = new BunFileService();
 * const repository = new HTTPRepository(httpClient, fileService);
 *
 * // Fetch manifest for English commands
 * const manifest = await repository.getManifest('en');
 * console.log(`Found ${manifest.commands.length} commands`);
 *
 * // Fetch specific command content
 * const content = await repository.getCommand('debug-help', 'en');
 * console.log(content); // Markdown content of the command
 * ```
 *
 * @example With custom cache configuration
 * ```typescript
 * const cacheConfig = new CacheConfig({
 *   cacheDir: "/home/user/.claude-cmd/cache",
 *   ttl: 7200000, // 2 hours
 * });
 * const repository = new HTTPRepository(httpClient, fileService, cacheConfig);
 * ```
 */
export default class HTTPRepository implements IRepository {
	private readonly httpClient: IHTTPClient;
	private readonly fileService: IFileService;
	private readonly cacheConfig: CacheConfig;

	/**
	 * Base URL for the GitHub repository containing command definitions
	 * Points to the main branch of the claude-cmd/commands repository
	 */
	private static readonly BASE_URL =
		"https://raw.githubusercontent.com/claude-code-commands/commands/refs/heads/main";

	/**
	 * Regular expression for validating language codes (ISO 639-1 format)
	 * Accepts 2-letter language codes like 'en', 'fr', 'es', etc.
	 */
	private static readonly LANGUAGE_CODE_PATTERN = /^[a-z]{2}$/;

	constructor(
		httpClient: IHTTPClient,
		fileService: IFileService,
		cacheConfig?: CacheConfig,
	) {
		this.httpClient = httpClient;
		this.fileService = fileService;
		this.cacheConfig = cacheConfig ?? new CacheConfig();

		// Validate dependencies at construction time
		if (!httpClient) {
			throw new Error("HTTPClient is required for repository operations");
		}
		if (!fileService) {
			throw new Error("FileService is required for caching operations");
		}
	}

	/**
	 * Sanitize path components to prevent directory traversal attacks
	 * Removes potentially dangerous characters and patterns that could escape cache directory
	 *
	 * @param component - The path component to sanitize
	 * @returns Sanitized path component safe for filesystem operations
	 * @throws Error if component is empty after sanitization
	 */
	private sanitizePathComponent(component: string): string {
		if (!component || typeof component !== "string") {
			throw new Error("Path component must be a non-empty string");
		}

		// Remove dangerous characters: path separators, null bytes, colons
		const sanitized = component
			.replace(/[./\\:\0]/g, "-")
			.replace(/\.\./g, "-")
			.trim();

		if (!sanitized) {
			throw new Error(
				`Path component "${component}" is invalid after sanitization`,
			);
		}

		// Prevent excessively long components that could cause filesystem issues
		if (sanitized.length > 255) {
			throw new Error(
				`Path component "${component}" is too long (max 255 characters)`,
			);
		}

		return sanitized;
	}

	/**
	 * Validate language code format and sanitize for URL construction
	 *
	 * @param language - Language code to validate (e.g., 'en', 'fr')
	 * @returns Validated and sanitized language code
	 * @throws ManifestError if language code format is invalid
	 */
	private validateLanguageCode(language: string): string {
		if (!language || typeof language !== "string") {
			throw new ManifestError(
				language,
				"Language code must be a non-empty string",
			);
		}

		const trimmed = language.trim().toLowerCase();

		if (!HTTPRepository.LANGUAGE_CODE_PATTERN.test(trimmed)) {
			throw new ManifestError(
				language,
				"Language code must be 2 lowercase letters (ISO 639-1 format)",
			);
		}

		return trimmed;
	}

	/**
	 * Generic cache utility that handles cache check, validation, and TTL logic
	 *
	 * This method implements a cache-first strategy with the following behavior:
	 * 1. If not force-refreshing, check for cached data and validate its structure and TTL
	 * 2. If cache miss or expired, fetch fresh data using the provided fetcher
	 * 3. Cache the fresh data with timestamp for future use
	 * 4. Return the data (cached or fresh)
	 *
	 * Cache failures are handled gracefully - the operation will continue with HTTP
	 * requests even if caching fails, ensuring repository operations are resilient.
	 *
	 * @param cacheKey - Unique identifier for the cached item (filename)
	 * @param dataFetcher - Async function that fetches fresh data when needed
	 * @param dataValidator - Function to validate cached data structure is correct
	 * @param options - Repository options including forceRefresh flag
	 * @returns Promise resolving to the requested data (cached or fresh)
	 * @throws Error from dataFetcher if fresh data cannot be retrieved
	 */
	private async getCachedData<T>(
		cacheKey: string,
		dataFetcher: () => Promise<T>,
		dataValidator: (data: unknown) => boolean,
		options?: RepositoryOptions,
	): Promise<T> {
		const cachePath = join(this.cacheConfig.cacheDir, cacheKey);

		// Phase 1: Check cache first (unless force refresh requested)
		if (!options?.forceRefresh) {
			try {
				const cacheExists = await this.fileService.exists(cachePath);

				if (cacheExists) {
					repoLogger.debug("cache file found: {cacheKey}", { cacheKey });
					const cachedContent = await this.fileService.readFile(cachePath);

					try {
						const cachedData = JSON.parse(cachedContent);

						// Validate cached data structure integrity
						if (
							typeof cachedData !== "object" ||
							cachedData === null ||
							typeof cachedData.timestamp !== "number" ||
							!dataValidator(cachedData)
						) {
							throw new Error("Invalid cached data structure");
						}

						// Check if cache has expired based on TTL
						const cacheAge = Date.now() - cachedData.timestamp;
						if (cacheAge < this.cacheConfig.ttl) {
							// Cache hit - return cached data
							repoLogger.debug(
								"cache hit: {cacheKey} (age: {age}ms, ttl: {ttl}ms)",
								{ cacheKey, age: cacheAge, ttl: this.cacheConfig.ttl },
							);
							return cachedData.data;
						}

						// Cache expired, will fetch fresh data below
						repoLogger.debug(
							"cache expired: {cacheKey} (age: {age}ms, ttl: {ttl}ms)",
							{ cacheKey, age: cacheAge, ttl: this.cacheConfig.ttl },
						);
					} catch (parseError) {
						// Malformed cache data, treat as cache miss but log warning
						repoLogger.warn("cache corrupted: {cacheKey} (error: {error})", {
							cacheKey,
							error:
								parseError instanceof Error ? parseError.message : parseError,
						});
					}
				} else {
					repoLogger.debug("cache miss: {cacheKey} (file not found)", {
						cacheKey,
					});
				}
			} catch (_cacheError) {
				// Cache read error - continue with fresh fetch
				repoLogger.debug("cache read error: {cacheKey}", { cacheKey });
			}
		}

		// Phase 2: Fetch fresh data from source
		repoLogger.debug("fetching fresh data: {cacheKey}", { cacheKey });
		const freshData = await dataFetcher();

		// Phase 3: Cache the fresh data for future use
		try {
			// Ensure cache directory exists before writing
			await this.fileService.mkdir(this.cacheConfig.cacheDir);

			const cacheData = {
				data: freshData,
				timestamp: Date.now(),
				version: "1.0", // For future cache format migration support
			};

			await this.fileService.writeFile(
				cachePath,
				JSON.stringify(cacheData, null, 2),
			);
			repoLogger.debug("cache written: {cacheKey}", { cacheKey });
		} catch (cacheWriteError) {
			// Log cache write failures but don't break the operation
			repoLogger.error("cache write failed: {cacheKey} (error: {error})", {
				cacheKey,
				error:
					cacheWriteError instanceof Error
						? cacheWriteError.message
						: cacheWriteError,
			});
		}

		return freshData;
	}

	/**
	 * Retrieve the command manifest for a specific language
	 *
	 * Fetches the manifest.json file containing all available commands for the specified
	 * language from the GitHub repository. Results are cached locally to improve performance.
	 *
	 * @param language - ISO 639-1 language code (e.g., 'en', 'fr', 'es')
	 * @param options - Optional caching and refresh configuration
	 * @returns Promise resolving to the complete manifest for the language
	 * @throws ManifestError when manifest cannot be retrieved, parsed, or language is invalid
	 */
	async getManifest(
		language: string,
		options?: RepositoryOptions,
	): Promise<Manifest> {
		// Validate and sanitize language code first
		const validatedLanguage = this.validateLanguageCode(language);
		const sanitizedLanguage = this.sanitizePathComponent(validatedLanguage);
		const cacheKey = `manifest-${sanitizedLanguage}.json`;

		// Validator to ensure cached manifest data structure is correct
		const manifestValidator = (cachedData: unknown): boolean => {
			const data = (cachedData as { data?: unknown })?.data;
			return (
				data !== null &&
				typeof data === "object" &&
				Array.isArray((data as { commands?: unknown })?.commands)
			);
		};

		// Fetcher function that retrieves fresh manifest data from GitHub
		const manifestFetcher = async (): Promise<Manifest> => {
			try {
				const manifestUrl = `${HTTPRepository.BASE_URL}/commands/${validatedLanguage}/manifest.json`;
				const response = await this.httpClient.get(manifestUrl);

				// Validate response has content
				if (!response.body || response.body.trim() === "") {
					throw new ManifestError(
						validatedLanguage,
						"Empty response received from server",
					);
				}

				// Parse and validate manifest JSON structure
				let manifest: unknown;
				try {
					manifest = JSON.parse(response.body);
				} catch (parseError) {
					throw new ManifestError(
						validatedLanguage,
						`Invalid JSON format received from server: ${parseError instanceof Error ? parseError.message : parseError}`,
					);
				}

				// Basic manifest structure validation
				if (
					!manifest ||
					typeof manifest !== "object" ||
					!Array.isArray((manifest as { commands?: unknown }).commands)
				) {
					throw new ManifestError(
						validatedLanguage,
						"Manifest does not contain valid commands array",
					);
				}

				return manifest as Manifest;
			} catch (error) {
				// Transform HTTP and other errors to ManifestError with proper context
				if (error instanceof ManifestError) {
					// Already a ManifestError, re-throw as-is
					throw error;
				} else if (error instanceof HTTPTimeoutError) {
					throw new ManifestError(
						validatedLanguage,
						`Request timed out after ${error.timeout}ms while fetching manifest`,
					);
				} else if (error instanceof HTTPNetworkError) {
					throw new ManifestError(
						validatedLanguage,
						`Network connection failed: ${error.cause || "Connection error"}`,
					);
				} else if (error instanceof HTTPStatusError) {
					throw new ManifestError(
						validatedLanguage,
						`Server returned ${error.status} ${error.statusText} for manifest request`,
					);
				} else {
					throw new ManifestError(
						validatedLanguage,
						`Unexpected error retrieving manifest: ${error instanceof Error ? error.message : error}`,
					);
				}
			}
		};

		return this.getCachedData(
			cacheKey,
			manifestFetcher,
			manifestValidator,
			options,
		);
	}

	/**
	 * Retrieve the content of a specific command file
	 *
	 * Fetches the markdown content of a command from the GitHub repository after first
	 * validating that the command exists in the manifest for the specified language.
	 * Results are cached locally to improve performance.
	 *
	 * @param commandName - Name of the command as it appears in the manifest
	 * @param language - ISO 639-1 language code (e.g., 'en', 'fr', 'es')
	 * @param options - Optional caching and refresh configuration
	 * @returns Promise resolving to the raw markdown content of the command file
	 * @throws CommandNotFoundError when command doesn't exist in the manifest
	 * @throws CommandContentError when command file cannot be retrieved
	 * @throws ManifestError if manifest retrieval fails during validation
	 */
	async getCommand(
		commandName: string,
		language: string,
		options?: RepositoryOptions,
	): Promise<string> {
		// Input validation
		if (!commandName || typeof commandName !== "string") {
			throw new CommandNotFoundError(commandName, language);
		}

		// First verify the command exists in the manifest (this validates language too)
		const validatedLanguage = this.validateLanguageCode(language);
		const manifest = await this.getManifest(validatedLanguage, options);
		const command = manifest.commands.find((cmd) => cmd.name === commandName);

		if (!command) {
			throw new CommandNotFoundError(commandName, validatedLanguage);
		}

		// Validate command file path is not empty or dangerous
		if (!command.file || typeof command.file !== "string") {
			throw new CommandContentError(
				commandName,
				validatedLanguage,
				"Command file path is missing or invalid in manifest",
			);
		}

		const sanitizedLanguage = this.sanitizePathComponent(validatedLanguage);
		const sanitizedCommandName = this.sanitizePathComponent(commandName);
		const cacheKey = `command-${sanitizedLanguage}-${sanitizedCommandName}.md`;

		// Validator to ensure cached content data is a string
		const contentValidator = (cachedData: unknown): boolean => {
			const data = (cachedData as { data?: unknown })?.data;
			return typeof data === "string" && data.length > 0;
		};

		// Fetcher function that retrieves fresh command content from GitHub
		const contentFetcher = async (): Promise<string> => {
			try {
				const commandUrl = `${HTTPRepository.BASE_URL}/commands/${validatedLanguage}/${command.file}`;
				const response = await this.httpClient.get(commandUrl);

				// Validate response has content
				if (response.body === undefined || response.body === null) {
					throw new CommandContentError(
						commandName,
						validatedLanguage,
						"Empty or null response received from server",
					);
				}

				// Allow empty string content but warn about it
				if (response.body === "") {
					repoLogger.warn(
						"command has empty content: {commandName} (language: {language})",
						{ commandName, language: validatedLanguage },
					);
				}

				return response.body;
			} catch (error) {
				// Transform HTTP and other errors to CommandContentError with proper context
				if (error instanceof CommandContentError) {
					// Already a CommandContentError, re-throw as-is
					throw error;
				} else if (error instanceof HTTPTimeoutError) {
					throw new CommandContentError(
						commandName,
						validatedLanguage,
						`Request timed out after ${error.timeout}ms while fetching command content`,
					);
				} else if (error instanceof HTTPNetworkError) {
					throw new CommandContentError(
						commandName,
						validatedLanguage,
						`Network connection failed: ${error.cause || "Connection error"}`,
					);
				} else if (error instanceof HTTPStatusError) {
					throw new CommandContentError(
						commandName,
						validatedLanguage,
						`Server returned ${error.status} ${error.statusText} for command file request`,
					);
				} else {
					throw new CommandContentError(
						commandName,
						validatedLanguage,
						`Unexpected error retrieving command content: ${error instanceof Error ? error.message : error}`,
					);
				}
			}
		};

		return this.getCachedData(
			cacheKey,
			contentFetcher,
			contentValidator,
			options,
		);
	}

	/**
	 * Discover available languages from the repository cache
	 *
	 * Dynamically discovers which languages have command manifests available by
	 * scanning the cache directory structure. Falls back to attempting network
	 * discovery if cache is empty. Provides command counts for each language
	 * to help users assess the value of each language option.
	 *
	 * @returns Promise resolving to array of language information with command counts
	 */
	async getAvailableLanguages(): Promise<LanguageStatusInfo[]> {
		const languages: LanguageStatusInfo[] = [];

		try {
			// Check if cache directory exists
			const cacheDirExists = await this.fileService.exists(
				this.cacheConfig.cacheDir,
			);
			if (!cacheDirExists) {
				// No cache yet, return empty array (caller can use common languages)
				return [];
			}

			// List all files in the cache directory
			const entries = await this.fileService.listFiles(
				this.cacheConfig.cacheDir,
			);

			// Find all manifest files (format: manifest-{lang}.json)
			const manifestPattern = /^manifest-([a-z]{2})\.json$/;

			for (const entry of entries) {
				const match = entry.match(manifestPattern);
				if (!match) {
					continue;
				}

				const languageCode = match[1];
				if (!languageCode) continue;

				const manifestPath = join(this.cacheConfig.cacheDir, entry);

				try {
					// Read and parse the manifest to get command count
					const manifestContent = await this.fileService.readFile(manifestPath);

					// Parse the cached data (it includes timestamp)
					const cacheData = JSON.parse(manifestContent);
					const manifestData = cacheData.data || cacheData; // Handle both cache formats

					// Validate it's a proper manifest with commands array
					if (!manifestData || !Array.isArray(manifestData.commands)) {
						continue;
					}

					// Try to get language name from known languages or use code as fallback
					const languageName = this.getLanguageName(languageCode);

					languages.push({
						code: languageCode,
						name: languageName || languageCode,
						commandCount: manifestData.commands.length,
					});
				} catch (error) {
					// Skip this language if we can't read or parse its manifest
					repoLogger.debug(
						"skipping language {languageCode} (error: {error})",
						{
							languageCode,
							error: error instanceof Error ? error.message : String(error),
						},
					);
				}
			}

			// Sort languages by command count (descending) for better UX
			languages.sort((a, b) => b.commandCount - a.commandCount);

			return languages;
		} catch (error) {
			// If we can't read the cache directory, return empty array
			repoLogger.debug("error reading cache directory (error: {error})", {
				error: error instanceof Error ? error.message : String(error),
			});
			return [];
		}
	}

	/**
	 * Get human-readable language name from language code
	 *
	 * @param code - ISO 639-1 language code
	 * @returns Human-readable language name or the code itself if unknown
	 */
	private getLanguageName(code: string): string {
		// Common language names mapping (will be extended over time)
		const knownLanguages = new Map<string, string>([
			["en", "English"],
			["fr", "Français"],
			["es", "Español"],
			["de", "Deutsch"],
			["it", "Italiano"],
			["pt", "Português"],
			["ja", "日本語"],
			["ko", "한국어"],
			["zh", "中文"],
			["ru", "Русский"],
			["pl", "Polski"],
			["nl", "Nederlands"],
			["sv", "Svenska"],
			["no", "Norsk"],
			["da", "Dansk"],
			["fi", "Suomi"],
			["tr", "Türkçe"],
			["ar", "العربية"],
			["he", "עברית"],
			["hi", "हिन्दी"],
		]);

		return knownLanguages.get(code) || code.toUpperCase();
	}
}
