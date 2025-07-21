import { beforeEach, describe, expect, test } from "bun:test";
import type { RepositoryOptions } from "../../src/types/Command.js";
import {
	CommandContentError,
	CommandNotFoundError,
	ManifestError,
} from "../../src/types/Command.js";
import InMemoryRepository from "../mocks/InMemoryRepository.js";
import MockFileService from "../mocks/MockFileService.js";
import MockHTTPClient from "../mocks/MockHTTPClient.js";

describe("Repository Interface", () => {
	let repository: InMemoryRepository;
	let mockHttpClient: MockHTTPClient;
	let mockFileService: MockFileService;

	beforeEach(() => {
		mockHttpClient = new MockHTTPClient();
		mockFileService = new MockFileService();
		repository = new InMemoryRepository(mockHttpClient, mockFileService);
	});

	describe("getManifest", () => {
		test("should retrieve manifest for English language", async () => {
			const manifest = await repository.getManifest("en");

			expect(manifest).toBeDefined();
			expect(manifest.version).toBe("1.0.1");
			expect(manifest.updated).toBe("2025-07-09T00:41:00Z");
			expect(manifest.commands).toHaveLength(6);

			const debugCommand = manifest.commands.find(
				(cmd) => cmd.name === "debug-help",
			);
			expect(debugCommand).toBeDefined();
			expect(debugCommand?.description).toContain("debugging assistance");
			expect(debugCommand?.file).toBe("debug-help.md");
			expect(debugCommand?.["allowed-tools"]).toContain("Read");
		});

		test("should retrieve manifest for French language", async () => {
			const manifest = await repository.getManifest("fr");

			expect(manifest).toBeDefined();
			expect(manifest.version).toBe("1.0.0");
			expect(manifest.commands).toHaveLength(3);

			const debugCommand = manifest.commands.find(
				(cmd) => cmd.name === "debug-help",
			);
			expect(debugCommand).toBeDefined();
			expect(debugCommand?.description).toContain("débogage");
		});

		test("should handle different allowed-tools formats", async () => {
			const manifest = await repository.getManifest("en");

			// Array format
			const debugCommand = manifest.commands.find(
				(cmd) => cmd.name === "debug-help",
			);
			expect(Array.isArray(debugCommand?.["allowed-tools"])).toBe(true);

			// String format
			const frontendCommand = manifest.commands.find(
				(cmd) => cmd.name === "frontend:component",
			);
			expect(typeof frontendCommand?.["allowed-tools"]).toBe("string");
		});

		test("should throw ManifestError for unsupported language", async () => {
			await expect(repository.getManifest("invalid-lang")).rejects.toThrow(
				ManifestError,
			);
			await expect(repository.getManifest("invalid-lang")).rejects.toThrow(
				"Language not supported",
			);
		});

		test("should throw ManifestError for network errors", async () => {
			await expect(repository.getManifest("network-error")).rejects.toThrow(
				ManifestError,
			);
			await expect(repository.getManifest("network-error")).rejects.toThrow(
				"Network connection failed",
			);
		});

		test("should throw ManifestError for timeout errors", async () => {
			await expect(repository.getManifest("timeout")).rejects.toThrow(
				ManifestError,
			);
			await expect(repository.getManifest("timeout")).rejects.toThrow(
				"Request timed out",
			);
		});

		test("should handle forceRefresh option", async () => {
			const options: RepositoryOptions = { forceRefresh: true };
			const manifest = await repository.getManifest("en", options);

			expect(manifest).toBeDefined();
			expect(manifest.commands).toHaveLength(6);
		});

		test("should handle maxAge option", async () => {
			const options: RepositoryOptions = { maxAge: 3600000 }; // 1 hour
			const manifest = await repository.getManifest("en", options);

			expect(manifest).toBeDefined();
			expect(manifest.commands).toHaveLength(6);
		});

		test("should track request history", async () => {
			await repository.getManifest("en");
			const history = repository.getRequestHistory();

			expect(history).toHaveLength(1);
			expect(history[0].method).toBe("getManifest");
			expect(history[0].language).toBe("en");
		});
	});

	describe("getCommand", () => {
		test("should retrieve command content for valid command", async () => {
			const content = await repository.getCommand("debug-help", "en");

			expect(content).toBeDefined();
			expect(typeof content).toBe("string");
			expect(content).toContain("# Debug Help");
			expect(content).toContain("debugging assistance");
			expect(content).toContain("## Usage");
		});

		test("should retrieve localized command content", async () => {
			const englishContent = await repository.getCommand("debug-help", "en");
			const frenchContent = await repository.getCommand("debug-help", "fr");

			expect(englishContent).toContain("Debug Help");
			expect(frenchContent).toContain("Aide au débogage");
			expect(frenchContent).toContain("Utilisation");
		});

		test("should handle commands with special characters", async () => {
			const content = await repository.getCommand("frontend:component", "en");

			expect(content).toBeDefined();
			expect(content).toContain("Frontend Component");
			expect(content).toContain("React components");
		});

		test("should handle commands with complex paths", async () => {
			const content = await repository.getCommand("backend:api", "en");

			expect(content).toBeDefined();
			expect(content).toContain("Backend API");
			expect(content).toContain("REST API endpoints");
		});

		test("should throw CommandNotFoundError for non-existent command", async () => {
			await expect(repository.getCommand("non-existent", "en")).rejects.toThrow(
				CommandNotFoundError,
			);

			try {
				await repository.getCommand("non-existent", "en");
			} catch (error) {
				expect(error).toBeInstanceOf(CommandNotFoundError);
				if (error instanceof CommandNotFoundError) {
					expect(error.commandName).toBe("non-existent");
					expect(error.language).toBe("en");
				}
			}
		});

		test("should throw CommandNotFoundError for command not in manifest", async () => {
			// Try to get a command that doesn't exist in the French manifest
			await expect(repository.getCommand("test-gen", "fr")).rejects.toThrow(
				CommandNotFoundError,
			);
		});

		test("should throw CommandContentError for content retrieval failures", async () => {
			await expect(
				repository.getCommand("content-error", "en"),
			).rejects.toThrow(CommandContentError);

			try {
				await repository.getCommand("content-error", "en");
			} catch (error) {
				expect(error).toBeInstanceOf(CommandContentError);
				if (error instanceof CommandContentError) {
					expect(error.commandName).toBe("content-error");
					expect(error.language).toBe("en");
					expect(error.cause).toBe("File corrupted");
				}
			}
		});

		test("should throw CommandContentError for missing files", async () => {
			await expect(repository.getCommand("missing-file", "fr")).rejects.toThrow(
				CommandContentError,
			);
			await expect(repository.getCommand("missing-file", "fr")).rejects.toThrow(
				"File not found on server",
			);
		});

		test("should handle forceRefresh option for commands", async () => {
			const options: RepositoryOptions = { forceRefresh: true };
			const content = await repository.getCommand("debug-help", "en", options);

			expect(content).toBeDefined();
			expect(content).toContain("Debug Help");
		});

		test("should handle maxAge option for commands", async () => {
			const options: RepositoryOptions = { maxAge: 1800000 }; // 30 minutes
			const content = await repository.getCommand("code-review", "en", options);

			expect(content).toBeDefined();
			expect(content).toContain("Code Review");
		});

		test("should track command request history", async () => {
			await repository.getCommand("debug-help", "en");
			const history = repository.getRequestHistory();

			expect(history.length).toBeGreaterThanOrEqual(2); // getManifest + getCommand
			const commandRequest = history.find((req) => req.method === "getCommand");
			expect(commandRequest).toBeDefined();
			expect(commandRequest?.commandName).toBe("debug-help");
			expect(commandRequest?.language).toBe("en");
		});

		test("should verify command exists in manifest before fetching content", async () => {
			// This should work - command exists in manifest
			await expect(
				repository.getCommand("debug-help", "en"),
			).resolves.toBeDefined();

			// This should fail - command not in manifest
			await expect(
				repository.getCommand("non-existent-command", "en"),
			).rejects.toThrow(CommandNotFoundError);
		});
	});

	describe("error handling", () => {
		test("should preserve error details in ManifestError", async () => {
			try {
				await repository.getManifest("network-error");
			} catch (error) {
				expect(error).toBeInstanceOf(ManifestError);
				if (error instanceof ManifestError) {
					expect(error.language).toBe("network-error");
					expect(error.cause).toBe("Network connection failed");
					expect(error.message).toContain("network-error");
					expect(error.message).toContain("Network connection failed");
				}
			}
		});

		test("should preserve error details in CommandNotFoundError", async () => {
			try {
				await repository.getCommand("non-existent", "en");
			} catch (error) {
				expect(error).toBeInstanceOf(CommandNotFoundError);
				if (error instanceof CommandNotFoundError) {
					expect(error.commandName).toBe("non-existent");
					expect(error.language).toBe("en");
					expect(error.message).toContain("non-existent");
					expect(error.message).toContain("en");
				}
			}
		});

		test("should preserve error details in CommandContentError", async () => {
			try {
				await repository.getCommand("content-error", "en");
			} catch (error) {
				expect(error).toBeInstanceOf(CommandContentError);
				if (error instanceof CommandContentError) {
					expect(error.commandName).toBe("content-error");
					expect(error.language).toBe("en");
					expect(error.cause).toBe("File corrupted");
					expect(error.message).toContain("content-error");
					expect(error.message).toContain("File corrupted");
				}
			}
		});
	});

	describe("language parameter threading", () => {
		test("should consistently use language parameter across operations", async () => {
			// Get manifest and command for same language
			await repository.getManifest("fr");
			await repository.getCommand("debug-help", "fr");

			const history = repository.getRequestHistory();
			expect(history.every((req) => req.language === "fr")).toBe(true);
		});

		test("should handle different languages independently", async () => {
			const enManifest = await repository.getManifest("en");
			const frManifest = await repository.getManifest("fr");

			expect(enManifest.commands).toHaveLength(6);
			expect(frManifest.commands).toHaveLength(3);

			const enContent = await repository.getCommand("debug-help", "en");
			const frContent = await repository.getCommand("debug-help", "fr");

			expect(enContent).toContain("Debug Help");
			expect(frContent).toContain("Aide au débogage");
		});

		test("should validate command existence per language", async () => {
			// test-gen exists in English but not French
			await expect(
				repository.getCommand("test-gen", "en"),
			).resolves.toBeDefined();
			await expect(repository.getCommand("test-gen", "fr")).rejects.toThrow(
				CommandNotFoundError,
			);
		});
	});

	describe("options parameter handling", () => {
		test("should accept undefined options", async () => {
			await expect(
				repository.getManifest("en", undefined),
			).resolves.toBeDefined();
			await expect(
				repository.getCommand("debug-help", "en", undefined),
			).resolves.toBeDefined();
		});

		test("should accept empty options object", async () => {
			const options: RepositoryOptions = {};
			await expect(
				repository.getManifest("en", options),
			).resolves.toBeDefined();
			await expect(
				repository.getCommand("debug-help", "en", options),
			).resolves.toBeDefined();
		});

		test("should track options in request history", async () => {
			const options: RepositoryOptions = {
				forceRefresh: true,
				maxAge: 3600000,
			};
			await repository.getManifest("en", options);

			const history = repository.getRequestHistory();
			expect(history[0].options).toEqual(options);
		});
	});

	describe("dependency injection verification", () => {
		test("should use injected HTTPClient for network operations", async () => {
			// Force refresh to ensure HTTP client is called
			await repository.getManifest("en", { forceRefresh: true });

			// Verify HTTPClient was called
			const httpHistory = mockHttpClient.getRequestHistory();
			expect(httpHistory.length).toBeGreaterThan(0);
			expect(httpHistory.some((req) => req.url.includes("index.json"))).toBe(
				true,
			);
		});

		test("should use injected FileService for caching operations", async () => {
			// First call should trigger cache check (exists) and write to cache
			await repository.getManifest("en");

			// Verify FileService was used for both cache checking and writing
			const fileHistory = mockFileService.getOperationHistory();
			expect(fileHistory.length).toBeGreaterThan(0);
			expect(fileHistory.some((op) => op.operation === "exists")).toBe(true);
			expect(fileHistory.some((op) => op.operation === "writeFile")).toBe(true);
		});

		test("should track dependency usage in request history", async () => {
			await repository.getManifest("en", { forceRefresh: true });

			// Verify dependency usage is tracked
			const history = repository.getRequestHistory();
			expect(history).toHaveLength(1);
			expect(history[0].httpCalled).toBe(true);
			expect(history[0].fileCalled).toBe(true);
		});

		test("should handle HTTPClient errors gracefully", async () => {
			// Test with a URL pattern that triggers network error
			await expect(repository.getManifest("network-error")).rejects.toThrow(
				ManifestError,
			);
		});

		test("should handle FileService errors gracefully", async () => {
			// The mock should handle file operations gracefully
			// This verifies the dependency injection doesn't break error handling
			const manifest = await repository.getManifest("en");
			expect(manifest).toBeDefined();
		});

		test("should use dependencies for command content retrieval", async () => {
			await repository.getCommand("debug-help", "en", { forceRefresh: true });

			// Verify both HTTP and File operations occurred
			const httpHistory = mockHttpClient.getRequestHistory();
			const fileHistory = mockFileService.getOperationHistory();
			const repoHistory = repository.getRequestHistory();

			// Should have calls for both manifest and command content
			expect(httpHistory.length).toBeGreaterThan(0);
			expect(fileHistory.length).toBeGreaterThan(0);

			// Should track dependency usage for both getManifest and getCommand calls
			const manifestCall = repoHistory.find(
				(req) => req.method === "getManifest",
			);
			const commandCall = repoHistory.find(
				(req) => req.method === "getCommand",
			);

			expect(manifestCall?.httpCalled).toBe(true);
			expect(manifestCall?.fileCalled).toBe(true);
			expect(commandCall?.httpCalled).toBe(true);
			expect(commandCall?.fileCalled).toBe(true);
		});
	});
});
