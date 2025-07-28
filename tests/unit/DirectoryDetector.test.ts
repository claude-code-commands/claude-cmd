import { beforeEach, describe, expect, spyOn, test } from "bun:test";
import os from "node:os";
import { DirectoryDetector } from "../../src/services/DirectoryDetector.js";
import InMemoryFileService from "../mocks/InMemoryFileService.js";

describe("DirectoryDetector", () => {
	let fileService: InMemoryFileService;
	let directoryDetector: DirectoryDetector;

	beforeEach(() => {
		fileService = new InMemoryFileService();
		directoryDetector = new DirectoryDetector(fileService);
	});

	describe("getClaudeDirectories", () => {
		test("should return personal and project directories", async () => {
			// Mock home directory
			const originalHome = process.env.HOME;
			process.env.HOME = "/Users/testuser";

			try {
				const directories = await directoryDetector.getClaudeDirectories();

				expect(directories).toHaveLength(2);

				const personalDir = directories.find((d) => d.type === "personal");
				const projectDir = directories.find((d) => d.type === "project");

				expect(personalDir).toBeDefined();
				expect(projectDir).toBeDefined();

				expect(personalDir?.path).toBe("/Users/testuser/.claude/commands");
				expect(projectDir?.path).toBe(".claude/commands");
			} finally {
				process.env.HOME = originalHome;
			}
		});

		test("should detect directory existence correctly", async () => {
			// Create personal directory in mock filesystem
			await fileService.mkdir("/Users/testuser/.claude/commands");

			// Mock home directory
			const originalHome = process.env.HOME;
			process.env.HOME = "/Users/testuser";

			try {
				const directories = await directoryDetector.getClaudeDirectories();

				const personalDir = directories.find((d) => d.type === "personal");
				const projectDir = directories.find((d) => d.type === "project");

				expect(personalDir?.exists).toBe(true);
				expect(projectDir?.exists).toBe(false);
			} finally {
				process.env.HOME = originalHome;
			}
		});

		test("should handle Windows home directory (USERPROFILE)", async () => {
			// Mock Windows environment
			const originalHome = process.env.HOME;
			const originalUserProfile = process.env.USERPROFILE;
			delete process.env.HOME;
			process.env.USERPROFILE = "C:\\Users\\testuser";

			try {
				const directories = await directoryDetector.getClaudeDirectories();

				const personalDir = directories.find((d) => d.type === "personal");
				expect(personalDir?.path).toBe("C:\\Users\\testuser/.claude/commands");
			} finally {
				process.env.HOME = originalHome;
				process.env.USERPROFILE = originalUserProfile;
			}
		});

		test("should handle missing home directory gracefully", async () => {
			// Mock missing home directory
			const originalHome = process.env.HOME;
			const originalUserProfile = process.env.USERPROFILE;
			delete process.env.HOME;
			delete process.env.USERPROFILE;

			// Mock os.homedir() to throw an error to simulate failure
			const mockHomedir = spyOn(os, "homedir").mockImplementation(() => {
				throw new Error("Unable to determine home directory");
			});

			try {
				await expect(directoryDetector.getClaudeDirectories()).rejects.toThrow(
					"Unable to determine home directory",
				);
			} finally {
				process.env.HOME = originalHome;
				process.env.USERPROFILE = originalUserProfile;
				mockHomedir.mockRestore();
			}
		});

		test("should check writability correctly", async () => {
			// Create directories with different permissions
			await fileService.mkdir("/Users/testuser/.claude/commands");

			// Mock home directory
			const originalHome = process.env.HOME;
			process.env.HOME = "/Users/testuser";

			try {
				const directories = await directoryDetector.getClaudeDirectories();

				const personalDir = directories.find((d) => d.type === "personal");
				expect(personalDir?.writable).toBe(true);
			} finally {
				process.env.HOME = originalHome;
			}
		});
	});

	describe("getPersonalDirectory", () => {
		test("should return personal Claude directory path", async () => {
			const originalHome = process.env.HOME;
			process.env.HOME = "/Users/testuser";

			try {
				const path = await directoryDetector.getPersonalDirectory();
				expect(path).toBe("/Users/testuser/.claude/commands");
			} finally {
				process.env.HOME = originalHome;
			}
		});

		test("should handle relative paths correctly", async () => {
			const originalHome = process.env.HOME;
			process.env.HOME = "~/testuser";

			try {
				const path = await directoryDetector.getPersonalDirectory();
				// Should resolve to absolute path
				expect(path).toMatch(/^\/.*\.claude\/commands$/);
			} finally {
				process.env.HOME = originalHome;
			}
		});
	});

	describe("getProjectDirectory", () => {
		test("should return project Claude directory path", async () => {
			const path = await directoryDetector.getProjectDirectory();
			expect(path).toBe(".claude/commands");
		});

		test("should return absolute path when requested", async () => {
			const path = await directoryDetector.getProjectDirectory(true);
			expect(path).toMatch(/^\/.*\.claude\/commands$/);
		});
	});

	describe("ensureDirectoryExists", () => {
		test("should create directory if it doesn't exist", async () => {
			const testPath = "/test/new/directory";

			expect(await fileService.exists(testPath)).toBe(false);

			await directoryDetector.ensureDirectoryExists(testPath);

			expect(await fileService.exists(testPath)).toBe(true);
		});

		test("should not fail if directory already exists", async () => {
			const testPath = "/test/existing";
			await fileService.mkdir(testPath);

			// Should not throw
			await directoryDetector.ensureDirectoryExists(testPath);

			expect(await fileService.exists(testPath)).toBe(true);
		});

		test("should create nested directories", async () => {
			const testPath = "/deep/nested/test/directory";

			await directoryDetector.ensureDirectoryExists(testPath);

			expect(await fileService.exists(testPath)).toBe(true);
		});
	});

	describe("getPreferredInstallLocation", () => {
		test("should return personal directory by default", async () => {
			const originalHome = process.env.HOME;
			process.env.HOME = "/Users/testuser";

			try {
				const location = await directoryDetector.getPreferredInstallLocation();
				expect(location).toBe("/Users/testuser/.claude/commands");
			} finally {
				process.env.HOME = originalHome;
			}
		});

		test("should return project directory when specified", async () => {
			const location =
				await directoryDetector.getPreferredInstallLocation("project");
			expect(location).toBe(".claude/commands");
		});

		test("should return personal directory when specified", async () => {
			const originalHome = process.env.HOME;
			process.env.HOME = "/Users/testuser";

			try {
				const location =
					await directoryDetector.getPreferredInstallLocation("personal");
				expect(location).toBe("/Users/testuser/.claude/commands");
			} finally {
				process.env.HOME = originalHome;
			}
		});
	});

	describe("cross-platform compatibility", () => {
		test("should handle Windows paths correctly", async () => {
			// Mock Windows platform
			const originalPlatform = process.platform;
			Object.defineProperty(process, "platform", { value: "win32" });

			const originalUserProfile = process.env.USERPROFILE;
			process.env.USERPROFILE = "C:\\Users\\testuser";
			const originalHome = process.env.HOME;
			delete process.env.HOME;

			try {
				const directories = await directoryDetector.getClaudeDirectories();
				const personalDir = directories.find((d) => d.type === "personal");

				expect(personalDir?.path).toBe("C:\\Users\\testuser/.claude/commands");
			} finally {
				Object.defineProperty(process, "platform", { value: originalPlatform });
				process.env.USERPROFILE = originalUserProfile;
				process.env.HOME = originalHome;
			}
		});

		test("should handle Unix-like paths correctly", async () => {
			// Mock Unix platform
			const originalPlatform = process.platform;
			Object.defineProperty(process, "platform", { value: "linux" });

			const originalHome = process.env.HOME;
			process.env.HOME = "/home/testuser";

			try {
				const directories = await directoryDetector.getClaudeDirectories();
				const personalDir = directories.find((d) => d.type === "personal");

				expect(personalDir?.path).toBe("/home/testuser/.claude/commands");
			} finally {
				Object.defineProperty(process, "platform", { value: originalPlatform });
				process.env.HOME = originalHome;
			}
		});
	});
});
