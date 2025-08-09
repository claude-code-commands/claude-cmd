import { beforeEach, describe, expect, it } from "bun:test";
import { CacheManager } from "../../src/services/CacheManager.js";
import { CommandEnrichmentService } from "../../src/services/CommandEnrichmentService.js";
import { CommandParser } from "../../src/services/CommandParser.js";
import { CommandQueryService } from "../../src/services/CommandQueryService.js";
import { DirectoryDetector } from "../../src/services/DirectoryDetector.js";
import { InstallationService } from "../../src/services/InstallationService.js";
import { LanguageDetector } from "../../src/services/LanguageDetector.js";
import { LocalCommandRepository } from "../../src/services/LocalCommandRepository.js";
import NamespaceService from "../../src/services/NamespaceService.js";
import { CommandNotFoundError } from "../../src/types/Command.js";
import InMemoryFileService from "../mocks/InMemoryFileService.js";
import InMemoryHTTPClient from "../mocks/InMemoryHTTPClient.js";
import InMemoryRepository from "../mocks/InMemoryRepository.js";
import InMemoryUserInteractionService from "../mocks/InMemoryUserInteractionService.js";

describe("CommandEnrichmentService", () => {
	let commandEnrichmentService: CommandEnrichmentService;
	let repository: InMemoryRepository;
	let cacheManager: CacheManager;
	let languageDetector: LanguageDetector;
	let installationService: InstallationService;
	let localCommandRepository: LocalCommandRepository;
	let commandQueryService: CommandQueryService;
	let directoryDetector: DirectoryDetector;
	let fileService: InMemoryFileService;
	let httpClient: InMemoryHTTPClient;

	beforeEach(() => {
		// Create in-memory dependencies
		fileService = new InMemoryFileService();
		httpClient = new InMemoryHTTPClient();
		repository = new InMemoryRepository(httpClient, fileService);
		cacheManager = new CacheManager(fileService);
		languageDetector = new LanguageDetector();
		directoryDetector = new DirectoryDetector(fileService);
		const namespaceService = new NamespaceService();
		const commandParser = new CommandParser(namespaceService);
		const userInteractionService = new InMemoryUserInteractionService();
		localCommandRepository = new LocalCommandRepository(
			directoryDetector,
			commandParser,
		);
		installationService = new InstallationService(
			repository,
			fileService,
			directoryDetector,
			commandParser,
			localCommandRepository,
			userInteractionService,
		);

		commandQueryService = new CommandQueryService(
			repository,
			cacheManager,
			languageDetector,
		);

		// Create CommandEnrichmentService with in-memory dependencies
		commandEnrichmentService = new CommandEnrichmentService(
			commandQueryService,
			localCommandRepository,
			directoryDetector,
			languageDetector,
		);
	});

	describe("getEnhancedCommandInfo", () => {
		it("should return enhanced command info for repository commands", async () => {
			// Execute
			const result = await commandEnrichmentService.getEnhancedCommandInfo(
				"debug-help",
				{
					language: "en",
				},
			);

			// Verify: Should return enhanced command info
			expect(result.name).toBe("debug-help");
			expect(result.description).toContain("debug");
			expect(result.source).toBe("repository");
			expect(result.availableInSources).toContain("repository");
			expect(result.installationStatus).toBeDefined();
			expect(result.installationStatus?.isInstalled).toBe(false); // Not installed by default
		});

		it("should detect local commands and prefer them over repository", async () => {
			// Setup: Create a local command that also exists in repository
			const localCommand = {
				name: "debug-help",
				description: "Local debug command",
				file: "debug-help.md",
				"allowed-tools": ["Bash(echo)"],
			};

			// Create the project directory structure first
			await fileService.mkdir(".claude/commands");

			await fileService.writeFile(
				".claude/commands/debug-help.md",
				`---
description: ${localCommand.description}
allowed-tools: ${JSON.stringify(localCommand["allowed-tools"])}
---

# Local Debug Command

This is a local override of the debug command.`,
			);

			// Execute
			const result = await commandEnrichmentService.getEnhancedCommandInfo(
				"debug-help",
				{
					language: "en",
				},
			);

			// Verify: Should prefer local command
			expect(result.name).toBe("debug-help");
			expect(result.description).toBe(localCommand.description);
			expect(result.source).toMatch(/personal|project/); // Either is acceptable for test
			expect(result.availableInSources).toContain("repository");
			expect(result.availableInSources.length).toBeGreaterThan(1);
		});

		it("should show correct installation status for repository commands", async () => {
			// Execute: Get info for a repository command that's not installed
			const result = await commandEnrichmentService.getEnhancedCommandInfo(
				"debug-help",
				{
					language: "en",
				},
			);

			// Verify: Should show as not installed
			expect(result.installationStatus).toBeDefined();
			expect(result.installationStatus?.isInstalled).toBe(false);
			expect(result.installationStatus?.installLocation).toBeUndefined();
			expect(result.installationStatus?.installPath).toBeUndefined();
			expect(result.installationStatus?.hasLocalChanges).toBe(false);
		});

		it("should detect installation status and local changes", async () => {
			// Setup: Create a local command that differs from repository version
			await fileService.mkdir(".claude/commands");
			await fileService.writeFile(
				".claude/commands/debug-help.md",
				`---
description: Modified debug command
allowed-tools: ["Bash(echo)", "Read"]
---

# Modified Debug Command

This is a modified version.`,
			);

			// Execute
			const result = await commandEnrichmentService.getEnhancedCommandInfo(
				"debug-help",
				{
					language: "en",
				},
			);

			// Verify: Should show as installed with local changes
			expect(result.installationStatus).toBeDefined();
			expect(result.installationStatus?.isInstalled).toBe(true);
			expect(result.installationStatus?.installLocation).toBeDefined();
			expect(result.installationStatus?.installPath).toContain("debug-help.md");
			expect(result.installationStatus?.hasLocalChanges).toBe(true); // Description and tools differ
		});

		it("should throw CommandNotFoundError when command doesn't exist anywhere", async () => {
			// Execute & Verify: Should throw error for non-existent command
			await expect(
				commandEnrichmentService.getEnhancedCommandInfo("nonexistent-command", {
					language: "en",
				}),
			).rejects.toThrow(CommandNotFoundError);
		});
	});
});
