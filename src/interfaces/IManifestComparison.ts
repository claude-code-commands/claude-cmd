import type { Manifest, ManifestComparisonResult } from "../types/index.js";

/**
 * Service for comparing manifests and detecting changes between versions
 *
 * Provides comprehensive comparison capabilities for command manifests,
 * identifying added, removed, and modified commands with detailed change
 * information. Optimized for performance with large manifests.
 */
export default interface IManifestComparison {
	/**
	 * Compare two manifests and identify all changes
	 *
	 * Performs a deep comparison between old and new manifests, identifying
	 * all types of changes (added, removed, modified) and providing detailed
	 * information about what specifically changed in each command.
	 *
	 * @param oldManifest - The previous version of the manifest
	 * @param newManifest - The new version of the manifest to compare against
	 * @returns Promise resolving to complete comparison result with detailed changes
	 */
	compareManifests(
		oldManifest: Manifest,
		newManifest: Manifest,
	): Promise<ManifestComparisonResult>;

	/**
	 * Check if two manifests are identical
	 *
	 * Efficiently determines if two manifests contain exactly the same commands
	 * with identical metadata. Useful for quick checks before performing
	 * detailed comparisons.
	 *
	 * @param oldManifest - First manifest to compare
	 * @param newManifest - Second manifest to compare
	 * @returns Promise resolving to true if manifests are identical, false otherwise
	 */
	areManifestsIdentical(
		oldManifest: Manifest,
		newManifest: Manifest,
	): Promise<boolean>;
}
