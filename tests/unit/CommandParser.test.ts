import { beforeEach, describe, expect, test } from "bun:test";
import { CommandParser } from "../../src/services/CommandParser.js";

describe("CommandParser", () => {
	let parser: CommandParser;

	beforeEach(() => {
		parser = new CommandParser();
	});

	describe("parseCommandFile", () => {
		test("should parse valid command file with YAML frontmatter", async () => {
			const content = `---
description: Test command for debugging
allowed-tools: Read, Edit, Bash(git:*)
---

# Test Command

This is a test command for debugging code issues.

## Usage
Use this command when you need help debugging.
`;

			const command = await parser.parseCommandFile(content, "test-debug");

			expect(command.name).toBe("test-debug");
			expect(command.description).toBe("Test command for debugging");
			expect(command.file).toBe("test-debug.md");
			expect(command["allowed-tools"]).toEqual(["Read", "Edit", "Bash(git:*)"]);
		});

		test("should handle allowed-tools as string", async () => {
			const content = `---
description: Test command
allowed-tools: "Read, Edit, Write"
---

# Test Command
`;

			const command = await parser.parseCommandFile(content, "test");

			expect(command["allowed-tools"]).toEqual(["Read", "Edit", "Write"]);
		});

		test("should handle allowed-tools as array", async () => {
			const content = `---
description: Test command  
allowed-tools:
  - Read
  - Edit
  - Write
---

# Test Command
`;

			const command = await parser.parseCommandFile(content, "test");

			expect(command["allowed-tools"]).toEqual(["Read", "Edit", "Write"]);
		});

		test("should throw error for missing description", async () => {
			const content = `---
allowed-tools: Read, Edit
---

# Test Command
`;

			await expect(parser.parseCommandFile(content, "test")).rejects.toThrow(
				"Command file missing required 'description' field",
			);
		});

		test("should throw error for missing allowed-tools", async () => {
			const content = `---
description: Test command
---

# Test Command
`;

			await expect(parser.parseCommandFile(content, "test")).rejects.toThrow(
				"Command file missing required 'allowed-tools' field",
			);
		});

		test("should throw error for invalid YAML frontmatter", async () => {
			const content = `---
description: Test command
allowed-tools: [invalid yaml structure
---

# Test Command
`;

			await expect(parser.parseCommandFile(content, "test")).rejects.toThrow(
				"Invalid YAML frontmatter",
			);
		});

		test("should handle commands without frontmatter", async () => {
			const content = `# Test Command

This command has no frontmatter.
`;

			const command = await parser.parseCommandFile(content, "test");

			expect(command.name).toBe("test");
			expect(command.description).toBe("Custom slash command: test");
			expect(command.file).toBe("test.md");
			expect(command["allowed-tools"]).toEqual([]);
		});

		test("should handle empty frontmatter as basic command", async () => {
			const content = `---
---

# Test Command
`;

			const command = await parser.parseCommandFile(content, "test");

			expect(command.name).toBe("test");
			expect(command.description).toBe("Custom slash command: test");
			expect(command.file).toBe("test.md");
			expect(command["allowed-tools"]).toEqual([]);
		});

		test("should handle complex allowed-tools patterns", async () => {
			const content = `---
description: Complex command
allowed-tools:
  - Read
  - Glob
  - Grep
  - "Bash(git:*)"
  - "Bash(npm:*, yarn:*)"
  - Edit
  - Write
---

# Complex Command
`;

			const command = await parser.parseCommandFile(content, "complex");

			expect(command["allowed-tools"]).toEqual([
				"Read",
				"Glob",
				"Grep",
				"Bash(git:*)",
				"Bash(npm:*, yarn:*)",
				"Edit",
				"Write",
			]);
		});

		test("should handle argument-hint field", async () => {
			const content = `---
description: Command with argument hint
allowed-tools: Read, Edit
argument-hint: add [tagId] | remove [tagId] | list
---

# Command with Argument Hint
`;

			const command = await parser.parseCommandFile(content, "tag-manager");

			expect(command.name).toBe("tag-manager");
			expect(command.description).toBe("Command with argument hint");
			expect(command["argument-hint"]).toBe(
				"add [tagId] | remove [tagId] | list",
			);
		});

		test("should handle command without argument-hint field", async () => {
			const content = `---
description: Command without argument hint
allowed-tools: Read, Edit
---

# Command without Argument Hint
`;

			const command = await parser.parseCommandFile(content, "no-hint");

			expect(command.name).toBe("no-hint");
			expect(command.description).toBe("Command without argument hint");
			expect(command["argument-hint"]).toBeUndefined();
		});
	});

	describe("validateCommandFile", () => {
		test("should return true for valid command file", async () => {
			const content = `---
description: Valid command
allowed-tools: Read, Edit
---

# Valid Command
`;

			const isValid = await parser.validateCommandFile(content);
			expect(isValid).toBe(true);
		});

		test("should return false for invalid command file", async () => {
			const content = `---
description: Invalid command
---

# Missing allowed-tools
`;

			const isValid = await parser.validateCommandFile(content);
			expect(isValid).toBe(false);
		});

		test("should return true for file without frontmatter", async () => {
			const content = `# No frontmatter command`;

			const isValid = await parser.validateCommandFile(content);
			expect(isValid).toBe(true);
		});

		test("should return false for malformed YAML", async () => {
			const content = `---
description: Test
allowed-tools: [invalid
---

# Test
`;

			const isValid = await parser.validateCommandFile(content);
			expect(isValid).toBe(false);
		});
	});

	describe("security validation", () => {
		test("should reject dangerous file paths in frontmatter", async () => {
			const content = `---
description: Dangerous command
allowed-tools: Read
file: ../../../etc/passwd
---

# Dangerous Command
`;

			await expect(
				parser.parseCommandFile(content, "dangerous"),
			).rejects.toThrow(
				"Security violation: file path contains path traversal",
			);
		});

		test("should reject absolute file paths", async () => {
			const content = `---
description: Absolute path command  
allowed-tools: Read
file: /etc/passwd
---

# Absolute Path Command
`;

			await expect(
				parser.parseCommandFile(content, "absolute"),
			).rejects.toThrow("Security violation: file path must be relative");
		});

		test("should validate allowed-tools against whitelist", async () => {
			const content = `---
description: Dangerous tools command
allowed-tools:
  - Read
  - "Bash(rm:*)"
  - "Bash(sudo:*)"
---

# Dangerous Tools Command
`;

			await expect(
				parser.parseCommandFile(content, "dangerous-tools"),
			).rejects.toThrow("Security violation: tool 'Bash(rm:*)' is not allowed");
		});

		test("should allow safe bash patterns", async () => {
			const content = `---
description: Safe tools command
allowed-tools:
  - Read
  - Edit
  - Write
  - Glob
  - Grep
  - "Bash(git:*)"
  - "Bash(npm:*)"
  - "Bash(node:*)"
---

# Safe Tools Command
`;

			const command = await parser.parseCommandFile(content, "safe-tools");
			expect(command["allowed-tools"]).toContain("Bash(git:*)");
		});
	});

	describe("normalization", () => {
		test("should normalize whitespace in allowed-tools", async () => {
			const content = `---
description: Whitespace test
allowed-tools: "  Read  ,  Edit  ,  Write  "
---

# Whitespace Test
`;

			const command = await parser.parseCommandFile(content, "whitespace");
			expect(command["allowed-tools"]).toEqual(["Read", "Edit", "Write"]);
		});

		test("should remove empty allowed-tools entries", async () => {
			const content = `---
description: Empty entries test
allowed-tools:
  - Read
  - ""
  - Edit  
  - "  "
  - Write
---

# Empty Entries Test
`;

			const command = await parser.parseCommandFile(content, "empty-entries");
			expect(command["allowed-tools"]).toEqual(["Read", "Edit", "Write"]);
		});

		test("should deduplicate allowed-tools", async () => {
			const content = `---
description: Duplicate test
allowed-tools:
  - Read
  - Edit
  - Read
  - Write
  - Edit
---

# Duplicate Test
`;

			const command = await parser.parseCommandFile(content, "duplicates");
			expect(command["allowed-tools"]).toEqual(["Read", "Edit", "Write"]);
		});
	});
});
