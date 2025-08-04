import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import HTTPRepository from "../../src/services/HTTPRepository.js";
import { LanguageConfigService } from "../../src/services/LanguageConfigService.js";
import type { ProjectConfig } from "../../src/services/ProjectConfigService.js";
import InMemoryFileService from "../mocks/InMemoryFileService.js";
import InMemoryHTTPClient from "../mocks/InMemoryHTTPClient.js";

describe("LanguageConfigService", () => {
	let fileService: InMemoryFileService;
	let httpClient: InMemoryHTTPClient;
	let repository: HTTPRepository;
	let languageConfigService: LanguageConfigService;

	beforeEach(() => {
		fileService = new InMemoryFileService();
		httpClient = new InMemoryHTTPClient();
		repository = new HTTPRepository(httpClient, fileService);
		languageConfigService = new LanguageConfigService(fileService, repository);
	});

	afterEach(() => {
		fileService.clearFiles();
		httpClient.clearRequestHistory();
		// Clean up environment variables that might affect tests
		delete process.env.CLAUDE_CMD_LANG;
	});

	describe("getCurrentLanguage", () => {
		test("should return null when no language preference is configured", async () => {
			const currentLanguage = await languageConfigService.getCurrentLanguage();
			expect(currentLanguage).toBeNull();
		});

		test("should return configured language preference", async () => {
			// Setup: Set language preference first
			await languageConfigService.setLanguage("fr");

			const currentLanguage = await languageConfigService.getCurrentLanguage();
			expect(currentLanguage).toBe("fr");
		});

		test("should handle corrupted config file gracefully", async () => {
			// Setup: Create corrupted config file
			const configPath = languageConfigService.getConfigPath();
			await fileService.mkdir(configPath.split("/").slice(0, -1).join("/"));
			await fileService.writeFile(configPath, "invalid-json");

			const currentLanguage = await languageConfigService.getCurrentLanguage();
			expect(currentLanguage).toBeNull();
		});
	});

	describe("setLanguage", () => {
		test("should set language preference successfully", async () => {
			await languageConfigService.setLanguage("es");

			const currentLanguage = await languageConfigService.getCurrentLanguage();
			expect(currentLanguage).toBe("es");
		});

		test("should reject invalid language codes", async () => {
			await expect(
				languageConfigService.setLanguage("invalid"),
			).rejects.toThrow("Invalid language code");
		});

		test("should reject empty language code", async () => {
			await expect(languageConfigService.setLanguage("")).rejects.toThrow(
				"Invalid language code",
			);
		});

		test("should create config directory if it doesn't exist", async () => {
			await languageConfigService.setLanguage("de");

			const configPath = languageConfigService.getConfigPath();
			const configDir = configPath.split("/").slice(0, -1).join("/");
			expect(await fileService.exists(configDir)).toBe(true);
		});
	});

	describe("getAvailableLanguages", () => {
		test("should return all known languages with availability status", async () => {
			const languages = await languageConfigService.getAvailableLanguages();

			// Should return all 9 known languages
			expect(languages).toHaveLength(9);

			// English should always be available
			const englishLang = languages.find((l) => l.code === "en");
			expect(englishLang).toEqual({
				code: "en",
				name: "English",
				available: true,
			});
		});

		test("should mark languages as unavailable when manifest fetch fails", async () => {
			// Setup: Mock errors for non-English manifest fetches
			httpClient.setResponse(
				"https://api.github.com/repos/anthropics/claude-commands/contents/commands/fr/index.json",
				new Error("Not found"),
			);

			const languages = await languageConfigService.getAvailableLanguages();

			const frenchLang = languages.find((l) => l.code === "fr");
			expect(frenchLang?.available).toBe(false);
		});

		test("should mark languages as available when manifest fetch succeeds", async () => {
			// Setup: Mock successful manifest for French
			httpClient.setResponse(
				"https://raw.githubusercontent.com/claude-code-commands/commands/refs/heads/main/pages/fr/index.json",
				{
					status: 200,
					statusText: "OK",
					headers: { "content-type": "application/json" },
					body: '{"commands": []}',
					url: "https://raw.githubusercontent.com/claude-code-commands/commands/refs/heads/main/pages/fr/index.json",
				},
			);

			const languages = await languageConfigService.getAvailableLanguages();

			const frenchLang = languages.find((l) => l.code === "fr");
			expect(frenchLang?.available).toBe(true);
		});
	});

	describe("getEffectiveLanguage", () => {
		test("should return saved preference when available", async () => {
			await languageConfigService.setLanguage("fr");

			const effectiveLanguage =
				await languageConfigService.getEffectiveLanguage();
			expect(effectiveLanguage).toBe("fr");
		});

		test("should fallback to environment and locale detection when no preference is set", async () => {
			// Note: This test depends on LanguageDetector behavior
			const effectiveLanguage =
				await languageConfigService.getEffectiveLanguage();
			expect(typeof effectiveLanguage).toBe("string");
			expect(effectiveLanguage.length).toBeGreaterThan(0);
		});

		test("should fallback to 'en' when all other detection methods fail", async () => {
			// This test may need to be adapted based on LanguageDetector implementation
			const effectiveLanguage =
				await languageConfigService.getEffectiveLanguage();
			expect(effectiveLanguage).toBe("en");
		});
	});

	describe("getEffectiveLanguageWithProjectConfig", () => {
		test("should prioritize environment over user config when no project config", async () => {
			// Set user preference
			await languageConfigService.setLanguage("fr");
			
			// Mock environment variable - should take precedence
			const originalEnv = process.env.CLAUDE_CMD_LANG;
			process.env.CLAUDE_CMD_LANG = "es";

			const effectiveLanguage = await languageConfigService.getEffectiveLanguageWithProjectConfig(null);
			expect(effectiveLanguage).toBe("es"); // Environment should win

			// Cleanup
			if (originalEnv) {
				process.env.CLAUDE_CMD_LANG = originalEnv;
			} else {
				delete process.env.CLAUDE_CMD_LANG;
			}
		});

		test("should prioritize project config over user config", async () => {
			// Set user preference
			await languageConfigService.setLanguage("fr");
			
			const projectConfig = { preferredLanguage: "es" };
			const effectiveLanguage = await languageConfigService.getEffectiveLanguageWithProjectConfig(projectConfig);
			expect(effectiveLanguage).toBe("es");
		});

		test("should fall back to user config when project config has no language preference", async () => {
			// Set user preference
			await languageConfigService.setLanguage("fr");
			
			const projectConfig = { otherSetting: "value" };
			const effectiveLanguage = await languageConfigService.getEffectiveLanguageWithProjectConfig(projectConfig);
			expect(effectiveLanguage).toBe("fr");
		});

		test("should follow complete precedence chain", async () => {
			// Set user preference
			await languageConfigService.setLanguage("fr");
			
			// Mock environment variable - should take precedence over project and user
			const originalEnv = process.env.CLAUDE_CMD_LANG;
			process.env.CLAUDE_CMD_LANG = "de";

			// Project config comes after environment in precedence
			const projectConfig = { preferredLanguage: "es" };
			const effectiveLanguage = await languageConfigService.getEffectiveLanguageWithProjectConfig(projectConfig);
			expect(effectiveLanguage).toBe("de"); // Environment should win per spec: CLI -> env -> project -> user -> locale -> default

			// Cleanup
			if (originalEnv) {
				process.env.CLAUDE_CMD_LANG = originalEnv;
			} else {
				delete process.env.CLAUDE_CMD_LANG;
			}
		});
	});
});
