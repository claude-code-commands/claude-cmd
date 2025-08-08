import { beforeEach, describe, expect, it } from "bun:test";
import { runCli } from "../testUtils.ts";
import InMemoryFileService from "../mocks/InMemoryFileService.js";

/**
 * Integration tests for enhanced info command functionality
 * Tests the dual-source lookup with priority handling and source attribution
 */
describe("CLI Info Command Enhanced Integration", () => {
	let fileService: InMemoryFileService;

	beforeEach(() => {
		fileService = new InMemoryFileService();
	});

	it("should display enhanced info for repository commands", async () => {
		const { stdout } = await runCli(["info", "debug-help", "--force"]);

		expect(stdout).toContain("Command: debug-help");
		expect(stdout).toContain("Source: repository");
		expect(stdout).toContain("Installation Status: Not installed");
	});

	it("should show help for info command", async () => {
		const { stdout } = await runCli(["info", "--help"]);

		expect(stdout).toContain("info");
		expect(stdout).toContain("command-name");
		expect(stdout).toContain("--detailed");
		expect(stdout).toContain("--language");
		expect(stdout).toContain("--force");
	});

	it("should handle non-existent commands gracefully", async () => {
		const { result, stderr, stdout } = await runCli(["info", "nonexistent-command-xyz", "--force"]);

		expect(result).toBe(1);
		expect(stderr || stdout).toContain("not found");
	});

	it("should display detailed content when --detailed flag is used", async () => {
		const { stdout } = await runCli(["info", "debug-help", "--detailed", "--force"]);

		expect(stdout).toContain("Command: debug-help");
		expect(stdout).toContain("--- Command Content ---");
	});

	it("should respect language option", async () => {
		const { stdout } = await runCli(["info", "debug-help", "--language", "en", "--force"]);

		expect(stdout).toContain("Command: debug-help");
		expect(stdout).toContain("Language: en");
	});
});