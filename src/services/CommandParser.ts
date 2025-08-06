import { basename, dirname } from "node:path";
import matter from "gray-matter";
import type INamespaceService from "../interfaces/INamespaceService.js";
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
 * with YAML frontmatter and markdown content, including namespace support.
 */
export class CommandParser {
	private readonly namespaceService: INamespaceService;

	constructor(namespaceService: INamespaceService) {
		this.namespaceService = namespaceService;
	}
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
	 * Parse a command file with optional YAML frontmatter and namespace support
	 *
	 * @param content File content to parse
	 * @param commandNameOrFilePath Command name (legacy) or file path (new namespace-aware mode)
	 * @param filePath Optional file path for namespace extraction (when using legacy signature)
	 * @returns Parsed Command object with namespace information if applicable
	 */
	async parseCommandFile(
		content: string,
		commandNameOrFilePath: string,
		filePath?: string,
	): Promise<Command> {
		// Extract namespace and command info first so it's available in catch block
		const { commandName, namespace, file } = this.extractCommandInfo(
			commandNameOrFilePath,
			filePath,
		);

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
					file: file,
					"allowed-tools": allowedTools,
				};

				// Add optional namespace if present
				if (namespace) {
					(command as any).namespace = namespace;
				}

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
					file: file,
					"allowed-tools": [], // No tools allowed for basic commands without frontmatter
				};

				// Add optional namespace if present
				if (namespace) {
					(command as any).namespace = namespace;
				}

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
		const bashPattern = /^Bash\([a-zA-Z0-9_\-,:*\s]+\)$/;
		if (bashPattern.test(tool)) {
			return true;
		}

		return false;
	}

	/**
	 * Extract command information from file paths, supporting both legacy and namespace modes
	 */
	private extractCommandInfo(
		commandNameOrFilePath: string,
		filePath?: string,
	): {
		commandName: string;
		namespace?: string;
		file: string;
	} {
		// If filePath is provided explicitly, use it for namespace extraction
		if (filePath) {
			return this.extractFromFilePath(filePath);
		}

		// Check if commandNameOrFilePath is actually a file path
		if (
			commandNameOrFilePath.includes("/") ||
			commandNameOrFilePath.endsWith(".md")
		) {
			return this.extractFromFilePath(commandNameOrFilePath);
		}

		// Legacy mode: just a command name
		return {
			commandName: commandNameOrFilePath,
			file: `${commandNameOrFilePath}.md`,
		};
	}

	/**
	 * Extract namespace and command info from a file path
	 */
	private extractFromFilePath(filePath: string): {
		commandName: string;
		namespace?: string;
		file: string;
	} {
		// Normalize the file path
		const normalizedPath = filePath.replace(/\\/g, "/");

		// Extract directory and filename
		const directory = dirname(normalizedPath);
		const filename = basename(normalizedPath);

		// Extract command name (remove .md extension)
		const commandName = filename.replace(/\.md$/, "");

		// Determine namespace from directory structure
		let namespace: string | undefined;

		if (directory && directory !== "." && directory !== "/") {
			try {
				// Convert path to colon-separated namespace
				namespace = this.namespaceService.toColonSeparated(directory);
			} catch {
				// If namespace parsing fails, treat as flat command
				namespace = undefined;
			}
		}

		return {
			commandName,
			namespace,
			file: normalizedPath,
		};
	}
}
