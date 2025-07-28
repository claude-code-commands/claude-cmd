import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "bun";

describe("CLI Language Command Integration", () => {
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

	describe("language list", () => {
		it("should display help for language list command", async () => {
			const proc = spawn(["bun", cliPath, "language", "list", "--help"]);
			const result = await proc.exited;
			const output = await new Response(proc.stdout).text();

			expect(result).toBe(0);
			expect(output).toContain("List available languages and show current language setting");
		});

		it("should display available languages", async () => {
			const proc = spawn(["bun", cliPath, "language", "list"]);
			const result = await proc.exited;
			const output = await new Response(proc.stdout).text();

			expect(result).toBe(0);
			expect(output).toContain("Available languages:");
			expect(output).toContain("Current language:");
		});

		it("should show English as available language", async () => {
			const proc = spawn(["bun", cliPath, "language", "list"]);
			const result = await proc.exited;
			const output = await new Response(proc.stdout).text();

			expect(result).toBe(0);
			expect(output).toContain("en");
			expect(output).toContain("English");
		});
	});

	describe("language set", () => {
		it("should display help for language set command", async () => {
			const proc = spawn(["bun", cliPath, "language", "set", "--help"]);
			const result = await proc.exited;
			const output = await new Response(proc.stdout).text();

			expect(result).toBe(0);
			expect(output).toContain("Set the preferred language for command retrieval");
			expect(output).toContain("<language>");
		});

		it("should set language preference successfully", async () => {
			const proc = spawn(["bun", cliPath, "language", "set", "fr"]);
			const result = await proc.exited;
			const output = await new Response(proc.stdout).text();

			expect(result).toBe(0);
			expect(output).toContain("Language preference set to: fr");
		});

		it("should reject invalid language codes", async () => {
			const proc = spawn(["bun", cliPath, "language", "set", "invalid"]);
			const result = await proc.exited;
			const stderr = await new Response(proc.stderr).text();

			expect(result).toBe(1);
			expect(stderr).toContain("Invalid language code");
		});

		it("should require language argument", async () => {
			const proc = spawn(["bun", cliPath, "language", "set"]);
			const result = await proc.exited;
			const stderr = await new Response(proc.stderr).text();

			expect(result).toBe(1);
			expect(stderr).toContain("error: missing required argument 'language'");
		});
	});

	describe("language help", () => {
		it("should display help for language command", async () => {
			const proc = spawn(["bun", cliPath, "language", "--help"]);
			const result = await proc.exited;
			const output = await new Response(proc.stdout).text();

			expect(result).toBe(0);
			expect(output).toContain("Manage language settings for claude-cmd");
			expect(output).toContain("list");
			expect(output).toContain("set");
		});
	});
});