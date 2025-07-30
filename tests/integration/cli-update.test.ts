import { describe, expect, it } from "bun:test";
import { runCli } from "../testUtils.ts";

describe("CLI Update Command Integration", () => {
	it("should display help for update command", async () => {
		const { result, stdout } = await runCli(["update", "--help"]);

		expect(result).toBe(0);
		expect(stdout).toContain(
			"Refresh the cached command manifest from the repository",
		);
		expect(stdout).toContain("--lang");
	});

	it("should handle basic update command execution", async () => {
		const { result, stdout } = await runCli(["update"]);

		expect(result).toBe(0);
		expect(stdout).toContain("Updating command manifest");
	});

	it("should handle update command with language option", async () => {
		const { result, stdout } = await runCli(["update", "--lang", "en"]);

		expect(result).toBe(0);
		expect(stdout).toContain("Updating command manifest");
		expect(stdout).toContain("Using language: en");
	});

	it("should handle update command with short language option (-l)", async () => {
		const { result, stdout } = await runCli(["update", "-l", "en"]);

		expect(result).toBe(0);
		expect(stdout).toContain("Updating command manifest");
		expect(stdout).toContain("Using language: en");
	});

	it("should handle error for unsupported language gracefully", async () => {
		const { result, stderr } = await runCli([
			"update",
			"--lang",
			"nonexistent",
		]);

		expect(result).toBe(1);
		expect(stderr).toContain("Error updating command manifest");
		expect(stderr).toContain(
			'Failed to retrieve manifest for language "nonexistent"',
		);
	});
});
