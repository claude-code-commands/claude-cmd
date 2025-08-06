import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { ConfigService } from "../../src/services/ConfigService.js";
import HTTPRepository from "../../src/services/HTTPRepository.js";
import { LanguageDetector } from "../../src/services/LanguageDetector.js";
import InMemoryFileService from "../mocks/InMemoryFileService.js";
import InMemoryHTTPClient from "../mocks/InMemoryHTTPClient.js";

describe("ConfigService", () => {
	let fileService: InMemoryFileService;
	let httpClient: InMemoryHTTPClient;
	let repository: HTTPRepository;
	let languageDetector: LanguageDetector;
	let userConfigService: ConfigService;
	let projectConfigService: ConfigService;

	const userConfigPath = "/home/user/.config/claude-cmd/config.claude-cmd.json";
	const projectConfigPath = ".claude/config.claude-cmd.json";

	beforeEach(() => {
		fileService = new InMemoryFileService();
		httpClient = new InMemoryHTTPClient();
		repository = new HTTPRepository(httpClient, fileService);
		languageDetector = new LanguageDetector();

		userConfigService = new ConfigService(
			userConfigPath,
			fileService,
			repository,
			languageDetector,
		);

		projectConfigService = new ConfigService(
			projectConfigPath,
			fileService,
			repository,
			languageDetector,
		);
	});

	afterEach(() => {
		fileService.clearFiles();
		httpClient.clearRequestHistory();
	});

	describe("getConfig", () => {
		test("should return null when no configuration exists", async () => {
			const config = await userConfigService.getConfig();
			expect(config).toBeNull();
		});

		test("should return configuration when it exists", async () => {
			const expectedConfig = { preferredLanguage: "fr" };
			await userConfigService.setConfig(expectedConfig);

			const config = await userConfigService.getConfig();
			expect(config).toEqual(expectedConfig);
		});

		test("should return null for corrupted configuration file", async () => {
			// Setup: Create corrupted config file
			await fileService.mkdir("/home/user/.config/claude-cmd");
			await fileService.writeFile(userConfigPath, "invalid-json");

			const config = await userConfigService.getConfig();
			expect(config).toBeNull();
		});

		test("should return null for invalid configuration", async () => {
			// Setup: Create config with invalid language
			await fileService.mkdir("/home/user/.config/claude-cmd");
			await fileService.writeFile(
				userConfigPath,
				JSON.stringify({ preferredLanguage: "invalid-lang" }),
			);

			const config = await userConfigService.getConfig();
			expect(config).toBeNull();
		});

		test("should work with both user and project config paths", async () => {
			const userConfig = { preferredLanguage: "en" };
			const projectConfig = {
				preferredLanguage: "fr",
				repositoryURL: "https://example.com",
			};

			await userConfigService.setConfig(userConfig);
			await projectConfigService.setConfig(projectConfig);

			const retrievedUserConfig = await userConfigService.getConfig();
			const retrievedProjectConfig = await projectConfigService.getConfig();

			expect(retrievedUserConfig).toEqual(userConfig);
			expect(retrievedProjectConfig).toEqual(projectConfig);
		});
	});

	describe("setConfig", () => {
		test("should save configuration successfully", async () => {
			const config = { preferredLanguage: "es" };
			await userConfigService.setConfig(config);

			const savedConfig = await userConfigService.getConfig();
			expect(savedConfig).toEqual(config);
		});

		test("should create config directory if it doesn't exist", async () => {
			const config = { preferredLanguage: "de" };
			await userConfigService.setConfig(config);

			const configDir = "/home/user/.config/claude-cmd";
			expect(await fileService.exists(configDir)).toBe(true);
		});

		test("should reject configuration with invalid language code", async () => {
			const invalidConfig = { preferredLanguage: "invalid" };

			await expect(userConfigService.setConfig(invalidConfig)).rejects.toThrow(
				"Invalid configuration",
			);
		});

		test("should reject configuration with invalid repository URL", async () => {
			const invalidConfig = { repositoryURL: "not-a-url" };

			await expect(userConfigService.setConfig(invalidConfig)).rejects.toThrow(
				"Invalid configuration",
			);
		});

		test("should accept valid repository URL", async () => {
			const validConfig = {
				preferredLanguage: "fr",
				repositoryURL: "https://github.com/user/commands.git",
			};

			// Should not throw
			await userConfigService.setConfig(validConfig);

			const savedConfig = await userConfigService.getConfig();
			expect(savedConfig).toEqual(validConfig);
		});

		test("should allow additional fields for forward compatibility", async () => {
			const configWithExtraFields = {
				preferredLanguage: "en",
				repositoryURL: "https://example.com",
				customField: "custom-value",
				nestedField: { nested: true },
			};

			// Should not throw
			await userConfigService.setConfig(configWithExtraFields);

			const savedConfig = await userConfigService.getConfig();
			expect(savedConfig).toEqual(configWithExtraFields);
		});
	});

	describe("getAvailableLanguages", () => {
		test("should return all known languages with availability status", async () => {
			const languages = await userConfigService.getAvailableLanguages();

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
				new Error("404 Not Found"),
			);

			const languages = await userConfigService.getAvailableLanguages();

			const frenchLang = languages.find((l) => l.code === "fr");
			expect(frenchLang?.available).toBe(false);
		});

		test("should work consistently across different ConfigService instances", async () => {
			// Both user and project config services should return same language availability
			const userLanguages = await userConfigService.getAvailableLanguages();
			const projectLanguages =
				await projectConfigService.getAvailableLanguages();

			expect(userLanguages).toEqual(projectLanguages);
		});
	});

	describe("getConfigPath", () => {
		test("should return correct path for user config", () => {
			expect(userConfigService.getConfigPath()).toBe(userConfigPath);
		});

		test("should return correct path for project config", () => {
			expect(projectConfigService.getConfigPath()).toBe(projectConfigPath);
		});
	});

	describe("validation", () => {
		test("should reject null configuration", async () => {
			await expect(userConfigService.setConfig(null as any)).rejects.toThrow(
				"Invalid configuration",
			);
		});

		test("should reject non-object configuration", async () => {
			await expect(
				userConfigService.setConfig("invalid" as any),
			).rejects.toThrow("Invalid configuration");
		});

		test("should reject configuration with non-string language", async () => {
			const invalidConfig = { preferredLanguage: 123 };

			await expect(
				userConfigService.setConfig(invalidConfig as any),
			).rejects.toThrow("Invalid configuration");
		});

		test("should reject configuration with non-string repository URL", async () => {
			const invalidConfig = { repositoryURL: 123 };

			await expect(
				userConfigService.setConfig(invalidConfig as any),
			).rejects.toThrow("Invalid configuration");
		});

		test("should accept empty configuration", async () => {
			const emptyConfig = {};

			// Should not throw
			await userConfigService.setConfig(emptyConfig);

			const savedConfig = await userConfigService.getConfig();
			expect(savedConfig).toEqual(emptyConfig);
		});
	});
});
