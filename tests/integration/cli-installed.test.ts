import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "bun";
import { spawnWithSandbox } from "../testUtils.ts";

describe("CLI Installed Command Integration", () => {
	let tempDir: string;
	const cliPath = join(import.meta.dir, "../../src/main.ts");

	beforeEach(async () => {
		tempDir = await mkdtemp(join(tmpdir(), "claude-cmd-test-"));
	});

	afterEach(async () => {
		await rm(tempDir, { recursive: true, force: true });
	});

	it("should display help for installed command", async () => {
		const proc = spawn(["bun", cliPath, "installed", "--help"]);
		const result = await proc.exited;
		const output = await new Response(proc.stdout).text();

		expect(result).toBe(0);
		expect(output).toContain(
			"List displays all installed Claude Code slash commands",
		);
		expect(output).toContain("--language");
		expect(output).toContain("--force");
	});

	it("should execute installed command and show installed commands or empty message", async () => {
		const proc = spawnWithSandbox(["bun", cliPath, "installed"], tempDir);
		const result = await proc.exited;
		const output = await new Response(proc.stdout).text();

		expect(result).toBe(0);
		// Should either show installed commands or "No commands are currently installed"
		expect(
			output.includes("Claude Code Commands") ||
				output.includes("No commands are currently installed"),
		).toBe(true);
	});

	it("should accept language option", async () => {
		const proc = spawnWithSandbox(
			["bun", cliPath, "installed", "--language", "en"],
			tempDir,
		);
		const result = await proc.exited;

		expect(result).toBe(0);
	});

	it("should accept force option", async () => {
		const proc = spawnWithSandbox(
			["bun", cliPath, "installed", "--force"],
			tempDir,
		);
		const result = await proc.exited;

		expect(result).toBe(0);
	});
});
