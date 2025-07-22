import { beforeEach, describe, expect, test } from "bun:test";
import ManifestParser from "../../src/services/ManifestParser.js";
import type { Manifest } from "../../src/types/Command.js";
import { ManifestError } from "../../src/types/Command.js";

describe("ManifestParser", () => {
	let parser: ManifestParser;

	beforeEach(() => {
		parser = new ManifestParser();
	});

	describe("parseManifest", () => {
		test("should parse valid manifest with all required fields", () => {
			const validJson = {
				version: "1.0.1",
				updated: "2025-07-09T00:41:00Z",
				commands: [
					{
						name: "debug-help",
						description:
							"Provide systematic debugging assistance for code issues",
						file: "debug-help.md",
						"allowed-tools": ["Read", "Glob", "Grep", "Bash(git:*)", "Edit"],
					},
				],
			};

			const result = parser.parseManifest(JSON.stringify(validJson), "en");

			expect(result).toBeDefined();
			expect(result.version).toBe("1.0.1");
			expect(result.updated).toBe("2025-07-09T00:41:00Z");
			expect(result.commands).toHaveLength(1);
			expect(result.commands[0]).toBeDefined();
			expect(result.commands[0]?.name).toBe("debug-help");
			expect(result.commands[0]?.description).toContain("debugging assistance");
			expect(result.commands[0]?.file).toBe("debug-help.md");
			expect(Array.isArray(result.commands[0]?.["allowed-tools"])).toBe(true);
		});

		test("should parse manifest with allowed-tools as string", () => {
			const validJson = {
				version: "1.0.1",
				updated: "2025-07-09T00:41:00Z",
				commands: [
					{
						name: "frontend:component",
						description:
							"Generate React components with TypeScript definitions",
						file: "frontend/component.md",
						"allowed-tools": "Read, Edit, Write, Bash(npm:*)",
					},
				],
			};

			const result = parser.parseManifest(JSON.stringify(validJson), "en");

			expect(result.commands[0]).toBeDefined();
			expect(result.commands[0]?.["allowed-tools"]).toBe(
				"Read, Edit, Write, Bash(npm:*)",
			);
		});

		test("should parse manifest with multiple commands", () => {
			const validJson = {
				version: "1.0.1",
				updated: "2025-07-09T00:41:00Z",
				commands: [
					{
						name: "debug-help",
						description: "Debug assistance",
						file: "debug-help.md",
						"allowed-tools": ["Read", "Edit"],
					},
					{
						name: "code-review",
						description: "Code review assistance",
						file: "code-review.md",
						"allowed-tools": "Read, Edit, Glob",
					},
				],
			};

			const result = parser.parseManifest(JSON.stringify(validJson), "en");

			expect(result.commands).toHaveLength(2);
			expect(result.commands[0]).toBeDefined();
			expect(result.commands[1]).toBeDefined();
			expect(result.commands[0]?.name).toBe("debug-help");
			expect(result.commands[1]?.name).toBe("code-review");
		});

		test("should handle empty commands array", () => {
			const validJson = {
				version: "1.0.0",
				updated: "2025-07-09T00:41:00Z",
				commands: [],
			};

			const result = parser.parseManifest(JSON.stringify(validJson), "en");

			expect(result.commands).toHaveLength(0);
		});

		test("should throw ManifestError for invalid JSON", () => {
			const invalidJson = '{"version": "1.0.1", invalid json}';

			expect(() => parser.parseManifest(invalidJson, "en")).toThrow(
				ManifestError,
			);
			expect(() => parser.parseManifest(invalidJson, "en")).toThrow(
				"Invalid JSON format",
			);
		});

		test("should throw ManifestError for missing version field", () => {
			const invalidManifest = {
				updated: "2025-07-09T00:41:00Z",
				commands: [],
			};

			expect(() =>
				parser.parseManifest(JSON.stringify(invalidManifest), "en"),
			).toThrow(ManifestError);
			expect(() =>
				parser.parseManifest(JSON.stringify(invalidManifest), "en"),
			).toThrow("Missing required field: version");
		});

		test("should throw ManifestError for missing updated field", () => {
			const invalidManifest = {
				version: "1.0.1",
				commands: [],
			};

			expect(() =>
				parser.parseManifest(JSON.stringify(invalidManifest), "en"),
			).toThrow(ManifestError);
			expect(() =>
				parser.parseManifest(JSON.stringify(invalidManifest), "en"),
			).toThrow("Missing required field: updated");
		});

		test("should throw ManifestError for missing commands field", () => {
			const invalidManifest = {
				version: "1.0.1",
				updated: "2025-07-09T00:41:00Z",
			};

			expect(() =>
				parser.parseManifest(JSON.stringify(invalidManifest), "en"),
			).toThrow(ManifestError);
			expect(() =>
				parser.parseManifest(JSON.stringify(invalidManifest), "en"),
			).toThrow("Missing required field: commands");
		});

		test("should throw ManifestError for invalid version type", () => {
			const invalidManifest = {
				version: 1.0,
				updated: "2025-07-09T00:41:00Z",
				commands: [],
			};

			expect(() =>
				parser.parseManifest(JSON.stringify(invalidManifest), "en"),
			).toThrow(ManifestError);
			expect(() =>
				parser.parseManifest(JSON.stringify(invalidManifest), "en"),
			).toThrow("Invalid field type: version must be string");
		});

		test("should throw ManifestError for invalid updated type", () => {
			const invalidManifest = {
				version: "1.0.1",
				updated: 1641024000,
				commands: [],
			};

			expect(() =>
				parser.parseManifest(JSON.stringify(invalidManifest), "en"),
			).toThrow(ManifestError);
			expect(() =>
				parser.parseManifest(JSON.stringify(invalidManifest), "en"),
			).toThrow("Invalid field type: updated must be string");
		});

		test("should throw ManifestError for invalid commands type", () => {
			const invalidManifest = {
				version: "1.0.1",
				updated: "2025-07-09T00:41:00Z",
				commands: "not an array",
			};

			expect(() =>
				parser.parseManifest(JSON.stringify(invalidManifest), "en"),
			).toThrow(ManifestError);
			expect(() =>
				parser.parseManifest(JSON.stringify(invalidManifest), "en"),
			).toThrow("Invalid field type: commands must be array");
		});

		test("should throw ManifestError for command missing name", () => {
			const invalidManifest = {
				version: "1.0.1",
				updated: "2025-07-09T00:41:00Z",
				commands: [
					{
						description: "Test command",
						file: "test.md",
						"allowed-tools": ["Read"],
					},
				],
			};

			expect(() =>
				parser.parseManifest(JSON.stringify(invalidManifest), "en"),
			).toThrow(ManifestError);
			expect(() =>
				parser.parseManifest(JSON.stringify(invalidManifest), "en"),
			).toThrow("Command at index 0: Missing required field: name");
		});

		test("should throw ManifestError for command missing description", () => {
			const invalidManifest = {
				version: "1.0.1",
				updated: "2025-07-09T00:41:00Z",
				commands: [
					{
						name: "test-command",
						file: "test.md",
						"allowed-tools": ["Read"],
					},
				],
			};

			expect(() =>
				parser.parseManifest(JSON.stringify(invalidManifest), "en"),
			).toThrow(ManifestError);
			expect(() =>
				parser.parseManifest(JSON.stringify(invalidManifest), "en"),
			).toThrow("Command at index 0: Missing required field: description");
		});

		test("should throw ManifestError for command missing file", () => {
			const invalidManifest = {
				version: "1.0.1",
				updated: "2025-07-09T00:41:00Z",
				commands: [
					{
						name: "test-command",
						description: "Test command",
						"allowed-tools": ["Read"],
					},
				],
			};

			expect(() =>
				parser.parseManifest(JSON.stringify(invalidManifest), "en"),
			).toThrow(ManifestError);
			expect(() =>
				parser.parseManifest(JSON.stringify(invalidManifest), "en"),
			).toThrow("Command at index 0: Missing required field: file");
		});

		test("should throw ManifestError for command missing allowed-tools", () => {
			const invalidManifest = {
				version: "1.0.1",
				updated: "2025-07-09T00:41:00Z",
				commands: [
					{
						name: "test-command",
						description: "Test command",
						file: "test.md",
					},
				],
			};

			expect(() =>
				parser.parseManifest(JSON.stringify(invalidManifest), "en"),
			).toThrow(ManifestError);
			expect(() =>
				parser.parseManifest(JSON.stringify(invalidManifest), "en"),
			).toThrow("Command at index 0: Missing required field: allowed-tools");
		});

		test("should throw ManifestError for invalid command name type", () => {
			const invalidManifest = {
				version: "1.0.1",
				updated: "2025-07-09T00:41:00Z",
				commands: [
					{
						name: 123,
						description: "Test command",
						file: "test.md",
						"allowed-tools": ["Read"],
					},
				],
			};

			expect(() =>
				parser.parseManifest(JSON.stringify(invalidManifest), "en"),
			).toThrow(ManifestError);
			expect(() =>
				parser.parseManifest(JSON.stringify(invalidManifest), "en"),
			).toThrow("Command at index 0: Invalid field type: name must be string");
		});

		test("should throw ManifestError for invalid allowed-tools type", () => {
			const invalidManifest = {
				version: "1.0.1",
				updated: "2025-07-09T00:41:00Z",
				commands: [
					{
						name: "test-command",
						description: "Test command",
						file: "test.md",
						"allowed-tools": 123,
					},
				],
			};

			expect(() =>
				parser.parseManifest(JSON.stringify(invalidManifest), "en"),
			).toThrow(ManifestError);
			expect(() =>
				parser.parseManifest(JSON.stringify(invalidManifest), "en"),
			).toThrow(
				"Command at index 0: Invalid field type: allowed-tools must be array or string",
			);
		});

		test("should throw ManifestError for invalid allowed-tools array content", () => {
			const invalidManifest = {
				version: "1.0.1",
				updated: "2025-07-09T00:41:00Z",
				commands: [
					{
						name: "test-command",
						description: "Test command",
						file: "test.md",
						"allowed-tools": ["Read", 123, "Edit"],
					},
				],
			};

			expect(() =>
				parser.parseManifest(JSON.stringify(invalidManifest), "en"),
			).toThrow(ManifestError);
			expect(() =>
				parser.parseManifest(JSON.stringify(invalidManifest), "en"),
			).toThrow(
				"Command at index 0: Invalid allowed-tools array: all elements must be strings",
			);
		});

		test("should handle non-object JSON input", () => {
			const invalidJson = '"just a string"';

			expect(() => parser.parseManifest(invalidJson, "en")).toThrow(
				ManifestError,
			);
			expect(() => parser.parseManifest(invalidJson, "en")).toThrow(
				"Manifest must be an object",
			);
		});

		test("should handle null JSON input", () => {
			const invalidJson = "null";

			expect(() => parser.parseManifest(invalidJson, "en")).toThrow(
				ManifestError,
			);
			expect(() => parser.parseManifest(invalidJson, "en")).toThrow(
				"Manifest must be an object",
			);
		});

		test("should handle array JSON input", () => {
			const invalidJson = '[{"name": "test"}]';

			expect(() => parser.parseManifest(invalidJson, "en")).toThrow(
				ManifestError,
			);
			expect(() => parser.parseManifest(invalidJson, "en")).toThrow(
				"Manifest must be an object",
			);
		});

		test("should include language in error messages", () => {
			const invalidJson = '{"version": 123}';

			try {
				parser.parseManifest(invalidJson, "fr");
			} catch (error) {
				expect(error).toBeInstanceOf(ManifestError);
				if (error instanceof ManifestError) {
					expect(error.language).toBe("fr");
					expect(error.message).toContain("fr");
				}
			}
		});

		test("should preserve original cause in error messages", () => {
			const invalidJson = "{broken json";

			try {
				parser.parseManifest(invalidJson, "en");
			} catch (error) {
				expect(error).toBeInstanceOf(ManifestError);
				if (error instanceof ManifestError) {
					expect(error.cause).toContain("Invalid JSON format");
				}
			}
		});
	});

	describe("validateManifest", () => {
		test("should return true for valid manifest object", () => {
			const validManifest: Manifest = {
				version: "1.0.1",
				updated: "2025-07-09T00:41:00Z",
				commands: [
					{
						name: "debug-help",
						description: "Debug assistance",
						file: "debug-help.md",
						"allowed-tools": ["Read", "Edit"],
					},
				],
			};

			const result = parser.validateManifest(validManifest);
			expect(result).toBe(true);
		});

		test("should return false for manifest missing version", () => {
			const invalidManifest = {
				updated: "2025-07-09T00:41:00Z",
				commands: [],
			} as any;

			const result = parser.validateManifest(invalidManifest);
			expect(result).toBe(false);
		});

		test("should return false for manifest with invalid commands", () => {
			const invalidManifest = {
				version: "1.0.1",
				updated: "2025-07-09T00:41:00Z",
				commands: [
					{
						name: "test-command",
						// missing description, file, allowed-tools
					},
				],
			} as any;

			const result = parser.validateManifest(invalidManifest);
			expect(result).toBe(false);
		});

		test("should return false for null input", () => {
			const result = parser.validateManifest(null);
			expect(result).toBe(false);
		});

		test("should return false for undefined input", () => {
			const result = parser.validateManifest(undefined);
			expect(result).toBe(false);
		});
	});
});
