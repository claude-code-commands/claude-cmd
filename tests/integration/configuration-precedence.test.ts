import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import crypto from "node:crypto";
import path from "node:path";
import BunFileService from "../../src/services/BunFileService.js";
import {
	getServices,
	resetServices,
} from "../../src/services/serviceFactory.js";

describe("Configuration Precedence Integration", () => {
	let originalEnv: string | undefined;
	let fileService: BunFileService;
	let testDir: string;
	let originalCwd: string;

	beforeEach(async () => {
		resetServices();
		fileService = new BunFileService();
		originalEnv = process.env.CLAUDE_CMD_LANG;
		originalCwd = process.cwd();

		// Create unique test directory for each test
		testDir = path.join(
			process.cwd(),
			"test-" + crypto.randomUUID().slice(0, 8),
		);
		await fileService.mkdir(testDir);
		process.chdir(testDir);

		delete process.env.CLAUDE_CMD_LANG;
	});

	afterEach(async () => {
		resetServices();

		// Restore original directory
		process.chdir(originalCwd);

		// Clean up environment
		if (originalEnv) {
			process.env.CLAUDE_CMD_LANG = originalEnv;
		} else {
			delete process.env.CLAUDE_CMD_LANG;
		}

		// Clean up test directory completely
		try {
			await fileService.unlink(path.join(testDir, ".claude", "config.json"));
		} catch {
			// Ignore if file doesn't exist
		}
		try {
			await fileService.rmdir(path.join(testDir, ".claude"));
		} catch {
			// Ignore if directory doesn't exist
		}
		try {
			await fileService.rmdir(testDir);
		} catch {
			// Ignore if directory doesn't exist
		}

		// Also clean up user config directory if it was created
		try {
			const services = getServices();
			const userConfigPath = services.userConfigService.getConfigPath();
			await fileService.unlink(userConfigPath);

			// Try to remove the parent config directory if empty
			const parentDir = path.dirname(userConfigPath);
			await fileService.rmdir(parentDir);
		} catch {
			// Ignore if file/directory doesn't exist
		}
	});

	it("should work correctly when project config file doesn't exist", async () => {
		const services = getServices();

		// Verify file doesn't exist (we're in a fresh test directory)
		const fileExists = await fileService.exists(".claude/config.json");
		expect(fileExists).toBe(false);

		// Set up user config only
		await services.userConfigService.setLanguage("fr");

		// Project config doesn't exist - should return null
		const projectConfig =
			await services.projectConfigService.getProjectConfig();
		expect(projectConfig).toBeNull();

		// Should fall back to user config
		const effectiveLanguage =
			await services.userConfigService.getEffectiveLanguageWithProjectConfig(
				projectConfig,
			);
		expect(effectiveLanguage).toBe("fr");
	});

	it("should prioritize environment variable over project and user config", async () => {
		const services = getServices();

		// Set up user config
		await services.userConfigService.setLanguage("fr");

		// Set up project config
		await services.projectConfigService.setProjectConfig({
			preferredLanguage: "es",
		});

		// Set environment variable (should take precedence)
		process.env.CLAUDE_CMD_LANG = "de";

		// Get project config for integration test
		const projectConfig =
			await services.projectConfigService.getProjectConfig();

		const effectiveLanguage =
			await services.userConfigService.getEffectiveLanguageWithProjectConfig(
				projectConfig,
			);
		expect(effectiveLanguage).toBe("de"); // Environment wins
	});

	it("should prioritize project config over user config when no environment", async () => {
		const services = getServices();

		// Set up user config
		await services.userConfigService.setLanguage("fr");

		// Set up project config (should take precedence over user config)
		await services.projectConfigService.setProjectConfig({
			preferredLanguage: "es",
		});

		// Get project config for integration test
		const projectConfig =
			await services.projectConfigService.getProjectConfig();

		const effectiveLanguage =
			await services.userConfigService.getEffectiveLanguageWithProjectConfig(
				projectConfig,
			);
		expect(effectiveLanguage).toBe("es"); // Project config wins
	});

	it("should fall back to user config when project config has no language preference", async () => {
		const services = getServices();

		// Set up user config
		await services.userConfigService.setLanguage("fr");

		// Set up project config without language preference
		await services.projectConfigService.setProjectConfig({
			otherSetting: "value",
		});

		// Get project config for integration test
		const projectConfig =
			await services.projectConfigService.getProjectConfig();

		const effectiveLanguage =
			await services.userConfigService.getEffectiveLanguageWithProjectConfig(
				projectConfig,
			);
		expect(effectiveLanguage).toBe("fr"); // User config wins
	});

	it("should handle project config validation correctly", async () => {
		const services = getServices();

		// Test valid project config
		const validConfig = { preferredLanguage: "es" };
		await services.projectConfigService.setProjectConfig(validConfig);

		const retrievedConfig =
			await services.projectConfigService.getProjectConfig();
		expect(retrievedConfig).toEqual(validConfig);

		// Test invalid project config (should throw)
		const invalidConfig = { preferredLanguage: "invalid-lang" };
		await expect(
			services.projectConfigService.setProjectConfig(invalidConfig),
		).rejects.toThrow();
	});

	it("should merge project and user configurations correctly", async () => {
		const services = getServices();

		// Set up user config with multiple settings
		await services.userConfigService.setLanguage("fr");

		// Set up project config that overrides some settings
		const projectConfig = {
			preferredLanguage: "es",
			projectSetting: "value",
		};
		await services.projectConfigService.setProjectConfig(projectConfig);

		// Get user config (simulated as it would come from UserConfigService)
		const userConfig = {
			preferredLanguage: await services.userConfigService.getCurrentLanguage(),
			userSetting: "userValue",
		};

		const mergedConfig = services.projectConfigService.mergeConfigs(
			projectConfig,
			userConfig,
		);

		expect(mergedConfig).toEqual({
			preferredLanguage: "es", // Project takes precedence
			projectSetting: "value", // From project
			userSetting: "userValue", // From user
		});
	});

	it("should handle corrupted project config gracefully", async () => {
		const services = getServices();

		// Set up user config
		await services.userConfigService.setLanguage("fr");

		// Create corrupted project config
		await fileService.mkdir(".claude");
		await fileService.writeFile(".claude/config.json", "invalid json");

		// Should return null for corrupted config
		const projectConfig =
			await services.projectConfigService.getProjectConfig();
		expect(projectConfig).toBeNull();

		// Should fall back to user config
		const effectiveLanguage =
			await services.userConfigService.getEffectiveLanguageWithProjectConfig(
				projectConfig,
			);
		expect(effectiveLanguage).toBe("fr");
	});

	it("should support complete precedence chain in realistic scenario", async () => {
		const services = getServices();

		// Set up all configuration sources
		await services.userConfigService.setLanguage("fr"); // User preference
		await services.projectConfigService.setProjectConfig({
			preferredLanguage: "es",
		}); // Project preference
		process.env.CLAUDE_CMD_LANG = "de"; // Environment variable

		// Get project config
		const projectConfig =
			await services.projectConfigService.getProjectConfig();

		// Environment should win
		const effectiveLanguage =
			await services.userConfigService.getEffectiveLanguageWithProjectConfig(
				projectConfig,
			);
		expect(effectiveLanguage).toBe("de");

		// Remove environment variable
		delete process.env.CLAUDE_CMD_LANG;

		// Project config should now win
		const effectiveLanguage2 =
			await services.userConfigService.getEffectiveLanguageWithProjectConfig(
				projectConfig,
			);
		expect(effectiveLanguage2).toBe("es");

		// Remove project config by setting it to empty
		await services.projectConfigService.setProjectConfig({});
		const emptyProjectConfig =
			await services.projectConfigService.getProjectConfig();

		// User config should now win
		const effectiveLanguage3 =
			await services.userConfigService.getEffectiveLanguageWithProjectConfig(
				emptyProjectConfig,
			);
		expect(effectiveLanguage3).toBe("fr");
	});
});
