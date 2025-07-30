/**
 * Represents a single Claude Code command from the repository manifest
 */
export interface Command {
	/** Unique command name (e.g., "debug-help", "frontend:component") */
	readonly name: string;

	/** Human-readable description of what the command does */
	readonly description: string;

	/** Relative path to the command file (e.g., "debug-help.md", "frontend/component.md") */
	readonly file: string;

	/** List of tools this command is allowed to use, or comma-separated string */
	readonly "allowed-tools": string[] | string;

	/** Optional hint for command arguments displayed during autocompletion */
	readonly "argument-hint"?: string;
}

/**
 * Represents the complete manifest structure from the repository
 */
export interface Manifest {
	/** Version of the manifest format */
	readonly version: string;

	/** ISO 8601 timestamp of when the manifest was last updated */
	readonly updated: string;

	/** Array of all available commands in this language */
	readonly commands: readonly Command[];
}

/**
 * Result of a cache update operation
 */
export interface CacheUpdateResult {
	/** Language code that was updated */
	readonly language: string;

	/** Timestamp when the cache was updated */
	readonly timestamp: number;

	/** Number of commands in the updated manifest */
	readonly commandCount: number;
}

/**
 * Options for repository operations that may affect caching behavior
 */
export interface RepositoryOptions {
	/** Force refresh from remote source, bypassing cache */
	readonly forceRefresh?: boolean;

	/** Maximum age in milliseconds for cached data (default: 1 hour) */
	readonly maxAge?: number;
}

/**
 * Base class for all repository-related errors
 */
export abstract class RepositoryError extends Error {
	constructor(
		message: string,
		public readonly language: string,
	) {
		super(message);
		this.name = this.constructor.name;
	}
}

/**
 * Error thrown when a requested command is not found in the manifest
 */
export class CommandNotFoundError extends RepositoryError {
	/** The command name that was not found */
	public readonly commandName: string;

	constructor(commandName: string, language: string) {
		super(
			`Command "${commandName}" not found in language "${language}"`,
			language,
		);
		this.commandName = commandName;
	}
}

/**
 * Error thrown when the manifest cannot be retrieved or parsed
 */
export class ManifestError extends RepositoryError {
	/** The underlying cause of the manifest error */
	public override readonly cause?: string;

	constructor(language: string, cause?: string) {
		super(
			`Failed to retrieve manifest for language "${language}": ${cause || "Unknown error"}`,
			language,
		);
		this.cause = cause;
	}
}

/**
 * Error thrown when a command file cannot be retrieved from the repository
 */
export class CommandContentError extends RepositoryError {
	/** The command name that failed to load */
	public readonly commandName: string;
	/** The underlying cause of the content error */
	public override readonly cause?: string;

	constructor(commandName: string, language: string, cause?: string) {
		super(
			`Failed to retrieve content for command "${commandName}" in language "${language}": ${cause || "Unknown error"}`,
			language,
		);
		this.commandName = commandName;
		this.cause = cause;
	}
}
