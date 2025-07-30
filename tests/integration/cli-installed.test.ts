import { describe, expect, it } from "bun:test";
import { runCli } from "../testUtils.ts";

describe("CLI Installed Command Integration", () => {
	it("should display help for installed command", async () => {
		const { result, stdout } = await runCli(["installed", "--help"]);

		expect(result).toBe(0);
		expect(stdout).toContain(
			"List displays all installed Claude Code slash commands",
		);
		expect(stdout).toContain("--language");
		expect(stdout).toContain("--force");
	});

	it("should execute installed command and show installed commands or empty message", async () => {
		const { result, stdout } = await runCli(["installed"]);

		expect(result).toBe(0);
		expect(
			stdout.includes("Claude Code Commands") ||
				stdout.includes("No commands are currently installed"),
		).toBe(true);
	});

	it("should accept language option", async () => {
		const { result } = await runCli(["installed", "--language", "en"]);

		expect(result).toBe(0);
	});

	it("should accept force option", async () => {
		const { result } = await runCli(["installed", "--force"]);

		expect(result).toBe(0);
	});
});
