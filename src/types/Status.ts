/**
 * Cache information for a specific language
 */
export interface CacheInfo {
	/** Language code */
	readonly language: string;
	/** Whether the cache file exists */
	readonly exists: boolean;
	/** Cache file path */
	readonly path: string;
	/** Cache age in milliseconds (only if exists) */
	readonly ageMs?: number;
	/** Cache size in bytes (only if exists) */
	readonly sizeBytes?: number;
	/** Whether the cache is expired */
	readonly isExpired: boolean;
	/** Number of commands in cache (only if exists and valid) */
	readonly commandCount?: number;
}

/**
 * Installation directory information
 */
export interface InstallationInfo {
	/** Directory type */
	readonly type: "project" | "user";
	/** Full path to the directory */
	readonly path: string;
	/** Whether the directory exists */
	readonly exists: boolean;
	/** Whether the directory is writable */
	readonly writable: boolean;
	/** Number of installed commands in this directory */
	readonly commandCount: number;
}

/**
 * System health indicators
 */
export interface SystemHealth {
	/** Whether cache directory is accessible */
	readonly cacheAccessible: boolean;
	/** Whether at least one installation directory is writable */
	readonly installationPossible: boolean;
	/** Overall system status */
	readonly status: "healthy" | "degraded" | "error";
	/** Any error messages or warnings */
	readonly messages: string[];
}

/**
 * Complete system status information
 */
export interface SystemStatus {
	/** Timestamp when status was collected */
	readonly timestamp: number;
	/** Cache information for all detected languages */
	readonly cache: readonly CacheInfo[];
	/** Installation directory information */
	readonly installations: readonly InstallationInfo[];
	/** Overall system health */
	readonly health: SystemHealth;
}

/**
 * Output format options for status display
 */
export type StatusOutputFormat = "default" | "compact" | "json";

/**
 * Error thrown when status collection fails
 */
export class StatusError extends Error {
	constructor(
		message: string,
		public override readonly cause?: Error,
	) {
		super(message);
		this.name = this.constructor.name;
	}
}
