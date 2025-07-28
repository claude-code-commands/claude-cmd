import { describe, expect, it } from "bun:test";
import { spawn } from "bun";

async function runCli(args: string[]) {
	const proc = spawn(["bun", "run", "src/main.ts", ...args], {
		stdout: "pipe",
		stderr: "pipe",
	});
	const stdout = await new Response(proc.stdout).text();
	const stderr = await new Response(proc.stderr).text();
	await proc.exited;
	return { stdout, stderr };
}

describe("CLI Help Integration", () => {
	it("should display help when no arguments provided", async () => {
		const { stdout, stderr } = await runCli(["--help"]);

		// Should display basic help information
		expect(stdout).toContain(
			"claude-cmd is a CLI tool that helps you discover, install, and manage",
		);
		expect(stdout).toContain("Usage:");
		expect(stdout).toContain("Commands:");
		expect(stdout).toContain("add");
		expect(stdout).toContain("list");
		expect(stdout).toContain("search");
		expect(stdout).toContain("Options:");
		expect(stdout).toContain("--help");
		expect(stdout).toContain("--version");

		// Should not have errors
		expect(stderr).toBe("");
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

	it("should display help for specific command", async () => {
		const { stdout, stderr } = await runCli(["add", "--help"]);

		// Should display add command help
		expect(stdout).toContain("Usage: claude-cmd add [options] <command-name>");
		expect(stderr).toBe("");
	});
});
