import { beforeEach, describe, expect, test } from "bun:test";
import {
	FileIOError,
	FileNotFoundError,
} from "../../src/interfaces/IFileService.ts";
import InMemoryFileService from "../mocks/InMemoryFileService.ts";
import { createFileServiceContractTests } from "../shared/IFileService.contract.ts";

describe("InMemoryFileService", () => {
	// Run the shared contract tests for InMemoryFileService
	describe("Contract Tests", () => {
		createFileServiceContractTests(
			async () => {
				const service = new InMemoryFileService();
				const cleanup = async () => {
					service.clearFiles();
					service.clearOperationHistory();
				};
				return { service, cleanup };
			},
			{ isRealFileSystem: false },
		);
	});

	// InMemoryFileService-specific tests for mock functionality
	describe("InMemoryFileService Specific Tests", () => {
		let fileService: InMemoryFileService;

		beforeEach(() => {
			fileService = new InMemoryFileService();
		});

		describe("operation history tracking", () => {
			test("should track file operations in history", async () => {
				await fileService.writeFile("test.txt", "content");
				await fileService.readFile("test.txt");
				await fileService.exists("test.txt");

				const history = fileService.getOperationHistory();
				expect(history).toHaveLength(3);
				expect(history[0]?.operation).toBe("writeFile");
				expect(history[0]?.path).toBe("test.txt");
				expect(history[0]?.content).toBe("content");
				expect(history[1]?.operation).toBe("readFile");
				expect(history[1]?.path).toBe("test.txt");
				expect(history[2]?.operation).toBe("exists");
				expect(history[2]?.path).toBe("test.txt");
			});

			test("should clear operation history", async () => {
				await fileService.readFile("test.txt").catch(() => {}); // Ignore error
				expect(fileService.getOperationHistory()).toHaveLength(1);

				fileService.clearOperationHistory();
				expect(fileService.getOperationHistory()).toHaveLength(0);
			});

			test("should return copy of history to prevent external modification", async () => {
				await fileService.writeFile("test.txt", "content");
				const history = fileService.getOperationHistory();
				history.push({ operation: "external-modification", path: "fake" });

				// Original history should be unaffected
				expect(fileService.getOperationHistory()).toHaveLength(1);
			});
		});

		describe("file system state management", () => {
			test("should allow direct file setting for test setup", () => {
				fileService.setFile("direct.txt", "direct content");

				expect(fileService.fs["direct.txt"]).toEqual({
					type: "file",
					content: "direct content",
				});
			});

			test("should clear all files", async () => {
				await fileService.writeFile("file1.txt", "content1");
				await fileService.writeFile("file2.txt", "content2");
				await fileService.mkdir("dir1/");

				expect(Object.keys(fileService.fs)).toHaveLength(3);

				fileService.clearFiles();
				expect(Object.keys(fileService.fs)).toHaveLength(0);
			});

			test("should initialize with provided files", () => {
				const initialFiles = {
					"existing1.txt": "content1",
					"existing2.txt": "content2",
					"dir/": "", // Directory marker
				};

				const service = new InMemoryFileService(initialFiles);

				expect(service.fs["existing1.txt"]).toEqual({
					type: "file",
					content: "content1",
				});
				expect(service.fs["existing2.txt"]).toEqual({
					type: "file",
					content: "content2",
				});
				expect(service.fs["dir/"]).toEqual({
					type: "directory",
				});
			});
		});

		describe("path normalization and collision detection", () => {
			test("should handle directory vs file path conflicts", async () => {
				// Create a file
				await fileService.writeFile("conflict", "file content");

				// Try to create directory with same name - should fail
				expect(fileService.mkdir("conflict")).rejects.toThrow(FileIOError);
				expect(fileService.mkdir("conflict/")).rejects.toThrow(FileIOError);
			});

			test("should handle file vs directory path conflicts", async () => {
				// Create a directory
				await fileService.mkdir("conflict/");

				// Try to create file with same name - should fail
				expect(fileService.writeFile("conflict", "content")).rejects.toThrow(
					FileIOError,
				);
				expect(fileService.writeFile("conflict/", "content")).rejects.toThrow(
					FileIOError,
				);
			});

			test("should normalize paths consistently for exists check", async () => {
				await fileService.mkdir("testdir/");

				expect(await fileService.exists("testdir")).toBe(true);
				expect(await fileService.exists("testdir/")).toBe(true);
			});

			test("should detect implicit directories from file paths", async () => {
				await fileService.writeFile("parent/child/file.txt", "content");

				expect(await fileService.exists("parent/")).toBe(true);
				expect(await fileService.exists("parent/child/")).toBe(true);
				expect(await fileService.exists("parent/child/file.txt")).toBe(true);
			});
		});

		describe("directory listing with file system structure", () => {
			test("should list files in implicit directories", async () => {
				await fileService.writeFile("testdir/file1.txt", "content1");
				await fileService.writeFile("testdir/file2.txt", "content2");
				await fileService.writeFile("testdir/subdir/nested.txt", "nested");

				const files = await fileService.listFiles("testdir/");

				expect(files).toHaveLength(2);
				expect(files.sort()).toEqual(["file1.txt", "file2.txt"]);
			});

			test("should list files recursively with correct relative paths", async () => {
				await fileService.writeFile("root/file1.txt", "content1");
				await fileService.writeFile("root/sub1/file2.txt", "content2");
				await fileService.writeFile("root/sub1/deep/file3.txt", "content3");
				await fileService.writeFile("root/sub2/file4.txt", "content4");

				const files = await fileService.listFilesRecursive("root/");

				expect(files).toHaveLength(4);
				expect(files.sort()).toEqual(
					[
						"file1.txt",
						"sub1/file2.txt",
						"sub1/deep/file3.txt",
						"sub2/file4.txt",
					].sort(),
				);
			});

			test("should handle mixed explicit and implicit directories", async () => {
				// Create explicit directory
				await fileService.mkdir("explicit/");
				// Create implicit directory via file
				await fileService.writeFile("implicit/file.txt", "content");

				expect(await fileService.exists("explicit/")).toBe(true);
				expect(await fileService.exists("implicit/")).toBe(true);

				const explicitFiles = await fileService.listFiles("explicit/");
				const implicitFiles = await fileService.listFiles("implicit/");

				expect(explicitFiles).toEqual([]);
				expect(implicitFiles).toEqual(["file.txt"]);
			});
		});

		describe("writability simulation", () => {
			test("should return true for writable existing paths", async () => {
				await fileService.writeFile("writable.txt", "content");
				await fileService.mkdir("writable-dir/");

				expect(await fileService.isWritable("writable.txt")).toBe(true);
				expect(await fileService.isWritable("writable-dir/")).toBe(true);
			});

			test("should return true for writable paths with existing parents", async () => {
				await fileService.mkdir("parent/");

				expect(await fileService.isWritable("parent/new-file.txt")).toBe(true);
			});

			test("should return false for paths without existing parents", async () => {
				expect(await fileService.isWritable("nonexistent/path/file.txt")).toBe(
					false,
				);
			});
		});

		describe("error consistency with typed errors", () => {
			test("should throw FileNotFoundError with correct properties", async () => {
				const path = "missing.txt";

				try {
					await fileService.readFile(path);
				} catch (error) {
					expect(error).toBeInstanceOf(FileNotFoundError);
					expect((error as FileNotFoundError).path).toBe(path);
					expect((error as FileNotFoundError).message).toContain(path);
				}
			});

			test("should throw FileIOError for conflicts with correct properties", async () => {
				await fileService.writeFile("conflict", "content");
				const path = "conflict";

				try {
					await fileService.mkdir(path);
				} catch (error) {
					expect(error).toBeInstanceOf(FileIOError);
					expect((error as FileIOError).path).toBe(path);
					expect((error as FileIOError).message).toContain(
						"conflicts with file",
					);
				}
			});
		});
	});
});
