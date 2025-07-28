import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "bun";
import { spawnWithSandbox } from "../testUtils.ts";

describe("CLI Remove Command Integration", () => {
	let tempDir: string;
	const cliPath = join(import.meta.dir, "../../src/main.ts");

	beforeEach(async () => {
		tempDir = await mkdtemp(join(tmpdir(), "claude-cmd-test-"));
	});

	afterEach(async () => {
		await rm(tempDir, { recursive: true, force: true });
	});

	it("should display help for remove command", async () => {
		const proc = spawn(["bun", cliPath, "remove", "--help"]);
		const result = await proc.exited;
		const output = await new Response(proc.stdout).text();

		expect(result).toBe(0);
		expect(output).toContain("Remove an installed Claude Code command");
		expect(output).toContain("<command-name>");
		expect(output).toContain("--yes");
	});

	it("should require command name argument", async () => {
		const proc = spawn(["bun", cliPath, "remove"]);
		const result = await proc.exited;

		expect(result).not.toBe(0);
		// Command should exit with non-zero status when missing required argument
	});

	it("should handle non-existent command gracefully", async () => {
		const proc = spawnWithSandbox(
			["bun", cliPath, "remove", "nonexistent-command", "--yes"],
			tempDir,
		);
		const result = await proc.exited;
		const output = await new Response(proc.stdout).text();

		expect(result).toBe(0);
		expect(output).toContain("is not installed");
	});

	it("should accept yes option", async () => {
		const proc = spawnWithSandbox(
			["bun", cliPath, "remove", "test-command", "--yes"],
			tempDir,
		);
		const result = await proc.exited;

		// Should exit cleanly (either with success if command exists or with
		// "not installed" message). The --yes flag should be accepted without errors.
		expect(result).toBe(0);
	});

	it("should accept yes option shorthand", async () => {
		const proc = spawnWithSandbox(
			["bun", cliPath, "remove", "test-command", "-y"],
			tempDir,
		);
		const result = await proc.exited;

		// Should accept the -y shorthand without argument parsing errors
		expect(result).toBe(0);
	});
});
