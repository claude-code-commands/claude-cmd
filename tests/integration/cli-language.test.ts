import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { getServices } from "../../src/services/serviceFactory.js";
import { runCli } from "../testUtils.ts";

describe("CLI Language Command Integration", () => {
	describe("language list", () => {
		it("should display help for language list command", async () => {
			const { result, stdout } = await runCli(["language", "list", "--help"]);

			expect(result).toBe(0);
			expect(stdout).toContain(
				"List available languages and show current language setting",
			);
		});

		it("should display available languages", async () => {
			const { result, stdout } = await runCli(["language", "list"]);

			expect(result).toBe(0);
			// Check for either format (repository languages or common languages)
			expect(stdout).toMatch(/Repository languages:|Common languages/);
			expect(stdout).toContain("Current language:");
		});

		it("should show English as available language", async () => {
			const { result, stdout } = await runCli(["language", "list"]);

			expect(result).toBe(0);
			expect(stdout).toContain("en");
			expect(stdout).toContain("English");
		});
	});

	describe("language set", () => {
		let currentLang: string;
		let validLanguages: string[];

		beforeEach(async () => {
			// Use known valid languages for testing
			validLanguages = ["en", "fr", "es"];

			const { result: listResult, stdout: listStdout } = await runCli([
				"language",
				"list",
			]);
			expect(listResult).toBe(0);
			const detectedLang =
				listStdout.match(/Current language: (\w{2,3})/)?.[1] || "en";

			// Only use valid languages, default to "en" for invalid/unsupported ones
			if (detectedLang === "not" || !validLanguages.includes(detectedLang)) {
				currentLang = "en";
			} else {
				currentLang = detectedLang;
			}
		});

		afterEach(async () => {
			const { result: resetResult, stdout: resetStdout } = await runCli([
				"language",
				"set",
				currentLang,
			]);
			expect(resetResult).toBe(0);
			expect(resetStdout).toContain(
				`Language preference set to: ${currentLang}`,
			);
		});

		it("should display help for language set command", async () => {
			const { result, stdout } = await runCli(["language", "set", "--help"]);

			expect(result).toBe(0);
			expect(stdout).toContain(
				"Set the preferred language for command retrieval",
			);
			expect(stdout).toContain("<language>");
		});

		it("should set language preference successfully", async () => {
			const { result, stdout } = await runCli(["language", "set", "fr"]);

			expect(result).toBe(0);
			expect(stdout).toContain("Language preference set to: fr");
		});

		it("should reject invalid language codes", async () => {
			const { result, stderr } = await runCli(["language", "set", "invalid"]);

			expect(result).toBe(1);
			expect(stderr).toContain("Invalid configuration");
		});

		it("should require language argument", async () => {
			const { result, stderr } = await runCli(["language", "set"]);

			expect(result).toBe(1);
			expect(stderr).toContain("error: missing required argument 'language'");
		});
	});

	describe("language help", () => {
		it("should display help for language command", async () => {
			const { result, stdout } = await runCli(["language", "--help"]);

			expect(result).toBe(0);
			expect(stdout).toContain("Manage language settings for claude-cmd");
			expect(stdout).toContain("list");
			expect(stdout).toContain("set");
		});
	});
});
