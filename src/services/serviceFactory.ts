import BunFileService from "./BunFileService.js";
import BunHTTPClient from "./BunHTTPClient.js";
import { CacheManager } from "./CacheManager.js";
import { CommandParser } from "./CommandParser.js";
import { CommandService } from "./CommandService.js";
import { DirectoryDetector } from "./DirectoryDetector.js";
import HTTPRepository from "./HTTPRepository.js";
import { InstallationService } from "./InstallationService.js";
import { LanguageDetector } from "./LanguageDetector.js";
import { LocalCommandRepository } from "./LocalCommandRepository.js";
import NamespaceService from "./NamespaceService.js";
import { ProjectConfigService } from "./ProjectConfigService.js";
import { UserConfigService } from "./UserConfigService.js";

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
	userConfigService: UserConfigService;
	localCommandRepository: LocalCommandRepository;
	projectConfigService: ProjectConfigService;
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
		const namespaceService = new NamespaceService();
		const commandParser = new CommandParser(namespaceService);

		// Create LocalCommandRepository for local command management
		const localCommandRepository = new LocalCommandRepository(
			directoryDetector,
			commandParser,
		);

		// Create InstallationService first
		const installationService = new InstallationService(
			repository,
			fileService,
			directoryDetector,
			commandParser,
			localCommandRepository,
		);

		// Create UserConfigService
		const userConfigService = new UserConfigService(fileService, repository);

		// Create ProjectConfigService
		const projectConfigService = new ProjectConfigService(fileService);

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
			userConfigService,
			localCommandRepository,
			projectConfigService,
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
