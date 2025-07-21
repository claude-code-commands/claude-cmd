import type IRepository from "../../src/interfaces/IRepository.js";
import type { CacheConfig } from "../../src/interfaces/IRepository.js";
import type IHTTPClient from "../../src/interfaces/IHTTPClient.js";
import type IFileService from "../../src/interfaces/IFileService.js";
import type { Manifest, RepositoryOptions } from "../../src/types/Command.js";
import {
	ManifestError,
	CommandNotFoundError,
	CommandContentError,
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
	/** History of all requests made to this repository instance */
	private readonly requestHistory: Array<RepositoryRequestHistoryEntry>;

	constructor(
		httpClient: IHTTPClient,
		fileService: IFileService,
		cacheConfig: CacheConfig = {
			cacheDir: "/tmp/claude-cmd-cache",
			ttl: 3600000, // 1 hour
			maxSize: 10485760 // 10MB
		}
	) {
		this.httpClient = httpClient;
		this.fileService = fileService;
		this.cacheConfig = cacheConfig;
		this.manifests = new Map();
		this.commands = new Map();
		this.requestHistory = [];
		this.setupDefaultData();
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
					description: "Provide systematic debugging assistance for code issues",
					file: "debug-help.md",
					"allowed-tools": ["Read", "Glob", "Grep", "Bash(git:*)", "Edit"]
				},
				{
					name: "code-review",
					description: "Perform comprehensive code review with best practices suggestions",
					file: "code-review.md",
					"allowed-tools": ["Read", "Glob", "Grep", "Edit"]
				},
				{
					name: "test-gen",
					description: "Generate comprehensive test suites for your code",
					file: "test-gen.md",
					"allowed-tools": ["Read", "Glob", "Grep", "Write", "Edit"]
				},
				{
					name: "frontend:component",
					description: "Generate React components with TypeScript definitions",
					file: "frontend/component.md",
					"allowed-tools": "Read, Edit, Write, Bash(npm:*)"
				},
				{
					name: "backend:api",
					description: "Generate REST API endpoints with validation and error handling",
					file: "backend/api.md",
					"allowed-tools": "Read, Edit, Write, Bash(npm:*, yarn:*)"
				},
				{
					name: "content-error",
					description: "Test command for content error scenarios",
					file: "content-error.md",
					"allowed-tools": ["Read"]
				}
			]
		};

		this.manifests.set("en", enManifest);

		// French manifest with fewer commands
		const frManifest: Manifest = {
			version: "1.0.0",
			updated: "2025-07-08T12:00:00Z",
			commands: [
				{
					name: "debug-help",
					description: "Fournir une assistance de débogage systématique pour les problèmes de code",
					file: "debug-help.md",
					"allowed-tools": ["Read", "Glob", "Grep", "Edit"]
				},
				{
					name: "code-review",
					description: "Effectuer une révision de code complète avec des suggestions de meilleures pratiques",
					file: "code-review.md",
					"allowed-tools": ["Read", "Glob", "Grep", "Edit"]
				},
				{
					name: "missing-file",
					description: "Test command for missing file scenarios",
					file: "missing-file.md",
					"allowed-tools": ["Read"]
				}
			]
		};

		this.manifests.set("fr", frManifest);

		// Sample command content
		this.commands.set("en:debug-help", 
			"# Debug Help\n\nThis command provides systematic debugging assistance for code issues.\n\n## Usage\n\nProvide details about your bug and I'll help you debug it step by step."
		);

		this.commands.set("en:code-review", 
			"# Code Review\n\nThis command performs comprehensive code review with best practices suggestions.\n\n## Usage\n\nShare your code and I'll provide detailed feedback."
		);

		this.commands.set("en:test-gen", 
			"# Test Generation\n\nThis command generates comprehensive test suites for your code.\n\n## Usage\n\nProvide your code and I'll create appropriate tests."
		);

		this.commands.set("en:frontend:component", 
			"# Frontend Component\n\nThis command generates React components with TypeScript definitions.\n\n## Usage\n\nDescribe the component you need and I'll create it."
		);

		this.commands.set("en:backend:api", 
			"# Backend API\n\nThis command generates REST API endpoints with validation and error handling.\n\n## Usage\n\nDescribe your API requirements and I'll create the endpoints."
		);

		this.commands.set("fr:debug-help", 
			"# Aide au débogage\n\nCette commande fournit une assistance de débogage systématique pour les problèmes de code.\n\n## Utilisation\n\nDécrivez votre problème et je vous aiderai à le déboguer étape par étape."
		);

		this.commands.set("fr:code-review", 
			"# Révision de code\n\nCette commande effectue une révision de code complète avec des suggestions.\n\n## Utilisation\n\nPartagez votre code et je fournirai des commentaires détaillés."
		);

		// Error scenarios
		this.manifests.set("invalid-lang", new ManifestError("invalid-lang", "Language not supported"));
		this.manifests.set("network-error", new ManifestError("network-error", "Network connection failed"));
		this.manifests.set("timeout", new ManifestError("timeout", "Request timed out"));

		this.commands.set("en:non-existent", new CommandNotFoundError("non-existent", "en"));
		this.commands.set("en:content-error", new CommandContentError("content-error", "en", "File corrupted"));
		this.commands.set("fr:missing-file", new CommandContentError("missing-file", "fr", "File not found on server"));
	}

	/**
	 * Retrieve the command manifest for a specific language
	 * 
	 * @param language - ISO 639-1 language code (e.g., "en", "fr", "es")
	 * @param options - Optional caching and refresh configuration
	 * @returns Promise resolving to the complete manifest for the language
	 * @throws ManifestError when manifest cannot be retrieved or parsed
	 */
	async getManifest(language: string, options?: RepositoryOptions): Promise<Manifest> {
		let httpCalled = false;
		let fileCalled = false;

		try {
			// Simulate cache check first using FileService
			const cacheKey = `manifest-${language}.json`;
			const cachePath = `${this.cacheConfig.cacheDir}/${cacheKey}`;
			
			// Check if cached file exists and is not expired (unless force refresh)
			if (!options?.forceRefresh) {
				try {
					const cacheExists = await this.fileService.exists(cachePath);
					fileCalled = true;
					
					if (cacheExists) {
						const cachedContent = await this.fileService.readFile(cachePath);
						try {
							const cachedData = JSON.parse(cachedContent);
							
							// Check TTL
							const cacheAge = Date.now() - cachedData.timestamp;
							if (cacheAge < this.cacheConfig.ttl) {
								// Return cached manifest
								this.requestHistory.push({ 
									method: "getManifest", 
									language, 
									options, 
									httpCalled, 
									fileCalled: true 
								});
								return cachedData.manifest;
							}
						} catch {
							// Malformed cache data, treat as cache miss and continue
						}
					}
				} catch {
					// Cache miss or error, continue to HTTP
				}
			}

			// Simulate HTTP request using HTTPClient
			try {
				const manifestUrl = `https://raw.githubusercontent.com/example/commands/main/${language}/index.json`;
				const response = await this.httpClient.get(manifestUrl);
				httpCalled = true;

				// Parse manifest from HTTP response with error handling
				try {
					const manifest = JSON.parse(response.body);

					// Cache the result using FileService
					const cacheData = {
						manifest,
						timestamp: Date.now()
					};
					await this.fileService.writeFile(cachePath, JSON.stringify(cacheData, null, 2));
					fileCalled = true;

					this.requestHistory.push({ 
						method: "getManifest", 
						language, 
						options, 
						httpCalled: true, 
						fileCalled 
					});

					return manifest;
				} catch (parseError) {
					// Malformed JSON response, convert to ManifestError
					throw new ManifestError(language, "Invalid manifest format received from server");
				}

			} catch (error) {
				// HTTP failed or JSON parse failed, fall back to pre-configured data for testing
				httpCalled = true;
			}

		} catch (error) {
			// Dependency call failed, fall back to pre-configured data
		}

		// Record the request with dependency usage tracking
		this.requestHistory.push({ 
			method: "getManifest", 
			language, 
			options, 
			httpCalled, 
			fileCalled 
		});

		// Simulate network delay for realism
		await new Promise(resolve => setTimeout(resolve, 1));

		// Fall back to pre-configured manifest or error for testing
		const manifest = this.manifests.get(language);

		if (!manifest) {
			throw new ManifestError(language, "Language not supported by repository");
		}

		if (manifest instanceof Error) {
			throw manifest;
		}

		return manifest;
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
	async getCommand(commandName: string, language: string, options?: RepositoryOptions): Promise<string> {
		let httpCalled = false;
		let fileCalled = false;

		try {
			// First verify the command exists in the manifest
			const manifest = await this.getManifest(language, options);
			const command = manifest.commands.find(cmd => cmd.name === commandName);

			if (!command) {
				throw new CommandNotFoundError(commandName, language);
			}

			// Simulate cache check using FileService
			const cacheKey = `command-${language}-${commandName}.md`;
			const cachePath = `${this.cacheConfig.cacheDir}/${cacheKey}`;

			// Check cache first (unless force refresh)
			if (!options?.forceRefresh) {
				try {
					const cacheExists = await this.fileService.exists(cachePath);
					fileCalled = true;

					if (cacheExists) {
						const cachedContent = await this.fileService.readFile(cachePath);
						try {
							const cachedData = JSON.parse(cachedContent);

							// Check TTL
							const cacheAge = Date.now() - cachedData.timestamp;
							if (cacheAge < this.cacheConfig.ttl) {
								this.requestHistory.push({ 
									method: "getCommand", 
									language, 
									commandName, 
									options, 
									httpCalled, 
									fileCalled: true 
								});
								return cachedData.content;
							}
						} catch {
							// Malformed cache data, treat as cache miss and continue
						}
					}
				} catch {
					// Cache miss or error, continue to HTTP
				}
			}

			// Simulate HTTP request for command content using HTTPClient
			try {
				const commandUrl = `https://raw.githubusercontent.com/example/commands/main/${language}/${command.file}`;
				const response = await this.httpClient.get(commandUrl);
				httpCalled = true;

				const content = response.body;

				// Cache the result using FileService
				const cacheData = {
					content,
					timestamp: Date.now()
				};
				await this.fileService.writeFile(cachePath, JSON.stringify(cacheData, null, 2));
				fileCalled = true;

				this.requestHistory.push({ 
					method: "getCommand", 
					language, 
					commandName, 
					options, 
					httpCalled: true, 
					fileCalled 
				});

				return content;

			} catch (error) {
				// HTTP failed, fall back to pre-configured data
				httpCalled = true;
			}

		} catch (error) {
			// Dependency call failed or manifest error, fall back to pre-configured data
		}

		// Record the request with dependency usage tracking
		this.requestHistory.push({ 
			method: "getCommand", 
			language, 
			commandName, 
			options, 
			httpCalled, 
			fileCalled 
		});

		// Simulate network delay for realism
		await new Promise(resolve => setTimeout(resolve, 1));

		// Fall back to pre-configured command content or error for testing
		const commandKey = `${language}:${commandName}`;
		const content = this.commands.get(commandKey);

		if (!content) {
			throw new CommandContentError(commandName, language, "Command file not found in repository");
		}

		if (content instanceof Error) {
			throw content;
		}

		return content;
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
	setCommand(commandName: string, language: string, content: string | Error): void {
		const commandKey = `${language}:${commandName}`;
		this.commands.set(commandKey, content);
	}
}

export default InMemoryRepository;