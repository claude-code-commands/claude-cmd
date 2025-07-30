import { describe, expect, it } from "bun:test";
import { runCli } from "../testUtils.ts";

describe("CLI Help Integration", () => {
	it("should display help when no arguments provided", async () => {
		const { result, stdout, stderr } = await runCli();

		// Should display basic help information
		expect(result).toBe(1);
		expect(stderr).toContain(
			"claude-cmd is a CLI tool that helps you discover, install, and manage",
		);
		expect(stderr).toContain("Usage:");
		expect(stderr).toContain("Commands:");
		expect(stderr).toContain("add");
		expect(stderr).toContain("list");
		expect(stderr).toContain("search");
		expect(stderr).toContain("Options:");
		expect(stderr).toContain("--help");
		expect(stderr).toContain("--version");

		// Should not have errors
		expect(stdout).toBe("");
	});

	it("should display help when --help flag is provided", async () => {
		const { stdout, stderr } = await runCli(["--help"]);

		// Should display the same help information
		expect(stdout).toContain(
			"claude-cmd is a CLI tool that helps you discover, install, and manage",
		);
		expect(stdout).toContain("Usage:");
		expect(stdout).toContain("Commands:");
		expect(stderr).toBe("");
	});

	it("should display version when --version flag is provided", async () => {
		const { stdout, stderr } = await runCli(["--version"]);

		// Should display version information
		expect(stdout).toMatch(/\d+\.\d+\.\d+/); // Version pattern
		expect(stderr).toBe("");
	});
});
