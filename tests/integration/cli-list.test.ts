import { describe, expect, it } from "bun:test";
import { runCli } from "../testUtils.ts";

describe("CLI List Command Integration", () => {
	it("should display help for list command", async () => {
		const { result, stdout } = await runCli(["list", "--help"]);

		expect(result).toBe(0);
		expect(stdout).toContain(
			"List displays all available Claude Code slash commands",
		);
		expect(stdout).toContain("--language");
		expect(stdout).toContain("--force");
	});

	it("should accept language and force options without argument errors", async () => {
		const { result } = await runCli(["list", "--language", "en", "--force"]);

		expect(result).toBe(0);
	});
});
