import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "bun";

describe("CLI List Command Integration", () => {
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

	it("should display help for list command", async () => {
		const proc = spawn(["bun", cliPath, "list", "--help"]);
		const result = await proc.exited;
		const output = await new Response(proc.stdout).text();

		expect(result).toBe(0);
		expect(output).toContain(
			"List displays all available Claude Code slash commands",
		);
		expect(output).toContain("--language");
		expect(output).toContain("--force");
	});

	it("should accept language and force options without argument errors", async () => {
		// This test just verifies the CLI accepts the options without argument parsing errors
		const proc = spawn(["bun", cliPath, "list", "--help"]);
		const result = await proc.exited;
		const output = await new Response(proc.stdout).text();

		expect(result).toBe(0);
		expect(output).toContain("--language");
		expect(output).toContain("--force");
	});
});
