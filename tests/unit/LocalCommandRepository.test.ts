import { beforeEach, describe, expect, test } from "bun:test";
import { LocalCommandRepository } from "../../src/services/LocalCommandRepository.js";
import { DirectoryDetector } from "../../src/services/DirectoryDetector.js";
import { CommandParser } from "../../src/services/CommandParser.js";
import NamespaceService from "../../src/services/NamespaceService.js";
import InMemoryFileService from "../mocks/InMemoryFileService.js";
import { CommandNotFoundError } from "../../src/types/Command.js";

describe("LocalCommandRepository", () => {
	let fileService: InMemoryFileService;
	let directoryDetector: DirectoryDetector;
	let commandParser: CommandParser;
	let namespaceService: NamespaceService;
	let repository: LocalCommandRepository;

	beforeEach(() => {
		fileService = new InMemoryFileService();
		directoryDetector = new DirectoryDetector(fileService);
		namespaceService = new NamespaceService();
		commandParser = new CommandParser(namespaceService);
		repository = new LocalCommandRepository(directoryDetector, commandParser);
	});

	describe("getManifest", () => {
		test("should create manifest from local commands in both directories", async () => {
			// Mock environment
			const originalHome = process.env.HOME;
			process.env.HOME = "/Users/testuser";

			try {
				// Set up directory structure with commands
				await fileService.mkdir("/Users/testuser/.claude/commands");
				await fileService.mkdir(".claude/commands");
				await fileService.mkdir(".claude/commands/frontend");

				// Create command files with YAML frontmatter
				await fileService.writeFile(
					"/Users/testuser/.claude/commands/global-helper.md",
					`---
description: "Global helper command"
allowed-tools: ["Read", "Write"]
argument-hint: "[file]"
---
# Global Helper
This is a global helper command.`
				);

				await fileService.writeFile(
					".claude/commands/local-helper.md",
					`---
description: "Local helper command"
allowed-tools: ["Grep", "LS"]
---
# Local Helper
This is a local helper command.`
				);

				await fileService.writeFile(
					".claude/commands/frontend/component.md",
					`---
description: "Frontend component generator"
allowed-tools: ["Write", "Edit"]
namespace: "frontend"
---
# Component Generator
Creates React components.`
				);

				const manifest = await repository.getManifest("en");

				expect(manifest.version).toBe("1.0.0");
				expect(manifest.commands).toHaveLength(3);

				// Check commands are properly parsed
				const globalCmd = manifest.commands.find(c => c.name === "global-helper");
				const localCmd = manifest.commands.find(c => c.name === "local-helper");
				const componentCmd = manifest.commands.find(c => c.name === "component");

				expect(globalCmd).toBeDefined();
				expect(globalCmd?.description).toBe("Global helper command");
				expect(globalCmd?.["allowed-tools"]).toEqual(["Read", "Write"]);
				expect(globalCmd?.["argument-hint"]).toBe("[file]");

				expect(localCmd).toBeDefined();
				expect(localCmd?.description).toBe("Local helper command");
				expect(localCmd?.["allowed-tools"]).toEqual(["Grep", "LS"]);

				expect(componentCmd).toBeDefined();
				expect(componentCmd?.description).toBe("Frontend component generator");
				expect(componentCmd?.namespace).toBe("frontend");
			} finally {
				process.env.HOME = originalHome;
			}
		});

		test("should handle empty directories gracefully", async () => {
			const originalHome = process.env.HOME;
			process.env.HOME = "/Users/testuser";

			try {
				const manifest = await repository.getManifest("en");

				expect(manifest.version).toBe("1.0.0");
				expect(manifest.commands).toHaveLength(0);
				expect(manifest.updated).toBeDefined();
			} finally {
				process.env.HOME = originalHome;
			}
		});

		test("should handle malformed command files gracefully", async () => {
			const originalHome = process.env.HOME;
			process.env.HOME = "/Users/testuser";

			try {
				await fileService.mkdir("/Users/testuser/.claude/commands");

				// Create valid and invalid command files
				await fileService.writeFile(
					"/Users/testuser/.claude/commands/valid.md",
					`---
description: "Valid command"
---
# Valid Command`
				);

				await fileService.writeFile(
					"/Users/testuser/.claude/commands/invalid.md",
					`---
description: "Invalid command"
invalid-yaml: [unclosed
---
# Invalid Command`
				);

				const manifest = await repository.getManifest("en");

				// Should only include valid command
				expect(manifest.commands).toHaveLength(1);
				expect(manifest.commands[0].name).toBe("valid");
			} finally {
				process.env.HOME = originalHome;
			}
		});

		test("should ignore language parameter (local commands are language-agnostic)", async () => {
			const originalHome = process.env.HOME;
			process.env.HOME = "/Users/testuser";

			try {
				await fileService.mkdir("/Users/testuser/.claude/commands");
				await fileService.writeFile(
					"/Users/testuser/.claude/commands/test.md",
					`---
description: "Test command"
---
# Test`
				);

				const manifestEn = await repository.getManifest("en");
				const manifestFr = await repository.getManifest("fr");

				// Both should return same results (local commands are language-agnostic)
				expect(manifestEn.commands).toHaveLength(1);
				expect(manifestFr.commands).toHaveLength(1);
				expect(manifestEn.commands[0].name).toBe(manifestFr.commands[0].name);
			} finally {
				process.env.HOME = originalHome;
			}
		});

		test("should handle nested namespace structures", async () => {
			const originalHome = process.env.HOME;
			process.env.HOME = "/Users/testuser";

			try {
				await fileService.mkdir("/Users/testuser/.claude/commands");
				await fileService.mkdir("/Users/testuser/.claude/commands/backend");
				await fileService.mkdir("/Users/testuser/.claude/commands/backend/auth");

				await fileService.writeFile(
					"/Users/testuser/.claude/commands/backend/auth/login.md",
					`---
description: "Login authentication helper"
---
# Login Helper`
				);

				const manifest = await repository.getManifest("en");

				expect(manifest.commands).toHaveLength(1);
				const loginCmd = manifest.commands[0];
				expect(loginCmd.name).toBe("login");
				expect(loginCmd.namespace).toBe("backend:auth");
				expect(loginCmd.file).toBe("backend/auth/login.md");
			} finally {
				process.env.HOME = originalHome;
			}
		});
	});

	describe("getCommand", () => {
		test("should return command content for existing command", async () => {
			const originalHome = process.env.HOME;
			process.env.HOME = "/Users/testuser";

			try {
				await fileService.mkdir("/Users/testuser/.claude/commands");
				const commandContent = `---
description: "Test command"
---
# Test Command
This is test content.`;

				await fileService.writeFile(
					"/Users/testuser/.claude/commands/test.md",
					commandContent
				);

				const content = await repository.getCommand("test", "en");
				expect(content).toBe(commandContent);
			} finally {
				process.env.HOME = originalHome;
			}
		});

		test("should handle namespaced commands", async () => {
			const originalHome = process.env.HOME;
			process.env.HOME = "/Users/testuser";

			try {
				await fileService.mkdir("/Users/testuser/.claude/commands");
				await fileService.mkdir("/Users/testuser/.claude/commands/frontend");

				const commandContent = `---
description: "Component generator"
---
# Component Generator`;

				await fileService.writeFile(
					"/Users/testuser/.claude/commands/frontend/component.md",
					commandContent
				);

				// Should find command by name regardless of namespace
				const content = await repository.getCommand("component", "en");
				expect(content).toBe(commandContent);
			} finally {
				process.env.HOME = originalHome;
			}
		});

		test("should throw CommandNotFoundError for non-existent command", async () => {
			const originalHome = process.env.HOME;
			process.env.HOME = "/Users/testuser";

			try {
				await expect(repository.getCommand("nonexistent", "en"))
					.rejects.toThrow(CommandNotFoundError);
			} finally {
				process.env.HOME = originalHome;
			}
		});

		test("should prioritize personal directory over project directory", async () => {
			const originalHome = process.env.HOME;
			process.env.HOME = "/Users/testuser";

			try {
				await fileService.mkdir("/Users/testuser/.claude/commands");
				await fileService.mkdir(".claude/commands");

				const personalContent = "# Personal Command";
				const projectContent = "# Project Command";

				await fileService.writeFile(
					"/Users/testuser/.claude/commands/duplicate.md",
					personalContent
				);

				await fileService.writeFile(
					".claude/commands/duplicate.md",
					projectContent
				);

				const content = await repository.getCommand("duplicate", "en");
				expect(content).toBe(personalContent);
			} finally {
				process.env.HOME = originalHome;
			}
		});
	});

	describe("repository options", () => {
		test("should ignore forceRefresh option (local commands are always fresh)", async () => {
			const originalHome = process.env.HOME;
			process.env.HOME = "/Users/testuser";

			try {
				await fileService.mkdir("/Users/testuser/.claude/commands");
				await fileService.writeFile(
					"/Users/testuser/.claude/commands/test.md",
					`---
description: "Test command"
---
# Test`
				);

				const manifest1 = await repository.getManifest("en", { forceRefresh: false });
				const manifest2 = await repository.getManifest("en", { forceRefresh: true });

				// Should return same results regardless of forceRefresh
				expect(manifest1.commands).toHaveLength(1);
				expect(manifest2.commands).toHaveLength(1);
				expect(manifest1.commands[0].name).toBe(manifest2.commands[0].name);
			} finally {
				process.env.HOME = originalHome;
			}
		});

		test("should ignore maxAge option (local commands don't expire)", async () => {
			const originalHome = process.env.HOME;
			process.env.HOME = "/Users/testuser";

			try {
				await fileService.mkdir("/Users/testuser/.claude/commands");
				await fileService.writeFile(
					"/Users/testuser/.claude/commands/test.md",
					`---
description: "Test command"
---
# Test`
				);

				const manifest = await repository.getManifest("en", { maxAge: 0 });

				expect(manifest.commands).toHaveLength(1);
			} finally {
				process.env.HOME = originalHome;
			}
		});
	});
});