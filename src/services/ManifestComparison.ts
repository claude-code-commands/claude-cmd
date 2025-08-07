import type IManifestComparison from "../interfaces/IManifestComparison.js";
import type {
	Manifest,
	Command,
	ManifestComparisonResult,
	CommandChange,
	CommandChangeDetails,
	ChangeSummary,
	ChangeType,
} from "../types/index.js";

/**
 * Service for comparing manifests and detecting changes between versions
 *
 * Provides comprehensive comparison capabilities optimized for performance
 * with large manifests through efficient algorithms and data structures.
 */
export class ManifestComparison implements IManifestComparison {
	/**
	 * Compare two manifests and identify all changes
	 */
	async compareManifests(
		oldManifest: Manifest,
		newManifest: Manifest,
	): Promise<ManifestComparisonResult> {
		// Create lookup maps for efficient comparison
		const oldCommandsMap = this.createCommandMap(oldManifest.commands);
		const newCommandsMap = this.createCommandMap(newManifest.commands);

		const changes: CommandChange[] = [];

		// Find added and modified commands
		for (const [name, newCommand] of newCommandsMap) {
			const oldCommand = oldCommandsMap.get(name);

			if (!oldCommand) {
				// Command was added
				changes.push({
					type: "added",
					name,
					newCommand,
				});
			} else if (!this.areCommandsEqual(oldCommand, newCommand)) {
				// Command was modified
				const details = this.getCommandChangeDetails(oldCommand, newCommand);
				changes.push({
					type: "modified",
					name,
					oldCommand,
					newCommand,
					details,
				});
			}
		}

		// Find removed commands
		for (const [name, oldCommand] of oldCommandsMap) {
			if (!newCommandsMap.has(name)) {
				changes.push({
					type: "removed",
					name,
					oldCommand,
				});
			}
		}

		// Generate summary statistics
		const summary = this.generateChangeSummary(changes);

		return {
			oldManifest,
			newManifest,
			summary,
			changes,
			comparedAt: new Date().toISOString(),
		};
	}

	/**
	 * Check if two manifests are identical
	 */
	async areManifestsIdentical(
		oldManifest: Manifest,
		newManifest: Manifest,
	): Promise<boolean> {
		// Quick check: different number of commands
		if (oldManifest.commands.length !== newManifest.commands.length) {
			return false;
		}

		// Quick check: different versions
		if (oldManifest.version !== newManifest.version) {
			return false;
		}

		// Quick check: different update times
		if (oldManifest.updated !== newManifest.updated) {
			return false;
		}

		// Deep comparison of commands
		const oldCommandsMap = this.createCommandMap(oldManifest.commands);
		const newCommandsMap = this.createCommandMap(newManifest.commands);

		// Check if all commands from old manifest exist and are identical in new manifest
		for (const [name, oldCommand] of oldCommandsMap) {
			const newCommand = newCommandsMap.get(name);
			if (!newCommand || !this.areCommandsEqual(oldCommand, newCommand)) {
				return false;
			}
		}

		return true;
	}

	/**
	 * Create a Map from command name to command for efficient lookups
	 */
	private createCommandMap(commands: readonly Command[]): Map<string, Command> {
		return new Map(commands.map((command) => [command.name, command]));
	}

	/**
	 * Check if two commands are equal by comparing all their properties
	 */
	private areCommandsEqual(oldCommand: Command, newCommand: Command): boolean {
		// Compare basic properties
		if (
			oldCommand.name !== newCommand.name ||
			oldCommand.description !== newCommand.description ||
			oldCommand.file !== newCommand.file ||
			oldCommand["argument-hint"] !== newCommand["argument-hint"] ||
			oldCommand.namespace !== newCommand.namespace
		) {
			return false;
		}

		// Compare allowed-tools (can be string[] or string)
		if (!this.areAllowedToolsEqual(oldCommand["allowed-tools"], newCommand["allowed-tools"])) {
			return false;
		}

		return true;
	}

	/**
	 * Compare allowed-tools fields, handling both string[] and string formats
	 */
	private areAllowedToolsEqual(
		oldTools: string[] | string,
		newTools: string[] | string,
	): boolean {
		// Normalize to arrays for comparison
		const oldArray = Array.isArray(oldTools) ? oldTools : oldTools.split(",").map(s => s.trim());
		const newArray = Array.isArray(newTools) ? newTools : newTools.split(",").map(s => s.trim());

		// Compare lengths
		if (oldArray.length !== newArray.length) {
			return false;
		}

		// Sort and compare (order shouldn't matter for tools)
		const oldSorted = [...oldArray].sort();
		const newSorted = [...newArray].sort();

		return oldSorted.every((tool, index) => tool === newSorted[index]);
	}

	/**
	 * Get detailed information about what changed in a command
	 */
	private getCommandChangeDetails(
		oldCommand: Command,
		newCommand: Command,
	): CommandChangeDetails {
		const fields: string[] = [];
		const oldValues: Record<string, unknown> = {};
		const newValues: Record<string, unknown> = {};

		// Check each field for changes
		if (oldCommand.description !== newCommand.description) {
			fields.push("description");
			oldValues.description = oldCommand.description;
			newValues.description = newCommand.description;
		}

		if (oldCommand.file !== newCommand.file) {
			fields.push("file");
			oldValues.file = oldCommand.file;
			newValues.file = newCommand.file;
		}

		if (oldCommand["argument-hint"] !== newCommand["argument-hint"]) {
			fields.push("argument-hint");
			oldValues["argument-hint"] = oldCommand["argument-hint"];
			newValues["argument-hint"] = newCommand["argument-hint"];
		}

		if (oldCommand.namespace !== newCommand.namespace) {
			fields.push("namespace");
			oldValues.namespace = oldCommand.namespace;
			newValues.namespace = newCommand.namespace;
		}

		if (!this.areAllowedToolsEqual(oldCommand["allowed-tools"], newCommand["allowed-tools"])) {
			fields.push("allowed-tools");
			oldValues["allowed-tools"] = oldCommand["allowed-tools"];
			newValues["allowed-tools"] = newCommand["allowed-tools"];
		}

		return {
			fields,
			oldValues,
			newValues,
		};
	}

	/**
	 * Generate summary statistics from the list of changes
	 */
	private generateChangeSummary(changes: CommandChange[]): ChangeSummary {
		const summary = {
			total: changes.length,
			added: 0,
			removed: 0,
			modified: 0,
		};

		for (const change of changes) {
			switch (change.type) {
				case "added":
					summary.added++;
					break;
				case "removed":
					summary.removed++;
					break;
				case "modified":
					summary.modified++;
					break;
			}
		}

		return {
			...summary,
			hasChanges: summary.total > 0,
		};
	}
}