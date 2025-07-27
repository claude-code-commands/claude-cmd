import { constants } from "node:fs";
import { access } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type IFileService from "../interfaces/IFileService.js";
import type { DirectoryInfo } from "../types/Installation.js";

/**
 * DirectoryDetector handles detection and management of Claude command directories
 * across different platforms and installation locations.
 */
export class DirectoryDetector {
	constructor(private readonly fileService: IFileService) {}

	/**
	 * Get all Claude directories (personal and project-specific)
	 * @returns Array of directory information
	 */
	async getClaudeDirectories(): Promise<DirectoryInfo[]> {
		const personalPath = await this.getPersonalDirectory();
		const projectPath = await this.getProjectDirectory();

		const [personalExists, projectExists] = await Promise.all([
			this.fileService.exists(personalPath),
			this.fileService.exists(projectPath),
		]);

		// Check writability - assume writable if directory exists or parent directory is writable
		const personalWritable = await this.checkWritability(
			personalPath,
			personalExists,
		);
		const projectWritable = await this.checkWritability(
			projectPath,
			projectExists,
		);

		return [
			{
				path: personalPath,
				type: "personal",
				exists: personalExists,
				writable: personalWritable,
			},
			{
				path: projectPath,
				type: "project",
				exists: projectExists,
				writable: projectWritable,
			},
		];
	}

	/**
	 * Get the personal Claude commands directory path
	 * @returns Absolute path to personal directory
	 */
	async getPersonalDirectory(): Promise<string> {
		const homeDir = this.getHomeDirectory();
		const personalPath = path.join(homeDir, ".claude", "commands");

		// For cross-platform compatibility, only resolve if the path doesn't start with a drive letter
		// This prevents issues when running Unix tests with Windows paths
		if (this.isAbsolutePath(personalPath)) {
			return personalPath;
		}

		return path.resolve(personalPath);
	}

	/**
	 * Get the project-specific Claude commands directory path
	 * @param absolute Whether to return absolute path (default: false)
	 * @returns Path to project directory
	 */
	async getProjectDirectory(absolute = false): Promise<string> {
		const projectPath = path.join(".claude", "commands");

		if (absolute) {
			return path.resolve(projectPath);
		}

		return projectPath;
	}

	/**
	 * Ensure a directory exists, creating it if necessary
	 * @param dirPath Path to the directory
	 */
	async ensureDirectoryExists(dirPath: string): Promise<void> {
		if (!(await this.fileService.exists(dirPath))) {
			await this.fileService.mkdir(dirPath);
		}
	}

	/**
	 * Get the preferred installation location based on target preference
	 * @param target Target directory type (defaults to "personal")
	 * @returns Absolute path to preferred directory
	 */
	async getPreferredInstallLocation(
		target: "personal" | "project" = "personal",
	): Promise<string> {
		if (target === "project") {
			return await this.getProjectDirectory();
		}

		return await this.getPersonalDirectory();
	}

	/**
	 * Get the home directory for the current user
	 * Cross-platform implementation that handles Windows, macOS, and Linux
	 * @returns Home directory path
	 */
	private getHomeDirectory(): string {
		// Try HOME first (Unix-like systems)
		if (process.env.HOME) {
			return process.env.HOME;
		}

		// Try USERPROFILE for Windows
		if (process.env.USERPROFILE) {
			return process.env.USERPROFILE;
		}

		// Try os.homedir() as fallback
		try {
			const homeDir = os.homedir();
			if (homeDir && homeDir !== "?") {
				return homeDir;
			}
		} catch {
			// os.homedir() can throw in some environments
		}

		// If all else fails, throw an error
		throw new Error(
			"Unable to determine home directory. Please set HOME or USERPROFILE environment variable.",
		);
	}

	/**
	 * Check if a path is absolute (cross-platform)
	 * @param filePath Path to check
	 * @returns True if path is absolute
	 */
	private isAbsolutePath(filePath: string): boolean {
		// Use Node.js built-in method which handles cross-platform differences
		return path.isAbsolute(filePath);
	}

	/**
	 * Check if a directory is writable by testing actual filesystem permissions
	 * @param dirPath Path to check
	 * @param exists Whether the directory already exists
	 * @returns True if writable
	 */
	private async checkWritability(
		dirPath: string,
		exists: boolean,
	): Promise<boolean> {
		try {
			if (exists) {
				// Directory exists, check if we can write to it
				await access(dirPath, constants.W_OK);
				return true;
			}

			// Directory doesn't exist, check if we can write to the parent
			const parentDir = path.dirname(dirPath);
			await access(parentDir, constants.W_OK);
			return true;
		} catch {
			return false;
		}
	}
}
