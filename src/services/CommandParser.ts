import matter from "gray-matter";
import type { Command } from "../types/Command.js";

/**
 * Error thrown when command parsing fails
 */
export class CommandParseError extends Error {
	constructor(
		message: string,
		public readonly commandName?: string,
		public override readonly cause?: Error,
	) {
		super(message);
		this.name = this.constructor.name;
	}
}

/**
 * CommandParser handles parsing and validation of Claude command files
 * with YAML frontmatter and markdown content.
 */
export class CommandParser {
	/**
	 * Whitelist of allowed core Claude Code tools
	 */
	private readonly allowedTools = new Set([
		"Edit",
		"Glob",
		"Grep",
		"LS",
		"MultiEdit",
		"NotebookEdit",
		"NotebookRead",
		"Read",
		"Task",
		"TodoWrite",
		"WebFetch",
		"WebSearch",
		"Write",
	]);

	/**
	 * Parse a command file with optional YAML frontmatter
	 * @param content File content to parse
	 * @param commandName Name of the command
	 * @returns Parsed Command object
	 */
	async parseCommandFile(
		content: string,
		commandName: string,
	): Promise<Command> {
		try {
			// Parse frontmatter using gray-matter
			const parsed = matter(content);

			// Handle missing or empty frontmatter (optional frontmatter support)
			const hasValidFrontmatter =
				parsed.data && Object.keys(parsed.data).length > 0;

			if (hasValidFrontmatter) {
				// Frontmatter exists - validate required fields for frontmatter mode
				if (!parsed.data.description) {
					throw new CommandParseError(
						"Command file missing required 'description' field",
						commandName,
					);
				}

				// Security validation
				this.validateSecurity(parsed.data, commandName);

				// Normalize allowed-tools (optional field, defaults to empty array)
				const allowedTools = parsed.data["allowed-tools"] 
					? this.normalizeAllowedTools(parsed.data["allowed-tools"])
					: [];

				// Validate allowed-tools against whitelist (only if tools are specified)
				if (allowedTools.length > 0) {
					this.validateAllowedTools(allowedTools, commandName);
				}

				// Build Command object with frontmatter data
				const command: Command = {
					name: commandName,
					description: parsed.data.description,
					file: `${commandName}.md`,
					"allowed-tools": allowedTools,
				};

				// Add optional argument-hint if present
				if (parsed.data["argument-hint"]) {
					(command as any)["argument-hint"] = parsed.data["argument-hint"];
				}

				return command;
			} else {
				// No frontmatter - create basic command with safe defaults
				// This supports basic Markdown files without YAML frontmatter
				const command: Command = {
					name: commandName,
					description: `Custom slash command: ${commandName}`,
					file: `${commandName}.md`,
					"allowed-tools": [], // No tools allowed for basic commands without frontmatter
				};

				return command;
			}
		} catch (error) {
			if (error instanceof CommandParseError) {
				throw error;
			}

			// Handle YAML parsing errors
			throw new CommandParseError(
				"Invalid YAML frontmatter",
				commandName,
				error as Error,
			);
		}
	}

	/**
	 * Validate if a command file is properly formatted
	 * @param content File content to validate
	 * @returns True if valid, false otherwise
	 */
	async validateCommandFile(content: string): Promise<boolean> {
		try {
			await this.parseCommandFile(content, "validation-test");
			return true;
		} catch {
			return false;
		}
	}

	/**
	 * Perform security validation on parsed frontmatter
	 * @param data Parsed frontmatter data
	 * @param commandName Command name for error reporting
	 */
	private validateSecurity(data: any, commandName: string): void {
		// Check for dangerous file paths
		if (data.file) {
			if (data.file.includes("..")) {
				throw new CommandParseError(
					"Security violation: file path contains path traversal",
					commandName,
				);
			}

			if (data.file.startsWith("/") || data.file.match(/^[A-Za-z]:/)) {
				throw new CommandParseError(
					"Security violation: file path must be relative",
					commandName,
				);
			}
		}
	}

	/**
	 * Normalize allowed-tools field to array format
	 * @param allowedTools Raw allowed-tools value
	 * @returns Normalized array of tools
	 */
	private normalizeAllowedTools(allowedTools: any): string[] {
		let tools: string[] = [];

		if (typeof allowedTools === "string") {
			// Split by comma and normalize
			tools = allowedTools.split(",").map((tool) => tool.trim());
		} else if (Array.isArray(allowedTools)) {
			// Already an array, just normalize strings
			tools = allowedTools.map((tool) => String(tool).trim());
		} else {
			throw new Error("allowed-tools must be string or array");
		}

		// Remove empty entries and deduplicate
		return [...new Set(tools.filter((tool) => tool.length > 0))];
	}

	/**
	 * Validate allowed-tools against security whitelist
	 * @param tools Array of tools to validate
	 * @param commandName Command name for error reporting
	 */
	private validateAllowedTools(tools: string[], commandName: string): void {
		for (const tool of tools) {
			if (!this.isAllowedTool(tool)) {
				throw new CommandParseError(
					`Security violation: tool '${tool}' is not allowed`,
					commandName,
				);
			}
		}
	}

	/**
	 * Check if a tool is in the allowed whitelist
	 * @param tool Tool to check
	 * @returns True if allowed
	 */
	private isAllowedTool(tool: string): boolean {
		// Direct match against core tools
		if (this.allowedTools.has(tool)) {
			return true;
		}

		// Check against MCP tool pattern: mcp__<server-name>__<prompt-name>
		const mcpPattern = /^mcp__[a-zA-Z0-9_]+__[a-zA-Z0-9_]+$/;
		if (mcpPattern.test(tool)) {
			return true;
		}

		// Allow any Bash command pattern: Bash(command:*) or Bash(cmd1:*, cmd2:*)
		// This gives users flexibility to use any bash tools in their slash commands
		const bashPattern = /^Bash\([a-zA-Z0-9_\-,:\*\s]+\)$/;
		if (bashPattern.test(tool)) {
			return true;
		}

		return false;
	}
}
