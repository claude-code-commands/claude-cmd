import { describe, it, expect, beforeEach } from "bun:test";
import { ProjectConfigService } from "../../src/services/ProjectConfigService.js";
import InMemoryFileService from "../mocks/InMemoryFileService.js";
import type IFileService from "../../src/interfaces/IFileService.js";

describe("ProjectConfigService", () => {
	let fileService: IFileService;
	let projectConfigService: ProjectConfigService;

	beforeEach(() => {
		fileService = new InMemoryFileService();
		projectConfigService = new ProjectConfigService(fileService);
	});

	describe("getProjectConfig", () => {
		it("should return null when .claude/config.json does not exist", async () => {
			const config = await projectConfigService.getProjectConfig();
			expect(config).toBeNull();
		});

		it("should return parsed config when .claude/config.json exists", async () => {
			const configData = {
				preferredLanguage: "fr",
			};
			await fileService.writeFile(".claude/config.json", JSON.stringify(configData));

			const config = await projectConfigService.getProjectConfig();
			expect(config).toEqual(configData);
		});

		it("should return null when .claude/config.json has invalid JSON", async () => {
			await fileService.writeFile(".claude/config.json", "invalid json");

			const config = await projectConfigService.getProjectConfig();
			expect(config).toBeNull();
		});

		it("should return null when file read fails", async () => {
			// Create directory to make file read fail
			await fileService.mkdir(".claude/config.json");

			const config = await projectConfigService.getProjectConfig();
			expect(config).toBeNull();
		});
	});

	describe("setProjectConfig", () => {
		it("should create .claude directory and write config", async () => {
			const config = { preferredLanguage: "es" };

			await projectConfigService.setProjectConfig(config);

			expect(await fileService.exists(".claude")).toBe(true);
			const written = await fileService.readFile(".claude/config.json");
			expect(JSON.parse(written)).toEqual(config);
		});

		it("should overwrite existing config", async () => {
			const initialConfig = { preferredLanguage: "fr" };
			const updatedConfig = { preferredLanguage: "de" };

			await projectConfigService.setProjectConfig(initialConfig);
			await projectConfigService.setProjectConfig(updatedConfig);

			const written = await fileService.readFile(".claude/config.json");
			expect(JSON.parse(written)).toEqual(updatedConfig);
		});

		it("should throw error when directory creation fails", async () => {
			// Create a file where directory should be
			await fileService.writeFile(".claude", "blocking file");

			const config = { preferredLanguage: "es" };
			await expect(projectConfigService.setProjectConfig(config)).rejects.toThrow();
		});

		it("should throw error when file write fails", async () => {
			// Mock fileService to simulate write failure
			const mockFileService = {
				...fileService,
				writeFile: async () => {
					throw new Error("Write failed");
				},
			} as IFileService;

			const service = new ProjectConfigService(mockFileService);
			const config = { preferredLanguage: "es" };

			await expect(service.setProjectConfig(config)).rejects.toThrow("Failed to save project configuration");
		});
	});

	describe("mergeConfigs", () => {
		it("should return project config when user config is null", () => {
			const projectConfig = { preferredLanguage: "fr" };
			const merged = projectConfigService.mergeConfigs(projectConfig, null);
			expect(merged).toEqual(projectConfig);
		});

		it("should return user config when project config is null", () => {
			const userConfig = { preferredLanguage: "en" };
			const merged = projectConfigService.mergeConfigs(null, userConfig);
			expect(merged).toEqual(userConfig);
		});

		it("should return empty object when both configs are null", () => {
			const merged = projectConfigService.mergeConfigs(null, null);
			expect(merged).toEqual({});
		});

		it("should prioritize project config over user config for same keys", () => {
			const projectConfig = { preferredLanguage: "fr" };
			const userConfig = { preferredLanguage: "en" };
			const merged = projectConfigService.mergeConfigs(projectConfig, userConfig);
			expect(merged).toEqual({ preferredLanguage: "fr" });
		});

		it("should merge different keys from both configs", () => {
			const projectConfig = { preferredLanguage: "fr" };
			const userConfig = { customField: "value" };
			const merged = projectConfigService.mergeConfigs(projectConfig, userConfig);
			expect(merged).toEqual({ 
				preferredLanguage: "fr",
				customField: "value" 
			});
		});

		it("should handle nested object merging", () => {
			const projectConfig = { 
				preferredLanguage: "fr",
				settings: { theme: "dark" }
			};
			const userConfig = { 
				preferredLanguage: "en",
				settings: { fontSize: 12 }
			};
			const merged = projectConfigService.mergeConfigs(projectConfig, userConfig);
			expect(merged).toEqual({
				preferredLanguage: "fr", // project wins
				settings: { theme: "dark", fontSize: 12 } // nested objects merge
			});
		});
	});

	describe("validateConfig", () => {
		it("should return true for valid language config", () => {
			const config = { preferredLanguage: "fr" };
			expect(projectConfigService.validateConfig(config)).toBe(true);
		});

		it("should return true for empty config", () => {
			const config = {};
			expect(projectConfigService.validateConfig(config)).toBe(true);
		});

		it("should return false for invalid language code", () => {
			const config = { preferredLanguage: "invalid-lang" };
			expect(projectConfigService.validateConfig(config)).toBe(false);
		});

		it("should return false for non-string language", () => {
			const config = { preferredLanguage: 123 };
			expect(projectConfigService.validateConfig(config)).toBe(false);
		});

		it("should return true for unknown fields (forward compatibility)", () => {
			const config = { 
				preferredLanguage: "fr",
				unknownField: "value"
			};
			expect(projectConfigService.validateConfig(config)).toBe(true);
		});
	});

	describe("getConfigPath", () => {
		it("should return correct config path", () => {
			const path = projectConfigService.getConfigPath();
			expect(path).toBe(".claude/config.json");
		});
	});
});