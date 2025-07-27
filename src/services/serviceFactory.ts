import BunFileService from "./BunFileService.js";
import BunHTTPClient from "./BunHTTPClient.js";
import { CacheManager } from "./CacheManager.js";
import { CommandParser } from "./CommandParser.js";
import { CommandService } from "./CommandService.js";
import { DirectoryDetector } from "./DirectoryDetector.js";
import HTTPRepository from "./HTTPRepository.js";
import { InstallationService } from "./InstallationService.js";
import { LanguageDetector } from "./LanguageDetector.js";

/**
 * Service factory that creates and manages singleton instances of core services.
 * Centralizes dependency injection setup to eliminate code duplication across CLI commands.
 *
 * This factory follows the singleton pattern to ensure services are instantiated only once,
 * improving performance and maintaining consistent state across command executions.
 */

// Create singleton instances of services
let services: {
	commandService: CommandService;
	languageDetector: LanguageDetector;
	installationService: InstallationService;
} | null = null;

/**
 * Initialize and return singleton service instances.
 * Services are created on first access and reused for subsequent calls.
 *
 * @returns Object containing configured service instances
 */
export function getServices() {
	if (!services) {
		// Initialize core dependencies
		const fileService = new BunFileService();
		const httpClient = new BunHTTPClient();
		const repository = new HTTPRepository(httpClient, fileService);
		const cacheManager = new CacheManager(fileService);
		const languageDetector = new LanguageDetector();

		// Initialize InstallationService dependencies
		const directoryDetector = new DirectoryDetector(fileService);
		const commandParser = new CommandParser();

		// Create InstallationService first
		const installationService = new InstallationService(
			repository,
			fileService,
			directoryDetector,
			commandParser,
		);

		// Create CommandService with all dependencies including InstallationService
		const commandService = new CommandService(
			repository,
			cacheManager,
			languageDetector,
			installationService,
		);

		services = {
			commandService,
			languageDetector,
			installationService,
		};
	}

	return services;
}

/**
 * Reset service instances (primarily for testing purposes)
 * Allows tests to start with fresh service instances
 */
export function resetServices(): void {
	services = null;
}
