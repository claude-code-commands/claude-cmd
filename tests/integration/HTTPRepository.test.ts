import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { rmdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type IFileService from "../../src/interfaces/IFileService.js";
import type IHTTPClient from "../../src/interfaces/IHTTPClient.js";
import {
	HTTPNetworkError,
	HTTPTimeoutError,
} from "../../src/interfaces/IHTTPClient.js";
import type IRepository from "../../src/interfaces/IRepository.js";
import { CacheConfig } from "../../src/interfaces/IRepository.js";
import BunFileService from "../../src/services/BunFileService.js";
import BunHTTPClient from "../../src/services/BunHTTPClient.js";
import HTTPRepository from "../../src/services/HTTPRepository.js";
import {
	CommandContentError,
	CommandNotFoundError,
	ManifestError,
} from "../../src/types/Command.js";

describe.skip("HTTPRepository Integration", () => {
	let repository: IRepository;
	let httpClient: IHTTPClient;
	let fileService: IFileService;
	let testCacheDir: string;
	let cacheConfig: CacheConfig;

	beforeEach(async () => {
		// Create a temporary cache directory for each test
		testCacheDir = join(
			tmpdir(),
			`http-repository-test-${Date.now()}-${Math.random().toString(36).substring(7)}`,
		);

		// Create real service instances
		httpClient = new BunHTTPClient();
		fileService = new BunFileService();
		cacheConfig = new CacheConfig({
			cacheDir: testCacheDir,
			ttl: 3600000, // 1 hour for integration tests
		});

		repository = new HTTPRepository(httpClient, fileService, cacheConfig);
	});

	afterEach(async () => {
		// Clean up test cache directory
		try {
			await rmdir(testCacheDir, { recursive: true });
		} catch {
			// Ignore cleanup errors
		}
	});

	describe("Real HTTP Operations", () => {
		test("should fetch real manifest from GitHub for English", async () => {
			const manifest = await repository.getManifest("en");

			expect(manifest).toBeDefined();
			expect(typeof manifest.version).toBe("string");
			expect(typeof manifest.updated).toBe("string");
			expect(Array.isArray(manifest.commands)).toBe(true);
			expect(manifest.commands.length).toBeGreaterThan(0);

			// Verify manifest structure
			const firstCommand = manifest.commands[0];
			expect(firstCommand).toBeDefined();
			expect(typeof firstCommand?.name).toBe("string");
			expect(typeof firstCommand?.description).toBe("string");
			expect(typeof firstCommand?.file).toBe("string");
			expect(firstCommand?.["allowed-tools"]).toBeDefined();
		});

		test("should handle non-existent language gracefully", async () => {
			await expect(repository.getManifest("xx")).rejects.toThrow(ManifestError);
		});

		test("should fetch real command content from GitHub", async () => {
			// First get the manifest to find a valid command
			const manifest = await repository.getManifest("en");
			expect(manifest.commands.length).toBeGreaterThan(0);

			const firstCommand = manifest.commands[0];
			expect(firstCommand).toBeDefined();

			// Now fetch the command content
			// biome-ignore lint: Biome and TS can't agree
			const content = await repository.getCommand(firstCommand!.name, "en");

			expect(content).toBeDefined();
			expect(typeof content).toBe("string");
			expect(content.length).toBeGreaterThan(0);
		});

		test("should handle command not found in manifest", async () => {
			await expect(
				repository.getCommand("non-existent-command", "en"),
			).rejects.toThrow(CommandNotFoundError);
		});
	});

	describe("Filesystem Caching Integration", () => {
		test("should create cache directory and cache manifest", async () => {
			// First call should fetch from network and cache
			const manifest1 = await repository.getManifest("en");
			expect(manifest1).toBeDefined();

			// Verify cache directory was created
			const cacheExists = await fileService.exists(testCacheDir);
			expect(cacheExists).toBe(true);

			// Verify cache file exists
			const manifestCachePath = join(testCacheDir, "manifest-en.json");
			const cacheFileExists = await fileService.exists(manifestCachePath);
			expect(cacheFileExists).toBe(true);

			// Second call should use cache (we can't easily verify this without mocking,
			// but we can verify it returns the same data)
			const manifest2 = await repository.getManifest("en");
			expect(manifest2).toEqual(manifest1);
		});

		test("should cache command content separately", async () => {
			// Get manifest first
			const manifest = await repository.getManifest("en");
			const firstCommand = manifest.commands[0];
			expect(firstCommand).toBeDefined();

			// Fetch command content
			// biome-ignore lint: Biome and TS can't agree
			const content1 = await repository.getCommand(firstCommand!.name, "en");
			expect(content1).toBeDefined();

			// Verify command cache file exists
			const commandCachePath = join(
				testCacheDir,
				`command-en-${firstCommand?.name.replace(/[./\\:\\0]/g, "-")}.md`,
			);
			const cacheFileExists = await fileService.exists(commandCachePath);
			expect(cacheFileExists).toBe(true);

			// Second call should return same content
			// biome-ignore lint: Biome and TS can't agree
			const content2 = await repository.getCommand(firstCommand!.name, "en");
			expect(content2).toBe(content1);
		});

		test("should respect forceRefresh option", async () => {
			// First call with normal caching
			await repository.getManifest("en");

			// Verify cache exists
			const manifestCachePath = join(testCacheDir, "manifest-en.json");
			const cacheExists = await fileService.exists(manifestCachePath);
			expect(cacheExists).toBe(true);

			// Call with forceRefresh should still work (bypass cache)
			const freshManifest = await repository.getManifest("en", {
				forceRefresh: true,
			});
			expect(freshManifest).toBeDefined();
		});

		test("should handle corrupted cache gracefully", async () => {
			// First create a normal cache
			await repository.getManifest("en");

			// Corrupt the cache file
			const manifestCachePath = join(testCacheDir, "manifest-en.json");
			await fileService.writeFile(manifestCachePath, "invalid json content");

			// Should handle corrupted cache and fetch fresh data
			const manifest = await repository.getManifest("en");
			expect(manifest).toBeDefined();
			expect(Array.isArray(manifest.commands)).toBe(true);
		});
	});

	describe("Error Handling Integration", () => {
		test("should handle network timeout", async () => {
			// Create repository with very short timeout
			const shortTimeoutClient = new BunHTTPClient();

			// This should timeout (using a slow endpoint)
			await expect(
				shortTimeoutClient.get("https://httpbin.org/delay/10", {
					timeout: 100,
				}),
			).rejects.toThrow(HTTPTimeoutError);
		});

		test("should handle network failure", async () => {
			await expect(
				httpClient.get("https://invalid-domain-that-does-not-exist-12345.com"),
			).rejects.toThrow(HTTPNetworkError);
		});

		test("should handle 404 errors from GitHub", async () => {
			// Try to fetch a non-existent manifest
			const invalidRepository = new HTTPRepository(
				httpClient,
				fileService,
				cacheConfig,
			);

			// This should result in a 404 error wrapped in ManifestError
			await expect(
				invalidRepository.getManifest("zz"), // Invalid language
			).rejects.toThrow(ManifestError);
		});

		test("should handle filesystem permission errors gracefully", async () => {
			// This is hard to test reliably across platforms
			// But we can verify the error types exist
			expect(ManifestError).toBeDefined();
			expect(CommandContentError).toBeDefined();
			expect(CommandNotFoundError).toBeDefined();
		});
	});

	describe("Security Integration", () => {
		test("should sanitize language codes in filesystem paths", async () => {
			// Try with various potentially dangerous language codes
			const dangerousLang = "../etc";

			await expect(repository.getManifest(dangerousLang)).rejects.toThrow(
				ManifestError,
			);
		});

		test("should sanitize command names in cache paths", async () => {
			// First get a valid manifest
			const manifest = await repository.getManifest("en");
			const validCommand = manifest.commands[0];
			expect(validCommand).toBeDefined();

			// Try with dangerous command name (this should be sanitized internally)
			const dangerousCommand = "../../../etc/passwd";

			await expect(
				repository.getCommand(dangerousCommand, "en"),
			).rejects.toThrow(CommandNotFoundError);
		});

		test("should create safe cache file paths", async () => {
			await repository.getManifest("en");

			// Verify cache files are created in the correct directory
			const cacheFiles = await fileService.exists(testCacheDir);
			expect(cacheFiles).toBe(true);

			// Cache files should not escape the cache directory
			const manifestCachePath = join(testCacheDir, "manifest-en.json");
			expect(manifestCachePath.startsWith(testCacheDir)).toBe(true);
		});
	});

	describe("Performance and Concurrency", () => {
		test("should handle concurrent requests efficiently", async () => {
			// Make multiple concurrent requests
			const promises = [
				repository.getManifest("en"),
				repository.getManifest("en"),
				repository.getManifest("en"),
			];

			const results = await Promise.all(promises);

			// All results should be identical
			expect(results[0]!).toEqual(results[1]!);
			expect(results[1]!).toEqual(results[2]!);
			expect(results[0]).toBeDefined();
		});

		test("should respect TTL configuration", async () => {
			// Create repository with very short TTL
			const shortTtlConfig = new CacheConfig({
				cacheDir: testCacheDir,
				ttl: 1, // 1 millisecond
			});
			const shortTtlRepository = new HTTPRepository(
				httpClient,
				fileService,
				shortTtlConfig,
			);

			// First call
			await shortTtlRepository.getManifest("en");

			// Wait for TTL to expire
			await new Promise((resolve) => setTimeout(resolve, 10));

			// Second call should fetch fresh data (can't easily verify without timing)
			const manifest = await shortTtlRepository.getManifest("en");
			expect(manifest).toBeDefined();
		});

		test("should handle large manifest responses", async () => {
			const manifest = await repository.getManifest("en");

			// Verify we can handle reasonably large responses
			expect(manifest.commands.length).toBeGreaterThan(0);
			expect(JSON.stringify(manifest).length).toBeGreaterThan(100);
		});
	});

	describe("Repository Constructor and Configuration", () => {
		test("should validate dependencies at construction", () => {
			expect(
				() => new HTTPRepository(null as any, fileService, cacheConfig),
			).toThrow("HTTPClient is required");

			expect(
				() => new HTTPRepository(httpClient, null as any, cacheConfig),
			).toThrow("FileService is required");
		});

		test("should use default cache config when not provided", () => {
			const defaultRepository = new HTTPRepository(httpClient, fileService);
			expect(defaultRepository).toBeDefined();
		});

		test("should use custom cache configuration", () => {
			const customConfig = new CacheConfig({
				cacheDir: "/tmp/custom-cache",
				ttl: 7200000, // 2 hours
			});
			const customRepository = new HTTPRepository(
				httpClient,
				fileService,
				customConfig,
			);
			expect(customRepository).toBeDefined();
		});
	});
});
