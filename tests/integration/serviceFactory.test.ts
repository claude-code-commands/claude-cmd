import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import crypto from "node:crypto";
import path from "node:path";
import BunFileService from "../../src/services/BunFileService.js";
import {
	getServices,
	resetServices,
} from "../../src/services/serviceFactory.js";

describe("serviceFactory integration with ProjectConfigService", () => {
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
			"factory-test-" + crypto.randomUUID().slice(0, 8),
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

		// Clean up user config if created
		try {
			const services = getServices();
			const userConfigPath = services.userConfigService.getConfigPath();
			await fileService.unlink(userConfigPath);

			const parentDir = path.dirname(userConfigPath);
			await fileService.rmdir(parentDir);
		} catch {
			// Ignore if file/directory doesn't exist
		}
	});

	it("should create ProjectConfigService instance in services", () => {
		const services = getServices();
		expect(services.projectConfigService).toBeDefined();
		expect(typeof services.projectConfigService.getProjectConfig).toBe(
			"function",
		);
		expect(typeof services.projectConfigService.setProjectConfig).toBe(
			"function",
		);
		expect(typeof services.projectConfigService.mergeConfigs).toBe("function");
	});

	it("should return the same ProjectConfigService instance on multiple calls", () => {
		const services1 = getServices();
		const services2 = getServices();
		expect(services1.projectConfigService).toBe(services2.projectConfigService);
	});

	it("should create fresh ProjectConfigService instance after reset", () => {
		const services1 = getServices();
		resetServices();
		const services2 = getServices();
		expect(services1.projectConfigService).not.toBe(
			services2.projectConfigService,
		);
	});

	it("should integrate project config with language detection", async () => {
		const services = getServices();

		// Test that UserConfigService can work with project config
		const projectConfig = { preferredLanguage: "fr" };
		const effectiveLanguage =
			await services.userConfigService.getEffectiveLanguageWithProjectConfig(
				projectConfig,
			);

		expect(typeof effectiveLanguage).toBe("string");
		expect(effectiveLanguage.length).toBeGreaterThan(0);
	});

	it("should provide project config service with proper file service dependency", async () => {
		const services = getServices();

		// Test that ProjectConfigService can perform file operations
		const testConfig = { preferredLanguage: "es" };

		// This should not throw - the file service dependency should be properly injected
		await services.projectConfigService.setProjectConfig(testConfig);

		// Should be able to read back the config
		const retrievedConfig =
			await services.projectConfigService.getProjectConfig();
		expect(retrievedConfig).toEqual(testConfig);
	});
});
