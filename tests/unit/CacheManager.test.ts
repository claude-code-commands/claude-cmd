import { beforeEach, describe, expect, test } from "bun:test";
import type IFileService from "../../src/interfaces/IFileService";
import { CacheManager } from "../../src/services/CacheManager";
import type { Manifest } from "../../src/types/Command";
import InMemoryFileService from "../mocks/InMemoryFileService";

describe("CacheManager", () => {
	let fileService: IFileService;
	let cacheManager: CacheManager;
	const mockManifest: Manifest = {
		version: "1.0.0",
		updated: "2025-07-21T12:00:00Z",
		commands: [
			{
				name: "test-command",
				description: "Test command",
				file: "test-command.md",
				"allowed-tools": ["Read", "Write"],
			},
		],
	};

	beforeEach(() => {
		fileService = new InMemoryFileService();
		cacheManager = new CacheManager(fileService);
	});

	describe("get", () => {
		test("should return null when cache does not exist", async () => {
			const result = await cacheManager.get("en");
			expect(result).toBeNull();
		});

		test("should return cached manifest when cache exists and is valid", async () => {
			await cacheManager.set("en", mockManifest);
			const result = await cacheManager.get("en");
			expect(result).toEqual(mockManifest);
		});

		test("should return null when cache exists but is expired", async () => {
			// Set a manifest with custom expiration time in the past (more than 1 week ago)
			const expiredTime = Date.now() - 8 * 24 * 60 * 60 * 1000; // 8 days ago
			await cacheManager.set("en", mockManifest, expiredTime);
			const result = await cacheManager.get("en");
			expect(result).toBeNull();
		});

		test("should handle different languages separately", async () => {
			await cacheManager.set("en", mockManifest);
			const resultEn = await cacheManager.get("en");
			const resultEs = await cacheManager.get("es");

			expect(resultEn).toEqual(mockManifest);
			expect(resultEs).toBeNull();
		});
	});

	describe("set", () => {
		test("should store manifest with current timestamp", async () => {
			await cacheManager.set("en", mockManifest);
			const result = await cacheManager.get("en");
			expect(result).toEqual(mockManifest);
		});

		test("should store manifest with custom timestamp", async () => {
			const customTime = Date.now() + 60 * 60 * 1000; // 1 hour from now
			await cacheManager.set("en", mockManifest, customTime);
			const result = await cacheManager.get("en");
			expect(result).toEqual(mockManifest);
		});

		test("should overwrite existing cache", async () => {
			const updatedManifest: Manifest = {
				...mockManifest,
				version: "2.0.0",
			};

			await cacheManager.set("en", mockManifest);
			await cacheManager.set("en", updatedManifest);
			const result = await cacheManager.get("en");
			expect(result).toEqual(updatedManifest);
		});

		test("should handle different languages independently", async () => {
			const spanishManifest: Manifest = {
				...mockManifest,
				commands: [
					{
						name: "comando-prueba",
						description: "Comando de prueba",
						file: "comando-prueba.md",
						"allowed-tools": "Read,Write",
					},
				],
			};

			await cacheManager.set("en", mockManifest);
			await cacheManager.set("es", spanishManifest);

			const resultEn = await cacheManager.get("en");
			const resultEs = await cacheManager.get("es");

			expect(resultEn).toEqual(mockManifest);
			expect(resultEs).toEqual(spanishManifest);
		});
	});

	describe("isExpired", () => {
		test("should return true when cache does not exist", async () => {
			const result = await cacheManager.isExpired("en");
			expect(result).toBe(true);
		});

		test("should return false when cache exists and is not expired", async () => {
			await cacheManager.set("en", mockManifest);
			const result = await cacheManager.isExpired("en");
			expect(result).toBe(false);
		});

		test("should return true when cache exists but is expired", async () => {
			const expiredTime = Date.now() - 8 * 24 * 60 * 60 * 1000; // 8 days ago (more than 1 week)
			await cacheManager.set("en", mockManifest, expiredTime);
			const result = await cacheManager.isExpired("en");
			expect(result).toBe(true);
		});

		test("should handle custom max age parameter", async () => {
			const recentTime = Date.now() - 30 * 60 * 1000; // 30 minutes ago
			await cacheManager.set("en", mockManifest, recentTime);

			// Should not be expired with 1 hour max age
			const notExpired = await cacheManager.isExpired("en", 60 * 60 * 1000);
			expect(notExpired).toBe(false);

			// Should be expired with 15 minute max age
			const expired = await cacheManager.isExpired("en", 15 * 60 * 1000);
			expect(expired).toBe(true);
		});
	});

	describe("clear", () => {
		test("should remove cache for specific language", async () => {
			await cacheManager.set("en", mockManifest);
			await cacheManager.clear("en");
			const result = await cacheManager.get("en");
			expect(result).toBeNull();
		});

		test("should only remove cache for specified language", async () => {
			const spanishManifest: Manifest = {
				...mockManifest,
				commands: [
					{
						name: "comando-prueba",
						description: "Comando de prueba",
						file: "comando-prueba.md",
						"allowed-tools": ["Read"],
					},
				],
			};

			await cacheManager.set("en", mockManifest);
			await cacheManager.set("es", spanishManifest);
			await cacheManager.clear("en");

			const resultEn = await cacheManager.get("en");
			const resultEs = await cacheManager.get("es");

			expect(resultEn).toBeNull();
			expect(resultEs).toEqual(spanishManifest);
		});

		test("should handle clearing non-existent cache", async () => {
			// Should not throw error when clearing non-existent cache
			await expect(cacheManager.clear("en")).resolves.toBeUndefined();
		});
	});

	describe("getCachePath", () => {
		test("should return language-specific cache path", () => {
			const path = cacheManager.getCachePath("en");
			expect(path).toContain("en");
			expect(path).toContain("manifest.json");
		});

		test("should return different paths for different languages", () => {
			const pathEn = cacheManager.getCachePath("en");
			const pathEs = cacheManager.getCachePath("es");

			expect(pathEn).not.toEqual(pathEs);
			expect(pathEn).toContain("en");
			expect(pathEs).toContain("es");
		});
	});
});
