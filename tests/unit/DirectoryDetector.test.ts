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

	describe("recursive command scanning", () => {
		describe("scanForCommandFiles", () => {
			test("should find all .md files in directory tree", async () => {
				// Set up nested command structure
				await fileService.mkdir("/test/commands");
				await fileService.mkdir("/test/commands/frontend");
				await fileService.mkdir("/test/commands/backend");
				await fileService.mkdir("/test/commands/backend/auth");

				// Create command files
				await fileService.writeFile("/test/commands/simple.md", "# Simple command");
				await fileService.writeFile("/test/commands/frontend/component.md", "# Component command");
				await fileService.writeFile("/test/commands/backend/api.md", "# API command");
				await fileService.writeFile("/test/commands/backend/auth/login.md", "# Login command");
				
				// Create non-command files (should be ignored)
				await fileService.writeFile("/test/commands/README.txt", "Not a command");
				await fileService.writeFile("/test/commands/config.claude-cmd.json", "{}");

				const commandFiles = await directoryDetector.scanForCommandFiles("/test/commands");

				expect(commandFiles).toHaveLength(4);
				expect(commandFiles).toContain("/test/commands/simple.md");
				expect(commandFiles).toContain("/test/commands/frontend/component.md");
				expect(commandFiles).toContain("/test/commands/backend/api.md");
				expect(commandFiles).toContain("/test/commands/backend/auth/login.md");
			});

			test("should handle empty directory", async () => {
				await fileService.mkdir("/test/empty");

				const commandFiles = await directoryDetector.scanForCommandFiles("/test/empty");

				expect(commandFiles).toHaveLength(0);
			});

			test("should handle non-existent directory", async () => {
				const commandFiles = await directoryDetector.scanForCommandFiles("/test/nonexistent");

				expect(commandFiles).toHaveLength(0);
			});

			test("should ignore hidden directories and files", async () => {
				await fileService.mkdir("/test/commands");
				await fileService.mkdir("/test/commands/.hidden");
				
				await fileService.writeFile("/test/commands/visible.md", "# Visible command");
				await fileService.writeFile("/test/commands/.hidden/secret.md", "# Hidden command");
				await fileService.writeFile("/test/commands/.hiddenfile.md", "# Hidden file");

				const commandFiles = await directoryDetector.scanForCommandFiles("/test/commands");

				expect(commandFiles).toHaveLength(1);
				expect(commandFiles).toContain("/test/commands/visible.md");
			});

			test("should handle deeply nested structures efficiently", async () => {
				// Create a deep structure to test performance optimization
				let currentPath = "/test/deep";
				await fileService.mkdir(currentPath);

				// Create 5 levels deep with commands at each level
				for (let i = 0; i < 5; i++) {
					currentPath = `${currentPath}/level${i}`;
					await fileService.mkdir(currentPath);
					await fileService.writeFile(`${currentPath}/command${i}.md`, `# Level ${i} command`);
				}

				const commandFiles = await directoryDetector.scanForCommandFiles("/test/deep");

				expect(commandFiles).toHaveLength(5);
				expect(commandFiles).toContain("/test/deep/level0/command0.md");
				expect(commandFiles).toContain("/test/deep/level0/level1/command1.md");
				expect(commandFiles).toContain("/test/deep/level0/level1/level2/command2.md");
				expect(commandFiles).toContain("/test/deep/level0/level1/level2/level3/command3.md");
				expect(commandFiles).toContain("/test/deep/level0/level1/level2/level3/level4/command4.md");
			});
		});

		describe("scanAllClaudeDirectories", () => {
			test("should scan both personal and project directories", async () => {
				// Mock environment
				const originalHome = process.env.HOME;
				process.env.HOME = "/Users/testuser";

				try {
					// Set up directories with commands
					await fileService.mkdir("/Users/testuser/.claude/commands");
					await fileService.mkdir("/Users/testuser/.claude/commands/personal");
					await fileService.mkdir(".claude/commands");
					await fileService.mkdir(".claude/commands/project");

					// Create command files
					await fileService.writeFile("/Users/testuser/.claude/commands/global.md", "# Global command");
					await fileService.writeFile("/Users/testuser/.claude/commands/personal/user.md", "# User command");
					await fileService.writeFile(".claude/commands/local.md", "# Local command");
					await fileService.writeFile(".claude/commands/project/team.md", "# Team command");

					const allCommandFiles = await directoryDetector.scanAllClaudeDirectories();

					expect(allCommandFiles.personal).toHaveLength(2);
					expect(allCommandFiles.project).toHaveLength(2);
					
					expect(allCommandFiles.personal).toContain("/Users/testuser/.claude/commands/global.md");
					expect(allCommandFiles.personal).toContain("/Users/testuser/.claude/commands/personal/user.md");
					expect(allCommandFiles.project).toContain(".claude/commands/local.md");
					expect(allCommandFiles.project).toContain(".claude/commands/project/team.md");
				} finally {
					process.env.HOME = originalHome;
				}
			});

			test("should handle missing directories gracefully", async () => {
				const originalHome = process.env.HOME;
				process.env.HOME = "/Users/testuser";

				try {
					// Don't create any directories

					const allCommandFiles = await directoryDetector.scanAllClaudeDirectories();

					expect(allCommandFiles.personal).toHaveLength(0);
					expect(allCommandFiles.project).toHaveLength(0);
				} finally {
					process.env.HOME = originalHome;
				}
			});
		});

		describe("performance optimization", () => {
			test("should handle large directory trees efficiently", async () => {
				// Create a structure with many files to test performance
				await fileService.mkdir("/test/large");
				
				// Create 50 command files across 10 directories
				for (let dir = 0; dir < 10; dir++) {
					const dirPath = `/test/large/dir${dir}`;
					await fileService.mkdir(dirPath);
					
					for (let file = 0; file < 5; file++) {
						await fileService.writeFile(`${dirPath}/cmd${file}.md`, `# Command ${dir}-${file}`);
						// Add some non-command files to make it more realistic
						await fileService.writeFile(`${dirPath}/readme${file}.txt`, "Not a command");
					}
				}

				const startTime = Date.now();
				const commandFiles = await directoryDetector.scanForCommandFiles("/test/large");
				const endTime = Date.now();

				expect(commandFiles).toHaveLength(50);
				// Should complete within reasonable time (less than 1 second for this size)
				expect(endTime - startTime).toBeLessThan(1000);
			});
		});
	});
});
