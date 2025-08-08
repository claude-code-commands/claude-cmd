import { beforeEach, describe, expect, it } from "bun:test";
import { exec } from "child_process";
import path from "node:path";
import { promisify } from "node:util";
import InMemoryFileService from "../mocks/InMemoryFileService.js";

const execAsync = promisify(exec);

/**
 * Integration tests for enhanced info command functionality
 * Tests the dual-source lookup with priority handling and source attribution
 */
describe("CLI Info Command Enhanced Integration", () => {
	const CLI_SCRIPT = path.join(process.cwd(), "dist", "main.js");
	const TEST_TIMEOUT = 10000;
	let fileService: InMemoryFileService;

	beforeEach(() => {
		fileService = new InMemoryFileService();
	});

	it("should display enhanced info for repository commands", async () => {
		const { stdout } = await execAsync(`bun "${CLI_SCRIPT}" info debug-help --force`, {
			env: { ...process.env, CLAUDECODE: "1" },
			timeout: TEST_TIMEOUT,
		});

		expect(stdout).toContain("Command: debug-help");
		expect(stdout).toContain("Source: repository");
		expect(stdout).toContain("Installation Status: Not installed");
	}, TEST_TIMEOUT);

	it("should show help for info command", async () => {
		const { stdout } = await execAsync(`bun "${CLI_SCRIPT}" info --help`, {
			env: { ...process.env, CLAUDECODE: "1" },
			timeout: TEST_TIMEOUT,
		});

		expect(stdout).toContain("info");
		expect(stdout).toContain("command-name");
		expect(stdout).toContain("--detailed");
		expect(stdout).toContain("--language");
		expect(stdout).toContain("--force");
	}, TEST_TIMEOUT);

	it("should handle non-existent commands gracefully", async () => {
		try {
			await execAsync(`bun "${CLI_SCRIPT}" info nonexistent-command-xyz --force`, {
				env: { ...process.env, CLAUDECODE: "1" },
				timeout: TEST_TIMEOUT,
			});
			// If we reach here, the command didn't fail as expected
			expect(true).toBe(false);
		} catch (error: any) {
			expect(error.stderr || error.stdout).toContain("not found");
		}
	}, TEST_TIMEOUT);

	it("should display detailed content when --detailed flag is used", async () => {
		const { stdout } = await execAsync(`bun "${CLI_SCRIPT}" info debug-help --detailed --force`, {
			env: { ...process.env, CLAUDECODE: "1" },
			timeout: TEST_TIMEOUT,
		});

		expect(stdout).toContain("Command: debug-help");
		expect(stdout).toContain("--- Command Content ---");
	}, TEST_TIMEOUT);

	it("should respect language option", async () => {
		const { stdout } = await execAsync(`bun "${CLI_SCRIPT}" info debug-help --language en --force`, {
			env: { ...process.env, CLAUDECODE: "1" },
			timeout: TEST_TIMEOUT,
		});

		expect(stdout).toContain("Command: debug-help");
		expect(stdout).toContain("Language: en");
	}, TEST_TIMEOUT);
});