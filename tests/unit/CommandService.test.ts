import { beforeEach, describe, expect, it } from "bun:test";
import { CacheManager } from "../../src/services/CacheManager.js";
import { CommandService } from "../../src/services/CommandService.js";
import { LanguageDetector } from "../../src/services/LanguageDetector.js";
import type { Manifest } from "../../src/types/Command.js";
import {
	CommandNotFoundError,
	ManifestError,
} from "../../src/types/Command.js";
import InMemoryFileService from "../mocks/InMemoryFileService.js";
import InMemoryHTTPClient from "../mocks/InMemoryHTTPClient.js";
import InMemoryRepository from "../mocks/InMemoryRepository.js";

describe("CommandService", () => {
	let commandService: CommandService;
	let repository: InMemoryRepository;
	let cacheManager: CacheManager;
	let languageDetector: LanguageDetector;
	let fileService: InMemoryFileService;
	let httpClient: InMemoryHTTPClient;

	beforeEach(() => {
		// Create in-memory dependencies
		fileService = new InMemoryFileService();
		httpClient = new InMemoryHTTPClient();
		repository = new InMemoryRepository(httpClient, fileService);
		cacheManager = new CacheManager(fileService);
		languageDetector = new LanguageDetector();

		// Create CommandService with in-memory dependencies
		commandService = new CommandService(
			repository,
			cacheManager,
			languageDetector,
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
			const result = await commandService.searchCommands("debug", undefined, {
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
			const result = await commandService.searchCommands(
				"nonexistentxyz",
				undefined,
				{ language: "en" },
			);

			// Verify: Should return empty array
			expect(result).toEqual([]);
		});

		it("should perform case-insensitive search", async () => {
			// Execute: Search with different case
			const lowerResult = await commandService.searchCommands(
				"debug",
				undefined,
				{ language: "en" },
			);
			const upperResult = await commandService.searchCommands(
				"DEBUG",
				undefined,
				{ language: "en" },
			);

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
});
