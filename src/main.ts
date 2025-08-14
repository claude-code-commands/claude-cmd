#!/usr/bin/env bun

import { join } from "node:path";
import { Command } from "commander";
import {
	configureLogger,
	enableVerboseLogging,
	rootLogger,
} from "./utils/logger.js";

// Early check for verbose flag and environment variable before configuring LogTape
const hasVerboseFlag =
	process.argv.includes("-V") || process.argv.includes("--verbose");
const envLogLevel = process.env.LOG_LEVEL;

let initialLogLevel = "info"; // Default log level

// Prioritize the --verbose flag for debug level if present
if (hasVerboseFlag) {
	initialLogLevel = "debug";
}

// Environment variable can override the flag
if (envLogLevel) {
	const lowerEnvLogLevel = envLogLevel.toLowerCase();
	if (["debug", "info", "warn", "error", "fatal"].includes(lowerEnvLogLevel)) {
		initialLogLevel = lowerEnvLogLevel;
	}
}

// Configure LogTape immediately based on early check
await configureLogger(initialLogLevel);

// Now import commands after logger is configured
import { addCommand } from "./cli/commands/add.js";
import { cacheCommand } from "./cli/commands/cache.js";
import { completionCommand } from "./cli/commands/completion.js";
import { infoCommand } from "./cli/commands/info.js";
import { installedCommand } from "./cli/commands/installed.js";
import { languageCommand } from "./cli/commands/language.js";
import { listCommand } from "./cli/commands/list.js";
import { removeCommand } from "./cli/commands/remove.js";
import { searchCommand } from "./cli/commands/search.js";
import { statusCommand } from "./cli/commands/status.js";

// Read version from package.json using Bun's file API with error handling
let version = "0.0.0";
try {
	const packageJsonPath = join(import.meta.dir, "../package.json");
	const packageJson = await Bun.file(packageJsonPath).json();
	version = packageJson.version || "0.0.0";
} catch (_error) {
	console.error(
		"Warning: Could not read version from package.json, using default version",
	);
}

const program = new Command();

program
	.name("claude-cmd")
	.description(
		"claude-cmd is a CLI tool that helps you discover, install, and manage \nClaude Code slash commands from a centralized repository. It provides a simple \nway to extend Claude Code with community-contributed commands.",
	)
	.version(version, "-v, --version", "Show version information")
	.option(
		"--format <format>",
		"Output format (default, compact, json)",
		"default",
	)
	.option(
		"-V, --verbose",
		"Enable verbose debug logging for cache, HTTP, and file operations. Useful for debugging/reporting issues.",
	)
	.helpOption("-h, --help", "help for claude-cmd")
	.hook("preAction", (thisCommand, actionCommand) => {
		const opts = thisCommand.opts();
		if (opts.verbose) {
			enableVerboseLogging();
		}
	});

// Add modular commands
program.addCommand(addCommand);
program.addCommand(cacheCommand);
program.addCommand(listCommand);
program.addCommand(searchCommand);
program.addCommand(infoCommand);
program.addCommand(installedCommand);
program.addCommand(removeCommand);
program.addCommand(statusCommand);
program.addCommand(languageCommand);
program.addCommand(completionCommand);

// Commander.js automatically provides help command and --help flag
// No need for custom help command

// Parse arguments
program.parse();
