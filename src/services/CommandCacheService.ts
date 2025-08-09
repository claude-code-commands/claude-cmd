import type IManifestComparison from "../interfaces/IManifestComparison.js";
import type IRepository from "../interfaces/IRepository.js";
import type {
	CacheUpdateResult,
	CacheUpdateResultWithChanges,
	CommandServiceOptions,
} from "../types/Command.js";
import type { ManifestComparisonResult } from "../types/ManifestComparison.js";
import type { CacheManager } from "./CacheManager.js";
import type { LanguageDetector } from "./LanguageDetector.js";
import {
	resolveLanguage,
	withErrorHandling,
} from "./shared/CommandServiceHelpers.js";

/**
 * CommandCacheService handles cache management and update operations.
 *
 * Responsibilities:
 * - Update local cache with fresh manifest data
 * - Detect changes between cached and new manifests
 * - Coordinate with repository and manifest comparison services
 */
export class CommandCacheService {
	constructor(
		private readonly repository: IRepository,
		private readonly cacheManager: CacheManager,
		private readonly languageDetector: LanguageDetector,
		private readonly manifestComparison: IManifestComparison,
	) {}

	/**
	 * Update the local cache with fresh manifest data from the repository
	 */
	async updateCache(
		options?: CommandServiceOptions,
	): Promise<CacheUpdateResult> {
		const language = resolveLanguage(options, this.languageDetector);

		return withErrorHandling("updateCache", language, async () => {
			// Always force refresh for explicit updates
			const manifest = await this.repository.getManifest(language, {
				forceRefresh: true,
			});

			// Update cache with fresh manifest
			await this.cacheManager.set(language, manifest);

			return {
				language,
				timestamp: Date.now(),
				commandCount: manifest.commands.length,
			};
		});
	}

	/**
	 * Update the local cache with fresh manifest data and detect changes
	 */
	async updateCacheWithChanges(
		options?: CommandServiceOptions,
	): Promise<CacheUpdateResultWithChanges> {
		const language = resolveLanguage(options, this.languageDetector);

		return withErrorHandling("updateCacheWithChanges", language, async () => {
			// Get the current cached manifest for comparison (if it exists)
			const oldManifest = await this.cacheManager.get(language);

			// Always force refresh for explicit updates
			const newManifest = await this.repository.getManifest(language, {
				forceRefresh: true,
			});

			let hasChanges = false;
			let added = 0;
			let removed = 0;
			let modified = 0;
			let comparisonResult: ManifestComparisonResult | undefined;

			// Compare manifests if old one exists
			if (oldManifest) {
				comparisonResult = await this.manifestComparison.compareManifests(
					oldManifest,
					newManifest,
				);
				hasChanges = comparisonResult.summary.hasChanges;
				added = comparisonResult.summary.added;
				removed = comparisonResult.summary.removed;
				modified = comparisonResult.summary.modified;
			} else {
				// If no old manifest exists, all commands are considered "added"
				hasChanges = newManifest.commands.length > 0;
				added = newManifest.commands.length;
			}

			// Update cache with fresh manifest
			await this.cacheManager.set(language, newManifest);

			return {
				language,
				timestamp: Date.now(),
				commandCount: newManifest.commands.length,
				hasChanges,
				added,
				removed,
				modified,
				comparisonResult,
			};
		});
	}
}
