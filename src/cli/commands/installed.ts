import { Command } from "commander";
import { getServices } from "../../services/serviceFactory.ts";
import type {
	InstallationInfo,
	InstallationSummary,
} from "../../types/Installation.js";
import { detectLanguage, handleError } from "../cliUtils.js";

/**
 * Format installed commands with enhanced display including location indicators
 * Provides detailed formatting with location information and grouping
 */
export function formatInstalledCommandsEnhanced(
	installationInfos: readonly InstallationInfo[],
	language: string,
): string {
	if (installationInfos.length === 0) {
		return "No commands are currently installed.";
	}

	// Group commands by location in single pass for efficiency
	const { personalCommands, projectCommands } = installationInfos.reduce(
		(acc, info) => {
			if (info.location === "personal") {
				acc.personalCommands.push(info);
			} else {
				acc.projectCommands.push(info);
			}
			return acc;
		},
		{
			personalCommands: [] as InstallationInfo[],
			projectCommands: [] as InstallationInfo[],
		},
	);

	let output = `${installationInfos.length} installed Claude Code Commands (${language}):\n\n`;

	if (personalCommands.length > 0) {
		output += "Personal Commands:\n";
		for (const info of personalCommands) {
			output += `${info.name}\n`;
		}
		output += "\n";
	}

	if (projectCommands.length > 0) {
		output += "Project Commands:\n";
		for (const info of projectCommands) {
			output += `${info.name}\n`;
		}
		output += "\n";
	}

	return output.trim();
}

/**
 * Format installation summary information with command counts
 * Provides aggregate statistics about installed commands using pre-calculated summary
 */
export function formatInstalledCommandsSummary(
	summary: InstallationSummary,
	language: string,
): string {
	if (summary.totalCommands === 0) {
		return "No commands are currently installed.";
	}

	let output = `Installation Summary (${language}):\n\n`;
	output += `Total: ${summary.totalCommands}\n`;
	output += `Personal: ${summary.personalCount}\n`;
	output += `Project: ${summary.projectCount}\n`;

	return output.trim();
}

/**
 * Format installed commands in tree structure for namespaced commands
 * Shows hierarchical display with proper tree characters and indentation
 */
export function formatInstalledCommandsTree(
	installationInfos: readonly InstallationInfo[],
	language: string,
): string {
	if (installationInfos.length === 0) {
		return "No commands are currently installed.";
	}

	// Build tree structure
	const tree = new Map<string, string[]>();
	const flatCommands: string[] = [];

	for (const info of installationInfos) {
		if (info.name.includes(":")) {
			// Namespaced command
			const parts = info.name.split(":");
			const namespace = parts.slice(0, -1).join(":");
			const commandName = parts[parts.length - 1];

			if (commandName && !tree.has(namespace)) {
				tree.set(namespace, []);
			}
			const namespaceCommands = tree.get(namespace);
			if (namespaceCommands && commandName) {
				namespaceCommands.push(commandName);
			}
		} else {
			// Flat command - also display with tree structure for consistency
			flatCommands.push(info.name);
		}
	}

	let output = `${installationInfos.length} installed Claude Code Commands (${language}) - Tree View:\n\n`;

	// Display flat commands with tree characters for consistency
	for (const command of flatCommands) {
		output += `├ ${command}\n`;
	}

	// Display namespaced commands with tree structure
	for (const [namespace, commands] of tree.entries()) {
		output += `├ ${namespace}:\n`;
		for (let i = 0; i < commands.length; i++) {
			const isLast = i === commands.length - 1;
			const treeChar = isLast ? "└" : "├";
			output += `  ${treeChar} ${commands[i]}\n`;
		}
	}

	return output.trim();
}

export const installedCommand = new Command("installed")
	.description(
		"List displays all installed Claude Code slash commands.\nShows commands that are available in your local Claude Code directories.",
	)
	.option(
		"-l, --language <lang>",
		"Language for commands (default: auto-detect)",
	)
	.option("-f, --force", "Force refresh cache even if current")
	.option("--summary", "Display summary information with command counts")
	.option("--tree", "Show hierarchical display for namespaced commands")
	.action(async (options) => {
		try {
			// Get singleton service instances from factory
			const { languageDetector, installationService } = getServices();

			// Determine language used
			const language = await detectLanguage(options.language, languageDetector);

			// Check which display mode to use
			if (options.summary) {
				// Summary mode: use a dedicated service method for efficiency
				const summary = await installationService.getInstallationSummary();
				const output = formatInstalledCommandsSummary(summary, language);
				console.log(output);
			} else {
				// For tree and enhanced modes, fetch installation info once
				const installationInfos =
					await installationService.getAllInstallationInfo();

				if (options.tree) {
					// Tree mode: show hierarchical display for namespaced commands
					const output = formatInstalledCommandsTree(
						installationInfos,
						language,
					);
					console.log(output);
				} else {
					// Default enhanced mode: show location information by default
					const output = formatInstalledCommandsEnhanced(
						installationInfos,
						language,
					);
					console.log(output);
				}
			}
		} catch (error) {
			handleError(error, "Failed to list installed commands");
		}
	});
