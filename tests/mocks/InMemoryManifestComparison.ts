import type IManifestComparison from "../../src/interfaces/IManifestComparison.js";
import type {
	ChangeSummary,
	CommandChange,
	Manifest,
	ManifestComparisonResult,
} from "../../src/types/index.js";

/**
 * In-memory implementation of IManifestComparison for testing
 *
 * Provides a simple mock implementation that can be controlled in tests
 * to simulate various comparison scenarios and results.
 */
export default class InMemoryManifestComparison implements IManifestComparison {
	private mockComparisonResult: ManifestComparisonResult | undefined;
	private mockIdenticalResult = false;

	/**
	 * Set the result that should be returned by compareManifests
	 */
	setComparisonResult(result: ManifestComparisonResult): void {
		this.mockComparisonResult = result;
	}

	/**
	 * Set the result that should be returned by areManifestsIdentical
	 */
	setIdenticalResult(identical: boolean): void {
		this.mockIdenticalResult = identical;
	}

	/**
	 * Reset all mock results to defaults
	 */
	reset(): void {
		this.mockComparisonResult = undefined;
		this.mockIdenticalResult = false;
	}

	async compareManifests(
		oldManifest: Manifest,
		newManifest: Manifest,
	): Promise<ManifestComparisonResult> {
		if (this.mockComparisonResult) {
			return this.mockComparisonResult;
		}

		// Default behavior: perform actual comparison for testing
		// This provides a simple implementation for when no mock result is set
		const changes: CommandChange[] = [];
		const oldCommandsMap = new Map(
			oldManifest.commands.map((cmd) => [cmd.name, cmd]),
		);
		const newCommandsMap = new Map(
			newManifest.commands.map((cmd) => [cmd.name, cmd]),
		);

		// Find added and modified commands
		for (const [name, newCommand] of newCommandsMap) {
			const oldCommand = oldCommandsMap.get(name);
			if (!oldCommand) {
				changes.push({
					type: "added",
					name,
					newCommand,
				});
			} else if (JSON.stringify(oldCommand) !== JSON.stringify(newCommand)) {
				changes.push({
					type: "modified",
					name,
					oldCommand,
					newCommand,
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

		const summary: ChangeSummary = {
			total: changes.length,
			added: changes.filter((c) => c.type === "added").length,
			removed: changes.filter((c) => c.type === "removed").length,
			modified: changes.filter((c) => c.type === "modified").length,
			hasChanges: changes.length > 0,
		};

		return {
			oldManifest,
			newManifest,
			summary,
			changes,
			comparedAt: new Date().toISOString(),
		};
	}

	async areManifestsIdentical(
		_oldManifest: Manifest,
		_newManifest: Manifest,
	): Promise<boolean> {
		return this.mockIdenticalResult;
	}
}
