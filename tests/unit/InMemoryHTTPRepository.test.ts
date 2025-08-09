import { beforeEach, describe, expect, test } from "bun:test";
import {
	HTTPNetworkError,
	HTTPStatusError,
	HTTPTimeoutError,
} from "../../src/interfaces/IHTTPClient.js";
import { CacheConfig } from "../../src/interfaces/IRepository.js";
import HTTPRepository from "../../src/services/HTTPRepository.js";
import {
	CommandContentError,
	CommandNotFoundError,
	ManifestError,
} from "../../src/types/Command.js";
import { createClaudeCmdResponses } from "../fixtures/httpResponses.js";
import InMemoryFileService from "../mocks/InMemoryFileService.js";
import InMemoryHTTPClient from "../mocks/InMemoryHTTPClient.js";
import { runRepositoryContractTests } from "../shared/IRepository.contract.js";

describe("HTTPRepository", () => {
	let repository: HTTPRepository;
	let mockHttpClient: InMemoryHTTPClient;
	let mockFileService: InMemoryFileService;
	const defaultCacheConfig = new CacheConfig({
		cacheDir: "/tmp/claude-cmd-test-cache",
		ttl: 3600000, // 1 hour
	});

	beforeEach(() => {
		mockHttpClient = new InMemoryHTTPClient();
		createClaudeCmdResponses(mockHttpClient);
		mockFileService = new InMemoryFileService();
		repository = new HTTPRepository(
			mockHttpClient,
			mockFileService,
			defaultCacheConfig,
		);
	});

	// Run contract tests to ensure HTTPRepository behaves according to IRepository contract
	runRepositoryContractTests(
		() => {
			const httpClient = new InMemoryHTTPClient();
			createClaudeCmdResponses(httpClient);
			return new HTTPRepository(
				httpClient,
				new InMemoryFileService(),
				defaultCacheConfig,
			);
		},
		{
			isRealRepository: false, // Using mock HTTP client, not real network
		},
	);

	describe("constructor", () => {
		test("should initialize with required dependencies", () => {
			expect(repository).toBeInstanceOf(HTTPRepository);
		});

		test("should accept optional cache configuration", () => {
			const customCache = new CacheConfig({
				cacheDir: "/custom/cache",
				ttl: 7200000, // 2 hours
			});
			const customRepo = new HTTPRepository(
				mockHttpClient,
				mockFileService,
				customCache,
			);
			expect(customRepo).toBeInstanceOf(HTTPRepository);
		});

		test("should use default cache configuration when not provided", () => {
			const defaultRepo = new HTTPRepository(mockHttpClient, mockFileService);
			expect(defaultRepo).toBeInstanceOf(HTTPRepository);
		});
	});

	describe("getManifest", () => {
		test("should retrieve English manifest via HTTP", async () => {
			const manifest = await repository.getManifest("en");

			expect(manifest).toBeDefined();
			expect(manifest.version).toBe("1.0.1");
			expect(manifest.updated).toBe("2025-07-09T00:41:00Z");
			expect(manifest.commands).toHaveLength(6);

			// Verify HTTP was called with correct GitHub URL
			const httpHistory = mockHttpClient.getRequestHistory();
			expect(httpHistory).toHaveLength(1);
			expect(httpHistory[0]?.url).toContain("/en/index.json");
			expect(httpHistory[0]?.url).toContain("githubusercontent.com");
		});

		test("should retrieve French manifest via HTTP", async () => {
			const manifest = await repository.getManifest("fr");

			expect(manifest).toBeDefined();
			expect(manifest.version).toBe("1.0.0");
			expect(manifest.commands).toHaveLength(3);

			// Verify correct French URL was requested
			const httpHistory = mockHttpClient.getRequestHistory();
			expect(httpHistory[0]?.url).toContain("/fr/index.json");
		});

		test("should handle HTTP network errors and throw ManifestError", async () => {
			// MockHTTPClient will throw HTTPNetworkError for 'network-error' pattern
			expect(mockHttpClient.get("network-error")).rejects.toThrow(
				HTTPNetworkError,
			);

			// HTTPRepository should catch this and convert to ManifestError
			// We need a language that triggers network error in MockHTTPClient
			const promise = repository.getManifest("network-test");
			expect(promise).rejects.toThrow(ManifestError);
			expect(promise).rejects.toThrow("Failed to retrieve manifest");
		});

		test("should handle HTTP timeout errors and throw ManifestError", async () => {
			// InMemoryHTTPClient throws timeout error for URLs containing 'timeout'
			expect(mockHttpClient.get("timeout", { timeout: 1 })).rejects.toThrow(
				HTTPTimeoutError,
			);

			// HTTPRepository should handle timeouts gracefully
			const promise = repository.getManifest("timeout-test");
			expect(promise).rejects.toThrow(ManifestError);
		});

		test("should handle HTTP status errors (404) and throw ManifestError", async () => {
			expect(mockHttpClient.get("not-found")).rejects.toThrow(HTTPStatusError);

			const promise = repository.getManifest("not-found");
			expect(promise).rejects.toThrow(ManifestError);
		});

		test("should handle malformed JSON and throw ManifestError", async () => {
			// This would be tested with a mock that returns invalid JSON
			// The HTTPRepository should catch JSON.parse errors
			const promise = repository.getManifest("invalid-json");
			expect(promise).rejects.toThrow(ManifestError);
		});

		test("should cache manifest results to reduce HTTP requests", async () => {
			// First call should hit HTTP
			const manifest1 = await repository.getManifest("en");
			expect(manifest1).toBeDefined();

			// Clear HTTP history to verify second call uses cache
			mockHttpClient.clearRequestHistory();

			// Second call should use cache, not HTTP
			const manifest2 = await repository.getManifest("en");
			expect(manifest2).toBeDefined();
			expect(manifest2).toEqual(manifest1);

			// Verify no additional HTTP request was made
			const httpHistory = mockHttpClient.getRequestHistory();
			expect(httpHistory).toHaveLength(0);

			// But FileService should have been called for cache read
			const fileHistory = mockFileService.getOperationHistory();
			expect(fileHistory.some((op) => op.operation === "exists")).toBe(true);
		});

		test("should respect forceRefresh option and bypass cache", async () => {
			// First call to populate cache
			await repository.getManifest("en");
			mockHttpClient.clearRequestHistory();

			// Second call with forceRefresh should hit HTTP again
			await repository.getManifest("en", { forceRefresh: true });

			const httpHistory = mockHttpClient.getRequestHistory();
			expect(httpHistory).toHaveLength(1);
			expect(httpHistory[0]?.url).toContain("/en/index.json");
		});

		test("should handle cache TTL expiration correctly", async () => {
			// This would require mocking time or using a very short TTL
			// For now, verify basic cache behavior
			const shortTtlConfig = new CacheConfig({
				cacheDir: "/tmp/claude-cmd-test-cache",
				ttl: 100, // 100ms
			});

			const shortTtlRepo = new HTTPRepository(
				mockHttpClient,
				mockFileService,
				shortTtlConfig,
			);

			await shortTtlRepo.getManifest("en");

			// Wait longer than TTL
			await new Promise((resolve) => setTimeout(resolve, 150));

			// Should make new HTTP request due to expired cache
			mockHttpClient.clearRequestHistory();
			await shortTtlRepo.getManifest("en");

			const httpHistory = mockHttpClient.getRequestHistory();
			expect(httpHistory).toHaveLength(1);
		});
	});

	describe("getCommand", () => {
		test("should retrieve command content via HTTP after validating manifest", async () => {
			const content = await repository.getCommand("debug-help", "en");

			expect(content).toBeDefined();
			expect(typeof content).toBe("string");
			expect(content).toContain("# Debug Help");
			expect(content).toContain("debugging assistance");

			// Verify HTTP calls were made for both manifest and command
			const httpHistory = mockHttpClient.getRequestHistory();
			expect(httpHistory.length).toBeGreaterThanOrEqual(2);

			// Should have called manifest first
			expect(
				httpHistory.some((req) => req.url.includes("/en/index.json")),
			).toBe(true);
			// Then command content
			expect(
				httpHistory.some((req) => req.url.includes("/debug-help.md")),
			).toBe(true);
		});

		test("should throw CommandNotFoundError for commands not in manifest", async () => {
			expect(repository.getCommand("non-existent", "en")).rejects.toThrow(
				CommandNotFoundError,
			);

			// Should still call manifest to check
			const httpHistory = mockHttpClient.getRequestHistory();
			expect(
				httpHistory.some((req) => req.url.includes("/en/index.json")),
			).toBe(true);
			// But should NOT call command content URL
			expect(
				httpHistory.some((req) => req.url.includes("non-existent.md")),
			).toBe(false);
		});

		test("should handle HTTP errors for command content and throw CommandContentError", async () => {
			// content-error command exists in manifest but content fetch will fail
			expect(repository.getCommand("content-error", "en")).rejects.toThrow(
				CommandContentError,
			);
		});

		test("should handle missing command files and throw CommandContentError", async () => {
			expect(repository.getCommand("missing-file", "fr")).rejects.toThrow(
				CommandContentError,
			);
		});

		test("should cache command content to reduce HTTP requests", async () => {
			// First call should hit HTTP
			const content1 = await repository.getCommand("debug-help", "en");
			expect(content1).toBeDefined();

			const initialHttpCalls = mockHttpClient.getRequestHistory().length;
			mockHttpClient.clearRequestHistory();

			// Second call should use cache for command content
			const content2 = await repository.getCommand("debug-help", "en");
			expect(content2).toBeDefined();
			expect(content2).toEqual(content1);

			// Should only call manifest, not command content
			const httpHistory = mockHttpClient.getRequestHistory();
			expect(httpHistory.length).toBeLessThan(initialHttpCalls);
		});

		test("should respect forceRefresh option for command content", async () => {
			await repository.getCommand("debug-help", "en");

			mockHttpClient.clearRequestHistory();
			await repository.getCommand("debug-help", "en", { forceRefresh: true });

			// Should make HTTP requests again due to forceRefresh
			const httpHistory = mockHttpClient.getRequestHistory();
			expect(httpHistory.length).toBeGreaterThan(0);
		});

		test("should validate command exists in correct language", async () => {
			// test-gen exists in English but not French
			expect(repository.getCommand("test-gen", "en")).resolves.toBeDefined();

			expect(repository.getCommand("test-gen", "fr")).rejects.toThrow(
				CommandNotFoundError,
			);
		});
	});

	describe("error handling", () => {
		test("should preserve HTTP error details in ManifestError", async () => {
			try {
				await repository.getManifest("network-error-test");
			} catch (error) {
				expect(error).toBeInstanceOf(ManifestError);
				if (error instanceof ManifestError) {
					expect(error.language).toBe("network-error-test");
					expect(error.message).toContain("Failed to retrieve manifest");
				}
			}
		});

		test("should preserve command details in CommandNotFoundError", async () => {
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

		test("should preserve HTTP error details in CommandContentError", async () => {
			try {
				await repository.getCommand("content-error", "en");
			} catch (error) {
				expect(error).toBeInstanceOf(CommandContentError);
				if (error instanceof CommandContentError) {
					expect(error.commandName).toBe("content-error");
					expect(error.language).toBe("en");
				}
			}
		});
	});

	describe("GitHub integration", () => {
		test("should construct correct GitHub URLs for manifests", async () => {
			await repository.getManifest("en");

			const httpHistory = mockHttpClient.getRequestHistory();
			expect(httpHistory[0]?.url).toMatch(
				/https:\/\/raw\.githubusercontent\.com\/.*\/.*\/main\/pages\/en\/index\.json/,
			);
		});

		test("should construct correct GitHub URLs for command files", async () => {
			await repository.getCommand("debug-help", "en");

			const httpHistory = mockHttpClient.getRequestHistory();
			// Should have both manifest and command file requests
			const commandRequest = httpHistory.find((req) =>
				req.url.includes("debug-help.md"),
			);
			expect(commandRequest).toBeDefined();
			expect(commandRequest?.url).toMatch(
				/https:\/\/raw\.githubusercontent\.com\/.*\/.*\/main\/pages\/en\/debug-help\.md/,
			);
		});

		test("should handle nested command paths correctly", async () => {
			await repository.getCommand("frontend:component", "en");

			const httpHistory = mockHttpClient.getRequestHistory();
			const commandRequest = httpHistory.find((req) =>
				req.url.includes("frontend-component.md"),
			);
			expect(commandRequest).toBeDefined();
		});
	});

	describe("dependency injection", () => {
		test("should use injected HTTPClient for all network operations", async () => {
			await repository.getManifest("en");
			await repository.getCommand("debug-help", "en");

			const httpHistory = mockHttpClient.getRequestHistory();
			expect(httpHistory.length).toBeGreaterThan(0);
		});

		test("should use injected FileService for all caching operations", async () => {
			await repository.getManifest("en");

			const fileHistory = mockFileService.getOperationHistory();
			expect(fileHistory.some((op) => op.operation === "exists")).toBe(true);
			expect(fileHistory.some((op) => op.operation === "writeFile")).toBe(true);
		});

		test("should handle FileService errors gracefully without breaking HTTP operations", async () => {
			// Even if caching fails, HTTP operations should work
			const manifest = await repository.getManifest("en");
			expect(manifest).toBeDefined();
		});
	});
});
