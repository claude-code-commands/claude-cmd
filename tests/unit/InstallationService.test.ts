import { beforeEach, describe, expect, test } from "bun:test";
import { CommandParser } from "../../src/services/CommandParser.js";
import { DirectoryDetector } from "../../src/services/DirectoryDetector.js";
import {
	CommandExistsError,
	CommandNotInstalledError,
	InstallationError,
	InstallationService,
} from "../../src/services/InstallationService.js";
import { LocalCommandRepository } from "../../src/services/LocalCommandRepository.js";
import NamespaceService from "../../src/services/NamespaceService.js";
import type { Command } from "../../src/types/Command.js";
import InMemoryFileService from "../mocks/InMemoryFileService.js";
import InMemoryHTTPClient from "../mocks/InMemoryHTTPClient.js";
import InMemoryRepository from "../mocks/InMemoryRepository.js";
import InMemoryUserInteractionService from "../mocks/InMemoryUserInteractionService.js";

describe("InstallationService", () => {
	let fileService: InMemoryFileService;
	let repository: InMemoryRepository;
	let _directoryDetector: DirectoryDetector;
	let _commandParser: CommandParser;
	let installationService: InstallationService;
	let userInteractionService: InMemoryUserInteractionService;

	const mockCommand: Command = {
		name: "test-command",
		description: "A test command for debugging",
		file: "test-command.md",
		"allowed-tools": ["Read", "Edit", "Bash(git:*)"],
	};

	const mockCommandContent = `---
description: A test command for debugging
allowed-tools:
  - Read
  - Edit
  - Bash(git:*)
---

# Test Command

This is a test command for debugging issues.

## Usage
Use this command when you need help with debugging.
`;

	beforeEach(() => {
		fileService = new InMemoryFileService();
		const httpClient = new InMemoryHTTPClient();
		repository = new InMemoryRepository(httpClient, fileService);
		const directoryDetector = new DirectoryDetector(fileService);
		const namespaceService = new NamespaceService();
		const commandParser = new CommandParser(namespaceService);
		const localCommandRepository = new LocalCommandRepository(
			directoryDetector,
			commandParser,
		);
		userInteractionService = new InMemoryUserInteractionService();

		// Set default confirmation to true for most tests
		userInteractionService.setDefaultResponse(true);

		installationService = new InstallationService(
			repository,
			fileService,
			directoryDetector,
			commandParser,
			localCommandRepository,
			userInteractionService,
		);

		// Set up mock home directory
		process.env.HOME = "/home/testuser";

		// Set up repository with test command
		repository.setManifest("en", {
			version: "1.0.0",
			updated: "2025-01-01T00:00:00Z",
			commands: [mockCommand],
		});
		repository.setCommand("test-command", "en", mockCommandContent);
	});

	describe("installCommand", () => {
		test("should install command to personal directory by default", async () => {
			await installationService.installCommand("test-command");

			const expectedPath = "/home/testuser/.claude/commands/test-command.md";
			expect(await fileService.exists(expectedPath)).toBe(true);

			const installedContent = await fileService.readFile(expectedPath);
			expect(installedContent).toBe(mockCommandContent);
		});

		test("should install command to project directory when specified", async () => {
			await installationService.installCommand("test-command", {
				target: "project",
			});

			const expectedPath = ".claude/commands/test-command.md";
			expect(await fileService.exists(expectedPath)).toBe(true);

			const installedContent = await fileService.readFile(expectedPath);
			expect(installedContent).toBe(mockCommandContent);
		});

		test("should create directory if it doesn't exist", async () => {
			// Ensure directory doesn't exist initially
			const personalDir = "/home/testuser/.claude/commands";
			expect(await fileService.exists(personalDir)).toBe(false);

			await installationService.installCommand("test-command");

			expect(await fileService.exists(personalDir)).toBe(true);
			expect(await fileService.exists(`${personalDir}/test-command.md`)).toBe(
				true,
			);
		});

		test("should throw CommandExistsError when command already exists without force", async () => {
			// Install command first
			await installationService.installCommand("test-command");

			// Try to install again without force
			await expect(
				installationService.installCommand("test-command"),
			).rejects.toThrow(CommandExistsError);
		});

		test("should overwrite existing command when force is true", async () => {
			// Install command first
			await installationService.installCommand("test-command");

			// Modify the command content in repository
			const newContent = mockCommandContent.replace(
				"A test command for debugging",
				"An updated test command",
			);
			repository.setCommand("test-command", "en", newContent);

			// Install with force
			await installationService.installCommand("test-command", {
				force: true,
			});

			const expectedPath = "/home/testuser/.claude/commands/test-command.md";
			const installedContent = await fileService.readFile(expectedPath);
			expect(installedContent).toBe(newContent);
		});

		test("should throw InstallationError for command not in repository", async () => {
			await expect(
				installationService.installCommand("nonexistent-command"),
			).rejects.toThrow(InstallationError);
		});

		test("should handle repository errors gracefully", async () => {
			repository.setCommand("test-command", "en", new Error("Network error"));

			await expect(
				installationService.installCommand("test-command"),
			).rejects.toThrow(InstallationError);
		});

		test("should validate command content before installation", async () => {
			// Set truly invalid command content (malformed YAML)
			const invalidContent = `---
description: Test command
allowed-tools: [invalid yaml structure
---

# Invalid Command`;
			repository.setCommand("test-command", "en", invalidContent);

			await expect(
				installationService.installCommand("test-command"),
			).rejects.toThrow(InstallationError);
		});
	});

	describe("removeCommand", () => {
		beforeEach(async () => {
			// Install a command for removal tests
			await installationService.installCommand("test-command");
		});

		test("should remove installed command", async () => {
			const expectedPath = "/home/testuser/.claude/commands/test-command.md";
			expect(await fileService.exists(expectedPath)).toBe(true);

			await installationService.removeCommand("test-command", { yes: true });

			expect(await fileService.exists(expectedPath)).toBe(false);
		});

		test("should throw CommandNotInstalledError for non-existent command", async () => {
			await expect(
				installationService.removeCommand("nonexistent-command", { yes: true }),
			).rejects.toThrow(CommandNotInstalledError);
		});

		test("should remove from correct location when multiple installations exist", async () => {
			// Install to both personal and project directories
			await installationService.installCommand("test-command", {
				target: "project",
			});

			const personalPath = "/home/testuser/.claude/commands/test-command.md";
			const projectPath = ".claude/commands/test-command.md";

			expect(await fileService.exists(personalPath)).toBe(true);
			expect(await fileService.exists(projectPath)).toBe(true);

			// Remove should remove personal by default (first found)
			await installationService.removeCommand("test-command", { yes: true });

			expect(await fileService.exists(personalPath)).toBe(false);
			expect(await fileService.exists(projectPath)).toBe(true);
		});
	});

	describe("listInstalledCommands", () => {
		test("should return empty array when no commands installed", async () => {
			const commands = await installationService.listInstalledCommands();
			expect(commands).toEqual([]);
		});

		test("should return installed commands from personal directory", async () => {
			await installationService.installCommand("test-command");

			const commands = await installationService.listInstalledCommands();
			expect(commands).toHaveLength(1);
			expect(commands[0]?.name).toBe("test-command");
			expect(commands[0]?.description).toBe("A test command for debugging");
		});

		test("should return commands from both personal and project directories", async () => {
			// Install to personal directory
			await installationService.installCommand("test-command");

			// Install different command to project directory
			const projectCommand: Command = {
				name: "project-command",
				description: "A project-specific command",
				file: "project-command.md",
				"allowed-tools": ["Read", "Write"],
			};

			repository.setManifest("en", {
				version: "1.0.0",
				updated: "2025-01-01T00:00:00Z",
				commands: [mockCommand, projectCommand],
			});

			const projectContent = `---
description: A project-specific command
allowed-tools: Read, Write
---

# Project Command
`;
			repository.setCommand("project-command", "en", projectContent);

			await installationService.installCommand("project-command", {
				target: "project",
			});

			const commands = await installationService.listInstalledCommands();
			expect(commands).toHaveLength(2);

			const commandNames = commands.map((c) => c.name);
			expect(commandNames).toContain("test-command");
			expect(commandNames).toContain("project-command");
		});

		test("should handle malformed command files gracefully", async () => {
			// Install valid command
			await installationService.installCommand("test-command");

			// Manually add truly malformed command file (malformed YAML)
			const personalDir = "/home/testuser/.claude/commands";
			await fileService.writeFile(
				`${personalDir}/malformed.md`,
				`---
description: Test
allowed-tools: [invalid yaml
---

# Malformed`,
			);

			const commands = await installationService.listInstalledCommands();

			// Should only return valid commands
			expect(commands).toHaveLength(1);
			expect(commands[0]?.name).toBe("test-command");
		});

		test("should deduplicate commands found in multiple locations", async () => {
			// Install same command to both locations
			await installationService.installCommand("test-command");
			await installationService.installCommand("test-command", {
				target: "project",
				force: true,
			});

			const commands = await installationService.listInstalledCommands();

			// Should only return one instance (personal takes precedence)
			expect(commands).toHaveLength(1);
			expect(commands[0]?.name).toBe("test-command");
		});

		test("should find commands in nested directories", async () => {
			// Create nested directory structure
			const personalDir = "/home/testuser/.claude/commands";

			// Add command in root
			await installationService.installCommand("test-command");

			// Add commands in nested directories
			await fileService.writeFile(
				`${personalDir}/ai/code-review.md`,
				`---
description: AI code review command
allowed-tools: Read, Edit
---

# AI Code Review`,
			);

			await fileService.writeFile(
				`${personalDir}/tools/docker/deploy.md`,
				`---
description: Docker deployment command
allowed-tools: Bash(docker:*)
---

# Docker Deploy`,
			);

			const commands = await installationService.listInstalledCommands();

			// Should find all commands including nested ones
			expect(commands).toHaveLength(3);

			const commandNames = commands.map((c) => c.name);
			expect(commandNames).toContain("test-command");
			expect(commandNames).toContain("ai:code-review");
			expect(commandNames).toContain("tools:docker:deploy");
		});

		test("should handle nested directories with malformed files gracefully", async () => {
			const personalDir = "/home/testuser/.claude/commands";

			// Add valid command in root
			await installationService.installCommand("test-command");

			// Add valid command in nested directory
			await fileService.writeFile(
				`${personalDir}/category/valid.md`,
				`---
description: Valid nested command
---

# Valid Command`,
			);

			// Add malformed command in nested directory
			await fileService.writeFile(
				`${personalDir}/category/malformed.md`,
				`---
description: Malformed
allowed-tools: [invalid yaml
---

# Malformed`,
			);

			const commands = await installationService.listInstalledCommands();

			// Should find valid commands and skip malformed ones
			expect(commands).toHaveLength(2);

			const commandNames = commands.map((c) => c.name);
			expect(commandNames).toContain("test-command");
			expect(commandNames).toContain("category:valid");
			expect(commandNames).not.toContain("category:malformed");
		});
	});

	describe("getInstallationInfo", () => {
		test("should return installation info for installed command", async () => {
			await installationService.installCommand("test-command");

			const info =
				await installationService.getInstallationInfo("test-command");

			expect(info).toBeDefined();
			expect(info?.name).toBe("test-command");
			expect(info?.location).toBe("personal");
			expect(info?.filePath).toBe(
				"/home/testuser/.claude/commands/test-command.md",
			);
			expect(info?.size).toBeGreaterThan(0);
			expect(info?.installedAt).toBeInstanceOf(Date);
		});

		test("should return null for non-installed command", async () => {
			const info = await installationService.getInstallationInfo("nonexistent");
			expect(info).toBeNull();
		});

		test("should return project location when command is in project directory", async () => {
			await installationService.installCommand("test-command", {
				target: "project",
			});

			const info =
				await installationService.getInstallationInfo("test-command");

			expect(info?.location).toBe("project");
			expect(info?.filePath).toBe(".claude/commands/test-command.md");
		});
	});

	describe("isInstalled", () => {
		test("should return true for installed command", async () => {
			await installationService.installCommand("test-command");

			expect(await installationService.isInstalled("test-command")).toBe(true);
		});

		test("should return false for non-installed command", async () => {
			expect(await installationService.isInstalled("nonexistent")).toBe(false);
		});
	});

	describe("getInstallationPath", () => {
		test("should return path for installed command", async () => {
			await installationService.installCommand("test-command");

			const path =
				await installationService.getInstallationPath("test-command");
			expect(path).toBe("/home/testuser/.claude/commands/test-command.md");
		});

		test("should return null for non-installed command", async () => {
			const path = await installationService.getInstallationPath("nonexistent");
			expect(path).toBeNull();
		});
	});

	describe("atomic operations", () => {
		test("should rollback on installation failure", async () => {
			// Mock file service to fail after directory creation
			const originalWriteFile = fileService.writeFile;
			fileService.writeFile = async () => {
				throw new Error("Disk full");
			};

			const personalDir = "/home/testuser/.claude/commands";

			await expect(
				installationService.installCommand("test-command"),
			).rejects.toThrow();

			// Directory should be created but file should not exist
			expect(await fileService.exists(personalDir)).toBe(true);
			expect(await fileService.exists(`${personalDir}/test-command.md`)).toBe(
				false,
			);

			// Restore original method
			fileService.writeFile = originalWriteFile;
		});
	});

	describe("namespace-aware command discovery", () => {
		beforeEach(async () => {
			// Set up directory structure for namespace tests
			const personalDir = "/home/testuser/.claude/commands";
			const projectDir = "./.claude/commands";
			await fileService.mkdir(personalDir);
			await fileService.mkdir(projectDir);
		});

		test("should find namespaced command with colon separator", async () => {
			// Create a namespaced command structure: frontend/component.md
			const namespacedPath =
				"/home/testuser/.claude/commands/frontend/component.md";
			await fileService.writeFile(namespacedPath, mockCommandContent);

			// Should find the command using colon notation
			const path =
				await installationService.getInstallationPath("frontend:component");
			expect(path).toBe(namespacedPath);

			// Should also work with isInstalled
			const isInstalled =
				await installationService.isInstalled("frontend:component");
			expect(isInstalled).toBe(true);
		});

		test("should find namespaced command with slash separator", async () => {
			// Create a namespaced command structure: api/endpoints/user.md
			const namespacedPath =
				"/home/testuser/.claude/commands/api/endpoints/user.md";
			await fileService.writeFile(namespacedPath, mockCommandContent);

			// Should find the command using slash notation
			const path =
				await installationService.getInstallationPath("api/endpoints/user");
			expect(path).toBe(namespacedPath);

			// Should also work with isInstalled
			const isInstalled =
				await installationService.isInstalled("api/endpoints/user");
			expect(isInstalled).toBe(true);
		});

		test("should support removing namespaced commands with confirmation", async () => {
			// Create a namespaced command
			const namespacedPath =
				"/home/testuser/.claude/commands/frontend/component.md";
			await fileService.writeFile(namespacedPath, mockCommandContent);

			// Verify it exists
			expect(await fileService.exists(namespacedPath)).toBe(true);

			// Remove using colon notation with --yes flag
			await installationService.removeCommand("frontend:component", {
				yes: true,
			});

			// Should be removed
			expect(await fileService.exists(namespacedPath)).toBe(false);
		});

		test("should return installation info for namespaced commands", async () => {
			// Create a namespaced command in project directory
			const projectDir = ".claude/commands";
			const namespacedPath = `${projectDir}/backend/database/migrations.md`;
			await fileService.writeFile(namespacedPath, mockCommandContent);

			// Get installation info using colon notation
			const info = await installationService.getInstallationInfo(
				"backend:database:migrations",
			);

			expect(info).not.toBeNull();
			expect(info?.name).toBe("backend:database:migrations");
			expect(info?.filePath).toBe(namespacedPath);
			expect(info?.location).toBe("project");
		});

		test("should handle deep namespaces correctly", async () => {
			// Create deeply nested command: tools/cli/commands/generate/component.md
			const deepPath =
				"/home/testuser/.claude/commands/tools/cli/commands/generate/component.md";
			await fileService.writeFile(deepPath, mockCommandContent);

			// Should find using colon notation
			const pathColon = await installationService.getInstallationPath(
				"tools:cli:commands:generate:component",
			);
			expect(pathColon).toBe(deepPath);

			// Should also find using slash notation
			const pathSlash = await installationService.getInstallationPath(
				"tools/cli/commands/generate/component",
			);
			expect(pathSlash).toBe(deepPath);
		});

		test("should prioritize personal directory over project for namespaced commands", async () => {
			// Create same namespaced command in both directories
			const personalPath = "/home/testuser/.claude/commands/shared/util.md";
			const projectPath = "./.claude/commands/shared/util.md";

			await fileService.writeFile(personalPath, mockCommandContent);
			await fileService.writeFile(projectPath, "project version");

			// Should return personal directory path (higher precedence)
			const path = await installationService.getInstallationPath("shared:util");
			expect(path).toBe(personalPath);
		});

		test("should return null for non-existent namespaced commands", async () => {
			// Try to find non-existent namespaced command
			const path = await installationService.getInstallationPath(
				"nonexistent:command",
			);
			expect(path).toBeNull();

			const isInstalled = await installationService.isInstalled(
				"nonexistent:command",
			);
			expect(isInstalled).toBe(false);
		});

		test("should handle mixed flat and namespaced commands correctly", async () => {
			// Create both flat and namespaced commands
			const flatPath = "/home/testuser/.claude/commands/helper.md";
			const namespacedPath = "/home/testuser/.claude/commands/utils/helper.md";

			await fileService.writeFile(flatPath, mockCommandContent);
			await fileService.writeFile(namespacedPath, mockCommandContent);

			// Should find flat command
			const flatFound = await installationService.getInstallationPath("helper");
			expect(flatFound).toBe(flatPath);

			// Should find namespaced command
			const namespacedFound =
				await installationService.getInstallationPath("utils:helper");
			expect(namespacedFound).toBe(namespacedPath);

			// Should not find wrong namespace
			const wrongNamespace =
				await installationService.getInstallationPath("wrong:helper");
			expect(wrongNamespace).toBeNull();
		});

		test("should handle interactive confirmation for namespaced command removal", async () => {
			// Create a namespaced command
			const namespacedPath =
				"/home/testuser/.claude/commands/test/interactive.md";
			await fileService.writeFile(namespacedPath, mockCommandContent);

			// Configure mock to cancel removal
			userInteractionService.setDefaultResponse(false);

			// Try to remove without --yes flag (should be cancelled)
			await installationService.removeCommand("test:interactive");

			// Should still exist because user cancelled
			expect(await fileService.exists(namespacedPath)).toBe(true);

			// Configure mock to confirm removal
			userInteractionService.setDefaultResponse(true);

			// Remove without --yes flag (should succeed)
			await installationService.removeCommand("test:interactive");

			// Should be removed because user confirmed
			expect(await fileService.exists(namespacedPath)).toBe(false);
		});
	});

	describe("Milestone 2.3: Enhanced Location Tracking and Metadata", () => {
		describe("location tracking and metadata", () => {
			test("should track installation source and enhanced metadata", async () => {
				const beforeInstall = new Date();
				await installationService.installCommand("test-command");
				const afterInstall = new Date();

				const info =
					await installationService.getInstallationInfo("test-command");

				expect(info).toBeDefined();
				expect(info?.name).toBe("test-command");
				expect(info?.location).toBe("personal");
				expect(info?.source).toBe("repository");
				expect(info?.installedAt).toBeInstanceOf(Date);
				expect(info?.installedAt.getTime()).toBeGreaterThanOrEqual(
					beforeInstall.getTime(),
				);
				expect(info?.installedAt.getTime()).toBeLessThanOrEqual(
					afterInstall.getTime(),
				);
				expect(info?.version).toBeDefined();
			});

			test("should differentiate between repository and local sources", async () => {
				// Install from repository
				await installationService.installCommand("test-command");
				const repoInfo =
					await installationService.getInstallationInfo("test-command");

				// Manually create a local command file (simulating local source)
				const localPath = "/home/testuser/.claude/commands/local-command.md";
				await fileService.writeFile(localPath, mockCommandContent);

				const localInfo =
					await installationService.getInstallationInfo("local-command");

				expect(repoInfo?.source).toBe("repository");
				expect(localInfo?.source).toBe("local");
			});

			test("should track installation metadata for project vs personal", async () => {
				// Install to personal directory
				await installationService.installCommand("test-command", {
					target: "personal",
				});
				const personalInfo =
					await installationService.getInstallationInfo("test-command");

				// Install to project directory
				await installationService.installCommand("test-command", {
					target: "project",
					force: true,
				});
				const projectInfo =
					await installationService.getInstallationInfo("test-command");

				expect(personalInfo?.location).toBe("personal");
				expect(projectInfo?.location).toBe("project");
				expect(personalInfo?.filePath).toContain("/.claude/commands/");
				expect(projectInfo?.filePath).toContain(".claude/commands/");
			});

			test("should provide detailed installation metadata", async () => {
				await installationService.installCommand("test-command");
				const info =
					await installationService.getInstallationInfo("test-command");

				expect(info).toBeDefined();
				expect(info?.metadata).toBeDefined();
				expect(info?.metadata.repositoryVersion).toBe("1.0.0");
				expect(info?.metadata.language).toBe("en");
				expect(info?.metadata.installationOptions).toBeDefined();
			});

			test("should return enhanced installation info for all installed commands", async () => {
				await installationService.installCommand("test-command");

				const allInfo = await installationService.getAllInstallationInfo();

				expect(allInfo).toHaveLength(1);
				expect(allInfo[0]?.name).toBe("test-command");
				expect(allInfo[0]?.location).toBe("personal");
				expect(allInfo[0]?.source).toBe("repository");
				expect(allInfo[0]?.installedAt).toBeInstanceOf(Date);
			});

			test("should return installation info with location indicators", async () => {
				// Install same command to both locations
				await installationService.installCommand("test-command", {
					target: "personal",
				});
				await installationService.installCommand("test-command", {
					target: "project",
					force: true,
				});

				const allInfo = await installationService.getAllInstallationInfo();

				expect(allInfo).toHaveLength(2);
				const locations = allInfo.map((info) => info.location);
				expect(locations).toContain("personal");
				expect(locations).toContain("project");
			});

			test("should provide command count and summary information", async () => {
				await installationService.installCommand("test-command", {
					target: "personal",
				});

				// Add project command
				const projectCommand: Command = {
					name: "project-command",
					description: "A project-specific command",
					file: "project-command.md",
					"allowed-tools": ["Read", "Write"],
				};

				repository.setManifest("en", {
					version: "1.0.0",
					updated: "2025-01-01T00:00:00Z",
					commands: [mockCommand, projectCommand],
				});

				const projectContent = `---
description: A project-specific command
allowed-tools: Read, Write
---

# Project Command
`;
				repository.setCommand("project-command", "en", projectContent);
				await installationService.installCommand("project-command", {
					target: "project",
				});

				const summary = await installationService.getInstallationSummary();

				expect(summary.totalCommands).toBe(2);
				expect(summary.personalCount).toBe(1);
				expect(summary.projectCount).toBe(1);
				expect(summary.locations).toEqual(["personal", "project"]);
			});
		});
	});

	describe("security validation", () => {
		test("should reject command names with path traversal attempts", async () => {
			await expect(
				installationService.installCommand("../../../etc/passwd"),
			).rejects.toThrow(InstallationError);
		});

		test("should reject command names with dangerous path segments", async () => {
			await expect(
				installationService.installCommand("valid/../invalid"),
			).rejects.toThrow(InstallationError);
		});

		test("should reject absolute path command names", async () => {
			await expect(
				installationService.installCommand("/etc/passwd"),
			).rejects.toThrow(InstallationError);
		});

		test("should reject empty command names", async () => {
			await expect(installationService.installCommand("")).rejects.toThrow(
				InstallationError,
			);
		});

		test("should accept valid namespaced command names", async () => {
			// Set up a valid namespaced command in the repository
			const namespacedCommand = {
				name: "frontend:component",
				description: "Create a frontend component",
				file: "frontend/component.md",
				"allowed-tools": ["Read", "Write"],
			};

			repository.setManifest("en", {
				version: "1.0.0",
				updated: "2025-01-01T00:00:00Z",
				commands: [mockCommand, namespacedCommand],
			});

			repository.setCommand("frontend:component", "en", mockCommandContent);

			// This should not throw
			await installationService.installCommand("frontend:component");
		});

		test("should accept valid command names with slash separators", async () => {
			// Set up a valid command with slash separators in the repository
			const slashCommand = {
				name: "project/frontend/component",
				description: "Create a project frontend component",
				file: "project/frontend/component.md",
				"allowed-tools": ["Read", "Write"],
			};

			repository.setManifest("en", {
				version: "1.0.0",
				updated: "2025-01-01T00:00:00Z",
				commands: [mockCommand, slashCommand],
			});

			repository.setCommand(
				"project/frontend/component",
				"en",
				mockCommandContent,
			);

			// This should not throw
			await installationService.installCommand("project/frontend/component");
		});
	});
});
