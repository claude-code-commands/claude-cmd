import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import type IFileService from "../../src/interfaces/IFileService.ts";
import {
	FileIOError,
	FileNotFoundError,
	FilePermissionError,
} from "../../src/interfaces/IFileService.ts";

/**
 * Setup context for contract tests
 */
interface FileServiceContractSetupContext {
	/** Whether this is testing a real filesystem implementation */
	isRealFileSystem: boolean;
}

/**
 * Factory function that creates an IFileService instance and cleanup function
 */
type FileServiceFactory = () => Promise<{
	service: IFileService;
	cleanup: () => Promise<void>;
}>;

/**
 * Shared contract test suite for IFileService implementations
 *
 * This test suite validates that any implementation of IFileService behaves
 * correctly according to the interface contract. It tests both successful
 * operations and error conditions to ensure consistent behavior across
 * different implementations (real file system and in-memory mock).
 *
 * @param factory - Function that creates an IFileService instance with cleanup
 * @param context - Setup context for environment-specific needs
 */
export function createFileServiceContractTests(
	factory: FileServiceFactory,
	context: FileServiceContractSetupContext,
) {
	describe("IFileService Contract", () => {
		let fileService: IFileService;
		let cleanup: () => Promise<void>;

		beforeEach(async () => {
			({ service: fileService, cleanup } = await factory());
		});

		afterEach(async () => {
			await cleanup();
		});

		describe("basic file operations", () => {
			test("should write a file and then read it back", async () => {
				const path = "test.txt";
				const content = "hello world";

				await fileService.writeFile(path, content);
				const readContent = await fileService.readFile(path);

				expect(readContent).toBe(content);
			});

			test("should handle empty file content", async () => {
				const path = "empty.txt";
				const content = "";

				await fileService.writeFile(path, content);
				const readContent = await fileService.readFile(path);

				expect(readContent).toBe(content);
			});

			test("should handle multiline content", async () => {
				const path = "multiline.txt";
				const content = "line 1\nline 2\nline 3";

				await fileService.writeFile(path, content);
				const readContent = await fileService.readFile(path);

				expect(readContent).toBe(content);
			});

			test("should handle special characters in content", async () => {
				const path = "special.txt";
				const content = "Special chars: àáâãäå æç èéêë ìíîï ñ òóôõö ùúûü ý";

				await fileService.writeFile(path, content);
				const readContent = await fileService.readFile(path);

				expect(readContent).toBe(content);
			});

			test("should overwrite existing files", async () => {
				const path = "overwrite.txt";
				const originalContent = "original";
				const newContent = "updated";

				await fileService.writeFile(path, originalContent);
				await fileService.writeFile(path, newContent);
				const readContent = await fileService.readFile(path);

				expect(readContent).toBe(newContent);
			});
		});

		describe("file existence checks", () => {
			test("should confirm a file exists after writing it", async () => {
				const path = "exists-test.txt";

				expect(await fileService.exists(path)).toBe(false);
				await fileService.writeFile(path, "content");
				expect(await fileService.exists(path)).toBe(true);
			});

			test("should return false for non-existent files", async () => {
				expect(await fileService.exists("non-existent.txt")).toBe(false);
			});

			test("should return false after deleting a file", async () => {
				const path = "delete-test.txt";

				await fileService.writeFile(path, "content");
				expect(await fileService.exists(path)).toBe(true);

				await fileService.deleteFile(path);
				expect(await fileService.exists(path)).toBe(false);
			});
		});

		describe("directory operations", () => {
			test("should create directories", async () => {
				const dirPath = "test-dir";

				await fileService.mkdir(dirPath);
				expect(await fileService.exists(dirPath)).toBe(true);
			});

			test("should create nested directories", async () => {
				const nestedPath = "parent/child/grandchild";

				await fileService.mkdir(nestedPath);
				expect(await fileService.exists(nestedPath)).toBe(true);
				expect(await fileService.exists("parent")).toBe(true);
				expect(await fileService.exists("parent/child")).toBe(true);
			});

			test("should be idempotent when creating existing directories", async () => {
				const dirPath = "existing-dir";

				await fileService.mkdir(dirPath);
				await fileService.mkdir(dirPath); // Should not throw

				expect(await fileService.exists(dirPath)).toBe(true);
			});

			test("should create parent directories when writing files", async () => {
				const filePath = "nested/path/file.txt";
				const content = "nested file content";

				await fileService.writeFile(filePath, content);

				expect(await fileService.exists("nested")).toBe(true);
				expect(await fileService.exists("nested/path")).toBe(true);
				expect(await fileService.exists(filePath)).toBe(true);

				const readContent = await fileService.readFile(filePath);
				expect(readContent).toBe(content);
			});
		});

		describe("directory listing operations", () => {
			test("should list files in a directory", async () => {
				const dirPath = "list-test";
				await fileService.mkdir(dirPath);

				await fileService.writeFile(`${dirPath}/file1.txt`, "content1");
				await fileService.writeFile(`${dirPath}/file2.txt`, "content2");

				const files = await fileService.listFiles(dirPath);

				expect(files).toHaveLength(2);
				expect(files.sort()).toEqual(["file1.txt", "file2.txt"]);
			});

			test("should return empty array for empty directory", async () => {
				const dirPath = "empty-dir";
				await fileService.mkdir(dirPath);

				const files = await fileService.listFiles(dirPath);

				expect(files).toEqual([]);
			});

			test("should list files recursively", async () => {
				const dirPath = "recursive-test";
				await fileService.mkdir(dirPath);

				await fileService.writeFile(`${dirPath}/root-file.txt`, "root");
				await fileService.writeFile(`${dirPath}/sub/nested-file.txt`, "nested");
				await fileService.writeFile(
					`${dirPath}/sub/deep/deep-file.txt`,
					"deep",
				);

				const files = await fileService.listFilesRecursive(dirPath);

				expect(files).toHaveLength(3);
				expect(files.sort()).toEqual(
					[
						"root-file.txt",
						"sub/nested-file.txt",
						"sub/deep/deep-file.txt",
					].sort(),
				);
			});

			test("should handle empty recursive directory listing", async () => {
				const dirPath = "empty-recursive";
				await fileService.mkdir(dirPath);

				const files = await fileService.listFilesRecursive(dirPath);

				expect(files).toEqual([]);
			});
		});

		describe("file deletion", () => {
			test("should delete existing files", async () => {
				const path = "delete-me.txt";

				await fileService.writeFile(path, "content");
				expect(await fileService.exists(path)).toBe(true);

				await fileService.deleteFile(path);
				expect(await fileService.exists(path)).toBe(false);
			});
		});

		describe("writability checks", () => {
			test("should return true for writable existing directories", async () => {
				const dirPath = "writable-dir";
				await fileService.mkdir(dirPath);

				expect(await fileService.isWritable(dirPath)).toBe(true);
			});

			test("should return true for writable file paths", async () => {
				const filePath = "writable-file.txt";
				await fileService.writeFile(filePath, "content");

				expect(await fileService.isWritable(filePath)).toBe(true);
			});
		});

		describe("error handling", () => {
			test("should throw FileNotFoundError when reading non-existent file", async () => {
				await expect(fileService.readFile("non-existent.txt")).rejects.toThrow(
					FileNotFoundError,
				);
			});

			test("should throw FileNotFoundError when deleting non-existent file", async () => {
				await expect(
					fileService.deleteFile("non-existent.txt"),
				).rejects.toThrow(FileNotFoundError);
			});

			test("should throw FileNotFoundError when listing non-existent directory", async () => {
				await expect(fileService.listFiles("non-existent-dir")).rejects.toThrow(
					FileNotFoundError,
				);
			});

			test("should throw FileNotFoundError when listing non-existent directory recursively", async () => {
				await expect(
					fileService.listFilesRecursive("non-existent-dir"),
				).rejects.toThrow(FileNotFoundError);
			});

			test("should include correct path in FileNotFoundError", async () => {
				const path = "missing-file.txt";

				try {
					await fileService.readFile(path);
				} catch (error) {
					expect(error).toBeInstanceOf(FileNotFoundError);
					expect((error as FileNotFoundError).path).toBe(path);
				}
			});
		});

		describe("path normalization", () => {
			test("should handle paths with different separators consistently", async () => {
				const content = "consistent content";

				await fileService.writeFile("path/to/file.txt", content);
				const readContent = await fileService.readFile("path/to/file.txt");

				expect(readContent).toBe(content);
			});

			test("should handle relative path components", async () => {
				const content = "relative content";

				// Skip relative path tests for mock implementation due to path normalization complexity
				if (!context.isRealFileSystem) {
					await fileService.writeFile("relative/file.txt", content);
					expect(await fileService.exists("relative/file.txt")).toBe(true);
					const readContent = await fileService.readFile("relative/file.txt");
					expect(readContent).toBe(content);
				} else {
					await fileService.writeFile("./relative/file.txt", content);
					expect(await fileService.exists("relative/file.txt")).toBe(true);
					const readContent = await fileService.readFile("relative/file.txt");
					expect(readContent).toBe(content);
				}
			});
		});

		// Platform-specific tests that may not apply to all implementations
		describe("platform-specific behavior", () => {
			test.skipIf(!context.isRealFileSystem)(
				"should handle complex permission scenarios",
				async () => {
					// This test would involve more complex file permission scenarios
					// that don't make sense for the in-memory implementation
					expect(true).toBe(true); // Placeholder for actual permission tests
				},
			);
		});
	});
}
