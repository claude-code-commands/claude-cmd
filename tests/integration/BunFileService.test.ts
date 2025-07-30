import { describe, expect, test } from "bun:test";
import { mkdir, rmdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	FileIOError,
	FileNotFoundError,
	FilePermissionError,
} from "../../src/interfaces/IFileService.ts";
import BunFileService from "../../src/services/BunFileService.ts";
import { createFileServiceContractTests } from "../shared/IFileService.contract.ts";

describe("BunFileService", () => {
	// Run the shared contract tests for BunFileService
	describe("Contract Tests", () => {
		createFileServiceContractTests(
			async () => {
				// Create a temporary directory for each test
				const testDir = join(
					tmpdir(),
					`bun-file-service-test-${Date.now()}-${Math.random().toString(36).substring(7)}`,
				);

				// Ensure test directory exists
				await mkdir(testDir, { recursive: true });

				// Create file service scoped to test directory
				const service = new BunFileService();

				// Change working directory context for relative paths
				const originalCwd = process.cwd();
				process.chdir(testDir);

				const cleanup = async () => {
					// Restore original working directory
					process.chdir(originalCwd);
					// Clean up test directory
					try {
						await rmdir(testDir, { recursive: true });
					} catch {
						// Ignore cleanup errors
					}
				};

				return { service, cleanup };
			},
			{ isRealFileSystem: true },
		);
	});

	// BunFileService-specific tests for implementation details not covered by contract
	describe("BunFileService Specific Tests", () => {
		describe("error handling", () => {
			test("should properly extend Error classes", () => {
				const fileNotFound = new FileNotFoundError("/test/path");
				const permissionError = new FilePermissionError("/test/path", "read");
				const ioError = new FileIOError("/test/path", "disk full");

				expect(fileNotFound).toBeInstanceOf(Error);
				expect(fileNotFound).toBeInstanceOf(FileNotFoundError);
				expect(fileNotFound.path).toBe("/test/path");

				expect(permissionError).toBeInstanceOf(Error);
				expect(permissionError).toBeInstanceOf(FilePermissionError);
				expect(permissionError.path).toBe("/test/path");
				expect(permissionError.operation).toBe("read");

				expect(ioError).toBeInstanceOf(Error);
				expect(ioError).toBeInstanceOf(FileIOError);
				expect(ioError.path).toBe("/test/path");
				expect(ioError.cause).toBe("disk full");
			});
		});
	});
});
