import * as os from "node:os";
import * as path from "node:path";
import BunFileService from "./BunFileService.js";
import BunHTTPClient from "./BunHTTPClient.js";
import { CacheManager } from "./CacheManager.js";
import { ChangeDisplayFormatter } from "./ChangeDisplayFormatter.js";
import { CommandParser } from "./CommandParser.js";
import { CommandService } from "./CommandService.js";
import { ConfigManager } from "./ConfigManager.js";
import { ConfigService } from "./ConfigService.js";
import { DirectoryDetector } from "./DirectoryDetector.js";
import HTTPRepository from "./HTTPRepository.js";
import { InstallationService } from "./InstallationService.js";
import { LanguageDetector } from "./LanguageDetector.js";
import { LocalCommandRepository } from "./LocalCommandRepository.js";
import { ManifestComparison } from "./ManifestComparison.js";
import NamespaceService from "./NamespaceService.js";
import { UserInteractionService } from "./UserInteractionService.js";

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
	userConfigService: ConfigService;
	projectConfigService: ConfigService;
	configManager: ConfigManager;
	localCommandRepository: LocalCommandRepository;
	userInteractionService: UserInteractionService;
	manifestComparison: ManifestComparison;
	changeDisplayFormatter: ChangeDisplayFormatter;
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

		// Create UserInteractionService
		const userInteractionService = new UserInteractionService();

		// Create ManifestComparison service
		const manifestComparison = new ManifestComparison();

		// Create ChangeDisplayFormatter service
		const changeDisplayFormatter = new ChangeDisplayFormatter();

		// Create InstallationService with UserInteractionService dependency
		const installationService = new InstallationService(
			repository,
			fileService,
			directoryDetector,
			commandParser,
			localCommandRepository,
			userInteractionService,
		);

		// Create ConfigService instances with shared LanguageDetector
		const userConfigPath = path.join(
			os.homedir(),
			".config",
			"claude-cmd",
			"config.claude-cmd.json",
		);
		const projectConfigPath = path.join(".claude", "config.claude-cmd.json");

		// First create ConfigService instances without ConfigManager
		const userConfigService = new ConfigService(
			userConfigPath,
			fileService,
			repository,
			languageDetector,
		);

		const projectConfigService = new ConfigService(
			projectConfigPath,
			fileService,
			repository,
			languageDetector,
		);

		// Create ConfigManager to orchestrate precedence
		const configManager = new ConfigManager(
			userConfigService,
			projectConfigService,
			languageDetector,
		);

		// Now recreate userConfigService with ConfigManager for getLanguageStatus
		const userConfigServiceWithManager = new ConfigService(
			userConfigPath,
			fileService,
			repository,
			languageDetector,
			configManager,
		);

		// Create CommandService with all dependencies including InstallationService
		const commandService = new CommandService(
			repository,
			cacheManager,
			languageDetector,
			installationService,
			manifestComparison,
			localCommandRepository,
			directoryDetector,
		);

		services = {
			commandService,
			languageDetector,
			installationService,
			userConfigService: userConfigServiceWithManager,
			projectConfigService,
			configManager,
			localCommandRepository,
			userInteractionService,
			manifestComparison,
			changeDisplayFormatter,
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
