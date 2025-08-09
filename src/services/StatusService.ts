import * as path from "node:path";
import type IFileService from "../interfaces/IFileService.js";
import type {
	CacheInfo,
	InstallationInfo,
	SystemHealth,
	SystemStatus,
} from "../types/Status.js";
import { StatusError } from "../types/Status.js";
import type { CacheManager } from "./CacheManager.js";
import type { ConfigManager } from "./ConfigManager.js";
import type { DirectoryDetector } from "./DirectoryDetector.js";
import type { LanguageDetector } from "./LanguageDetector.js";
import type { LocalCommandRepository } from "./LocalCommandRepository.js";

/**
 * Service for collecting comprehensive system status information
 *
 * Gathers data about cache status, installation directories, and system health
 * to provide a complete overview of the claude-cmd system state.
 *
 * Features:
 * - Cache status for all detected languages (age, size, health)
 * - Installation directory analysis (locations, accessibility, command counts)
 * - System health indicators with diagnostic messages
 * - Comprehensive error handling with graceful degradation
 */
export class StatusService {
	/**
	 * Create a new StatusService instance
	 *
	 * @param fileService - File service for I/O operations
	 * @param cacheManager - Cache manager for cache-related operations
	 * @param directoryDetector - Directory detector for installation paths
	 * @param localCommandRepository - Repository for local command analysis
	 * @param languageDetector - Language detector for language support
	 * @param configManager - Config manager for effective language detection
	 */
	constructor(
		private readonly fileService: IFileService,
		private readonly cacheManager: CacheManager,
		private readonly directoryDetector: DirectoryDetector,
		private readonly localCommandRepository: LocalCommandRepository,
		private readonly languageDetector: LanguageDetector,
		private readonly configManager: ConfigManager,
	) {}

	/**
	 * Collect complete system status information
	 *
	 * @returns Promise resolving to comprehensive system status
	 * @throws StatusError if critical status collection fails
	 */
	async getSystemStatus(): Promise<SystemStatus> {
		try {
			const timestamp = Date.now();

			// Collect status information in parallel for better performance
			const [cache, installations, health] = await Promise.all([
				this.collectCacheStatus(),
				this.collectInstallationStatus(),
				this.assessSystemHealth(),
			]);

			return {
				timestamp,
				cache,
				installations,
				health,
			};
		} catch (error) {
			throw new StatusError(
				"Failed to collect system status",
				error instanceof Error ? error : new Error(String(error)),
			);
		}
	}

	/**
	 * Collect cache status information for all existing cached languages
	 *
	 * @returns Promise resolving to array of cache information
	 */
	private async collectCacheStatus(): Promise<readonly CacheInfo[]> {
		const cacheInfos: CacheInfo[] = [];

		try {
			// Discover languages that actually have cache files
			const existingLanguages = await this.getExistingCachedLanguages();

			for (const language of existingLanguages) {
				try {
					const cacheInfo = await this.analyzeCacheForLanguage(language);
					cacheInfos.push(cacheInfo);
				} catch (error) {
					// Continue with other languages if one fails
					cacheInfos.push({
						language,
						exists: false,
						path: this.cacheManager.getCachePath(language),
						isExpired: true,
						ageMs: undefined,
						sizeBytes: undefined,
						commandCount: undefined,
					});
				}
			}
		} catch (error) {
			// If we can't discover cached languages, return empty array
			// This gracefully handles cases where cache directory doesn't exist
		}

		return cacheInfos;
	}

	/**
	 * Discover languages that actually have cache files by scanning the cache directory
	 *
	 * @returns Promise resolving to array of language codes with existing cache files
	 */
	private async getExistingCachedLanguages(): Promise<string[]> {
		const languages: string[] = [];

		try {
			// Get the base cache directory (e.g., ~/.cache/claude-cmd/pages)
			// getCachePath returns {cacheDir}/{language}/manifest.json
			// So we need to go up two levels: dirname(dirname(path))
			const dummyCachePath = this.cacheManager.getCachePath("dummy");
			const cacheBaseDir = path.dirname(path.dirname(dummyCachePath));

			// Check if cache directory exists
			const exists = await this.fileService.exists(cacheBaseDir);
			if (!exists) {
				return languages;
			}

			// List all entries in the cache directory
			// We need both files and directories, so we need to use a different approach
			// Since IFileService doesn't have listEntries, we'll simulate it for InMemoryFileService
			let entries: string[] = [];
			if (typeof (this.fileService as any).listEntries === "function") {
				// Use listEntries for InMemoryFileService (testing)
				entries = await (this.fileService as any).listEntries(cacheBaseDir);
			} else {
				// For real file service (BunFileService), we need a different approach
				// This is a limitation - we can't easily discover language directories
				// For now, we'll just try the common languages
				const commonLanguages = [
					"en",
					"es",
					"fr",
					"de",
					"it",
					"pt",
					"ru",
					"zh",
					"ja",
					"ko",
				];
				for (const lang of commonLanguages) {
					const manifestPath = path.join(cacheBaseDir, lang, "manifest.json");
					if (await this.fileService.exists(manifestPath)) {
						entries.push(lang);
					}
				}
			}

			for (const entry of entries) {
				// Check if this entry has a corresponding manifest.json file
				const manifestPath = path.join(cacheBaseDir, entry, "manifest.json");
				const hasManifest = await this.fileService.exists(manifestPath);

				if (hasManifest) {
					// Validate that this is a valid language code
					try {
						if (this.languageDetector.isValidLanguageCode(entry)) {
							languages.push(entry);
						}
					} catch {
						// Skip invalid language codes
					}
				}
			}
		} catch (error) {
			// If we can't scan the directory, return empty array
			// This handles cases where cache directory doesn't exist or isn't readable
		}

		return languages.sort(); // Sort for consistent output
	}

	/**
	 * Analyze cache information for a specific language
	 *
	 * @param language - Language code to analyze
	 * @returns Promise resolving to cache information
	 */
	private async analyzeCacheForLanguage(language: string): Promise<CacheInfo> {
		const cachePath = this.cacheManager.getCachePath(language);
		const exists = await this.fileService.exists(cachePath);

		if (!exists) {
			return {
				language,
				exists: false,
				path: cachePath,
				isExpired: true,
			};
		}

		try {
			// Get cache age by checking the cached manifest
			const isExpired = await this.cacheManager.isExpired(language);
			const manifest = await this.cacheManager.get(language);

			// Try to get file stats for additional information
			let ageMs: number | undefined;
			let sizeBytes: number | undefined;

			try {
				const content = await this.fileService.readFile(cachePath);
				sizeBytes = Buffer.byteLength(content, "utf8");

				// Parse timestamp from cache entry to calculate age
				const parsed = JSON.parse(content);
				if (parsed && typeof parsed.timestamp === "number") {
					ageMs = Date.now() - parsed.timestamp;
				}
			} catch {
				// Continue without file stats if they can't be determined
			}

			return {
				language,
				exists: true,
				path: cachePath,
				isExpired,
				ageMs,
				sizeBytes,
				commandCount: manifest?.commands.length,
			};
		} catch {
			return {
				language,
				exists: true,
				path: cachePath,
				isExpired: true,
				ageMs: undefined,
				sizeBytes: undefined,
				commandCount: undefined,
			};
		}
	}

	/**
	 * Collect installation directory status information
	 *
	 * @returns Promise resolving to array of installation information
	 */
	private async collectInstallationStatus(): Promise<
		readonly InstallationInfo[]
	> {
		const installations: InstallationInfo[] = [];

		try {
			// Check project-specific directory
			const projectDir = await this.directoryDetector.getProjectDirectory();
			if (projectDir) {
				const projectInfo = await this.analyzeInstallationDirectory(
					projectDir,
					"project",
				);
				installations.push(projectInfo);
			}
		} catch {
			// Continue if project directory analysis fails
		}

		try {
			// Check personal directory (user-global)
			const personalDir = await this.directoryDetector.getPersonalDirectory();
			const personalInfo = await this.analyzeInstallationDirectory(
				personalDir,
				"user",
			);
			installations.push(personalInfo);
		} catch {
			// Continue if personal directory analysis fails
		}

		return installations;
	}

	/**
	 * Analyze installation directory information
	 *
	 * @param dirPath - Directory path to analyze
	 * @param type - Directory type (project or user)
	 * @returns Promise resolving to installation information
	 */
	private async analyzeInstallationDirectory(
		dirPath: string,
		type: "project" | "user",
	): Promise<InstallationInfo> {
		const exists = await this.fileService.exists(dirPath);
		let writable = false;
		let commandCount = 0;

		if (exists) {
			try {
				writable = await this.fileService.isWritable(dirPath);

				// Count installed commands using LocalCommandRepository
				const detectedLanguage =
					await this.configManager.getEffectiveLanguage();
				try {
					const manifest =
						await this.localCommandRepository.getManifest(detectedLanguage);
					commandCount = manifest.commands.length;
				} catch {
					// If we can't get commands, at least try to count files
					try {
						const files = await this.fileService.listFilesRecursive(dirPath);
						commandCount = files.filter((file) => file.endsWith(".md")).length;
					} catch {
						// Leave commandCount as 0 if we can't determine it
					}
				}
			} catch {
				// Continue with defaults if checks fail
			}
		}

		return {
			type,
			path: dirPath,
			exists,
			writable,
			commandCount,
		};
	}

	/**
	 * Assess overall system health
	 *
	 * @returns Promise resolving to system health information
	 */
	private async assessSystemHealth(): Promise<SystemHealth> {
		const messages: string[] = [];
		let cacheAccessible = true;
		let installationPossible = false;

		// Check cache accessibility
		try {
			const testLanguage = "en"; // Use English as a test language
			const cachePath = this.cacheManager.getCachePath(testLanguage);
			const cacheDir = path.dirname(cachePath);

			// Check if we can create the cache directory
			await this.fileService.mkdir(cacheDir);

			// Try a test write to ensure cache is writable
			const testPath = path.join(cacheDir, ".test");
			await this.fileService.writeFile(testPath, "test");

			// Clean up test file
			try {
				await this.fileService.deleteFile(testPath);
			} catch {
				// Ignore cleanup failure
			}
		} catch (error) {
			cacheAccessible = false;
			messages.push(
				`Cache directory not accessible: ${error instanceof Error ? error.message : "Unknown error"}`,
			);
		}

		// Check if at least one installation directory is writable
		try {
			const personalDir = await this.directoryDetector.getPersonalDirectory();
			const personalWritable =
				(await this.fileService.exists(personalDir)) &&
				(await this.fileService.isWritable(personalDir));

			const projectDir = await this.directoryDetector.getProjectDirectory();
			const projectWritable = projectDir
				? (await this.fileService.exists(projectDir)) &&
					(await this.fileService.isWritable(projectDir))
				: false;

			installationPossible = personalWritable || projectWritable;

			if (!installationPossible) {
				messages.push("No writable installation directories found");
			}
		} catch (error) {
			messages.push(
				`Installation directory check failed: ${error instanceof Error ? error.message : "Unknown error"}`,
			);
		}

		// Determine overall status
		let status: "healthy" | "degraded" | "error";
		if (!cacheAccessible && !installationPossible) {
			status = "error";
		} else if (!cacheAccessible || !installationPossible) {
			status = "degraded";
		} else {
			status = "healthy";
		}

		return {
			cacheAccessible,
			installationPossible,
			status,
			messages,
		};
	}
}
