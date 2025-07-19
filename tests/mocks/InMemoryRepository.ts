import type IRepository from "../../src/interfaces/IRepository.js";
import type { Manifest, RepositoryOptions } from "../../src/types/Command.js";
import {
	ManifestError,
	CommandNotFoundError,
	CommandContentError,
} from "../../src/types/Command.js";

/**
 * In-memory repository implementation for testing
 * 
 * Simulates repository responses based on language and command parameters.
 * Can trigger various error conditions for comprehensive testing scenarios.
 * Provides deterministic mock for unit testing without requiring network connectivity.
 * 
 * @example
 * ```typescript
 * const repo = new InMemoryRepository();
 * const manifest = await repo.getManifest('en');
 * console.log(manifest.commands.length); // 5 (default test commands)
 * ```
 */
class InMemoryRepository implements IRepository {
	/** Pre-configured manifests mapped by language */
	private readonly manifests: Map<string, Manifest | Error>;
	/** Pre-configured command content mapped by language:commandName */
	private readonly commands: Map<string, string | Error>;
	/** History of all requests made to this repository instance */
	private readonly requestHistory: Array<{ method: string; language: string; commandName?: string; options?: RepositoryOptions }>;

	constructor() {
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
		// Record request for verification in tests
		this.requestHistory.push({ method: "getManifest", language, options });

		// Simulate network delay for realism
		await new Promise(resolve => setTimeout(resolve, 1));

		// Handle force refresh option
		if (options?.forceRefresh) {
			// In a real implementation, this would bypass cache
			// For testing, we just record the option was used
		}

		// Retrieve pre-configured manifest or error for this language
		const manifest = this.manifests.get(language);

		if (!manifest) {
			// Default behavior for unmapped languages
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
		// Record request for verification in tests
		this.requestHistory.push({ method: "getCommand", language, commandName, options });

		// Simulate network delay for realism
		await new Promise(resolve => setTimeout(resolve, 1));

		// First verify the command exists in the manifest
		const manifest = await this.getManifest(language, options);
		const commandExists = manifest.commands.some(cmd => cmd.name === commandName);

		if (!commandExists) {
			throw new CommandNotFoundError(commandName, language);
		}

		// Retrieve pre-configured command content or error
		const commandKey = `${language}:${commandName}`;
		const content = this.commands.get(commandKey);

		if (!content) {
			// Default behavior for unmapped commands
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
	getRequestHistory(): Array<{ method: string; language: string; commandName?: string; options?: RepositoryOptions }> {
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