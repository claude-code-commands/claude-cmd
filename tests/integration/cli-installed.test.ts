import { describe, expect, it } from "bun:test";
import { runCli } from "../testUtils.ts";

describe("CLI Installed Command Integration", () => {
	it("should display help for installed command", async () => {
		const { result, stdout } = await runCli(["installed", "--help"]);

		expect(result).toBe(0);
		expect(stdout).toContain(
			"List displays all installed Claude Code slash commands",
		);
		expect(stdout).toContain("--language");
		expect(stdout).toContain("--force");
	});

	it("should execute installed command and show installed commands or empty message", async () => {
		const { result, stdout } = await runCli(["installed"]);

		expect(result).toBe(0);
		expect(
			stdout.includes("Claude Code Commands") ||
				stdout.includes("No commands are currently installed"),
		).toBe(true);
	});

	it("should accept language option", async () => {
		const { result } = await runCli(["installed", "--language", "en"]);

		expect(result).toBe(0);
	});

	it("should accept force option", async () => {
		const { result } = await runCli(["installed", "--force"]);

		expect(result).toBe(0);
	});

	describe("Milestone 2.3: Enhanced Display Features", () => {
		it("should show location indicators for installed commands by default", async () => {
			const { result, stdout } = await runCli(["installed"]);

			expect(result).toBe(0);
			// Should show location indicators like [personal] or [project] by default
			if (!stdout.includes("No commands are currently installed")) {
				expect(stdout).toMatch(/\[(personal|project)\]/);
			}
		});

		it("should display summary information with command counts", async () => {
			const { result, stdout } = await runCli(["installed", "--summary"]);

			expect(result).toBe(0);
			// Should show summary info like "Personal: X, Project: Y"
			if (!stdout.includes("No commands are currently installed")) {
				expect(stdout).toMatch(/Personal: \d+|Project: \d+/);
			}
		});

		it("should show enhanced formatting with location information by default", async () => {
			const { result, stdout } = await runCli(["installed"]);

			expect(result).toBe(0);
			// Enhanced formatting should include location info by default
			if (!stdout.includes("No commands are currently installed")) {
				// Should show more detailed formatting than just "name\t\tdescription"
				expect(stdout).not.toMatch(/^[^[\n]*\t\t[^[\n]*$/m); // Old tab-separated format
			}
		});

		it("should support tree-like display for namespaced commands", async () => {
			const { result, stdout } = await runCli(["installed", "--tree"]);

			expect(result).toBe(0);
			// Should show hierarchical display for namespaced commands
			if (!stdout.includes("No commands are currently installed")) {
				// Look for tree-like structure with indentation or hierarchy
				expect(stdout).toMatch(/^[ ├└│]/m); // Tree characters or indentation
			}
		});

		it("should display location-specific counts in summary", async () => {
			const { result, stdout } = await runCli(["installed", "--summary"]);

			expect(result).toBe(0);
			if (!stdout.includes("No commands are currently installed")) {
				// Should show breakdown by location
				expect(stdout).toMatch(/Total: \d+/);
				expect(stdout).toMatch(/Personal: \d+/);
				expect(stdout).toMatch(/Project: \d+/);
			}
		});
	});
});
