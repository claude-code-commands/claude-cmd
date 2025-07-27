import { beforeEach, describe, expect, test } from "bun:test";
import type IFileService from "../../src/interfaces/IFileService.ts";
import InMemoryFileService from "../mocks/InMemoryFileService.ts";

describe("In Memory FileService", () => {
	let fileService: IFileService;
	beforeEach(() => {
		const fakeFS: Record<string, string> = {
			"/path/to/file": "file content",
		};
		fileService = new InMemoryFileService(fakeFS);
	});

	describe("readFile", () => {
		test("should read file content", async () => {
			expect(await fileService.readFile("/path/to/file")).toBe("file content");
		});

		test("should throw error if file not found", () => {
			expect(
				async () => await fileService.readFile("/path/to/non-existent-file"),
			).toThrow("File not found: /path/to/non-existent-file");
		});
	});

	describe("writeFile", () => {
		test("should override file content", async () => {
			expect(await fileService.readFile("/path/to/file")).toBe("file content");
			expect(
				fileService.writeFile("/path/to/file", "new file content"),
			).resolves.toBeUndefined();
			expect(await fileService.readFile("/path/to/file")).toBe(
				"new file content",
			);
		});

		test("should create file if it doesn't exist", async () => {
			expect(await fileService.exists("/path/to/new-file")).toBe(false);
			expect(
				fileService.writeFile("/path/to/new-file", "new file content"),
			).resolves.toBeUndefined();
			expect(await fileService.exists("/path/to/new-file")).toBe(true);
		});

		test("shouldn't work when a directory already exists", async () => {
			const fileService = new InMemoryFileService({
				"/path/to/": "",
			});
			expect(await fileService.exists("/path/to/")).toBe(true);
			expect(
				fileService.writeFile("/path/to", "new file content"),
			).rejects.toThrow(`Cannot write file: /path/to conflicts with directory`);
		});
	});

	describe("exists", () => {
		test("should return true if file exists", async () => {
			expect(await fileService.exists("/path/to/file")).toBe(true);
		});

		test("should return false if file does not exist", async () => {
			expect(await fileService.exists("/path/to/non-existent-file")).toBe(
				false,
			);
		});

		test("should return false for partial match", async () => {
			expect(await fileService.exists("/path/to/f")).toBe(false);
		});

		test("should return true if directory exists", async () => {
			expect(await fileService.exists("/path/to/")).toBe(true);
		});

		test("should return false if directory does not exist", async () => {
			expect(await fileService.exists("/path/to/non-existent-dir/")).toBe(
				false,
			);
		});
	});

	describe("mkdir", () => {
		test("should create directory", async () => {
			expect(async () => await fileService.mkdir("/path/to/dir")).not.toThrow();
			expect(await fileService.exists("/path/to/dir")).toBe(true);
		});

		test("shouldn't do anything if directory already exists (idempotency)", async () => {
			expect(await fileService.exists("/path/to/dir")).toBe(false);
			expect(async () => await fileService.mkdir("/path/to/dir")).not.toThrow();
			expect(await fileService.exists("/path/to/dir")).toBe(true);
			expect(async () => await fileService.mkdir("/path/to/dir")).not.toThrow();
			expect(await fileService.exists("/path/to/dir")).toBe(true);
		});

		test("shouldn't work when a file already exists", async () => {
			const fileService = new InMemoryFileService({
				"/path/to/existing": "file content",
			});
			expect(await fileService.exists("/path/to/existing")).toBe(true);
			expect(fileService.mkdir("/path/to/existing/")).rejects.toThrow(
				`Cannot create directory: /path/to/existing/ conflicts with file`,
			);
		});
	});

	describe("deleteFile", () => {
		test("should delete existing file", async () => {
			expect(await fileService.exists("/path/to/file")).toBe(true);
			expect(fileService.deleteFile("/path/to/file")).resolves.toBeUndefined();
			expect(await fileService.exists("/path/to/file")).toBe(false);
		});

		test("should throw error if file not found", () => {
			expect(
				async () => await fileService.deleteFile("/path/to/non-existent-file"),
			).toThrow("File not found: /path/to/non-existent-file");
		});

		test("should throw error when trying to delete directory", async () => {
			await fileService.mkdir("/path/to/dir");
			expect(await fileService.exists("/path/to/dir")).toBe(true);
			expect(async () => await fileService.deleteFile("/path/to/dir/")).toThrow(
				"File not found: /path/to/dir/",
			);
		});
	});

	describe("listFiles", () => {
		test("should list files in existing directory", async () => {
			const fileService = new InMemoryFileService({
				"/path/to/dir/": "",
				"/path/to/dir/file1.txt": "content1",
				"/path/to/dir/file2.txt": "content2",
			});
			const files = await fileService.listFiles("/path/to/dir");
			expect(files).toEqual(["file1.txt", "file2.txt"]);
		});

		test("should return empty array for empty directory", async () => {
			await fileService.mkdir("/path/to/empty-dir");
			const files = await fileService.listFiles("/path/to/empty-dir");
			expect(files).toEqual([]);
		});

		test("should throw error if directory not found", () => {
			expect(
				async () => await fileService.listFiles("/path/to/non-existent-dir"),
			).toThrow("Directory not found: /path/to/non-existent-dir");
		});

		test("should list files in directory without trailing slash", async () => {
			const fileService = new InMemoryFileService({
				"/path/to/dir/file1.txt": "content1",
				"/path/to/dir/file2.txt": "content2",
			});
			const files = await fileService.listFiles("/path/to/dir");
			expect(files).toEqual(["file1.txt", "file2.txt"]);
		});

		test("should not include subdirectories in file list", async () => {
			const fileService = new InMemoryFileService({
				"/path/to/dir/": "",
				"/path/to/dir/file.txt": "content",
				"/path/to/dir/subdir/": "",
				"/path/to/dir/subdir/nested.txt": "nested content",
			});
			const files = await fileService.listFiles("/path/to/dir");
			expect(files).toEqual(["file.txt"]);
		});
	});
});
