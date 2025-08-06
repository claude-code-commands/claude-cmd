import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { ConfigManager } from "../../src/services/ConfigManager.js";
import { ConfigService } from "../../src/services/ConfigService.js";
import HTTPRepository from "../../src/services/HTTPRepository.js";
import { LanguageDetector } from "../../src/services/LanguageDetector.js";
import InMemoryFileService from "../mocks/InMemoryFileService.js";
import InMemoryHTTPClient from "../mocks/InMemoryHTTPClient.js";

describe("ConfigManager", () => {
	let fileService: InMemoryFileService;
	let httpClient: InMemoryHTTPClient;
	let repository: HTTPRepository;
	let languageDetector: LanguageDetector;
	let userConfigService: ConfigService;
	let projectConfigService: ConfigService;
	let configManager: ConfigManager;
	let originalEnv: Record<string, string | undefined>;

	beforeEach(() => {
		fileService = new InMemoryFileService();
		httpClient = new InMemoryHTTPClient();
		repository = new HTTPRepository(httpClient, fileService);
		languageDetector = new LanguageDetector();

		userConfigService = new ConfigService(
			"/home/user/.config/claude-cmd/config.claude-cmd.json",
			fileService,
			repository,
			languageDetector,
		);

		projectConfigService = new ConfigService(
			".claude/config.claude-cmd.json",
			fileService,
			repository,
			languageDetector,
		);

		configManager = new ConfigManager(
			userConfigService,
			projectConfigService,
			languageDetector,
		);

		// Save original environment variables
		originalEnv = {
			CLAUDE_CMD_LANG: process.env.CLAUDE_CMD_LANG,
			LC_ALL: process.env.LC_ALL,
			LC_MESSAGES: process.env.LC_MESSAGES,
			LANG: process.env.LANG,
		};

		// Clear environment variables for clean testing
		delete process.env.CLAUDE_CMD_LANG;
		delete process.env.LC_ALL;
		delete process.env.LC_MESSAGES;
		delete process.env.LANG;
	});

	afterEach(() => {
		fileService.clearFiles();
		httpClient.clearRequestHistory();

		// Restore original environment variables
		for (const [key, value] of Object.entries(originalEnv)) {
			if (value !== undefined) {
				process.env[key] = value;
			} else {
				delete process.env[key];
			}
		}
	});

	describe("getEffectiveConfig", () => {
		test("should return empty config when no configurations exist", async () => {
			const config = await configManager.getEffectiveConfig();
			expect(config).toEqual({});
		});

		test("should return user config when only user config exists", async () => {
			const userConfig = { preferredLanguage: "fr" };
			await userConfigService.setConfig(userConfig);

			const effectiveConfig = await configManager.getEffectiveConfig();
			expect(effectiveConfig).toEqual(userConfig);
		});

		test("should return project config when only project config exists", async () => {
			const projectConfig = { preferredLanguage: "es" };
			await projectConfigService.setConfig(projectConfig);

			const effectiveConfig = await configManager.getEffectiveConfig();
			expect(effectiveConfig).toEqual(projectConfig);
		});

		test("should merge configs with project taking precedence", async () => {
			const userConfig = {
				preferredLanguage: "fr",
				repositoryURL: "https://user-repo.com",
				userSetting: "user-value",
			};
			const projectConfig = {
				preferredLanguage: "es",
				projectSetting: "project-value",
			};

			await userConfigService.setConfig(userConfig);
			await projectConfigService.setConfig(projectConfig);

			const effectiveConfig = await configManager.getEffectiveConfig();
			expect(effectiveConfig).toEqual({
				preferredLanguage: "es", // Project wins
				repositoryURL: "https://user-repo.com", // From user
				userSetting: "user-value", // From user
				projectSetting: "project-value", // From project
			});
		});

		test("should deep merge nested objects", async () => {
			const userConfig = {
				nested: {
					userField: "user-value",
					sharedField: "user-shared",
				},
			};
			const projectConfig = {
				nested: {
					projectField: "project-value",
					sharedField: "project-shared",
				},
			};

			await userConfigService.setConfig(userConfig);
			await projectConfigService.setConfig(projectConfig);

			const effectiveConfig = await configManager.getEffectiveConfig();
			expect(effectiveConfig).toEqual({
				nested: {
					userField: "user-value",
					projectField: "project-value",
					sharedField: "project-shared", // Project wins
				},
			});
		});

		test("should handle arrays by overriding (not merging)", async () => {
			const userConfig = {
				arrayField: ["user1", "user2"],
			};
			const projectConfig = {
				arrayField: ["project1"],
			};

			await userConfigService.setConfig(userConfig);
			await projectConfigService.setConfig(projectConfig);

			const effectiveConfig = await configManager.getEffectiveConfig();
			expect(effectiveConfig).toEqual({
				arrayField: ["project1"], // Project array completely replaces user array
			});
		});
	});

	describe("getEffectiveLanguage", () => {
		test("should return fallback 'en' when no language is configured", async () => {
			const language = await configManager.getEffectiveLanguage();
			expect(language).toBe("en");
		});

		test("should prioritize environment variable over configs", async () => {
			const userConfig = { preferredLanguage: "fr" };
			const projectConfig = { preferredLanguage: "es" };

			await userConfigService.setConfig(userConfig);
			await projectConfigService.setConfig(projectConfig);

			process.env.CLAUDE_CMD_LANG = "de";

			const language = await configManager.getEffectiveLanguage();
			expect(language).toBe("de");
		});

		test("should prioritize project config over user config", async () => {
			const userConfig = { preferredLanguage: "fr" };
			const projectConfig = { preferredLanguage: "es" };

			await userConfigService.setConfig(userConfig);
			await projectConfigService.setConfig(projectConfig);

			const language = await configManager.getEffectiveLanguage();
			expect(language).toBe("es"); // Project wins
		});

		test("should fall back to user config when project has no language", async () => {
			const userConfig = { preferredLanguage: "fr" };
			const projectConfig = { otherSetting: "value" }; // No preferredLanguage

			await userConfigService.setConfig(userConfig);
			await projectConfigService.setConfig(projectConfig);

			const language = await configManager.getEffectiveLanguage();
			expect(language).toBe("fr");
		});

		test("should use system locale when no config language is set", async () => {
			process.env.LC_ALL = "es_ES.UTF-8";

			const language = await configManager.getEffectiveLanguage();
			expect(language).toBe("es"); // Extracted from locale
		});

		test("should handle complete precedence chain", async () => {
			// Setup all sources
			const userConfig = { preferredLanguage: "fr" };
			const projectConfig = { preferredLanguage: "es" };

			await userConfigService.setConfig(userConfig);
			await projectConfigService.setConfig(projectConfig);
			process.env.LANG = "de_DE.UTF-8";
			process.env.CLAUDE_CMD_LANG = "it";

			// Environment should win
			let language = await configManager.getEffectiveLanguage();
			expect(language).toBe("it");

			// Remove env var, project should win
			delete process.env.CLAUDE_CMD_LANG;
			language = await configManager.getEffectiveLanguage();
			expect(language).toBe("es");

			// Set project config to empty, user should win
			await projectConfigService.setConfig({});
			language = await configManager.getEffectiveLanguage();
			expect(language).toBe("fr");

			// Set user config to empty, locale should win
			await userConfigService.setConfig({});
			language = await configManager.getEffectiveLanguage();
			expect(language).toBe("de");

			// Remove locale, fallback should win
			delete process.env.LANG;
			language = await configManager.getEffectiveLanguage();
			expect(language).toBe("en");
		});

		test("should handle invalid language codes gracefully", async () => {
			process.env.CLAUDE_CMD_LANG = "invalid-lang-code";

			// Should fall back to next available source or default
			const language = await configManager.getEffectiveLanguage();
			expect(language).toBe("en"); // Fallback since invalid env var is ignored
		});

		test("should prefer LC_ALL over other locale variables", async () => {
			process.env.LC_ALL = "fr_FR.UTF-8";
			process.env.LC_MESSAGES = "es_ES.UTF-8";
			process.env.LANG = "de_DE.UTF-8";

			const language = await configManager.getEffectiveLanguage();
			expect(language).toBe("fr"); // LC_ALL takes precedence
		});

		test("should prefer LC_MESSAGES over LANG", async () => {
			process.env.LC_MESSAGES = "es_ES.UTF-8";
			process.env.LANG = "de_DE.UTF-8";

			const language = await configManager.getEffectiveLanguage();
			expect(language).toBe("es"); // LC_MESSAGES takes precedence over LANG
		});
	});

	describe("error handling", () => {
		test("should handle corrupted config files gracefully", async () => {
			// Create corrupted files
			await fileService.mkdir("/home/user/.config/claude-cmd");
			await fileService.writeFile(
				"/home/user/.config/claude-cmd/config.claude-cmd.json",
				"invalid-json",
			);
			await fileService.mkdir(".claude");
			await fileService.writeFile(
				".claude/config.claude-cmd.json",
				"also-invalid",
			);

			// Should not throw and return empty config
			const config = await configManager.getEffectiveConfig();
			expect(config).toEqual({});

			// Should still return valid language
			const language = await configManager.getEffectiveLanguage();
			expect(language).toBe("en");
		});

		test("should handle file system errors gracefully", async () => {
			// FileService will return null for non-existent files, which is handled
			const config = await configManager.getEffectiveConfig();
			expect(config).toEqual({});
		});
	});
});
