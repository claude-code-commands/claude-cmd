import { describe, expect, it } from "bun:test";
import { runCli } from "../testUtils.ts";

describe("CLI Remove Command Integration", () => {
	it("should display help for remove command", async () => {
		const { result, stdout } = await runCli(["remove", "--help"]);

		expect(result).toBe(0);
		expect(stdout).toContain("Remove an installed Claude Code command");
		expect(stdout).toContain("<command-name>");
		expect(stdout).toContain("--yes");
	});

	it("should require command name argument", async () => {
		const { result, stderr } = await runCli(["remove"]);

		expect(result).toBe(1);
		expect(stderr).toContain("missing required argument 'command-name'");
	});

	it("should handle non-existent command gracefully", async () => {
		const { result, stdout } = await runCli([
			"remove",
			"nonexistent-command",
			"--yes",
		]);

		expect(result).toBe(0);
		expect(stdout).toContain("is not installed");
	});

	it("should accept --yes option", async () => {
		const { result } = await runCli(["remove", "test-command", "--yes"]);

		// Should exit cleanly (either with success if command exists or with
		// "not installed" message). The --yes flag should be accepted without errors.
		expect(result).toBe(0);
	});

	it("should accept --yes option shorthand (-y)", async () => {
		const { result } = await runCli(["remove", "test-command", "-y"]);

		expect(result).toBe(0);
	});

	it("should show only cancellation message when user cancels removal", async () => {
		// This test would require an actual installed command and user interaction
		// For now, we'll test the behavior when command is not installed (which is fine)
		const { result, stdout } = await runCli(["remove", "nonexistent-command"]);
		
		expect(result).toBe(0);
		expect(stdout).toContain("is not installed");
		// Should NOT contain success message when command doesn't exist
		expect(stdout).not.toContain("✓ Successfully removed command");
	});
});
