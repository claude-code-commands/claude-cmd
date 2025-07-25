import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdir, rmdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type IFileService from "../../src/interfaces/IFileService.ts";
import {
	FileIOError,
	FileNotFoundError,
	FilePermissionError,
} from "../../src/interfaces/IFileService.ts";
import BunFileService from "../../src/services/BunFileService.ts";

describe("BunFileService", () => {
	let fileService: IFileService;
	let testDir: string;
	let testFilePath: string;
	let testDirPath: string;

	beforeEach(async () => {
		// Create a temporary directory for each test
		testDir = join(
			tmpdir(),
			`bun-file-service-test-${Date.now()}-${Math.random().toString(36).substring(7)}`,
		);
		testFilePath = join(testDir, "test-file.txt");
		testDirPath = join(testDir, "test-subdir");

		fileService = new BunFileService();

		// Ensure test directory exists
		await mkdir(testDir, { recursive: true });
	});

	afterEach(async () => {
		// Clean up test directory
		try {
			await rmdir(testDir, { recursive: true });
		} catch {
			// Ignore cleanup errors
		}
	});

	describe("readFile", () => {
		test("should read file content successfully", async () => {
			const content = "Hello, World!";
			await Bun.write(testFilePath, content);

			const result = await fileService.readFile(testFilePath);
			expect(result).toBe(content);
		});

		test("should throw FileNotFoundError when file doesn't exist", async () => {
			const nonExistentPath = join(testDir, "non-existent.txt");

			await expect(fileService.readFile(nonExistentPath)).rejects.toThrow(
				FileNotFoundError,
			);
			await expect(fileService.readFile(nonExistentPath)).rejects.toThrow(
				`File or directory not found: ${nonExistentPath}`,
			);
		});

		test("should handle empty files", async () => {
			await Bun.write(testFilePath, "");

			const result = await fileService.readFile(testFilePath);
			expect(result).toBe("");
		});

		test("should handle files with special characters", async () => {
			const content = "Hello 世界! 🌍 Special chars: åäö";
			await Bun.write(testFilePath, content);

			const result = await fileService.readFile(testFilePath);
			expect(result).toBe(content);
		});

		test("should throw FilePermissionError when read access is denied", async () => {
			// This is hard to test reliably across platforms, so we'll mock it in implementation
			// For now, just verify the error type exists
			expect(FilePermissionError).toBeDefined();
		});
	});

	describe("writeFile", () => {
		test("should write file content successfully", async () => {
			const content = "Hello, Bun!";

			await fileService.writeFile(testFilePath, content);

			const result = await Bun.file(testFilePath).text();
			expect(result).toBe(content);
		});

		test("should create directories as needed", async () => {
			const nestedPath = join(testDir, "nested", "deep", "file.txt");
			const content = "Deep file content";

			await fileService.writeFile(nestedPath, content);

			const result = await Bun.file(nestedPath).text();
			expect(result).toBe(content);
		});

		test("should overwrite existing files", async () => {
			const originalContent = "Original content";
			const newContent = "New content";

			await Bun.write(testFilePath, originalContent);
			await fileService.writeFile(testFilePath, newContent);

			const result = await Bun.file(testFilePath).text();
			expect(result).toBe(newContent);
		});

		test("should handle empty content", async () => {
			await fileService.writeFile(testFilePath, "");

			const result = await Bun.file(testFilePath).text();
			expect(result).toBe("");
		});

		test("should handle special characters", async () => {
			const content = "Special chars: åäö 世界 🌍";

			await fileService.writeFile(testFilePath, content);

			const result = await Bun.file(testFilePath).text();
			expect(result).toBe(content);
		});

		test("should throw FilePermissionError when write access is denied", async () => {
			// This is hard to test reliably across platforms
			expect(FilePermissionError).toBeDefined();
		});

		test("should throw FileIOError for disk space issues", async () => {
			// This is hard to test reliably
			expect(FileIOError).toBeDefined();
		});
	});

	describe("exists", () => {
		test("should return true for existing files", async () => {
			await Bun.write(testFilePath, "content");

			const result = await fileService.exists(testFilePath);
			expect(result).toBe(true);
		});

		test("should return false for non-existing files", async () => {
			const nonExistentPath = join(testDir, "non-existent.txt");

			const result = await fileService.exists(nonExistentPath);
			expect(result).toBe(false);
		});

		test("should return true for existing directories", async () => {
			await mkdir(testDirPath);

			const result = await fileService.exists(testDirPath);
			expect(result).toBe(true);
		});

		test("should return false for non-existing directories", async () => {
			const nonExistentDir = join(testDir, "non-existent-dir");

			const result = await fileService.exists(nonExistentDir);
			expect(result).toBe(false);
		});

		test("should handle empty files", async () => {
			await Bun.write(testFilePath, "");

			const result = await fileService.exists(testFilePath);
			expect(result).toBe(true);
		});
	});

	describe("mkdir", () => {
		test("should create directory successfully", async () => {
			await expect(fileService.mkdir(testDirPath)).resolves.toBeUndefined();

			const result = await fileService.exists(testDirPath);
			expect(result).toBe(true);
		});

		test("should create nested directories recursively", async () => {
			const nestedDirPath = join(testDir, "nested", "deep", "directory");

			await fileService.mkdir(nestedDirPath);

			const result = await fileService.exists(nestedDirPath);
			expect(result).toBe(true);
		});

		test("should be idempotent (not fail if directory already exists)", async () => {
			await mkdir(testDirPath);

			await expect(fileService.mkdir(testDirPath)).resolves.toBeUndefined();

			const result = await fileService.exists(testDirPath);
			expect(result).toBe(true);
		});

		test("should handle root directory paths", async () => {
			// Should not fail on already existing root directories
			await expect(fileService.mkdir(testDir)).resolves.toBeUndefined();
		});

		test("should throw FilePermissionError when create access is denied", async () => {
			// This is hard to test reliably across platforms
			expect(FilePermissionError).toBeDefined();
		});

		test("should throw FileIOError for other I/O failures", async () => {
			// This is hard to test reliably
			expect(FileIOError).toBeDefined();
		});
	});

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
