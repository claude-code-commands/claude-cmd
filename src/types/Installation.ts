/**
 * Installation-related types for the claude-cmd package manager
 */

/**
 * Information about a Claude directory (personal or project-specific)
 */
export interface DirectoryInfo {
	/** Absolute path to the directory */
	readonly path: string;
	/** Type of directory (personal or project) */
	readonly type: "personal" | "project";
	/** Whether the directory exists on the filesystem */
	readonly exists: boolean;
	/** Whether the directory is writable */
	readonly writable: boolean;
}

/**
 * Options for installing a command
 */
export interface InstallOptions {
	/** Target directory type (personal or project) */
	readonly target?: "personal" | "project";
	/** Force overwrite if command already exists */
	readonly force?: boolean;
	/** Language for the command (defaults to auto-detect) */
	readonly language?: string;
}

/**
 * Options for removing a command
 */
export interface RemoveOptions {
	/** Skip confirmation prompt */
	readonly yes?: boolean;
	/** Language for the command (defaults to auto-detect) */
	readonly language?: string;
}

/**
 * Installation metadata containing additional details
 */
export interface InstallationMetadata {
	/** Repository version when command was installed */
	readonly repositoryVersion?: string;
	/** Language used for installation */
	readonly language: string;
	/** Installation options used */
	readonly installationOptions?: InstallOptions;
}

/**
 * Information about an installed command
 */
export interface InstallationInfo {
	/** Name of the command */
	readonly name: string;
	/** Absolute path to the command file */
	readonly filePath: string;
	/** Directory type where command is installed */
	readonly location: "personal" | "project";
	/** Installation timestamp */
	readonly installedAt: Date;
	/** File size in bytes */
	readonly size: number;
	/** Command source (repository or local) */
	readonly source: "repository" | "local";
	/** Command version identifier */
	readonly version?: string;
	/** Detailed installation metadata */
	readonly metadata: InstallationMetadata;
}

/**
 * Result of scanning all Claude directories for command files
 */
export interface CommandScanResult {
	/** Command files found in personal directory */
	readonly personal: string[];
	/** Command files found in project directory */
	readonly project: string[];
}

/**
 * Summary information about all installed commands
 */
export interface InstallationSummary {
	/** Total number of installed commands */
	readonly totalCommands: number;
	/** Number of commands in personal directory */
	readonly personalCount: number;
	/** Number of commands in project directory */
	readonly projectCount: number;
	/** Available installation locations */
	readonly locations: ReadonlyArray<"personal" | "project">;
}

/**
 * Error thrown when installation operations fail
 */
export class InstallationError extends Error {
	constructor(
		message: string,
		public readonly operation: string,
		public readonly commandName?: string,
		public override readonly cause?: Error,
	) {
		super(message);
		this.name = this.constructor.name;
	}
}

/**
 * Error thrown when a command already exists and force is not specified
 */
export class CommandExistsError extends InstallationError {
	constructor(commandName: string, existingPath: string) {
		super(
			`Command '${commandName}' already exists at ${existingPath}. Use --force to overwrite.`,
			"install",
			commandName,
		);
	}
}

/**
 * Error thrown when a command is not found for removal
 */
export class CommandNotInstalledError extends InstallationError {
	constructor(commandName: string) {
		super(`Command '${commandName}' is not installed.`, "remove", commandName);
	}
}
