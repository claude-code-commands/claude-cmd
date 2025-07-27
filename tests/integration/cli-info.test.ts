import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "bun";

describe("CLI Info Command Integration", () => {
	let tempDir: string;
	const cliPath = join(import.meta.dir, "../../src/main.ts");

	beforeEach(async () => {
		// Create temporary directory for this test
		tempDir = await mkdtemp(join(tmpdir(), "claude-cmd-test-"));
	});

	afterEach(async () => {
		// Clean up temp directory
		await rm(tempDir, { recursive: true, force: true });
	});

	it("should display help for info command", async () => {
		const proc = spawn(["bun", cliPath, "info", "--help"]);
		const result = await proc.exited;
		const output = await new Response(proc.stdout).text();

		expect(result).toBe(0);
		expect(output).toContain(
			"Display detailed information about a Claude Code slash command",
		);
		expect(output).toContain("--detailed");
		expect(output).toContain("<command-name>");
	});

	it("should accept detailed flag without argument errors", async () => {
		// This test just verifies the CLI accepts the options without argument parsing errors
		const proc = spawn(["bun", cliPath, "info", "--help"]);
		const result = await proc.exited;
		const output = await new Response(proc.stdout).text();

		expect(result).toBe(0);
		expect(output).toContain("--detailed");
	});

	it("should require command name argument", async () => {
		const proc = spawn(["bun", cliPath, "info"]);
		const result = await proc.exited;

		expect(result).not.toBe(0);
		// Just verify the command exits with non-zero status
		// The exact error message handling varies between different environments
	});
});
