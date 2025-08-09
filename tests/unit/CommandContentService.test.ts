import { beforeEach, describe, expect, it } from "bun:test";
import { CacheManager } from "../../src/services/CacheManager.js";
import { CommandContentService } from "../../src/services/CommandContentService.js";
import { CommandParser } from "../../src/services/CommandParser.js";
import { CommandQueryService } from "../../src/services/CommandQueryService.js";
import { DirectoryDetector } from "../../src/services/DirectoryDetector.js";
import { LanguageDetector } from "../../src/services/LanguageDetector.js";
import { LocalCommandRepository } from "../../src/services/LocalCommandRepository.js";
import NamespaceService from "../../src/services/NamespaceService.js";
import { CommandNotFoundError } from "../../src/types/Command.js";
import InMemoryFileService from "../mocks/InMemoryFileService.js";
import InMemoryHTTPClient from "../mocks/InMemoryHTTPClient.js";
import InMemoryRepository from "../mocks/InMemoryRepository.js";

describe("CommandContentService", () => {
	let commandContentService: CommandContentService;
	let repository: InMemoryRepository;
	let commandQueryService: CommandQueryService;
	let fileService: InMemoryFileService;
	let httpClient: InMemoryHTTPClient;

	beforeEach(() => {
		// Create in-memory dependencies
		fileService = new InMemoryFileService();
		httpClient = new InMemoryHTTPClient();
		repository = new InMemoryRepository(httpClient, fileService);

		// Create required dependencies for CommandQueryService
		const cacheManager = new CacheManager(fileService);
		const languageDetector = new LanguageDetector();
		const directoryDetector = new DirectoryDetector(fileService);
		const namespaceService = new NamespaceService();
		const commandParser = new CommandParser(namespaceService);
		const localCommandRepository = new LocalCommandRepository(
			directoryDetector,
			commandParser,
		);

		commandQueryService = new CommandQueryService(
			repository,
			cacheManager,
			languageDetector,
		);

		// Create CommandContentService with in-memory dependencies
		commandContentService = new CommandContentService(
			repository,
			languageDetector,
			commandQueryService,
		);
	});

	describe("getCommandContent", () => {
		it("should return command content when command exists", async () => {
			// Execute
			const result = await commandContentService.getCommandContent(
				"debug-help",
				{
					language: "en",
				},
			);

			// Verify: Should return command content as string
			expect(typeof result).toBe("string");
			expect(result.length).toBeGreaterThan(0);
			expect(result).toContain("Debug Help"); // Should contain expected content
		});

		it("should throw CommandNotFoundError when command does not exist in manifest", async () => {
			// Execute & Verify: Should throw error for non-existent command
			await expect(
				commandContentService.getCommandContent("nonexistent-command", {
					language: "en",
				}),
			).rejects.toThrow(CommandNotFoundError);
		});

		it("should handle repository content errors gracefully", async () => {
			// Setup: Configure repository to fail for specific command content
			repository.setCommand(
				"content-error",
				"en",
				new Error("Content fetch failed"),
			);

			// Execute & Verify: Should propagate content error
			await expect(
				commandContentService.getCommandContent("content-error", {
					language: "en",
				}),
			).rejects.toThrow(Error);
		});
	});
});
