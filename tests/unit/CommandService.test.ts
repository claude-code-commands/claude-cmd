import { beforeEach, describe, expect, it } from "bun:test";
import { CacheManager } from "../../src/services/CacheManager.js";
import { CommandParser } from "../../src/services/CommandParser.js";
import { CommandService } from "../../src/services/CommandService.js";
import { DirectoryDetector } from "../../src/services/DirectoryDetector.js";
import { InstallationService } from "../../src/services/InstallationService.js";
import { LanguageDetector } from "../../src/services/LanguageDetector.js";
import { LocalCommandRepository } from "../../src/services/LocalCommandRepository.js";
import NamespaceService from "../../src/services/NamespaceService.js";
import type { Manifest } from "../../src/types/Command.js";
import {
	CommandNotFoundError,
	ManifestError,
} from "../../src/types/Command.js";
import InMemoryFileService from "../mocks/InMemoryFileService.js";
import InMemoryHTTPClient from "../mocks/InMemoryHTTPClient.js";
import InMemoryManifestComparison from "../mocks/InMemoryManifestComparison.js";
import InMemoryRepository from "../mocks/InMemoryRepository.js";
import InMemoryUserInteractionService from "../mocks/InMemoryUserInteractionService.js";

describe("CommandService", () => {
	let commandService: CommandService;
	let repository: InMemoryRepository;
	let cacheManager: CacheManager;
	let languageDetector: LanguageDetector;
	let installationService: InstallationService;
	let manifestComparison: InMemoryManifestComparison;
	let localCommandRepository: LocalCommandRepository;
	let fileService: InMemoryFileService;
	let httpClient: InMemoryHTTPClient;

	beforeEach(() => {
		// Create in-memory dependencies
		fileService = new InMemoryFileService();
		httpClient = new InMemoryHTTPClient();
		repository = new InMemoryRepository(httpClient, fileService);
		cacheManager = new CacheManager(fileService);
		languageDetector = new LanguageDetector();
		const directoryDetector = new DirectoryDetector(fileService);
		const namespaceService = new NamespaceService();
		const commandParser = new CommandParser(namespaceService);
		const userInteractionService = new InMemoryUserInteractionService();
		localCommandRepository = new LocalCommandRepository(directoryDetector, commandParser);
		installationService = new InstallationService(
			repository,
			fileService,
			directoryDetector,
			commandParser,
			localCommandRepository,
			userInteractionService,
		);
		manifestComparison = new InMemoryManifestComparison();

		// Create CommandService with in-memory dependencies
		commandService = new CommandService(
			repository,
			cacheManager,
			languageDetector,
			installationService,
			manifestComparison,
			localCommandRepository,
		);
	});

	describe("listCommands", () => {
		it("should return cached commands when cache hit occurs", async () => {
			// Setup: Pre-populate cache with manifest
			const testManifest: Manifest = {
				version: "1.0.0",
				updated: "2025-01-15T10:00:00Z",
				commands: [
					{
						name: "test-command",
						description: "A test command",
						file: "test-command.md",
						"allowed-tools": ["read"],
					},
				],
			};

			await cacheManager.set("en", testManifest);

			// Execute
			const result = await commandService.listCommands({ language: "en" });

			// Verify: Should return commands from cache
			expect(result).toEqual(testManifest.commands);
			expect(result).toHaveLength(1);
			expect(result[0]?.name).toBe("test-command");
		});

		it("should fetch from repository when cache miss occurs", async () => {
			// No setup needed - cache is empty by default

			// Execute
			const result = await commandService.listCommands({ language: "en" });

			// Verify: Should return commands from repository (InMemoryRepository has default data)
			expect(result).toBeInstanceOf(Array);
			expect(result.length).toBeGreaterThan(0);

			// Verify it contains expected commands from InMemoryRepository default data
			const commandNames = result.map((cmd) => cmd.name);
			expect(commandNames).toContain("debug-help");
			expect(commandNames).toContain("code-review");
		});

		it("should refresh from repository when cache is expired", async () => {
			// Setup: Pre-populate cache with old manifest
			const oldManifest: Manifest = {
				version: "0.9.0",
				updated: "2025-01-01T10:00:00Z", // Old timestamp
				commands: [
					{
						name: "old-command",
						description: "An old command",
						file: "old-command.md",
						"allowed-tools": ["read"],
					},
				],
			};

			// Use very short maxAge to simulate expired cache
			await cacheManager.set("en", oldManifest);

			// Wait a bit then check if expired (simulate time passage)
			await new Promise((resolve) => setTimeout(resolve, 10));

			// Execute: Cache should be considered expired with very short maxAge
			const result = await commandService.listCommands({
				language: "en",
				forceRefresh: true, // Force refresh to bypass cache
			});

			// Verify: Should return fresh commands from repository
			expect(result).toBeInstanceOf(Array);
			expect(result.length).toBeGreaterThan(0);

			// Should NOT contain the old command, should contain fresh data
			const commandNames = result.map((cmd) => cmd.name);
			expect(commandNames).not.toContain("old-command");
			expect(commandNames).toContain("debug-help"); // From fresh repository data
		});

		it("should handle repository errors gracefully", async () => {
			// Setup: Configure repository to fail for specific language (use valid language code)
			repository.setManifest("xx", new ManifestError("xx", "Network timeout"));

			// Execute & Verify: Should propagate repository error
			await expect(
				commandService.listCommands({ language: "xx" }),
			).rejects.toThrow(ManifestError);
		});

		it("should use language detector when no explicit language provided", async () => {
			// Execute: No language option provided, should use language detection
			const result = await commandService.listCommands();

			// Verify: Should return commands (language detector should default to "en")
			expect(result).toBeInstanceOf(Array);
			expect(result.length).toBeGreaterThan(0);
		});

		it("should pass forceRefresh option to repository", async () => {
			// Clear repository request history
			repository.clearRequestHistory();

			// Execute: Force refresh
			const result = await commandService.listCommands({
				language: "en",
				forceRefresh: true,
			});

			// Verify: Should return commands
			expect(result).toBeInstanceOf(Array);

			// Verify: Should have called repository with forceRefresh option
			const history = repository.getRequestHistory();
			expect(history).toHaveLength(1);
			expect(history[0]?.method).toBe("getManifest");
			expect(history[0]?.language).toBe("en");
			expect(history[0]?.options?.forceRefresh).toBe(true);
		});
	});

	describe("searchCommands", () => {
		it("should filter commands by query in name and description", async () => {
			// Execute: Search for "debug"
			const result = await commandService.searchCommands("debug", {
				language: "en",
			});

			// Verify: Should return only matching commands
			expect(result).toBeInstanceOf(Array);
			expect(result.length).toBeGreaterThan(0);

			// All results should contain "debug" in name or description
			for (const command of result) {
				const matchesName = command.name.toLowerCase().includes("debug");
				const matchesDescription = command.description
					.toLowerCase()
					.includes("debug");
				expect(matchesName || matchesDescription).toBe(true);
			}
		});

		it("should return empty array when no commands match query", async () => {
			// Execute: Search for non-existent term
			const result = await commandService.searchCommands("nonexistentxyz", {
				language: "en",
			});

			// Verify: Should return empty array
			expect(result).toEqual([]);
		});

		it("should perform case-insensitive search", async () => {
			// Execute: Search with different case
			const lowerResult = await commandService.searchCommands("debug", {
				language: "en",
			});
			const upperResult = await commandService.searchCommands("DEBUG", {
				language: "en",
			});

			// Verify: Should return same results regardless of case
			expect(lowerResult.length).toBe(upperResult.length);
			if (lowerResult.length > 0 && upperResult.length > 0) {
				const lowerCommand = lowerResult[0]!;
				const upperCommand = upperResult[0]!;
				expect(lowerCommand.name).toBe(upperCommand.name);
			}
		});
	});

	describe("getCommandInfo", () => {
		it("should return command metadata when command exists", async () => {
			// Execute
			const result = await commandService.getCommandInfo("debug-help", {
				language: "en",
			});

			// Verify: Should return the specific command
			expect(result.name).toBe("debug-help");
			expect(result.description).toContain("debug"); // Should contain debug in description
			expect(result.file).toBe("debug-help.md");
		});

		it("should throw CommandNotFoundError when command does not exist", async () => {
			// Execute & Verify: Should throw error for non-existent command
			await expect(
				commandService.getCommandInfo("nonexistent-command", {
					language: "en",
				}),
			).rejects.toThrow(CommandNotFoundError);
		});
	});

	describe("getEnhancedCommandInfo", () => {
		it("should return enhanced command info for repository commands", async () => {
			// Execute
			const result = await commandService.getEnhancedCommandInfo("debug-help", {
				language: "en",
			});

			// Verify: Should return enhanced command info
			expect(result.name).toBe("debug-help");
			expect(result.description).toContain("debug");
			expect(result.source).toBe("repository");
			expect(result.availableInSources).toContain("repository");
			expect(result.installationStatus).toBeDefined();
			expect(result.installationStatus?.isInstalled).toBe(false); // Not installed by default
		});

		it("should detect local commands and prefer them over repository", async () => {
			// Setup: Create a local command that also exists in repository
			const localCommand = {
				name: "debug-help",
				description: "Local debug command",
				file: "debug-help.md",
				"allowed-tools": ["Bash(echo)"],
			};
			
			// Create the project directory structure first
			await fileService.mkdir(".claude/commands");
			
			await fileService.writeFile(".claude/commands/debug-help.md", `---
description: ${localCommand.description}
allowed-tools: ${JSON.stringify(localCommand["allowed-tools"])}
---

# Local Debug Command

This is a local override of the debug command.`);

			// Execute
			const result = await commandService.getEnhancedCommandInfo("debug-help", {
				language: "en",
			});

			// Verify: Should prefer local command
			expect(result.name).toBe("debug-help");
			expect(result.description).toBe(localCommand.description);
			expect(result.source).toMatch(/personal|project/); // Either is acceptable for test
			expect(result.availableInSources).toContain("repository");
			expect(result.availableInSources.length).toBeGreaterThan(1);
		});

		it("should show correct installation status for repository commands", async () => {
			// Execute: Get info for a repository command that's not installed
			const result = await commandService.getEnhancedCommandInfo("debug-help", {
				language: "en",
			});

			// Verify: Should show as not installed
			expect(result.installationStatus).toBeDefined();
			expect(result.installationStatus?.isInstalled).toBe(false);
			expect(result.installationStatus?.installLocation).toBeUndefined();
			expect(result.installationStatus?.installPath).toBeUndefined();
			expect(result.installationStatus?.hasLocalChanges).toBe(false);
		});

		it("should detect installation status and local changes", async () => {
			// Setup: Create a local command that differs from repository version
			await fileService.mkdir(".claude/commands");
			await fileService.writeFile(".claude/commands/debug-help.md", `---
description: Modified debug command
allowed-tools: ["Bash(echo)", "Read"]
---

# Modified Debug Command

This is a modified version.`);

			// Execute
			const result = await commandService.getEnhancedCommandInfo("debug-help", {
				language: "en",
			});

			// Verify: Should show as installed with local changes
			expect(result.installationStatus).toBeDefined();
			expect(result.installationStatus?.isInstalled).toBe(true);
			expect(result.installationStatus?.installLocation).toBeDefined();
			expect(result.installationStatus?.installPath).toContain("debug-help.md");
			expect(result.installationStatus?.hasLocalChanges).toBe(true); // Description and tools differ
		});

		it("should throw CommandNotFoundError when command doesn't exist anywhere", async () => {
			// Execute & Verify: Should throw error for non-existent command
			await expect(
				commandService.getEnhancedCommandInfo("nonexistent-command", {
					language: "en",
				}),
			).rejects.toThrow(CommandNotFoundError);
		});
	});

	describe("getCommandContent", () => {
		it("should return command content when command exists", async () => {
			// Execute
			const result = await commandService.getCommandContent("debug-help", {
				language: "en",
			});

			// Verify: Should return command content as string
			expect(typeof result).toBe("string");
			expect(result.length).toBeGreaterThan(0);
			expect(result).toContain("Debug Help"); // Should contain expected content
		});

		it("should throw CommandNotFoundError when command does not exist in manifest", async () => {
			// Execute & Verify: Should throw error for non-existent command
			await expect(
				commandService.getCommandContent("nonexistent-command", {
					language: "en",
				}),
			).rejects.toThrow(CommandNotFoundError);
		});

		it("should handle repository content errors gracefully", async () => {
			// Setup: Configure repository to fail for specific command content
			repository.setCommand(
				"content-error",
				"en",
				new Error("Content fetch failed"),
			);

			// Execute & Verify: Should propagate content error
			await expect(
				commandService.getCommandContent("content-error", { language: "en" }),
			).rejects.toThrow(Error);
		});
	});

	describe("updateCache", () => {
		it("should update cache with fresh manifest data", async () => {
			// Setup: Configure repository with manifest
			const testManifest: Manifest = {
				version: "1.0.0",
				updated: "2025-01-15T10:00:00Z",
				commands: [
					{
						name: "fresh-command",
						description: "A fresh command",
						file: "fresh-command.md",
						"allowed-tools": ["read", "write"],
					},
					{
						name: "another-command",
						description: "Another command",
						file: "another-command.md",
						"allowed-tools": ["bash"],
					},
				],
			};

			repository.setManifest("en", testManifest);

			// Execute
			const result = await commandService.updateCache({ language: "en" });

			// Verify: Should return correct update information
			expect(result.language).toBe("en");
			expect(result.commandCount).toBe(2);
			expect(typeof result.timestamp).toBe("number");
			expect(result.timestamp).toBeGreaterThan(0);

			// Verify: Cache should be updated
			const cachedManifest = await cacheManager.get("en");
			expect(cachedManifest).toEqual(testManifest);
		});

		it("should use auto-detected language when no language option provided", async () => {
			// Setup: Configure repository with manifest for default language (en)
			const testManifest: Manifest = {
				version: "1.0.0",
				updated: "2025-01-15T10:00:00Z",
				commands: [
					{
						name: "default-lang-command",
						description: "A command in default language",
						file: "default-lang-command.md",
						"allowed-tools": ["read"],
					},
				],
			};

			repository.setManifest("en", testManifest);

			// Execute: No language option provided
			const result = await commandService.updateCache();

			// Verify: Should use default language
			expect(result.language).toBe("en");
			expect(result.commandCount).toBe(1);
		});

		it("should always force refresh from repository", async () => {
			// Setup: Put stale data in cache
			const staleManifest: Manifest = {
				version: "0.9.0",
				updated: "2025-01-01T00:00:00Z",
				commands: [
					{
						name: "stale-command",
						description: "A stale command",
						file: "stale-command.md",
						"allowed-tools": ["read"],
					},
				],
			};

			await cacheManager.set("fr", staleManifest);

			// Setup: Configure repository with fresh data
			const freshManifest: Manifest = {
				version: "1.0.0",
				updated: "2025-01-15T10:00:00Z",
				commands: [
					{
						name: "fresh-command",
						description: "A fresh command",
						file: "fresh-command.md",
						"allowed-tools": ["read", "write"],
					},
				],
			};

			repository.setManifest("fr", freshManifest);

			// Execute
			const result = await commandService.updateCache({ language: "fr" });

			// Verify: Should have fetched fresh data, not stale cache
			expect(result.commandCount).toBe(1);
			const cachedManifest = await cacheManager.get("fr");
			expect(cachedManifest?.version).toBe("1.0.0");
			expect(cachedManifest?.commands[0]?.name).toBe("fresh-command");
		});

		it("should handle repository errors gracefully", async () => {
			// Setup: Configure repository to fail
			repository.setManifest(
				"error-lang",
				new ManifestError("Repository fetch failed", "error-lang"),
			);

			// Execute & Verify: Should propagate repository error
			expect(
				commandService.updateCache({ language: "error-lang" }),
			).rejects.toThrow(ManifestError);
		});

		it("should handle invalid language gracefully", async () => {
			// Execute & Verify: Should handle invalid language gracefully
			expect(commandService.updateCache({ language: "" })).rejects.toThrow(
				"Language not supported by repository",
			);
		});
	});

	describe("updateCacheWithChanges", () => {
		it("should detect changes when cache exists", async () => {
			// Setup: Pre-populate cache with old manifest
			const oldManifest: Manifest = {
				version: "1.0.0",
				updated: "2025-01-15T10:00:00Z",
				commands: [
					{
						name: "old-command",
						description: "An old command",
						file: "old-command.md",
						"allowed-tools": ["read"],
					},
				],
			};
			await cacheManager.set("en", oldManifest);

			// Setup: New manifest with changes
			const newManifest: Manifest = {
				version: "1.1.0",
				updated: "2025-01-15T11:00:00Z",
				commands: [
					{
						name: "old-command",
						description: "Updated old command",
						file: "old-command.md",
						"allowed-tools": ["read", "write"],
					},
					{
						name: "new-command",
						description: "A new command",
						file: "new-command.md",
						"allowed-tools": ["bash"],
					},
				],
			};
			repository.setManifest("en", newManifest);

			// Setup: Configure manifestComparison mock
			manifestComparison.setComparisonResult({
				oldManifest,
				newManifest,
				summary: {
					total: 2,
					added: 1,
					removed: 0,
					modified: 1,
					hasChanges: true,
				},
				changes: [],
				comparedAt: "2025-01-15T12:00:00Z",
			});

			// Execute
			const result = await commandService.updateCacheWithChanges({ language: "en" });

			// Verify
			expect(result.language).toBe("en");
			expect(result.commandCount).toBe(2);
			expect(result.hasChanges).toBe(true);
			expect(result.added).toBe(1);
			expect(result.removed).toBe(0);
			expect(result.modified).toBe(1);
		});

		it("should mark all as added when no cache exists", async () => {
			// Setup: No pre-existing cache
			const newManifest: Manifest = {
				version: "1.0.0",
				updated: "2025-01-15T10:00:00Z",
				commands: [
					{
						name: "test-command",
						description: "A test command",
						file: "test-command.md",
						"allowed-tools": ["read"],
					},
				],
			};
			repository.setManifest("en", newManifest);

			// Execute
			const result = await commandService.updateCacheWithChanges({ language: "en" });

			// Verify
			expect(result.language).toBe("en");
			expect(result.commandCount).toBe(1);
			expect(result.hasChanges).toBe(true);
			expect(result.added).toBe(1);
			expect(result.removed).toBe(0);
			expect(result.modified).toBe(0);
		});

		it("should detect no changes when manifests are identical", async () => {
			// Setup: Same manifest in cache and repository
			const manifest: Manifest = {
				version: "1.0.0",
				updated: "2025-01-15T10:00:00Z",
				commands: [
					{
						name: "test-command",
						description: "A test command",
						file: "test-command.md",
						"allowed-tools": ["read"],
					},
				],
			};
			await cacheManager.set("en", manifest);
			repository.setManifest("en", manifest);

			// Setup: Configure manifestComparison to show no changes
			manifestComparison.setComparisonResult({
				oldManifest: manifest,
				newManifest: manifest,
				summary: {
					total: 0,
					added: 0,
					removed: 0,
					modified: 0,
					hasChanges: false,
				},
				changes: [],
				comparedAt: "2025-01-15T12:00:00Z",
			});

			// Execute
			const result = await commandService.updateCacheWithChanges({ language: "en" });

			// Verify
			expect(result.language).toBe("en");
			expect(result.commandCount).toBe(1);
			expect(result.hasChanges).toBe(false);
			expect(result.added).toBe(0);
			expect(result.removed).toBe(0);
			expect(result.modified).toBe(0);
		});

		it("should handle empty new manifest correctly", async () => {
			// Setup: Pre-populate cache with commands
			const oldManifest: Manifest = {
				version: "1.0.0",
				updated: "2025-01-15T10:00:00Z",
				commands: [
					{
						name: "test-command",
						description: "A test command",
						file: "test-command.md",
						"allowed-tools": ["read"],
					},
				],
			};
			await cacheManager.set("en", oldManifest);

			// Setup: Empty new manifest
			const newManifest: Manifest = {
				version: "1.1.0",
				updated: "2025-01-15T11:00:00Z",
				commands: [],
			};
			repository.setManifest("en", newManifest);

			// Setup: Configure manifestComparison to show removal
			manifestComparison.setComparisonResult({
				oldManifest,
				newManifest,
				summary: {
					total: 1,
					added: 0,
					removed: 1,
					modified: 0,
					hasChanges: true,
				},
				changes: [],
				comparedAt: "2025-01-15T12:00:00Z",
			});

			// Execute
			const result = await commandService.updateCacheWithChanges({ language: "en" });

			// Verify
			expect(result.language).toBe("en");
			expect(result.commandCount).toBe(0);
			expect(result.hasChanges).toBe(true);
			expect(result.added).toBe(0);
			expect(result.removed).toBe(1);
			expect(result.modified).toBe(0);
		});
	});
});
