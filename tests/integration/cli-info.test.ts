import { describe, expect, it } from "bun:test";
import { runCli } from "../testUtils.ts";

describe("CLI Info Command Integration", () => {
	it("should require command name argument", async () => {
		const { result, stderr } = await runCli(["info"]);

		expect(result).toBe(1);
		expect(stderr).toContain("missing required argument 'command-name'");
	});

	it("should display help for info command", async () => {
		const { result, stdout } = await runCli(["info", "--help"]);

		expect(result).toBe(0);
		expect(stdout).toContain(
			"Display detailed information about a Claude Code slash command",
		);
		expect(stdout).toContain("--detailed");
		expect(stdout).toContain("<command-name>");
	});

	it("should accept detailed flag without argument errors", async () => {
		const { result, stderr } = await runCli(["info", "--detailed"]);

		expect(result).toBe(1);
		expect(stderr).not.toContain("--detailed");
	});
});
