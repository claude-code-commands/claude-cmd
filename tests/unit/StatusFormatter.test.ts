import { describe, expect, test } from "bun:test";
import { StatusFormatter } from "../../src/services/StatusFormatter.js";
import type { SystemStatus } from "../../src/types/Status.js";

describe("StatusFormatter", () => {
	const formatter = new StatusFormatter();

	// Sample status data for testing
	const sampleStatus: SystemStatus = {
		timestamp: new Date("2024-01-15T12:00:00Z").getTime(),
		cache: [
			{
				language: "en",
				exists: true,
				path: "/cache/en/manifest.json",
				isExpired: false,
				ageMs: 30 * 60 * 1000, // 30 minutes
				sizeBytes: 2048,
				commandCount: 5,
			},
			{
				language: "fr",
				exists: false,
				path: "/cache/fr/manifest.json",
				isExpired: true,
			},
		],
		installations: [
			{
				type: "project",
				path: ".claude/commands",
				exists: false,
				writable: false,
				commandCount: 0,
			},
			{
				type: "user",
				path: "/home/.claude/commands",
				exists: true,
				writable: true,
				commandCount: 3,
			},
		],
		health: {
			cacheAccessible: true,
			installationPossible: true,
			status: "healthy",
			messages: [],
		},
	};

	describe("format", () => {
		test("should default to default format", () => {
			const output = formatter.format(sampleStatus, "default");

			expect(output).toContain("Claude CMD System Status");
			expect(output).toContain("System Health:");
			expect(output).toContain("Cache Status:");
			expect(output).toContain("Installation Directories:");
		});

		test("should handle compact format", () => {
			const output = formatter.format(sampleStatus, "compact");

			expect(output).toContain("Status: ✅ HEALTHY");
			expect(output).toContain("Cache: 1/2 valid");
			expect(output).toContain("Installs: 1/2 writable, 3 commands");
		});

		test("should handle json format", () => {
			const output = formatter.format(sampleStatus, "json");

			const parsed = JSON.parse(output);
			expect(parsed.timestamp).toBe(sampleStatus.timestamp);
			expect(parsed.cache).toHaveLength(2);
			expect(parsed.installations).toHaveLength(2);
			expect(parsed.health.status).toBe("healthy");
		});
	});

	describe("default format", () => {
		test("should include human-readable timestamp", () => {
			const output = formatter.format(sampleStatus, "default");

			// Check that timestamp is formatted with user's locale (will vary by system)
			// Just verify it contains some expected date components
			expect(output).toContain("Status collected at:");
			expect(output).toContain("2024"); // Should contain the year
			expect(output).toContain("January"); // Should contain month name
			expect(output).toContain("15"); // Should contain day
		});

		test("should show health status with icons", () => {
			const output = formatter.format(sampleStatus, "default");

			expect(output).toContain("Overall Status: ✅ HEALTHY");
			expect(output).toContain("Cache Accessible: ✅ Yes");
			expect(output).toContain("Installation Possible: ✅ Yes");
		});

		test("should display cache information", () => {
			const output = formatter.format(sampleStatus, "default");

			expect(output).toContain("Language: en");
			expect(output).toContain("Age: 30m 0s");
			expect(output).toContain("Size: 2.0 KB");
			expect(output).toContain("Commands: 5");
			expect(output).toContain("Expired: ✅ No");
		});

		test("should display installation directories", () => {
			const output = formatter.format(sampleStatus, "default");

			expect(output).toContain("Project Directory:");
			expect(output).toContain("User Directory:");
			expect(output).toContain("Commands Installed: 3");
		});

		test("should handle degraded health status", () => {
			const degradedStatus: SystemStatus = {
				...sampleStatus,
				health: {
					cacheAccessible: false,
					installationPossible: true,
					status: "degraded",
					messages: ["Cache directory not accessible"],
				},
			};

			const output = formatter.format(degradedStatus, "default");

			expect(output).toContain("Overall Status: ⚠️  DEGRADED");
			expect(output).toContain("Cache Accessible: ❌ No");
			expect(output).toContain("⚠️  Cache directory not accessible");
		});

		test("should handle error health status", () => {
			const errorStatus: SystemStatus = {
				...sampleStatus,
				health: {
					cacheAccessible: false,
					installationPossible: false,
					status: "error",
					messages: ["Multiple system failures"],
				},
			};

			const output = formatter.format(errorStatus, "default");

			expect(output).toContain("Overall Status: ❌ ERROR");
		});

		test("should handle empty cache list", () => {
			const emptyCacheStatus: SystemStatus = {
				...sampleStatus,
				cache: [],
			};

			const output = formatter.format(emptyCacheStatus, "default");

			expect(output).toContain("No cache information available");
		});

		test("should handle empty installations list", () => {
			const emptyInstallsStatus: SystemStatus = {
				...sampleStatus,
				installations: [],
			};

			const output = formatter.format(emptyInstallsStatus, "default");

			expect(output).toContain("No installation directories found");
		});
	});

	describe("compact format", () => {
		test("should show one-line summary", () => {
			const output = formatter.format(sampleStatus, "compact");

			// Should be a single line
			expect(output.split("\\n")).toHaveLength(1);
			expect(output).toContain(" | ");
		});

		test("should show warnings count when present", () => {
			const statusWithWarnings: SystemStatus = {
				...sampleStatus,
				health: {
					...sampleStatus.health,
					messages: ["Warning 1", "Warning 2"],
				},
			};

			const output = formatter.format(statusWithWarnings, "compact");

			expect(output).toContain("Warnings: 2");
		});

		test("should not show warnings when none present", () => {
			const output = formatter.format(sampleStatus, "compact");

			expect(output).not.toContain("Warnings:");
		});
	});

	describe("duration formatting", () => {
		test("should format seconds", () => {
			const status: SystemStatus = {
				...sampleStatus,
				cache: [
					{
						language: "en",
						exists: true,
						path: "/cache/en/manifest.json",
						isExpired: false,
						ageMs: 45000, // 45 seconds
						commandCount: 1,
					},
				],
			};

			const output = formatter.format(status, "default");
			expect(output).toContain("Age: 45s");
		});

		test("should format minutes and seconds", () => {
			const status: SystemStatus = {
				...sampleStatus,
				cache: [
					{
						language: "en",
						exists: true,
						path: "/cache/en/manifest.json",
						isExpired: false,
						ageMs: 125000, // 2 minutes 5 seconds
						commandCount: 1,
					},
				],
			};

			const output = formatter.format(status, "default");
			expect(output).toContain("Age: 2m 5s");
		});

		test("should format hours and minutes", () => {
			const status: SystemStatus = {
				...sampleStatus,
				cache: [
					{
						language: "en",
						exists: true,
						path: "/cache/en/manifest.json",
						isExpired: false,
						ageMs: 3750000, // 1 hour 2 minutes 30 seconds
						commandCount: 1,
					},
				],
			};

			const output = formatter.format(status, "default");
			expect(output).toContain("Age: 1h 2m");
		});

		test("should format days and hours", () => {
			const status: SystemStatus = {
				...sampleStatus,
				cache: [
					{
						language: "en",
						exists: true,
						path: "/cache/en/manifest.json",
						isExpired: false,
						ageMs: 90000000, // 1 day 1 hour
						commandCount: 1,
					},
				],
			};

			const output = formatter.format(status, "default");
			expect(output).toContain("Age: 1d 1h");
		});
	});

	describe("file size formatting", () => {
		test("should format bytes", () => {
			const status: SystemStatus = {
				...sampleStatus,
				cache: [
					{
						language: "en",
						exists: true,
						path: "/cache/en/manifest.json",
						isExpired: false,
						sizeBytes: 512,
						commandCount: 1,
					},
				],
			};

			const output = formatter.format(status, "default");
			expect(output).toContain("Size: 512 B");
		});

		test("should format kilobytes", () => {
			const status: SystemStatus = {
				...sampleStatus,
				cache: [
					{
						language: "en",
						exists: true,
						path: "/cache/en/manifest.json",
						isExpired: false,
						sizeBytes: 1536, // 1.5 KB
						commandCount: 1,
					},
				],
			};

			const output = formatter.format(status, "default");
			expect(output).toContain("Size: 1.5 KB");
		});

		test("should format megabytes", () => {
			const status: SystemStatus = {
				...sampleStatus,
				cache: [
					{
						language: "en",
						exists: true,
						path: "/cache/en/manifest.json",
						isExpired: false,
						sizeBytes: 2097152, // 2 MB
						commandCount: 1,
					},
				],
			};

			const output = formatter.format(status, "default");
			expect(output).toContain("Size: 2.0 MB");
		});
	});

	describe("health icons", () => {
		test("should show correct icon for healthy status", () => {
			const output = formatter.format(sampleStatus, "default");
			expect(output).toContain("✅ HEALTHY");
		});

		test("should show correct icon for degraded status", () => {
			const degradedStatus: SystemStatus = {
				...sampleStatus,
				health: { ...sampleStatus.health, status: "degraded" },
			};

			const output = formatter.format(degradedStatus, "default");
			expect(output).toContain("⚠️  DEGRADED");
		});

		test("should show correct icon for error status", () => {
			const errorStatus: SystemStatus = {
				...sampleStatus,
				health: { ...sampleStatus.health, status: "error" },
			};

			const output = formatter.format(errorStatus, "default");
			expect(output).toContain("❌ ERROR");
		});
	});
});
