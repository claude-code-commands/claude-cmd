import type {
	CacheUpdateResultWithChanges,
	ChangeType,
	CommandChange,
	ManifestComparisonResult,
} from "../types/index.js";

/**
 * Service for formatting change detection results for display
 *
 * Provides user-friendly formatting of manifest comparison results
 * with visual indicators and detailed change descriptions.
 */
export class ChangeDisplayFormatter {
	/**
	 * Format cache update results with changes for display
	 */
	formatUpdateSummary(result: CacheUpdateResultWithChanges): string {
		const lines: string[] = [];

		lines.push("Command manifest updated successfully!");
		lines.push(`Language: ${result.language}`);
		lines.push(`Commands available: ${result.commandCount}`);
		lines.push(`Updated at: ${new Date(result.timestamp).toLocaleString()}`);
		lines.push("");

		if (result.hasChanges) {
			const totalChanges = result.added + result.removed + result.modified;
			lines.push(`📊 Changes detected: ${totalChanges} total`);

			if (result.added > 0) {
				lines.push(`  ➕ Added: ${result.added} commands`);
			}
			if (result.modified > 0) {
				lines.push(`  🔄 Modified: ${result.modified} commands`);
			}
			if (result.removed > 0) {
				lines.push(`  ➖ Removed: ${result.removed} commands`);
			}
		} else {
			lines.push("✅ No changes detected");
		}

		return lines.join("\n");
	}

	/**
	 * Format detailed comparison results for display
	 */
	formatComparisonDetails(comparison: ManifestComparisonResult): string {
		const lines: string[] = [];

		lines.push(`📋 Manifest Comparison Results`);
		lines.push(
			`Compared at: ${new Date(comparison.comparedAt).toLocaleString()}`,
		);
		lines.push("");

		if (!comparison.summary.hasChanges) {
			lines.push("✅ No changes detected");
			return lines.join("\n");
		}

		// Summary
		lines.push(`📊 Summary: ${comparison.summary.total} changes`);
		if (comparison.summary.added > 0) {
			lines.push(`  ➕ Added: ${comparison.summary.added}`);
		}
		if (comparison.summary.modified > 0) {
			lines.push(`  🔄 Modified: ${comparison.summary.modified}`);
		}
		if (comparison.summary.removed > 0) {
			lines.push(`  ➖ Removed: ${comparison.summary.removed}`);
		}
		lines.push("");

		// Group changes by type for better organization
		const addedChanges = comparison.changes.filter((c) => c.type === "added");
		const modifiedChanges = comparison.changes.filter(
			(c) => c.type === "modified",
		);
		const removedChanges = comparison.changes.filter(
			(c) => c.type === "removed",
		);

		// Show added commands
		if (addedChanges.length > 0) {
			lines.push("➕ Added Commands:");
			for (const change of addedChanges) {
				const description = change.newCommand?.description;
				lines.push(
					`  + ${change.name}: ${description !== undefined ? description : "No description"}`,
				);
			}
			lines.push("");
		}

		// Show modified commands with details
		if (modifiedChanges.length > 0) {
			lines.push("🔄 Modified Commands:");
			for (const change of modifiedChanges) {
				lines.push(`  ~ ${change.name}`);
				if (change.details) {
					for (const field of change.details.fields) {
						const oldValue = this.formatFieldValue(
							field,
							change.details.oldValues[field],
						);
						const newValue = this.formatFieldValue(
							field,
							change.details.newValues[field],
						);
						lines.push(`    ${field}: ${oldValue} → ${newValue}`);
					}
				}
			}
			lines.push("");
		}

		// Show removed commands
		if (removedChanges.length > 0) {
			lines.push("➖ Removed Commands:");
			for (const change of removedChanges) {
				const description = change.oldCommand?.description;
				lines.push(
					`  - ${change.name}: ${description !== undefined ? description : "No description"}`,
				);
			}
		}

		return lines.join("\n");
	}

	/**
	 * Format a compact change summary for status display
	 */
	formatCompactSummary(summary: {
		total: number;
		added: number;
		modified: number;
		removed: number;
		hasChanges: boolean;
	}): string {
		if (!summary.hasChanges) {
			return "No changes";
		}

		const parts: string[] = [];
		if (summary.added > 0) parts.push(`+${summary.added}`);
		if (summary.modified > 0) parts.push(`~${summary.modified}`);
		if (summary.removed > 0) parts.push(`-${summary.removed}`);

		return parts.join(", ");
	}

	/**
	 * Get the visual indicator for a change type
	 */
	getChangeIndicator(type: ChangeType): string {
		switch (type) {
			case "added":
				return "➕";
			case "modified":
				return "🔄";
			case "removed":
				return "➖";
		}
	}

	/**
	 * Format a field value for display
	 */
	private formatFieldValue(_field: string, value: unknown): string {
		if (value === undefined || value === null) {
			return "(none)";
		}

		if (Array.isArray(value)) {
			return `[${value.join(", ")}]`;
		}

		if (typeof value === "string" && value.length > 50) {
			return `"${value.substring(0, 46)}..."`;
		}

		return typeof value === "string" ? `"${value}"` : String(value);
	}

	/**
	 * Format individual command change for display
	 */
	formatCommandChange(change: CommandChange): string {
		const indicator = this.getChangeIndicator(change.type);

		switch (change.type) {
			case "added": {
				const addedDescription = change.newCommand?.description;
				return `${indicator} ${change.name}: ${addedDescription !== undefined ? addedDescription : "No description"}`;
			}

			case "removed": {
				const removedDescription = change.oldCommand?.description;
				return `${indicator} ${change.name}: ${removedDescription !== undefined ? removedDescription : "No description"}`;
			}

			case "modified": {
				const lines = [`${indicator} ${change.name}`];
				if (change.details) {
					for (const field of change.details.fields) {
						const oldValue = this.formatFieldValue(
							field,
							change.details.oldValues[field],
						);
						const newValue = this.formatFieldValue(
							field,
							change.details.newValues[field],
						);
						lines.push(`  ${field}: ${oldValue} → ${newValue}`);
					}
				}
				return lines.join("\n");
			}
		}
	}
}
