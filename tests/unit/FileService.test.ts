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
				async () =>
					await fileService.writeFile("/path/to/file", "new file content"),
			).not.toThrow();
			expect(await fileService.readFile("/path/to/file")).toBe(
				"new file content",
			);
		});

		test("should create file if it doesn't exist", async () => {
			expect(await fileService.exists("/path/to/new-file")).toBe(false);
			expect(
				async () =>
					await fileService.writeFile("/path/to/new-file", "new file content"),
			).not.toThrow();
			expect(await fileService.exists("/path/to/new-file")).toBe(true);
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
	});
});
