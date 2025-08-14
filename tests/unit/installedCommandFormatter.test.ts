import { describe, expect, test } from "bun:test";
import type {
	InstallationInfo,
	InstallationSummary,
} from "../../src/types/Installation.js";

// We'll need to import the formatting functions once they're created
// For now, this will fail since the functions don't exist

describe("Installed Command Formatter", () => {
	const mockInstallationInfos: InstallationInfo[] = [
		{
			name: "test-command",
			filePath: "/home/user/.claude/commands/test-command.md",
			location: "personal",
			installedAt: new Date("2025-01-01T10:00:00Z"),
			size: 100,
			source: "repository",
			version: "1.0.0",
			metadata: {
				language: "en",
				repositoryVersion: "1.0.0",
				installationOptions: {},
			},
		},
		{
			name: "project-helper",
			filePath: "./.claude/commands/project-helper.md",
			location: "project",
			installedAt: new Date("2025-01-01T11:00:00Z"),
			size: 150,
			source: "repository",
			version: "1.0.0",
			metadata: {
				language: "en",
				repositoryVersion: "1.0.0",
				installationOptions: {},
			},
		},
		{
			name: "frontend:component",
			filePath: "/home/user/.claude/commands/frontend/component.md",
			location: "personal",
			installedAt: new Date("2025-01-01T12:00:00Z"),
			size: 200,
			source: "repository",
			version: "1.0.0",
			metadata: {
				language: "en",
				repositoryVersion: "1.0.0",
				installationOptions: {},
			},
		},
	];

	describe("formatInstalledCommandsEnhanced", () => {
		test("should format commands with location indicators", async () => {
			// This will fail since formatInstalledCommandsEnhanced doesn't exist
			const { formatInstalledCommandsEnhanced } = await import(
				"../../src/cli/commands/installed.js"
			);

			const result = formatInstalledCommandsEnhanced(
				mockInstallationInfos,
				"en",
			);

			expect(result).toContain("test-command");
			expect(result).toContain("project-helper");
		});

		test("should show summary with command counts", async () => {
			const { formatInstalledCommandsSummary } = await import(
				"../../src/cli/commands/installed.js"
			);

			// Create a mock summary object based on the mock installation infos
			const mockSummary: InstallationSummary = {
				totalCommands: 3,
				personalCount: 2,
				projectCount: 1,
				locations: ["personal", "project"],
			};

			const result = formatInstalledCommandsSummary(mockSummary, "en");

			expect(result).toMatch(/Total: 3/);
			expect(result).toMatch(/Personal: 2/);
			expect(result).toMatch(/Project: 1/);
		});

		test("should format namespaced commands in tree structure", async () => {
			const { formatInstalledCommandsTree } = await import(
				"../../src/cli/commands/installed.js"
			);

			const result = formatInstalledCommandsTree(mockInstallationInfos, "en");

			expect(result).toContain("frontend:");
			expect(result).toContain("  └ component");
			expect(result).toMatch(/^├/m); // Tree characters at start of line
		});

		test("should handle empty command list", async () => {
			const { formatInstalledCommandsEnhanced } = await import(
				"../../src/cli/commands/installed.js"
			);

			const result = formatInstalledCommandsEnhanced([], "en");

			expect(result).toBe("No commands are currently installed.");
		});

		test("should group commands by location", async () => {
			const { formatInstalledCommandsEnhanced } = await import(
				"../../src/cli/commands/installed.js"
			);

			const result = formatInstalledCommandsEnhanced(
				mockInstallationInfos,
				"en",
			);

			// Should group personal and project commands
			expect(result).toMatch(/Personal.*Commands:/);
			expect(result).toMatch(/Project.*Commands:/);
		});
	});
});
