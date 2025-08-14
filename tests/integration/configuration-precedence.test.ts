import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import crypto from "node:crypto";
import fs from "node:fs/promises";
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
			`test-${crypto.randomUUID().slice(0, 8)}`,
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

		// Clean up the test directory completely
		try {
			await fs.rm(testDir, { recursive: true, force: true });
		} catch (error) {
			console.error(`Failed to clean up test directory ${testDir}`, error);
		}
	});

	it("should work correctly when project config file doesn't exist", async () => {
		const services = getServices();

		// Verify file doesn't exist (we're in a fresh test directory)
		const fileExists = await fileService.exists(
			".claude/config.claude-cmd.json",
		);
		expect(fileExists).toBe(false);

		// Set up user config only
		await services.userConfigService.setConfig({ preferredLanguage: "fr" });

		// Project config doesn't exist - should return null
		const projectConfig = await services.projectConfigService.getConfig();
		expect(projectConfig).toBeNull();

		// Should fall back to user config
		const effectiveLanguage =
			await services.configManager.getEffectiveLanguage();
		expect(effectiveLanguage).toBe("fr");
	});

	it("should prioritize environment variable over project and user config", async () => {
		const services = getServices();

		// Set up user config
		await services.userConfigService.setConfig({ preferredLanguage: "fr" });

		// Set up project config
		await services.projectConfigService.setConfig({
			preferredLanguage: "es",
		});

		// Set environment variable (should take precedence)
		process.env.CLAUDE_CMD_LANG = "de";

		const effectiveLanguage =
			await services.configManager.getEffectiveLanguage();
		expect(effectiveLanguage).toBe("de"); // Environment wins
	});

	it("should prioritize project config over user config when no environment", async () => {
		const services = getServices();

		// Set up user config
		await services.userConfigService.setConfig({ preferredLanguage: "fr" });

		// Set up project config (should take precedence over user config)
		await services.projectConfigService.setConfig({
			preferredLanguage: "es",
		});

		const effectiveLanguage =
			await services.configManager.getEffectiveLanguage();
		expect(effectiveLanguage).toBe("es"); // Project config wins
	});

	it("should fall back to user config when project config has no language preference", async () => {
		const services = getServices();

		// Set up user config
		await services.userConfigService.setConfig({ preferredLanguage: "fr" });

		// Set up project config without language preference
		await services.projectConfigService.setConfig({
			otherSetting: "value",
		});

		const effectiveLanguage =
			await services.configManager.getEffectiveLanguage();
		expect(effectiveLanguage).toBe("fr"); // User config wins
	});

	it("should handle project config validation correctly", async () => {
		const services = getServices();

		// Test valid project config
		const validConfig = { preferredLanguage: "es" };
		await services.projectConfigService.setConfig(validConfig);

		const retrievedConfig = await services.projectConfigService.getConfig();
		expect(retrievedConfig).toEqual(validConfig);

		// Test invalid project config (should throw)
		const invalidConfig = { preferredLanguage: "invalid-lang" };
		await expect(
			services.projectConfigService.setConfig(invalidConfig),
		).rejects.toThrow();
	});

	it("should merge project and user configurations correctly", async () => {
		const services = getServices();

		// Set up user config with multiple settings
		const userConfig = {
			preferredLanguage: "fr",
			userSetting: "userValue",
		};
		await services.userConfigService.setConfig(userConfig);

		// Set up project config that overrides some settings
		const projectConfig = {
			preferredLanguage: "es",
			projectSetting: "value",
		};
		await services.projectConfigService.setConfig(projectConfig);

		const effectiveConfig = await services.configManager.getEffectiveConfig();

		expect(effectiveConfig).toEqual({
			preferredLanguage: "es", // Project takes precedence
			projectSetting: "value", // From project
			userSetting: "userValue", // From user
		});
	});

	it("should handle corrupted project config gracefully", async () => {
		const services = getServices();

		// Set up user config
		await services.userConfigService.setConfig({ preferredLanguage: "fr" });

		// Create corrupted project config
		await fileService.mkdir(".claude");
		await fileService.writeFile(
			".claude/config.claude-cmd.json",
			"invalid json",
		);

		// Should return null for corrupted config
		const projectConfig = await services.projectConfigService.getConfig();
		expect(projectConfig).toBeNull();

		// Should fall back to user config
		const effectiveLanguage =
			await services.configManager.getEffectiveLanguage();
		expect(effectiveLanguage).toBe("fr");
	});

	it("should support complete precedence chain in realistic scenario", async () => {
		const services = getServices();

		// Set up all configuration sources
		await services.userConfigService.setConfig({ preferredLanguage: "fr" }); // User preference
		await services.projectConfigService.setConfig({
			preferredLanguage: "es",
		}); // Project preference
		process.env.CLAUDE_CMD_LANG = "de"; // Environment variable

		// Environment should win
		const effectiveLanguage =
			await services.configManager.getEffectiveLanguage();
		expect(effectiveLanguage).toBe("de");

		// Remove environment variable
		delete process.env.CLAUDE_CMD_LANG;

		// Project config should now win
		const effectiveLanguage2 =
			await services.configManager.getEffectiveLanguage();
		expect(effectiveLanguage2).toBe("es");

		// Remove project config by setting it to empty
		await services.projectConfigService.setConfig({});

		// User config should now win
		const effectiveLanguage3 =
			await services.configManager.getEffectiveLanguage();
		expect(effectiveLanguage3).toBe("fr");
	});
});
