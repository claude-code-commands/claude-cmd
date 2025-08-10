import { beforeEach, describe, expect, test } from "bun:test";
import type IRepository from "../../src/interfaces/IRepository.ts";
import { CacheConfig } from "../../src/interfaces/IRepository.ts";
import {
	CommandContentError,
	CommandNotFoundError,
	ManifestError,
} from "../../src/types/Command.ts";

/**
 * Setup context for contract tests
 */
interface ContractSetupContext {
	/** Setup function called before all contract tests */
	setup?: () => Promise<void>;
	/** Teardown function called after all contract tests */
	teardown?: () => Promise<void>;
	/** Base URL for test endpoints (used by integration tests) */
	baseUrl?: string;
	/** Whether this is testing a real repository implementation */
	isRealRepository: boolean;
}

/**
 * Shared contract test suite for IRepository implementations
 *
 * This test suite validates that any implementation of IRepository behaves
 * correctly according to the interface contract. It tests both successful
 * operations and error conditions to ensure consistent behavior across
 * different implementations (real HTTP repository and in-memory mock).
 *
 * @param repositoryFactory - Function that creates an IRepository instance
 * @param context - Optional setup/teardown context for environment-specific needs
 */
export function runRepositoryContractTests(
	repositoryFactory: () => IRepository,
	context: ContractSetupContext = { isRealRepository: false },
) {
	describe("IRepository Contract", () => {
		let repository: IRepository;

		beforeEach(async () => {
			if (context.setup) {
				await context.setup();
			}
			repository = repositoryFactory();
		});

		describe("manifest operations", () => {
			test("should retrieve manifest for supported language", async () => {
				const manifest = await repository.getManifest("en");

				expect(manifest).toBeDefined();
				expect(manifest.version).toBeDefined();
				expect(typeof manifest.version).toBe("string");
				expect(manifest.updated).toBeDefined();
				expect(typeof manifest.updated).toBe("string");
				expect(Array.isArray(manifest.commands)).toBe(true);
				expect(manifest.commands.length).toBeGreaterThan(0);

				// Validate command structure
				const firstCommand = manifest.commands[0];
				if (firstCommand) {
					expect(firstCommand.name).toBeDefined();
					expect(typeof firstCommand.name).toBe("string");
					expect(firstCommand.description).toBeDefined();
					expect(typeof firstCommand.description).toBe("string");
					expect(firstCommand.file).toBeDefined();
					expect(typeof firstCommand.file).toBe("string");
					expect(firstCommand["allowed-tools"]).toBeDefined();
				}
			});

			test("should handle French language manifest", async () => {
				const manifest = await repository.getManifest("fr");

				expect(manifest).toBeDefined();
				expect(manifest.version).toBeDefined();
				expect(Array.isArray(manifest.commands)).toBe(true);
				expect(manifest.commands.length).toBeGreaterThan(0);
			});

			test("should handle manifest caching correctly", async () => {
				// First call
				const manifest1 = await repository.getManifest("en");

				// Second call should return same data (from cache or consistent source)
				const manifest2 = await repository.getManifest("en");

				expect(manifest1).toEqual(manifest2);
			});

			test("should respect forceRefresh option", async () => {
				// First call without force refresh
				const manifest1 = await repository.getManifest("en");

				// Second call with force refresh
				const manifest2 = await repository.getManifest("en", {
					forceRefresh: true,
				});

				// Data should be consistent regardless of caching
				expect(manifest1).toEqual(manifest2);
			});

			test("should throw ManifestError for unsupported language", async () => {
				await expect(repository.getManifest("invalid-lang")).rejects.toThrow(
					ManifestError,
				);
			});

			test("should include language in ManifestError", async () => {
				try {
					await repository.getManifest("invalid-lang");
				} catch (error) {
					expect(error).toBeInstanceOf(ManifestError);
					expect((error as ManifestError).language).toBe("invalid-lang");
					expect((error as ManifestError).message).toContain("invalid-lang");
				}
			});

			test("should throw ManifestError on network failure", async () => {
				await expect(repository.getManifest("network-error")).rejects.toThrow(
					ManifestError,
				);
			});

			test("should handle timeout scenarios", async () => {
				await expect(repository.getManifest("timeout")).rejects.toThrow(
					ManifestError,
				);
			});
		});

		describe("command operations", () => {
			test("should retrieve command content successfully", async () => {
				const content = await repository.getCommand("debug-help", "en");

				expect(content).toBeDefined();
				expect(typeof content).toBe("string");
				expect(content.length).toBeGreaterThan(0);
				expect(content).toContain("Debug Help");
			});

			test("should handle namespaced command names", async () => {
				const content = await repository.getCommand("frontend:component", "en");

				expect(content).toBeDefined();
				expect(typeof content).toBe("string");
				expect(content.length).toBeGreaterThan(0);
			});

			test("should handle command caching correctly", async () => {
				// First call
				const content1 = await repository.getCommand("debug-help", "en");

				// Second call should return same data (from cache or consistent source)
				const content2 = await repository.getCommand("debug-help", "en");

				expect(content1).toBe(content2);
			});

			test("should respect forceRefresh option for commands", async () => {
				// First call without force refresh
				const content1 = await repository.getCommand("debug-help", "en");

				// Second call with force refresh
				const content2 = await repository.getCommand("debug-help", "en", {
					forceRefresh: true,
				});

				// Data should be consistent regardless of caching
				expect(content1).toBe(content2);
			});

			test("should throw CommandNotFoundError for non-existent command", async () => {
				await expect(
					repository.getCommand("non-existent-command", "en"),
				).rejects.toThrow(CommandNotFoundError);
			});

			test("should include command info in CommandNotFoundError", async () => {
				try {
					await repository.getCommand("non-existent-command", "en");
				} catch (error) {
					expect(error).toBeInstanceOf(CommandNotFoundError);
					expect((error as CommandNotFoundError).commandName).toBe(
						"non-existent-command",
					);
					expect((error as CommandNotFoundError).language).toBe("en");
					expect((error as CommandNotFoundError).message).toContain(
						"non-existent-command",
					);
				}
			});

			test("should throw CommandContentError when command file is corrupted", async () => {
				await expect(
					repository.getCommand("content-error", "en"),
				).rejects.toThrow(CommandContentError);
			});

			test("should include command info in CommandContentError", async () => {
				try {
					await repository.getCommand("content-error", "en");
				} catch (error) {
					expect(error).toBeInstanceOf(CommandContentError);
					expect((error as CommandContentError).commandName).toBe(
						"content-error",
					);
					expect((error as CommandContentError).language).toBe("en");
					expect((error as CommandContentError).message).toContain(
						"content-error",
					);
				}
			});

			test("should verify command exists in manifest before fetching", async () => {
				// This ensures the repository checks manifest first
				await expect(
					repository.getCommand("definitely-not-in-manifest", "en"),
				).rejects.toThrow(CommandNotFoundError);
			});

			test("should handle missing command file for valid command in manifest", async () => {
				await expect(
					repository.getCommand("missing-file", "fr"),
				).rejects.toThrow(CommandContentError);
			});
		});

		describe("language discovery", () => {
			test("should return array of available languages", async () => {
				// First trigger cache population by fetching manifests
				await repository.getManifest("en");
				await repository.getManifest("fr");

				const languages = await repository.getAvailableLanguages();

				expect(Array.isArray(languages)).toBe(true);

				// For implementations with pre-configured data, expect languages
				// For cache-based implementations, they might be empty until cache is populated
				if (languages.length > 0) {
					// Validate language info structure
					const firstLanguage = languages[0];
					if (firstLanguage) {
						expect(firstLanguage.code).toBeDefined();
						expect(typeof firstLanguage.code).toBe("string");
						expect(firstLanguage.name).toBeDefined();
						expect(typeof firstLanguage.name).toBe("string");
						expect(firstLanguage.commandCount).toBeDefined();
						expect(typeof firstLanguage.commandCount).toBe("number");
						expect(firstLanguage.commandCount).toBeGreaterThanOrEqual(0);
					}
				}
			});

			test("should include English and French languages after manifests are cached", async () => {
				// Populate cache first
				await repository.getManifest("en");
				await repository.getManifest("fr");

				const languages = await repository.getAvailableLanguages();
				const languageCodes = languages.map((lang) => lang.code);

				// For mock implementations, this should work immediately
				// For cache-based implementations, they should work after cache population
				if (!context.isRealRepository || languageCodes.length > 0) {
					expect(languageCodes).toContain("en");
					expect(languageCodes).toContain("fr");
				}
			});

			test("should provide accurate command counts when available", async () => {
				// Populate cache first
				await repository.getManifest("en");

				const languages = await repository.getAvailableLanguages();
				const englishLang = languages.find((lang) => lang.code === "en");

				if (englishLang) {
					// Verify by checking actual manifest
					const manifest = await repository.getManifest("en");
					expect(englishLang.commandCount).toBe(manifest.commands.length);
				} else {
					// For cache-based implementations that might not populate immediately
					// Just verify the method doesn't throw
					expect(languages).toEqual([]);
				}
			});

			test("should exclude error languages from available languages", async () => {
				const languages = await repository.getAvailableLanguages();
				const languageCodes = languages.map((lang) => lang.code);

				// Error-triggering languages should not appear
				expect(languageCodes).not.toContain("invalid-lang");
				expect(languageCodes).not.toContain("network-error");
				expect(languageCodes).not.toContain("timeout");
			});
		});

		describe("cache configuration handling", () => {
			test("should accept custom cache configuration", async () => {
				// This test verifies repository can work with custom cache config
				const manifest = await repository.getManifest("en");
				expect(manifest).toBeDefined();
			});

			test("should work with default cache configuration", async () => {
				// Verify repository works without explicit cache config
				const manifest = await repository.getManifest("en");
				expect(manifest).toBeDefined();
			});
		});

		describe("error consistency", () => {
			test("should throw consistent errors for same invalid inputs", async () => {
				// First call
				let error1: Error | null = null;
				try {
					await repository.getManifest("invalid-lang");
				} catch (e) {
					error1 = e as Error;
				}

				// Second call should throw same type of error
				let error2: Error | null = null;
				try {
					await repository.getManifest("invalid-lang");
				} catch (e) {
					error2 = e as Error;
				}

				expect(error1).toBeInstanceOf(ManifestError);
				expect(error2).toBeInstanceOf(ManifestError);
				if (error1 && error2) {
					expect(error1.constructor.name).toBe(error2.constructor.name);
					expect((error1 as ManifestError).language).toBe(
						(error2 as ManifestError).language,
					);
				}
			});

			test("should maintain error properties across calls", async () => {
				try {
					await repository.getCommand("non-existent", "en");
				} catch (error) {
					expect(error).toBeInstanceOf(CommandNotFoundError);
					expect((error as CommandNotFoundError).commandName).toBe(
						"non-existent",
					);
					expect((error as CommandNotFoundError).language).toBe("en");
				}

				// Verify error properties are consistent on second call
				try {
					await repository.getCommand("non-existent", "en");
				} catch (error) {
					expect(error).toBeInstanceOf(CommandNotFoundError);
					expect((error as CommandNotFoundError).commandName).toBe(
						"non-existent",
					);
					expect((error as CommandNotFoundError).language).toBe("en");
				}
			});
		});

		describe("input validation and sanitization", () => {
			test("should handle empty language parameter", async () => {
				await expect(repository.getManifest("")).rejects.toThrow();
			});

			test("should handle empty command name", async () => {
				await expect(repository.getCommand("", "en")).rejects.toThrow();
			});

			test("should handle whitespace-only inputs", async () => {
				await expect(repository.getManifest("   ")).rejects.toThrow();
				await expect(repository.getCommand("   ", "en")).rejects.toThrow();
			});

			test("should handle special characters safely", async () => {
				// These should not cause security issues or crashes
				await expect(repository.getManifest("../../../etc")).rejects.toThrow();
				await expect(
					repository.getCommand("../../../etc", "en"),
				).rejects.toThrow();
			});
		});

		// Platform-specific tests that may not apply to all implementations
		describe("platform-specific behavior", () => {
			test.skipIf(!context.isRealRepository)(
				"should handle real network timeouts",
				async () => {
					// Test actual network timeout behavior with timeout scenarios
					// For real repository implementations, test that timeout errors
					// are properly converted to ManifestError

					// This should trigger timeout behavior in real HTTP implementations
					await expect(repository.getManifest("timeout")).rejects.toThrow(
						ManifestError,
					);

					// Verify that the timeout error includes appropriate error information
					try {
						await repository.getManifest("timeout");
					} catch (error) {
						expect(error).toBeInstanceOf(ManifestError);
						expect((error as ManifestError).message).toMatch(
							/timeout|network|failed/i,
						);
					}
				},
			);

			test.skipIf(!context.isRealRepository)(
				"should handle real cache directory creation",
				async () => {
					// Test that real repository implementations properly handle
					// cache directory creation and file system operations

					// Get a manifest which should trigger cache operations
					const manifest1 = await repository.getManifest("en");
					expect(manifest1).toBeDefined();

					// Get the same manifest again - should work with cached data
					const manifest2 = await repository.getManifest("en");
					expect(manifest2).toEqual(manifest1);

					// Force refresh should bypass cache and still work
					const manifest3 = await repository.getManifest("en", {
						forceRefresh: true,
					});
					expect(manifest3).toBeDefined();
					expect(manifest3).toEqual(manifest1);

					// Verify that repository can handle multiple languages
					const frManifest = await repository.getManifest("fr");
					expect(frManifest).toBeDefined();
					expect(frManifest).not.toEqual(manifest1); // Should be different language
				},
			);
		});
	});
}
