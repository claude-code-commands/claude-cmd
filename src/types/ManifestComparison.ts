import type { Command, Manifest } from "./Command.js";

/**
 * Types of changes that can occur to commands
 */
export type ChangeType = "added" | "removed" | "modified";

/**
 * Detailed information about what specifically changed in a command
 */
export interface CommandChangeDetails {
	/** Field names that changed */
	readonly fields: readonly string[];
	/** Previous values for changed fields */
	readonly oldValues: Record<string, unknown>;
	/** New values for changed fields */
	readonly newValues: Record<string, unknown>;
}

/**
 * Represents a change to a single command
 */
export interface CommandChange {
	/** Type of change that occurred */
	readonly type: ChangeType;
	/** Command name that changed */
	readonly name: string;
	/** Command after change (undefined for removed commands) */
	readonly newCommand?: Command;
	/** Command before change (undefined for added commands) */
	readonly oldCommand?: Command;
	/** Detailed change information (only for modified commands) */
	readonly details?: CommandChangeDetails;
}

/**
 * Summary statistics about changes between manifests
 */
export interface ChangeSummary {
	/** Total number of changes */
	readonly total: number;
	/** Number of commands added */
	readonly added: number;
	/** Number of commands removed */
	readonly removed: number;
	/** Number of commands modified */
	readonly modified: number;
	/** Whether any changes were detected */
	readonly hasChanges: boolean;
}

/**
 * Complete comparison result between two manifests
 */
export interface ManifestComparisonResult {
	/** The old manifest that was compared from */
	readonly oldManifest: Manifest;
	/** The new manifest that was compared to */
	readonly newManifest: Manifest;
	/** Summary statistics of all changes */
	readonly summary: ChangeSummary;
	/** Detailed list of all changes */
	readonly changes: readonly CommandChange[];
	/** ISO 8601 timestamp when the comparison was performed */
	readonly comparedAt: string;
}