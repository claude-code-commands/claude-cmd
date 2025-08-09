import { describe, expect, test } from "bun:test";
import { ManifestComparison } from "../../../src/services/ManifestComparison.js";
import type { Command, Manifest } from "../../../src/types/index.js";

describe("ManifestComparison", () => {
	const service = new ManifestComparison();

	// Sample manifests for testing
	const createManifest = (
		commands: Command[],
		version = "1.0",
		updated = "2024-01-01T00:00:00Z",
	): Manifest => ({
		version,
		updated,
		commands,
	});

	const baseCommands: Command[] = [
		{
			name: "debug-help",
			description: "Debug help command",
			file: "debug-help.md",
			"allowed-tools": ["Bash", "Read"],
		},
		{
			name: "frontend:component",
			description: "Create frontend component",
			file: "frontend/component.md",
			"allowed-tools": "Write,Edit",
			namespace: "frontend",
		},
	];

	describe("areManifestsIdentical", () => {
		test("returns true for identical manifests", async () => {
			const manifest1 = createManifest(baseCommands);
			const manifest2 = createManifest(baseCommands);

			const result = await service.areManifestsIdentical(manifest1, manifest2);
			expect(result).toBe(true);
		});

		test("returns false for different versions", async () => {
			const manifest1 = createManifest(baseCommands, "1.0");
			const manifest2 = createManifest(baseCommands, "1.1");

			const result = await service.areManifestsIdentical(manifest1, manifest2);
			expect(result).toBe(false);
		});

		test("returns false for different update times", async () => {
			const manifest1 = createManifest(
				baseCommands,
				"1.0",
				"2024-01-01T00:00:00Z",
			);
			const manifest2 = createManifest(
				baseCommands,
				"1.0",
				"2024-01-02T00:00:00Z",
			);

			const result = await service.areManifestsIdentical(manifest1, manifest2);
			expect(result).toBe(false);
		});

		test("returns false for different number of commands", async () => {
			const manifest1 = createManifest(baseCommands);
			const manifest2 = createManifest(baseCommands.slice(0, 1));

			const result = await service.areManifestsIdentical(manifest1, manifest2);
			expect(result).toBe(false);
		});

		test("returns false for different command content", async () => {
			const modifiedCommands: Command[] = [
				{ ...baseCommands[0]!, description: "Modified description" },
				baseCommands[1]!,
			];
			const manifest1 = createManifest(baseCommands);
			const manifest2 = createManifest(modifiedCommands);

			const result = await service.areManifestsIdentical(manifest1, manifest2);
			expect(result).toBe(false);
		});

		test("handles allowed-tools format differences correctly", async () => {
			const commands1: Command[] = [
				{
					...baseCommands[0]!,
					"allowed-tools": ["Bash", "Read"],
				},
			];
			const commands2: Command[] = [
				{
					...baseCommands[0]!,
					"allowed-tools": "Bash, Read",
				},
			];
			const manifest1 = createManifest(commands1);
			const manifest2 = createManifest(commands2);

			const result = await service.areManifestsIdentical(manifest1, manifest2);
			expect(result).toBe(true);
		});
	});

	describe("compareManifests", () => {
		test("detects no changes for identical manifests", async () => {
			const oldManifest = createManifest(baseCommands);
			const newManifest = createManifest(baseCommands);

			const result = await service.compareManifests(oldManifest, newManifest);

			expect(result.summary.hasChanges).toBe(false);
			expect(result.summary.total).toBe(0);
			expect(result.summary.added).toBe(0);
			expect(result.summary.removed).toBe(0);
			expect(result.summary.modified).toBe(0);
			expect(result.changes).toHaveLength(0);
		});

		test("detects added commands", async () => {
			const newCommand: Command = {
				name: "backend:api",
				description: "Create API endpoint",
				file: "backend/api.md",
				"allowed-tools": ["Write", "Bash"],
			};
			const oldManifest = createManifest(baseCommands);
			const newManifest = createManifest([...baseCommands, newCommand]);

			const result = await service.compareManifests(oldManifest, newManifest);

			expect(result.summary.hasChanges).toBe(true);
			expect(result.summary.total).toBe(1);
			expect(result.summary.added).toBe(1);
			expect(result.summary.removed).toBe(0);
			expect(result.summary.modified).toBe(0);

			const addedChange = result.changes.find((c) => c.type === "added");
			expect(addedChange).toBeDefined();
			expect(addedChange?.name).toBe("backend:api");
			expect(addedChange?.newCommand).toEqual(newCommand);
			expect(addedChange?.oldCommand).toBeUndefined();
		});

		test("detects removed commands", async () => {
			const oldManifest = createManifest(baseCommands);
			const newManifest = createManifest([baseCommands[0]!]); // Remove second command

			const result = await service.compareManifests(oldManifest, newManifest);

			expect(result.summary.hasChanges).toBe(true);
			expect(result.summary.total).toBe(1);
			expect(result.summary.added).toBe(0);
			expect(result.summary.removed).toBe(1);
			expect(result.summary.modified).toBe(0);

			const removedChange = result.changes.find((c) => c.type === "removed");
			expect(removedChange).toBeDefined();
			expect(removedChange?.name).toBe("frontend:component");
			expect(removedChange?.oldCommand).toEqual(baseCommands[1]!);
			expect(removedChange?.newCommand).toBeUndefined();
		});

		test("detects modified commands with detailed changes", async () => {
			const modifiedCommand: Command = {
				...baseCommands[0]!,
				description: "Updated debug help command",
				"allowed-tools": ["Bash", "Read", "Write"],
			};
			const oldManifest = createManifest(baseCommands);
			const newManifest = createManifest([modifiedCommand, baseCommands[1]!]);

			const result = await service.compareManifests(oldManifest, newManifest);

			expect(result.summary.hasChanges).toBe(true);
			expect(result.summary.total).toBe(1);
			expect(result.summary.added).toBe(0);
			expect(result.summary.removed).toBe(0);
			expect(result.summary.modified).toBe(1);

			const modifiedChange = result.changes.find((c) => c.type === "modified");
			expect(modifiedChange).toBeDefined();
			expect(modifiedChange?.name).toBe("debug-help");
			expect(modifiedChange?.oldCommand).toEqual(baseCommands[0]!);
			expect(modifiedChange?.newCommand).toEqual(modifiedCommand);
			expect(modifiedChange?.details?.fields).toContain("description");
			expect(modifiedChange?.details?.fields).toContain("allowed-tools");
			expect(modifiedChange?.details?.oldValues.description).toBe(
				"Debug help command",
			);
			expect(modifiedChange?.details?.newValues.description).toBe(
				"Updated debug help command",
			);
		});

		test("handles multiple types of changes", async () => {
			const newCommand: Command = {
				name: "test:unit",
				description: "Run unit tests",
				file: "test/unit.md",
				"allowed-tools": "Bash",
			};
			const modifiedCommand: Command = {
				...baseCommands[0]!,
				description: "Updated debug help command",
			};

			const oldManifest = createManifest(baseCommands);
			const newManifest = createManifest([modifiedCommand, newCommand]); // Modified, removed, added

			const result = await service.compareManifests(oldManifest, newManifest);

			expect(result.summary.hasChanges).toBe(true);
			expect(result.summary.total).toBe(3);
			expect(result.summary.added).toBe(1);
			expect(result.summary.removed).toBe(1);
			expect(result.summary.modified).toBe(1);

			expect(result.changes.find((c) => c.type === "added")?.name).toBe(
				"test:unit",
			);
			expect(result.changes.find((c) => c.type === "removed")?.name).toBe(
				"frontend:component",
			);
			expect(result.changes.find((c) => c.type === "modified")?.name).toBe(
				"debug-help",
			);
		});

		test("includes comparison metadata", async () => {
			const oldManifest = createManifest(baseCommands);
			const newManifest = createManifest(baseCommands);

			const result = await service.compareManifests(oldManifest, newManifest);

			expect(result.oldManifest).toBe(oldManifest);
			expect(result.newManifest).toBe(newManifest);
			expect(result.comparedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/); // ISO 8601 format
		});

		test("handles empty manifests", async () => {
			const emptyManifest = createManifest([]);
			const oldManifest = createManifest(baseCommands);

			const result = await service.compareManifests(oldManifest, emptyManifest);

			expect(result.summary.hasChanges).toBe(true);
			expect(result.summary.total).toBe(2);
			expect(result.summary.added).toBe(0);
			expect(result.summary.removed).toBe(2);
			expect(result.summary.modified).toBe(0);
		});
	});

	describe("allowed-tools comparison", () => {
		test("handles string to array conversion in allowed-tools", async () => {
			const command1: Command = {
				name: "test",
				description: "Test",
				file: "test.md",
				"allowed-tools": "Bash, Read, Write",
			};
			const command2: Command = {
				...command1,
				"allowed-tools": ["Bash", "Read", "Write"],
			};

			const oldManifest = createManifest([command1]);
			const newManifest = createManifest([command2]);

			const result = await service.compareManifests(oldManifest, newManifest);
			expect(result.summary.hasChanges).toBe(false);
		});

		test("detects changes in allowed-tools regardless of order", async () => {
			const command1: Command = {
				name: "test",
				description: "Test",
				file: "test.md",
				"allowed-tools": ["Bash", "Read", "Write"],
			};
			const command2: Command = {
				...command1,
				"allowed-tools": ["Write", "Bash", "Read"], // Same tools, different order
			};

			const oldManifest = createManifest([command1]);
			const newManifest = createManifest([command2]);

			const result = await service.compareManifests(oldManifest, newManifest);
			expect(result.summary.hasChanges).toBe(false);
		});

		test("detects actual changes in allowed-tools", async () => {
			const command1: Command = {
				name: "test",
				description: "Test",
				file: "test.md",
				"allowed-tools": ["Bash", "Read"],
			};
			const command2: Command = {
				...command1,
				"allowed-tools": ["Bash", "Write"], // Changed Read to Write
			};

			const oldManifest = createManifest([command1]);
			const newManifest = createManifest([command2]);

			const result = await service.compareManifests(oldManifest, newManifest);
			expect(result.summary.hasChanges).toBe(true);
			expect(result.summary.modified).toBe(1);

			const modifiedChange = result.changes.find((c) => c.type === "modified");
			expect(modifiedChange?.details?.fields).toContain("allowed-tools");
		});
	});
});
