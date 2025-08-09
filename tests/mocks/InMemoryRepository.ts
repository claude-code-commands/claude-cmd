import { join } from "node:path";
import type IFileService from "../../src/interfaces/IFileService.js";
import type IHTTPClient from "../../src/interfaces/IHTTPClient.js";
import type IRepository from "../../src/interfaces/IRepository.js";
import type { LanguageStatusInfo } from "../../src/interfaces/IRepository.js";
import { CacheConfig } from "../../src/interfaces/IRepository.js";
import type { Manifest, RepositoryOptions } from "../../src/types/Command.js";
import {
	CommandContentError,
	CommandNotFoundError,
	ManifestError,
} from "../../src/types/Command.js";

/**
 * Request history entry for tracking Repository method calls and dependency usage
 */
export interface RepositoryRequestHistoryEntry {
	/** The method that was called (getManifest, getCommand) */
	method: string;
	/** The language parameter passed to the method */
	language: string;
	/** The command name (for getCommand calls only) */
	commandName?: string;
	/** The options parameter passed to the method */
	options?: RepositoryOptions;
	/** Whether HTTPClient was called during this request */
	httpCalled?: boolean;
	/** Whether FileService was called during this request */
	fileCalled?: boolean;
}

/**
 * In-memory repository implementation for testing
 *
 * Simulates repository responses based on language and command parameters.
 * Can trigger various error conditions for comprehensive testing scenarios.
 * Provides deterministic mock for unit testing without requiring network connectivity.
 *
 * Now accepts HTTPClient and FileService dependencies to simulate real repository behavior
 * and verify that dependencies are used correctly in tests.
 *
 * @example
 * ```typescript
 * const httpClient = new MockHTTPClient();
 * const fileService = new MockFileService();
 * const repo = new InMemoryRepository(httpClient, fileService);
 * const manifest = await repo.getManifest('en');
 * console.log(manifest.commands.length); // 6 (default test commands)
 * ```
 */
class InMemoryRepository implements IRepository {
	/** Injected HTTP client for network operations */
	private readonly httpClient: IHTTPClient;
	/** Injected file service for caching operations */
	private readonly fileService: IFileService;
	/** Cache configuration */
	private readonly cacheConfig: CacheConfig;

	/** Pre-configured manifests mapped by language */
	private readonly manifests: Map<string, Manifest | Error>;
	/** Pre-configured command content mapped by language:commandName */
	private readonly commands: Map<string, string | Error>;
	/** History of all requests made to this repository instance (capped at 1000 entries) */
	private readonly requestHistory: Array<RepositoryRequestHistoryEntry>;
	/** Maximum number of request history entries to maintain */
	private readonly maxHistoryEntries = 1000;

	constructor(
		httpClient: IHTTPClient,
		fileService: IFileService,
		cacheConfig?: CacheConfig,
	) {
		this.httpClient = httpClient;
		this.fileService = fileService;
		this.cacheConfig = cacheConfig ?? new CacheConfig();
		this.manifests = new Map();
		this.commands = new Map();
		this.requestHistory = [];
		this.setupDefaultData();
	}

	/**
	 * Add request history entry while maintaining size limit
	 * Keeps most recent entries, discarding oldest when limit exceeded
	 */
	private addToRequestHistory(entry: RepositoryRequestHistoryEntry): void {
		this.requestHistory.push(entry);

		// Trim to max size if exceeded
		if (this.requestHistory.length > this.maxHistoryEntries) {
			this.requestHistory.splice(
				0,
				this.requestHistory.length - this.maxHistoryEntries,
			);
		}
	}

	/**
	 * Sanitize path components to prevent directory traversal attacks
	 * Removes potentially dangerous characters that could escape cache directory
	 */
	private static sanitizePathComponent(component: string): string {
		// Remove path traversal patterns, null bytes, and other dangerous characters
		return component.replace(/[./\\:\0]/g, "").replace(/\.\./g, "");
	}

	/**
	 * Generic cache utility that handles cache check, validation, and TTL logic
	 * Eliminates code duplication between getManifest and getCommand
	 */
	private async getCachedData<T>(
		cacheKey: string,
		dataFetcher: () => Promise<T>,
		dataValidator: (data: unknown) => boolean,
		options?: RepositoryOptions,
	): Promise<{ data: T; httpCalled: boolean; fileCalled: boolean }> {
		const cachePath = join(this.cacheConfig.cacheDir, cacheKey);
		let httpCalled = false;
		let fileCalled = false;

		// 1. Check cache first (unless force refresh)
		if (!options?.forceRefresh) {
			try {
				const cacheExists = await this.fileService.exists(cachePath);
				fileCalled = true;

				if (cacheExists) {
					const cachedContent = await this.fileService.readFile(cachePath);
					try {
						const cachedData = JSON.parse(cachedContent);

						// Validate cached data structure
						if (
							typeof cachedData !== "object" ||
							!cachedData.timestamp ||
							typeof cachedData.timestamp !== "number" ||
							!dataValidator(cachedData)
						) {
							throw new Error("Invalid cached data structure");
						}

						// Check TTL
						const cacheAge = Date.now() - cachedData.timestamp;
						if (cacheAge < this.cacheConfig.ttl) {
							return { data: cachedData.data, httpCalled, fileCalled };
						}
					} catch (error) {
						// Malformed cache data, treat as cache miss but log the issue
						console.warn(`Failed to parse cache file ${cachePath}:`, error);
					}
				}
			} catch {
				// Cache miss or error, continue to fetch fresh data
			}
		}

		// 2. Fetch fresh data
		const freshData = await dataFetcher();
		httpCalled = true;

		// 3. Cache the result
		try {
			const cacheData = { data: freshData, timestamp: Date.now() };
			await this.fileService.writeFile(
				cachePath,
				JSON.stringify(cacheData, null, 2),
			);
			fileCalled = true;
		} catch (error) {
			console.error(`Cache write failed for ${cacheKey}:`, error);
		}

		return { data: freshData, httpCalled, fileCalled };
	}

	/**
	 * Initialize default test data for common scenarios
	 * Includes successful manifests, commands, and error conditions
	 */
	private setupDefaultData(): void {
		// Default English manifest
		const enManifest: Manifest = {
			version: "1.0.1",
			updated: "2025-07-09T00:41:00Z",
			commands: [
				{
					name: "debug-help",
					description:
						"Provide systematic debugging assistance for code issues",
					file: "debug-help.md",
					"allowed-tools": ["Read", "Glob", "Grep", "Bash(git:*)", "Edit"],
				},
				{
					name: "code-review",
					description:
						"Perform comprehensive code review with best practices suggestions",
					file: "code-review.md",
					"allowed-tools": ["Read", "Glob", "Grep", "Edit"],
				},
				{
					name: "test-gen",
					description: "Generate comprehensive test suites for your code",
					file: "test-gen.md",
					"allowed-tools": ["Read", "Glob", "Grep", "Write", "Edit"],
				},
				{
					name: "frontend:component",
					description: "Generate React components with TypeScript definitions",
					file: "frontend/component.md",
					"allowed-tools": "Read, Edit, Write, Bash(npm:*)",
				},
				{
					name: "backend:api",
					description:
						"Generate REST API endpoints with validation and error handling",
					file: "backend/api.md",
					"allowed-tools": "Read, Edit, Write, Bash(npm:*, yarn:*)",
				},
				{
					name: "content-error",
					description: "Test command for content error scenarios",
					file: "content-error.md",
					"allowed-tools": ["Read"],
				},
			],
		};

		this.manifests.set("en", enManifest);

		// French manifest with fewer commands (matches MockHTTPClient)
		const frManifest: Manifest = {
			version: "1.0.0",
			updated: "2025-07-08T12:00:00Z",
			commands: [
				{
					name: "debug-help",
					description:
						"Fournir une assistance de débogage systématique pour les problèmes de code",
					file: "debug-help.md",
					"allowed-tools": ["Read", "Glob", "Grep", "Edit"],
				},
				{
					name: "missing-file",
					description: "Command that simulates missing file error",
					file: "missing-file.md",
					"allowed-tools": ["Read"],
				},
				{
					name: "frontend:component",
					description:
						"Générer des composants React avec les meilleures pratiques",
					file: "frontend-component.md",
					"allowed-tools": ["Write", "Edit", "Read"],
				},
			],
		};

		this.manifests.set("fr", frManifest);

		// Sample command content
		this.commands.set(
			"en:debug-help",
			"# Debug Help\n\nThis command provides systematic debugging assistance for code issues.\n\n## Usage\n\nProvide details about your bug and I'll help you debug it step by step.",
		);

		this.commands.set(
			"en:code-review",
			"# Code Review\n\nThis command performs comprehensive code review with best practices suggestions.\n\n## Usage\n\nShare your code and I'll provide detailed feedback.",
		);

		this.commands.set(
			"en:test-gen",
			"# Test Generation\n\nThis command generates comprehensive test suites for your code.\n\n## Usage\n\nProvide your code and I'll create appropriate tests.",
		);

		this.commands.set(
			"en:frontend:component",
			"# Frontend Component\n\nThis command generates React components with TypeScript definitions.\n\n## Usage\n\nDescribe the component you need and I'll create it.",
		);

		this.commands.set(
			"en:backend:api",
			"# Backend API\n\nThis command generates REST API endpoints with validation and error handling.\n\n## Usage\n\nDescribe your API requirements and I'll create the endpoints.",
		);

		this.commands.set(
			"fr:debug-help",
			"# Aide au débogage\n\nCette commande fournit une assistance de débogage systématique pour les problèmes de code.\n\n## Utilisation\n\nDécrivez votre problème et je vous aiderai à le déboguer étape par étape.",
		);

		this.commands.set(
			"fr:frontend:component",
			"# Composant Frontend\n\nCette commande génère des composants React avec les meilleures pratiques.\n\n## Utilisation\n\nDécrivez le composant dont vous avez besoin et je le créerai.",
		);

		// Error scenarios for manifests
		this.manifests.set(
			"invalid-lang",
			new ManifestError("invalid-lang", "Language not supported"),
		);
		this.manifests.set(
			"network-error",
			new ManifestError("network-error", "Network connection failed"),
		);
		this.manifests.set(
			"timeout",
			new ManifestError("timeout", "Request timed out"),
		);

		// Error scenarios for commands - these should be exceptions for specific test cases
		this.commands.set(
			"en:content-error",
			new CommandContentError("content-error", "en", "File corrupted"),
		);
		// missing-file command in French should throw error instead of returning content
		this.commands.set(
			"fr:missing-file",
			new CommandContentError("missing-file", "fr", "File not found on server"),
		);
	}

	/**
	 * Retrieve the command manifest for a specific language
	 *
	 * @param language - ISO 639-1 language code (e.g., "en", "fr", "es")
	 * @param options - Optional caching and refresh configuration
	 * @returns Promise resolving to the complete manifest for the language
	 * @throws ManifestError when manifest cannot be retrieved or parsed
	 */
	async getManifest(
		language: string,
		options?: RepositoryOptions,
	): Promise<Manifest> {
		try {
			// Use the generic cache utility for consistent caching behavior
			const sanitizedLanguage =
				InMemoryRepository.sanitizePathComponent(language);
			const cacheKey = `manifest-${sanitizedLanguage}.json`;

			const manifestValidator = (cachedData: unknown): boolean => {
				return (
					// biome-ignore lint: requires any
					(cachedData as any)?.data &&
					// biome-ignore lint: requires any
					typeof (cachedData as any).data === "object"
				);
			};

			const manifestFetcher = async (): Promise<Manifest> => {
				try {
					const manifestUrl = `https://raw.githubusercontent.com/example/commands/main/${language}/index.json`;
					const response = await this.httpClient.get(manifestUrl);

					// Parse manifest from HTTP response with error handling
					try {
						const manifest = JSON.parse(response.body);
						return manifest;
					} catch (_parseError) {
						// Malformed JSON response, convert to ManifestError
						throw new ManifestError(
							language,
							"Invalid manifest format received from server",
						);
					}
				} catch (_error) {
					// HTTP failed, fall back to pre-configured data for testing
					throw new Error(
						"HTTP fetch failed, falling back to pre-configured data",
					);
				}
			};

			const result = await this.getCachedData(
				cacheKey,
				manifestFetcher,
				manifestValidator,
				options,
			);

			this.addToRequestHistory({
				method: "getManifest",
				language,
				options,
				httpCalled: result.httpCalled,
				fileCalled: result.fileCalled,
			});

			return result.data;
		} catch (_error) {
			// If cache utility fails, fall back to pre-configured data
			this.addToRequestHistory({
				method: "getManifest",
				language,
				options,
				httpCalled: false,
				fileCalled: false,
			});

			// Simulate network delay for realism
			await new Promise((resolve) => setTimeout(resolve, 1));

			// Fall back to pre-configured manifest or error for testing
			const manifest = this.manifests.get(language);

			if (!manifest) {
				throw new ManifestError(
					language,
					"Language not supported by repository",
				);
			}

			if (manifest instanceof Error) {
				throw manifest;
			}

			return manifest;
		}
	}

	/**
	 * Retrieve the content of a specific command file
	 *
	 * @param commandName - Name of the command as it appears in the manifest
	 * @param language - ISO 639-1 language code (e.g., "en", "fr", "es")
	 * @param options - Optional caching and refresh configuration
	 * @returns Promise resolving to the raw markdown content of the command file
	 * @throws CommandNotFoundError when command doesn't exist in the manifest
	 * @throws CommandContentError when command file cannot be retrieved
	 */
	async getCommand(
		commandName: string,
		language: string,
		options?: RepositoryOptions,
	): Promise<string> {
		// First verify the command exists in the manifest - ALWAYS do this check
		const manifest = await this.getManifest(language, options);
		const command = manifest.commands.find((cmd) => cmd.name === commandName);

		if (!command) {
			// Record the request even for validation failures
			this.addToRequestHistory({
				method: "getCommand",
				language,
				commandName,
				options,
				httpCalled: false,
				fileCalled: false,
			});
			throw new CommandNotFoundError(commandName, language);
		}

		try {
			// Use the generic cache utility for consistent caching behavior
			const sanitizedLanguage =
				InMemoryRepository.sanitizePathComponent(language);
			const sanitizedCommandName =
				InMemoryRepository.sanitizePathComponent(commandName);
			const cacheKey = `command-${sanitizedLanguage}-${sanitizedCommandName}.md`;

			const contentValidator = (cachedData: unknown): boolean => {
				return (
					// biome-ignore lint: requires any
					(cachedData as any)?.data &&
					// biome-ignore lint: requires any
					typeof (cachedData as any).data === "string"
				);
			};

			const contentFetcher = async (): Promise<string> => {
				try {
					const commandUrl = `https://raw.githubusercontent.com/example/commands/main/${language}/${command.file}`;
					const response = await this.httpClient.get(commandUrl);
					return response.body;
				} catch (_error) {
					// HTTP failed, fall back to pre-configured data for testing
					throw new Error(
						"HTTP fetch failed, falling back to pre-configured data",
					);
				}
			};

			const result = await this.getCachedData(
				cacheKey,
				contentFetcher,
				contentValidator,
				options,
			);

			this.addToRequestHistory({
				method: "getCommand",
				language,
				commandName,
				options,
				httpCalled: result.httpCalled,
				fileCalled: result.fileCalled,
			});

			return result.data;
		} catch (_error) {
			// If cache utility fails, fall back to pre-configured data
			this.addToRequestHistory({
				method: "getCommand",
				language,
				commandName,
				options,
				httpCalled: false,
				fileCalled: false,
			});

			// Simulate network delay for realism
			await new Promise((resolve) => setTimeout(resolve, 1));

			// Fall back to pre-configured command content or error for testing
			const commandKey = `${language}:${commandName}`;
			const content = this.commands.get(commandKey);

			if (!content) {
				throw new CommandContentError(
					commandName,
					language,
					"Command file not found in repository",
				);
			}

			if (content instanceof Error) {
				throw content;
			}

			return content;
		}
	}

	/**
	 * Get the history of requests made to this repository (for testing verification)
	 *
	 * @returns Copy of request history to prevent external modification
	 */
	getRequestHistory(): Array<RepositoryRequestHistoryEntry> {
		return [...this.requestHistory];
	}

	/**
	 * Clear request history for clean test state
	 */
	clearRequestHistory(): void {
		this.requestHistory.length = 0;
	}

	/**
	 * Get available languages from the in-memory manifests
	 */
	async getAvailableLanguages(): Promise<LanguageStatusInfo[]> {
		const languages: LanguageStatusInfo[] = [];

		for (const [lang, manifest] of this.manifests) {
			if (!(manifest instanceof Error)) {
				languages.push({
					code: lang,
					name: lang === "en" ? "English" : lang === "fr" ? "French" : lang,
					commandCount: manifest.commands.length,
				});
			}
		}

		return languages;
	}

	/**
	 * Add a custom manifest for dynamic testing scenarios
	 *
	 * @param language - The language code to map
	 * @param manifest - The manifest or error to return for this language
	 */
	setManifest(language: string, manifest: Manifest | Error): void {
		this.manifests.set(language, manifest);
	}

	/**
	 * Add custom command content for dynamic testing scenarios
	 *
	 * @param commandName - The command name
	 * @param language - The language code
	 * @param content - The content or error to return for this command
	 */
	setCommand(
		commandName: string,
		language: string,
		content: string | Error,
	): void {
		const commandKey = `${language}:${commandName}`;
		this.commands.set(commandKey, content);
	}
}

export default InMemoryRepository;
