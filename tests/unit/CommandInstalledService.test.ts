import { beforeEach, describe, expect, it } from "bun:test";
import { CommandInstalledService } from "../../src/services/CommandInstalledService.js";
import { CommandParser } from "../../src/services/CommandParser.js";
import { DirectoryDetector } from "../../src/services/DirectoryDetector.js";
import { InstallationService } from "../../src/services/InstallationService.js";
import { LanguageDetector } from "../../src/services/LanguageDetector.js";
import { LocalCommandRepository } from "../../src/services/LocalCommandRepository.js";
import NamespaceService from "../../src/services/NamespaceService.js";
import InMemoryFileService from "../mocks/InMemoryFileService.js";
import InMemoryHTTPClient from "../mocks/InMemoryHTTPClient.js";
import InMemoryRepository from "../mocks/InMemoryRepository.js";
import InMemoryUserInteractionService from "../mocks/InMemoryUserInteractionService.js";

describe("CommandInstalledService", () => {
	let commandInstalledService: CommandInstalledService;
	let installationService: InstallationService;
	let languageDetector: LanguageDetector;
	let fileService: InMemoryFileService;

	beforeEach(() => {
		// Create in-memory dependencies
		fileService = new InMemoryFileService();
		const httpClient = new InMemoryHTTPClient();
		const repository = new InMemoryRepository(httpClient, fileService);
		const directoryDetector = new DirectoryDetector(fileService);
		const namespaceService = new NamespaceService();
		const commandParser = new CommandParser(namespaceService);
		const localCommandRepository = new LocalCommandRepository(
			directoryDetector,
			commandParser,
		);
		const userInteractionService = new InMemoryUserInteractionService();
		languageDetector = new LanguageDetector();

		installationService = new InstallationService(
			repository,
			fileService,
			directoryDetector,
			commandParser,
			localCommandRepository,
			userInteractionService,
		);

		// Create CommandInstalledService with in-memory dependencies
		commandInstalledService = new CommandInstalledService(
			installationService,
			languageDetector,
		);
	});

	describe("getInstalledCommands", () => {
		it("should return empty array when no commands are installed", async () => {
			// Execute
			const result = await commandInstalledService.getInstalledCommands();

			// Verify: Should return empty array
			expect(result).toEqual([]);
		});

		it("should return installed commands from local directories", async () => {
			// Setup: Create local commands
			await fileService.mkdir(".claude/commands");
			await fileService.writeFile(
				".claude/commands/local-command.md",
				`---
description: A local command
allowed-tools: ["read"]
---

# Local Command

This is a local command.`,
			);

			// Execute
			const result = await commandInstalledService.getInstalledCommands();

			// Verify: Should return installed commands
			expect(result).toBeInstanceOf(Array);
			expect(result.length).toBeGreaterThan(0);
			expect(result[0]?.name).toBe("local-command");
			expect(result[0]?.description).toBe("A local command");
		});

		it("should handle forceRefresh option", async () => {
			// Setup: Create local commands
			await fileService.mkdir(".claude/commands");
			await fileService.writeFile(
				".claude/commands/test-command.md",
				`---
description: Test command
allowed-tools: ["read"]
---

# Test Command`,
			);

			// Execute with forceRefresh
			const result = await commandInstalledService.getInstalledCommands({
				forceRefresh: true,
			});

			// Verify: Should return commands
			expect(result).toBeInstanceOf(Array);
			expect(result.length).toBeGreaterThan(0);
			expect(result[0]?.name).toBe("test-command");
		});

		it("should handle language option", async () => {
			// Setup: Create local commands
			await fileService.mkdir(".claude/commands");
			await fileService.writeFile(
				".claude/commands/multilang-command.md",
				`---
description: Multilingual command
allowed-tools: ["read"]
---

# Multilingual Command`,
			);

			// Execute with specific language
			const result = await commandInstalledService.getInstalledCommands({
				language: "en",
			});

			// Verify: Should return commands
			expect(result).toBeInstanceOf(Array);
			if (result.length > 0) {
				expect(result[0]?.name).toBe("multilang-command");
			}
		});
	});
});
