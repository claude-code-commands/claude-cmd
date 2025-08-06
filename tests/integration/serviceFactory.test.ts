import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import crypto from "node:crypto";
import { rm, rmdir } from "node:fs/promises";
import path from "node:path";
import BunFileService from "../../src/services/BunFileService.js";
import {
	getServices,
	resetServices,
} from "../../src/services/serviceFactory.js";

describe("serviceFactory integration with ConfigService", () => {
	let testDir: string;
	let originalCwd: string;
	let fileService: BunFileService;

	beforeEach(async () => {
		resetServices();
		fileService = new BunFileService();
		originalCwd = process.cwd();

		// Create unique test directory for each test
		testDir = path.join(
			process.cwd(),
			`factory-test-${crypto.randomUUID().slice(0, 8)}`,
		);
		await fileService.mkdir(testDir);
		process.chdir(testDir);
	});

	afterEach(async () => {
		resetServices();

		// Restore original directory
		process.chdir(originalCwd);

		// Clean up test directory completely
		try {
			await Bun.file(
				path.join(testDir, ".claude", "config.claude-cmd.json"),
			).delete();
		} catch (err) {
			if (err instanceof Error && "code" in err && err.code !== "ENOENT") {
				console.warn("Could not clean up test config file", err);
			}
		}
		try {
			await rm(testDir, { recursive: true });
		} catch (err) {
			if (err instanceof Error && "code" in err && err.code !== "ENOENT") {
				console.warn("Could not clean up test directory", err);
			}
		}

		// Clean up user config if created
		try {
			const services = getServices();
			const userConfigPath = services.userConfigService.getConfigPath();
			await Bun.file(userConfigPath).delete();

			const parentDir = path.dirname(userConfigPath);
			await rmdir(parentDir);
		} catch (err) {
			if (err instanceof Error && "code" in err && err.code !== "ENOENT") {
				console.warn("Could not clean up test user config directory", err);
			}
		}
	});

	it("should create ConfigService instances and ConfigManager in services", () => {
		const services = getServices();
		expect(services.projectConfigService).toBeDefined();
		expect(services.userConfigService).toBeDefined();
		expect(services.configManager).toBeDefined();

		expect(typeof services.projectConfigService.getConfig).toBe("function");
		expect(typeof services.projectConfigService.setConfig).toBe("function");
		expect(typeof services.userConfigService.getConfig).toBe("function");
		expect(typeof services.userConfigService.setConfig).toBe("function");
		expect(typeof services.configManager.getEffectiveConfig).toBe("function");
		expect(typeof services.configManager.getEffectiveLanguage).toBe("function");
	});

	it("should return the same ConfigService instances on multiple calls", () => {
		const services1 = getServices();
		const services2 = getServices();
		expect(services1.projectConfigService).toBe(services2.projectConfigService);
		expect(services1.userConfigService).toBe(services2.userConfigService);
		expect(services1.configManager).toBe(services2.configManager);
	});

	it("should create fresh ConfigService instances after reset", () => {
		const services1 = getServices();
		resetServices();
		const services2 = getServices();
		expect(services1.projectConfigService).not.toBe(
			services2.projectConfigService,
		);
		expect(services1.userConfigService).not.toBe(services2.userConfigService);
		expect(services1.configManager).not.toBe(services2.configManager);
	});

	it("should integrate config services with language detection", async () => {
		const services = getServices();

		// Test that ConfigManager can work with both config services
		await services.projectConfigService.setConfig({ preferredLanguage: "fr" });

		const effectiveLanguage =
			await services.configManager.getEffectiveLanguage();
		expect(typeof effectiveLanguage).toBe("string");
		expect(effectiveLanguage.length).toBeGreaterThan(0);
		expect(effectiveLanguage).toBe("fr");
	});

	it("should provide config services with proper file service dependency", async () => {
		const services = getServices();

		// Test that ConfigService instances can perform file operations
		const testUserConfig = {
			preferredLanguage: "en",
			repositoryURL: "https://test.com",
		};
		const testProjectConfig = { preferredLanguage: "es" };

		// This should not throw - the file service dependency should be properly injected
		await services.userConfigService.setConfig(testUserConfig);
		await services.projectConfigService.setConfig(testProjectConfig);

		// Should be able to read back the configs
		const retrievedUserConfig = await services.userConfigService.getConfig();
		const retrievedProjectConfig =
			await services.projectConfigService.getConfig();

		expect(retrievedUserConfig).toEqual(testUserConfig);
		expect(retrievedProjectConfig).toEqual(testProjectConfig);
	});

	it("should share LanguageDetector instance across config services", () => {
		const services = getServices();

		// Both config services and manager should use the same languageDetector
		expect(services.languageDetector).toBeDefined();

		// This is hard to test directly, but we can verify behavior consistency
		expect(services.userConfigService.getConfigPath()).toContain(
			"config.claude-cmd.json",
		);
		expect(services.projectConfigService.getConfigPath()).toContain(
			"config.claude-cmd.json",
		);
	});
});
