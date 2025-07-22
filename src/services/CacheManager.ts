import * as os from "node:os";
import * as path from "node:path";
import type IFileService from "../interfaces/IFileService";
import { FileNotFoundError } from "../interfaces/IFileService";
import type { Manifest } from "../types/Command";
import { LanguageDetector } from "./LanguageDetector";

/**
 * Cache entry structure that stores the manifest with metadata
 */
interface CacheEntry {
	/** The cached manifest data */
	manifest: Manifest;
	/** Timestamp when this entry was cached (milliseconds since Unix epoch) */
	timestamp: number;
}

/**
 * Error thrown when cache operations fail
 */
export class CacheError extends Error {
	constructor(
		message: string,
		public readonly language: string,
		public override readonly cause?: Error,
	) {
		super(message);
		this.name = this.constructor.name;
	}
}

/**
 * Manages language-specific caching of command manifests
 *
 * Provides file-based persistence with automatic expiration handling.
 * Cache files are stored in language-specific directories to support
 * internationalization.
 *
 * Features:
 * - Language-aware cache isolation
 * - Automatic expiration based on configurable max age
 * - Graceful error handling with proper fallbacks
 * - Cache invalidation support
 * - Robust handling of corrupted cache files
 */
export class CacheManager {
	private readonly cacheDir: string;
	private readonly defaultMaxAge: number = 60 * 60 * 1000; // 1 hour in milliseconds
	private readonly languageDetector = new LanguageDetector();

	/**
	 * Create a new CacheManager instance
	 *
	 * @param fileService - File service implementation for I/O operations
	 * @param cacheDir - Optional custom cache directory (defaults to ~/.cache/claude-cmd/pages)
	 */
	constructor(
		private readonly fileService: IFileService,
		cacheDir?: string,
	) {
		this.cacheDir =
			cacheDir ?? path.join(os.homedir(), ".cache", "claude-cmd", "pages");
	}

	/**
	 * Retrieve cached manifest for a specific language
	 *
	 * @param language - Language code (e.g., "en", "es")
	 * @returns Cached manifest if exists and not expired, null otherwise
	 */
	async get(language: string): Promise<Manifest | null> {
		this.validateLanguage(language);
		const cachePath = this.getCachePath(language);

		try {
			const content = await this.fileService.readFile(cachePath);

			// Handle empty files (cleared cache)
			if (!content.trim()) {
				return null;
			}

			const entry = this.parseCacheEntry(content);
			if (!entry) {
				return null;
			}

			// Check if cache is expired
			const now = Date.now();
			if (now - entry.timestamp > this.defaultMaxAge) {
				return null;
			}

			return entry.manifest;
		} catch (error) {
			return this.handleCacheReadError(error, language);
		}
	}

	/**
	 * Store manifest in cache for a specific language
	 *
	 * @param language - Language code (e.g., "en", "es")
	 * @param manifest - Manifest to cache
	 * @param timestamp - Optional timestamp, defaults to current time
	 */
	async set(
		language: string,
		manifest: Manifest,
		timestamp?: number,
	): Promise<void> {
		this.validateLanguage(language);

		try {
			const cachePath = this.getCachePath(language);
			const entry: CacheEntry = {
				manifest,
				timestamp: timestamp ?? Date.now(),
			};

			// Ensure cache directory exists
			const cacheDir = path.dirname(cachePath);
			await this.fileService.mkdir(cacheDir);

			await this.fileService.writeFile(
				cachePath,
				JSON.stringify(entry, null, 2),
			);
		} catch (error) {
			throw new CacheError(
				`Failed to store cache for language "${language}"`,
				language,
				error instanceof Error ? error : new Error(String(error)),
			);
		}
	}

	/**
	 * Check if cached manifest for a language is expired
	 *
	 * @param language - Language code (e.g., "en", "es")
	 * @param maxAge - Optional custom maximum age in milliseconds
	 * @returns True if cache doesn't exist or is expired, false otherwise
	 */
	async isExpired(language: string, maxAge?: number): Promise<boolean> {
		this.validateLanguage(language);
		const cachePath = this.getCachePath(language);
		const effectiveMaxAge = maxAge ?? this.defaultMaxAge;

		try {
			const content = await this.fileService.readFile(cachePath);

			// Handle empty files (cleared cache)
			if (!content.trim()) {
				return true;
			}

			const entry = this.parseCacheEntry(content);
			if (!entry) {
				return true; // Invalid cache entry is considered expired
			}

			const now = Date.now();
			return now - entry.timestamp > effectiveMaxAge;
		} catch (error) {
			// Handle string errors from InMemoryFileService
			if (
				error instanceof FileNotFoundError ||
				(typeof error === "string" && error.includes("File not found"))
			) {
				return true; // Cache doesn't exist, so it's "expired"
			}
			throw error;
		}
	}

	/**
	 * Remove cached manifest for a specific language
	 *
	 * @param language - Language code (e.g., "en", "es")
	 */
	async clear(language: string): Promise<void> {
		this.validateLanguage(language);
		const cachePath = this.getCachePath(language);

		try {
			const exists = await this.fileService.exists(cachePath);
			if (exists) {
				// Since we don't have a delete method in IFileService,
				// we'll write an empty file to effectively "clear" it
				await this.fileService.writeFile(cachePath, "");
			}
		} catch (error) {
			// Ignore errors when clearing non-existent cache
			if (!(error instanceof FileNotFoundError)) {
				throw error;
			}
		}
	}

	/**
	 * Get the file path for cached manifest of a specific language
	 *
	 * @param language - Language code (e.g., "en", "es")
	 * @returns Full path to the cache file
	 */
	getCachePath(language: string): string {
		return path.join(this.cacheDir, language, "manifest.json");
	}

	/**
	 * Validate language code using LanguageDetector
	 *
	 * @param language - Language code to validate
	 * @throws CacheError if language code is invalid
	 */
	private validateLanguage(language: string): void {
		const languageCode = this.languageDetector.sanitizeLanguageCode(language);
		if (!languageCode) {
			throw new CacheError("Language code cannot be empty", language);
		}

		// Use LanguageDetector's validation
		if (!this.languageDetector.isValidLanguageCode(languageCode)) {
			throw new CacheError(
				`Invalid language code format: "${languageCode}". Expected format: "en", "es", etc.`,
				languageCode,
			);
		}
	}

	/**
	 * Parse cache entry content with error handling
	 *
	 * @param content - Raw cache file content
	 * @returns Parsed cache entry or null if parsing fails
	 */
	private parseCacheEntry(content: string): CacheEntry | null {
		try {
			const parsed = JSON.parse(content);

			// Validate cache entry structure
			if (!parsed || typeof parsed !== "object") {
				return null;
			}

			if (!parsed.manifest || typeof parsed.timestamp !== "number") {
				return null;
			}

			return parsed as CacheEntry;
		} catch {
			// Return null for any parsing errors to trigger cache regeneration
			return null;
		}
	}

	/**
	 * Handle cache read errors with appropriate fallbacks
	 *
	 * @param error - Error that occurred during cache read
	 * @param language - Language code for context
	 * @returns null for recoverable errors
	 */
	private handleCacheReadError(error: unknown, _language: string): null {
		// Handle string errors from InMemoryFileService
		if (
			error instanceof FileNotFoundError ||
			(typeof error === "string" && error.includes("File not found"))
		) {
			return null;
		}

		console.error("Unexpected error reading cache:", error);

		// For any other errors, we'll return null to trigger cache regeneration
		// This provides resilience against corrupted cache files
		return null;
	}
}
