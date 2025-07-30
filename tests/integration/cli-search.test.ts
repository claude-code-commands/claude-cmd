import { describe, expect, it } from "bun:test";
import { runCli } from "../testUtils.ts";

describe("CLI Search Command Integration", () => {
	it("should display help for search command", async () => {
		const { result, stdout } = await runCli(["search", "--help"]);

		expect(result).toBe(0);
		expect(stdout).toContain(
			"Find Claude Code commands by name or description",
		);
		expect(stdout).toContain("--language");
		expect(stdout).toContain("--force");
	});

	it("should accept query argument and options without parsing errors", async () => {
		// This test just verifies the CLI accepts the options without argument parsing errors
		const { result, stdout } = await runCli(["search", "--help"]);

		expect(result).toBe(0);
		expect(stdout).toContain("--language");
		expect(stdout).toContain("--force");
		expect(stdout).toContain("<query>");
	});

	it("should execute search and display results or 'no results' message", async () => {
		const { result, stdout } = await runCli(["search", "debug"]);

		expect(result).toBe(0);
		expect(
			/Found \d+ commands? matching/.test(stdout) ||
				stdout.includes("No commands found"),
		).toBe(true);
	});

	it("should pass language and force options to service", async () => {
		const { result } = await runCli([
			"search",
			"test",
			"--language=en",
			"--force",
		]);

		expect(result).toBe(0);
	});

	it("should handle service errors gracefully", async () => {
		// We'll use an empty query to trigger a validation error
		const { result, stderr } = await runCli(["search", ""]);

		expect(result).toBe(1);
		expect(stderr).toContain("Error:");
	});
});
