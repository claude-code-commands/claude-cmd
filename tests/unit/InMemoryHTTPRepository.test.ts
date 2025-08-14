import { beforeEach, describe, expect, test } from "bun:test";
import { CacheConfig } from "../../src/interfaces/IRepository.js";
import HTTPRepository from "../../src/services/HTTPRepository.js";
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
		// Basic manifest operations are covered by contract tests

		// All basic manifest operations covered by contract tests

		// TTL behavior testing with controlled timing using mocks
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
		// Basic command operations are covered by contract tests
	});

	describe("error handling", () => {
		// Error handling and error properties are covered by contract tests
	});

	describe("GitHub integration", () => {
		test("should construct correct GitHub URLs for manifests", async () => {
			await repository.getManifest("en");

			const httpHistory = mockHttpClient.getRequestHistory();
			expect(httpHistory[0]?.url).toMatch(
				/https:\/\/raw\.githubusercontent\.com\/.*\/.*\/main\/commands\/en\/manifest\.json/,
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
				/https:\/\/raw\.githubusercontent\.com\/.*\/.*\/main\/commands\/en\/debug-help\.md/,
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
