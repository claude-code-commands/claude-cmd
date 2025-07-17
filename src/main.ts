#!/usr/bin/env bun

import { Command } from "commander";
import { join } from "path";
import { addCommand } from "./cli/commands/add.js";
import { listCommand } from "./cli/commands/list.js";
import { searchCommand } from "./cli/commands/search.js";
import { infoCommand } from "./cli/commands/info.js";
import { installedCommand } from "./cli/commands/installed.js";
import { removeCommand } from "./cli/commands/remove.js";
import { updateCommand } from "./cli/commands/update.js";
import { languageCommand } from "./cli/commands/language.js";
import { completionCommand } from "./cli/commands/completion.js";

// Read version from package.json using Bun's file API with error handling
let version = "0.0.0";
try {
  const packageJsonPath = join(import.meta.dir, "../package.json");
  const packageJson = await Bun.file(packageJsonPath).json();
  version = packageJson.version || "0.0.0";
} catch (error) {
  console.error("Warning: Could not read version from package.json, using default version");
}

const program = new Command();

program
  .name("claude-cmd")
  .description("claude-cmd is a CLI tool that helps you discover, install, and manage \nClaude Code slash commands from a centralized repository. It provides a simple \nway to extend Claude Code with community-contributed commands.")
  .version(version, "-v, --version", "Show version information")
  .option("--format <format>", "Output format (default, compact, json)", "default")
  .helpOption("-h, --help", "help for claude-cmd");

// Add modular commands
program.addCommand(addCommand);
program.addCommand(listCommand);
program.addCommand(searchCommand);
program.addCommand(infoCommand);
program.addCommand(installedCommand);
program.addCommand(removeCommand);
program.addCommand(updateCommand);
program.addCommand(languageCommand);
program.addCommand(completionCommand);

// Commander.js automatically provides help command and --help flag
// No need for custom help command

// Parse arguments
program.parse();