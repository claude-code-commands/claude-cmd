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
