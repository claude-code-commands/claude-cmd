import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "bun";
import { spawnWithSandbox } from "../testUtils.ts";

describe("CLI Add Command Integration", () => {
	let tempDir: string;
	const cliPath = join(import.meta.dir, "../../src/main.ts");

	beforeEach(async () => {
		tempDir = await mkdtemp(join(tmpdir(), "claude-cmd-test-"));
	});

	afterEach(async () => {
		await rm(tempDir, { recursive: true, force: true });
	});

	it("should display help for add command", async () => {
		const proc = spawn(["bun", cliPath, "add", "--help"]);
		const result = await proc.exited;
		const output = await new Response(proc.stdout).text();

		expect(result).toBe(0);
		expect(output).toContain(
			"Download and install a Claude Code slash command",
		);
		expect(output).toContain("<command-name>");
		expect(output).toContain("--force");
		expect(output).toContain("--language");
		expect(output).toContain("--target");
	});

	it("should require command name argument", async () => {
		const proc = spawn(["bun", cliPath, "add"]);
		const result = await proc.exited;

		expect(result).not.toBe(0);
		// Command should exit with non-zero status when missing required argument
	});

	it("should accept all valid options", async () => {
		// Test that the CLI accepts the options without parsing errors
		const proc = spawnWithSandbox(
			[
				"bun",
				cliPath,
				"add",
				"nonexistent-test-command",
				"--force",
				"--language",
				"en",
				"--target",
				"personal",
			],
			tempDir,
		);
		const result = await proc.exited;
		const stderr = await new Response(proc.stderr).text();

		// Should not fail due to argument parsing errors
		expect(result).not.toBe(127); // Not a command line parsing error
		expect(stderr).not.toMatch(/unknown option/i);
		expect(stderr).not.toMatch(/invalid option/i);
	});

	it("should handle target option values", async () => {
		// Test personal target
		const proc1 = spawnWithSandbox(
			["bun", cliPath, "add", "test-command", "--target", "personal"],
			tempDir,
		);
		const result1 = await proc1.exited;
		const stderr1 = await new Response(proc1.stderr).text();

		// Test project target
		const proc2 = spawnWithSandbox(
			["bun", cliPath, "add", "test-command", "--target", "project"],
			tempDir,
		);
		const result2 = await proc2.exited;
		const stderr2 = await new Response(proc2.stderr).text();

		// Both should accept the target options without argument parsing errors
		expect(result1).not.toBe(127);
		expect(result2).not.toBe(127);
		expect(stderr1).not.toMatch(/unknown option/i);
		expect(stderr2).not.toMatch(/unknown option/i);
	});
});
