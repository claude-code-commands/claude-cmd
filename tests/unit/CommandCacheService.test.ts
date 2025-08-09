import { beforeEach, describe, expect, it } from "bun:test";
import { CacheManager } from "../../src/services/CacheManager.js";
import { CommandCacheService } from "../../src/services/CommandCacheService.js";
import { LanguageDetector } from "../../src/services/LanguageDetector.js";
import type { Manifest } from "../../src/types/Command.js";
import { ManifestError } from "../../src/types/Command.js";
import InMemoryFileService from "../mocks/InMemoryFileService.js";
import InMemoryHTTPClient from "../mocks/InMemoryHTTPClient.js";
import InMemoryManifestComparison from "../mocks/InMemoryManifestComparison.js";
import InMemoryRepository from "../mocks/InMemoryRepository.js";

describe("CommandCacheService", () => {
	let commandCacheService: CommandCacheService;
	let repository: InMemoryRepository;
	let cacheManager: CacheManager;
	let languageDetector: LanguageDetector;
	let manifestComparison: InMemoryManifestComparison;
	let fileService: InMemoryFileService;
	let httpClient: InMemoryHTTPClient;

	beforeEach(() => {
		// Create in-memory dependencies
		fileService = new InMemoryFileService();
		httpClient = new InMemoryHTTPClient();
		repository = new InMemoryRepository(httpClient, fileService);
		cacheManager = new CacheManager(fileService);
		languageDetector = new LanguageDetector();
		manifestComparison = new InMemoryManifestComparison();

		// Create CommandCacheService with in-memory dependencies
		commandCacheService = new CommandCacheService(
			repository,
			cacheManager,
			languageDetector,
			manifestComparison,
		);
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
			const result = await commandCacheService.updateCache({ language: "en" });

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
			const result = await commandCacheService.updateCache();

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
			const result = await commandCacheService.updateCache({ language: "fr" });

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
				commandCacheService.updateCache({ language: "error-lang" }),
			).rejects.toThrow(ManifestError);
		});

		it("should handle invalid language gracefully", async () => {
			// Execute & Verify: Should handle invalid language gracefully
			expect(commandCacheService.updateCache({ language: "" })).rejects.toThrow(
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
			const result = await commandCacheService.updateCacheWithChanges({
				language: "en",
			});

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
			const result = await commandCacheService.updateCacheWithChanges({
				language: "en",
			});

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
			const result = await commandCacheService.updateCacheWithChanges({
				language: "en",
			});

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
			const result = await commandCacheService.updateCacheWithChanges({
				language: "en",
			});

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
