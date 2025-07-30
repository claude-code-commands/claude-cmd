import { describe, expect, it } from "bun:test";
import { runCli } from "../testUtils.ts";

describe("CLI Add Command Integration", () => {
	it("should display help for add command", async () => {
		const { result, stdout } = await runCli(["add", "--help"]);

		expect(result).toBe(0);
		expect(stdout).toContain("Usage: claude-cmd add [options] <command-name>");
		expect(stdout).toContain(
			"Download and install a Claude Code slash command",
		);
		expect(stdout).toContain("<command-name>");
		expect(stdout).toContain("--force");
		expect(stdout).toContain("--language");
		expect(stdout).toContain("--target");
	});

	it("should require command name argument", async () => {
		const { result, stderr } = await runCli(["add"]);

		expect(result).toBe(1);
		expect(stderr).toContain("missing required argument 'command-name'");
	});

	it("should accept all valid options", async () => {
		// Test that the CLI accepts the options without parsing errors
		const { result, stderr } = await runCli([
			"add",
			"nonexistent-test-command",
			"--force",
			"--language",
			"en",
			"--target",
			"personal",
		]);

		// Should not fail due to argument parsing errors
		expect(result).toBe(1);
		expect(stderr).not.toMatch(/unknown option/i);
	});
});
