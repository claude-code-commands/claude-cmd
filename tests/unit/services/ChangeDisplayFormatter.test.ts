import { describe, expect, test } from "bun:test";
import { ChangeDisplayFormatter } from "../../../src/services/ChangeDisplayFormatter.js";
import type {
	CacheUpdateResultWithChanges,
	Command,
	CommandChange,
	ManifestComparisonResult,
} from "../../../src/types/index.js";

describe("ChangeDisplayFormatter", () => {
	const formatter = new ChangeDisplayFormatter();

	// Sample data for testing
	const sampleCommand: Command = {
		name: "test-command",
		description: "A test command",
		file: "test-command.md",
		"allowed-tools": ["Read", "Write"],
	};

	describe("formatUpdateSummary", () => {
		test("formats update result with no changes", () => {
			const result: CacheUpdateResultWithChanges = {
				language: "en",
				timestamp: new Date("2024-01-15T12:00:00Z").getTime(),
				commandCount: 10,
				hasChanges: false,
				added: 0,
				removed: 0,
				modified: 0,
			};

			const formatted = formatter.formatUpdateSummary(result);

			expect(formatted).toContain("Command manifest updated successfully!");
			expect(formatted).toContain("Language: en");
			expect(formatted).toContain("Commands available: 10");
			expect(formatted).toContain("✅ No changes detected");
		});

		test("formats update result with changes", () => {
			const result: CacheUpdateResultWithChanges = {
				language: "en",
				timestamp: new Date("2024-01-15T12:00:00Z").getTime(),
				commandCount: 12,
				hasChanges: true,
				added: 2,
				removed: 1,
				modified: 3,
			};

			const formatted = formatter.formatUpdateSummary(result);

			expect(formatted).toContain("📊 Changes detected: 6 total");
			expect(formatted).toContain("➕ Added: 2 commands");
			expect(formatted).toContain("🔄 Modified: 3 commands");
			expect(formatted).toContain("➖ Removed: 1 commands");
		});

		test("formats update result with only added changes", () => {
			const result: CacheUpdateResultWithChanges = {
				language: "fr",
				timestamp: Date.now(),
				commandCount: 5,
				hasChanges: true,
				added: 3,
				removed: 0,
				modified: 0,
			};

			const formatted = formatter.formatUpdateSummary(result);

			expect(formatted).toContain("📊 Changes detected: 3 total");
			expect(formatted).toContain("➕ Added: 3 commands");
			expect(formatted).not.toContain("Modified:");
			expect(formatted).not.toContain("Removed:");
		});
	});

	describe("formatComparisonDetails", () => {
		test("formats comparison with no changes", () => {
			const comparison: ManifestComparisonResult = {
				oldManifest: {
					version: "1.0",
					updated: "2024-01-15T10:00:00Z",
					commands: [sampleCommand],
				},
				newManifest: {
					version: "1.0",
					updated: "2024-01-15T10:00:00Z",
					commands: [sampleCommand],
				},
				summary: {
					total: 0,
					added: 0,
					removed: 0,
					modified: 0,
					hasChanges: false,
				},
				changes: [],
				comparedAt: "2024-01-15T12:00:00Z",
			};

			const formatted = formatter.formatComparisonDetails(comparison);

			expect(formatted).toContain("📋 Manifest Comparison Results");
			expect(formatted).toContain("✅ No changes detected");
		});

		test("formats comparison with all types of changes", () => {
			const addedCommand: Command = {
				name: "new-command",
				description: "A new command",
				file: "new-command.md",
				"allowed-tools": ["bash"],
			};

			const modifiedCommand: Command = {
				...sampleCommand,
				description: "Updated test command",
			};

			const changes: CommandChange[] = [
				{
					type: "added",
					name: "new-command",
					newCommand: addedCommand,
				},
				{
					type: "modified",
					name: "test-command",
					oldCommand: sampleCommand,
					newCommand: modifiedCommand,
					details: {
						fields: ["description"],
						oldValues: { description: "A test command" },
						newValues: { description: "Updated test command" },
					},
				},
				{
					type: "removed",
					name: "old-command",
					oldCommand: {
						name: "old-command",
						description: "An old command",
						file: "old-command.md",
						"allowed-tools": ["Read"],
					},
				},
			];

			const comparison: ManifestComparisonResult = {
				oldManifest: {
					version: "1.0",
					updated: "2024-01-15T10:00:00Z",
					commands: [sampleCommand],
				},
				newManifest: {
					version: "1.1",
					updated: "2024-01-15T11:00:00Z",
					commands: [modifiedCommand, addedCommand],
				},
				summary: {
					total: 3,
					added: 1,
					removed: 1,
					modified: 1,
					hasChanges: true,
				},
				changes,
				comparedAt: "2024-01-15T12:00:00Z",
			};

			const formatted = formatter.formatComparisonDetails(comparison);

			expect(formatted).toContain("📊 Summary: 3 changes");
			expect(formatted).toContain("➕ Added: 1");
			expect(formatted).toContain("🔄 Modified: 1");
			expect(formatted).toContain("➖ Removed: 1");
			expect(formatted).toContain("➕ Added Commands:");
			expect(formatted).toContain("+ new-command: A new command");
			expect(formatted).toContain("🔄 Modified Commands:");
			expect(formatted).toContain("~ test-command");
			expect(formatted).toContain(
				'description: "A test command" → "Updated test command"',
			);
			expect(formatted).toContain("➖ Removed Commands:");
			expect(formatted).toContain("- old-command: An old command");
		});
	});

	describe("formatCompactSummary", () => {
		test("formats no changes", () => {
			const summary = {
				total: 0,
				added: 0,
				removed: 0,
				modified: 0,
				hasChanges: false,
			};

			const formatted = formatter.formatCompactSummary(summary);
			expect(formatted).toBe("No changes");
		});

		test("formats mixed changes", () => {
			const summary = {
				total: 6,
				added: 2,
				removed: 1,
				modified: 3,
				hasChanges: true,
			};

			const formatted = formatter.formatCompactSummary(summary);
			expect(formatted).toBe("+2, ~3, -1");
		});

		test("formats only additions", () => {
			const summary = {
				total: 3,
				added: 3,
				removed: 0,
				modified: 0,
				hasChanges: true,
			};

			const formatted = formatter.formatCompactSummary(summary);
			expect(formatted).toBe("+3");
		});
	});

	describe("getChangeIndicator", () => {
		test("returns correct indicators for change types", () => {
			expect(formatter.getChangeIndicator("added")).toBe("➕");
			expect(formatter.getChangeIndicator("modified")).toBe("🔄");
			expect(formatter.getChangeIndicator("removed")).toBe("➖");
		});
	});

	describe("formatCommandChange", () => {
		test("formats added command", () => {
			const change: CommandChange = {
				type: "added",
				name: "new-command",
				newCommand: {
					name: "new-command",
					description: "A new command",
					file: "new-command.md",
					"allowed-tools": ["bash"],
				},
			};

			const formatted = formatter.formatCommandChange(change);
			expect(formatted).toBe("➕ new-command: A new command");
		});

		test("formats removed command", () => {
			const change: CommandChange = {
				type: "removed",
				name: "old-command",
				oldCommand: {
					name: "old-command",
					description: "An old command",
					file: "old-command.md",
					"allowed-tools": ["Read"],
				},
			};

			const formatted = formatter.formatCommandChange(change);
			expect(formatted).toBe("➖ old-command: An old command");
		});

		test("formats modified command with details", () => {
			const change: CommandChange = {
				type: "modified",
				name: "test-command",
				oldCommand: sampleCommand,
				newCommand: {
					...sampleCommand,
					description: "Updated description",
				},
				details: {
					fields: ["description"],
					oldValues: { description: "A test command" },
					newValues: { description: "Updated description" },
				},
			};

			const formatted = formatter.formatCommandChange(change);
			expect(formatted).toContain("🔄 test-command");
			expect(formatted).toContain(
				'description: "A test command" → "Updated description"',
			);
		});

		test("handles commands with no description", () => {
			const change: CommandChange = {
				type: "added",
				name: "no-desc-command",
				newCommand: {
					name: "no-desc-command",
					description: "",
					file: "no-desc.md",
					"allowed-tools": ["Read"],
				},
			};

			const formatted = formatter.formatCommandChange(change);
			expect(formatted).toBe("➕ no-desc-command: ");
		});
	});

	describe("field value formatting", () => {
		test("formats array values", () => {
			const change: CommandChange = {
				type: "modified",
				name: "test-command",
				oldCommand: sampleCommand,
				newCommand: {
					...sampleCommand,
					"allowed-tools": ["Read", "Write", "Bash"],
				},
				details: {
					fields: ["allowed-tools"],
					oldValues: { "allowed-tools": ["Read", "Write"] },
					newValues: { "allowed-tools": ["Read", "Write", "Bash"] },
				},
			};

			const formatted = formatter.formatCommandChange(change);
			expect(formatted).toContain(
				"allowed-tools: [Read, Write] → [Read, Write, Bash]",
			);
		});

		test("handles long string values", () => {
			const longDescription =
				"This is a very long description that exceeds fifty characters and should be truncated";
			const change: CommandChange = {
				type: "modified",
				name: "test-command",
				oldCommand: sampleCommand,
				newCommand: {
					...sampleCommand,
					description: longDescription,
				},
				details: {
					fields: ["description"],
					oldValues: { description: "Short description" },
					newValues: { description: longDescription },
				},
			};

			const formatted = formatter.formatCommandChange(change);
			expect(formatted).toContain(
				'"This is a very long description that exceeds f..."',
			);
		});

		test("handles undefined and null values", () => {
			const change: CommandChange = {
				type: "modified",
				name: "test-command",
				oldCommand: sampleCommand,
				newCommand: {
					...sampleCommand,
					"argument-hint": "some hint",
				},
				details: {
					fields: ["argument-hint"],
					oldValues: { "argument-hint": undefined },
					newValues: { "argument-hint": "some hint" },
				},
			};

			const formatted = formatter.formatCommandChange(change);
			expect(formatted).toContain('argument-hint: (none) → "some hint"');
		});
	});
});
