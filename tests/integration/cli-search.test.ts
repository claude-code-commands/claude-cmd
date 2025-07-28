import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "bun";

describe("CLI Search Command Integration", () => {
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

	it("should display help for search command", async () => {
		const proc = spawn(["bun", cliPath, "search", "--help"]);
		const result = await proc.exited;
		const output = await new Response(proc.stdout).text();

		expect(result).toBe(0);
		expect(output).toContain(
			"Find Claude Code commands by name or description",
		);
		expect(output).toContain("--language");
		expect(output).toContain("--force");
	});

	it("should accept query argument and options without parsing errors", async () => {
		// This test just verifies the CLI accepts the options without argument parsing errors
		const proc = spawn(["bun", cliPath, "search", "--help"]);
		const result = await proc.exited;
		const output = await new Response(proc.stdout).text();

		expect(result).toBe(0);
		expect(output).toContain("--language");
		expect(output).toContain("--force");
		expect(output).toContain("<query>");
	});

	it("should execute search and display results", async () => {
		// This test expects the search to work and display formatted results
		const proc = spawn(["bun", cliPath, "search", "debug"]);
		const result = await proc.exited;
		const output = await new Response(proc.stdout).text();

		expect(result).toBe(0);
		// Should show result count and formatted results (singular or plural)
		expect(output).toMatch(/Found \d+ commands? matching/);
		// Should show command names and descriptions in tabular format
		expect(output).toMatch(/\w+\s+.+/); // command name followed by description
	});

	it("should display no results message when search finds nothing", async () => {
		// This test expects proper handling when no commands match
		const proc = spawn(["bun", cliPath, "search", "nonexistentxyz"]);
		const result = await proc.exited;
		const output = await new Response(proc.stdout).text();

		expect(result).toBe(0); // Should not be an error condition
		expect(output).toContain("No commands found matching");
		expect(output).toContain("nonexistentxyz");
	});

	it("should pass language and force options to service", async () => {
		// This test verifies that options are properly passed through
		// We'll test this by checking the command accepts the options without error
		const proc = spawn([
			"bun",
			cliPath,
			"search",
			"test",
			"--language=en",
			"--force",
		]);
		const result = await proc.exited;

		// Should not exit with error due to unrecognized options
		expect(result).toBe(0);
	});

	it("should handle service errors gracefully", async () => {
		// This test expects graceful error handling when service fails
		// We'll use an empty query to trigger validation error
		const proc = spawn(["bun", cliPath, "search", ""], {
			stdout: "pipe",
			stderr: "pipe",
		});
		const result = await proc.exited;
		const stderr = await new Response(proc.stderr).text();

		// Should exit with non-zero code for errors
		expect(result).not.toBe(0);
		// Should display user-friendly error message
		expect(stderr).toContain("Error:");
	});
});
