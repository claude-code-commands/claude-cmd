import type { Manifest, RepositoryOptions } from "../types/Command.js";

/**
 * Repository interface for command manifest and content operations
 * 
 * Provides abstractions for fetching command manifests and individual command content
 * from a remote repository. Designed to support language-specific repositories and
 * caching optimizations.
 * 
 * All operations are language-aware and support caching hints for performance optimization.
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