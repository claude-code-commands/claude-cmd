import type { CommandServiceOptions } from "../services/CommandService.js";
import type { Command } from "../types/Command.js";
import type {
	InstallationInfo,
	InstallationSummary,
	InstallOptions,
	RemoveOptions,
} from "../types/Installation.js";

/**
 * InstallationService interface for managing Claude command installations
 *
 * Provides operations for installing, removing, and managing Claude Code
 * slash commands in local directories (personal and project-specific).
 */
export default interface IInstallationService {
	/**
	 * Install a command from the repository to local directory
	 * @param commandName Name of the command to install
	 * @param options Installation options (target directory, force overwrite, etc.)
	 * @returns Promise that resolves when installation is complete
	 */
	installCommand(commandName: string, options?: InstallOptions): Promise<void>;

	/**
	 * Remove an installed command from local directory
	 * @param commandName Name of the command to remove
	 * @param options Removal options (confirmation bypass, etc.)
	 * @returns Promise that resolves when removal is complete
	 */
	removeCommand(commandName: string, options?: RemoveOptions): Promise<void>;

	/**
	 * List all installed commands from local Claude directories
	 * @param options Optional language override and cache control
	 * @returns Promise resolving to array of locally installed commands
	 */
	listInstalledCommands(
		options?: CommandServiceOptions,
	): Promise<readonly Command[]>;

	/**
	 * Get detailed information about an installed command
	 * @param commandName Name of the command to get info for
	 * @returns Promise resolving to installation info or null if not found
	 */
	getInstallationInfo(commandName: string): Promise<InstallationInfo | null>;

	/**
	 * Check if a command is currently installed
	 * @param commandName Name of the command to check
	 * @returns Promise resolving to true if installed, false otherwise
	 */
	isInstalled(commandName: string): Promise<boolean>;

	/**
	 * Get the installation path for a command if it's installed
	 * @param commandName Name of the command
	 * @returns Promise resolving to file path or null if not installed
	 */
	getInstallationPath(commandName: string): Promise<string | null>;

	/**
	 * Get detailed information about all installed commands
	 * @returns Promise resolving to array of installation info
	 */
	getAllInstallationInfo(): Promise<InstallationInfo[]>;

	/**
	 * Get summary information about all installed commands
	 * @returns Promise resolving to installation summary
	 */
	getInstallationSummary(): Promise<InstallationSummary>;
}
