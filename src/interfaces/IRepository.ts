import type { Manifest, RepositoryOptions } from "../types/Command.js";
import type IHTTPClient from "./IHTTPClient.js";
import type IFileService from "./IFileService.js";

/**
 * Cache configuration for repository operations
 * 
 * Controls how repository content is cached locally to improve performance
 * and reduce network requests. All settings use sensible defaults for typical usage.
 * 
 * @example
 * ```typescript
 * const cacheConfig: CacheConfig = {
 *   cacheDir: "~/.claude/cache",
 *   ttl: 3600000, // 1 hour
 *   maxSize: 10485760 // 10MB
 * };
 * ```
 */
export interface CacheConfig {
	/** 
	 * Directory path for cached files 
	 * @default "/tmp/claude-cmd-cache" or "~/.claude/cache"
	 */
	readonly cacheDir: string;
	
	/** 
	 * Time-to-live in milliseconds for cached content
	 * After this time, cache entries are considered stale and will be refreshed
	 * @default 3600000 (1 hour)
	 */
	readonly ttl: number;
	
	/** 
	 * Maximum cache size in bytes (optional)
	 * When exceeded, oldest entries will be removed to maintain size limit
	 * @default 10485760 (10MB)
	 */
	readonly maxSize?: number;
}

/**
 * Repository interface for command manifest and content operations
 * 
 * Provides abstractions for fetching command manifests and individual command content
 * from a remote repository. Designed to support language-specific repositories and
 * caching optimizations.
 * 
 * All operations are language-aware and support caching hints for performance optimization.
 * 
 * Implementations must accept HTTPClient and FileService dependencies for proper
 * testability and adherence to the abstracted I/O architecture.
 */
export default interface IRepository {
	/**
	 * Retrieve the command manifest for a specific language
	 * 
	 * The manifest contains metadata about all available commands including their names,
	 * descriptions, file paths, and allowed tools. This method supports caching
	 * optimizations through the options parameter.
	 * 
	 * @param language - ISO 639-1 language code (e.g., "en", "fr", "es")
	 * @param options - Optional caching and refresh configuration
	 * @returns Promise resolving to the complete manifest for the language
	 * @throws ManifestError when manifest cannot be retrieved or parsed
	 * @throws RepositoryError for other repository-related failures
	 */
	getManifest(language: string, options?: RepositoryOptions): Promise<Manifest>;

	/**
	 * Retrieve the content of a specific command file
	 * 
	 * Fetches the complete markdown content of a command file from the repository.
	 * The command must exist in the manifest for the specified language.
	 * 
	 * @param commandName - Name of the command as it appears in the manifest
	 * @param language - ISO 639-1 language code (e.g., "en", "fr", "es")
	 * @param options - Optional caching and refresh configuration
	 * @returns Promise resolving to the raw markdown content of the command file
	 * @throws CommandNotFoundError when command doesn't exist in the manifest
	 * @throws CommandContentError when command file cannot be retrieved
	 * @throws RepositoryError for other repository-related failures
	 */
	getCommand(commandName: string, language: string, options?: RepositoryOptions): Promise<string>;
}

/**
 * Factory interface for creating Repository instances with proper dependency injection
 * 
 * Provides a standardized way to create Repository instances with required dependencies.
 * This ensures all Repository implementations accept the required HTTPClient and FileService
 * dependencies for proper testability and adherence to abstracted I/O principles.
 * 
 * @example
 * ```typescript
 * const factory: IRepositoryFactory = new GitHubRepositoryFactory();
 * const httpClient = new BunHTTPClient();
 * const fileService = new BunFileService();
 * const repo = factory.create(httpClient, fileService);
 * ```
 */
export interface IRepositoryFactory {
	/**
	 * Create a new Repository instance with injected dependencies
	 * 
	 * @param httpClient - HTTP client for network operations (manifest and command fetching)
	 * @param fileService - File service for local caching operations (cache read/write)
	 * @param cacheConfig - Optional cache configuration (defaults applied if not provided)
	 * @returns Repository instance ready for use with dependency injection properly configured
	 * @throws Error if dependencies are invalid or incompatible
	 */
	create(httpClient: IHTTPClient, fileService: IFileService, cacheConfig?: CacheConfig): IRepository;
}

/**
 * Constructor interface for Repository implementations
 * 
 * Defines the required constructor signature that all Repository implementations must follow
 * to enable proper dependency injection and testing. This interface ensures consistent
 * instantiation patterns across different repository types (in-memory, GitHub, etc.).
 * 
 * @example
 * ```typescript
 * // All repository implementations must follow this pattern:
 * class GitHubRepository implements IRepository {
 *   constructor(
 *     httpClient: IHTTPClient, 
 *     fileService: IFileService, 
 *     cacheConfig?: CacheConfig
 *   ) { ... }
 * }
 * ```
 */
export interface IRepositoryConstructor {
	/**
	 * Repository constructor with dependency injection
	 * 
	 * @param httpClient - HTTP client for network operations
	 * @param fileService - File service for local caching operations  
	 * @param cacheConfig - Optional cache configuration with sensible defaults
	 */
	new (httpClient: IHTTPClient, fileService: IFileService, cacheConfig?: CacheConfig): IRepository;
}