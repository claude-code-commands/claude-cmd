import { constants } from "node:fs";
import {
	access,
	mkdir as fsMkdir,
	rmdir as fsRmdir,
	readdir,
	stat,
	unlink,
} from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import type IFileService from "../interfaces/IFileService.ts";
import {
	FileIOError,
	FileNotFoundError,
	FilePermissionError,
	type NamespacedFile,
} from "../interfaces/IFileService.ts";

/**
 * Interface for Node.js system errors with error codes
 */
interface SystemError extends Error {
	code?: string;
}

/**
 * Real file service implementation using Bun.file() APIs
 *
 * Provides production file system operations with proper error handling
 * and mapping to custom error types defined in IFileService.
 */
export default class BunFileService implements IFileService {
	/**
	 * Private helper to map system errors to custom error types
	 */
	private mapSystemError(
		error: unknown,
		path: string,
		operation: "read" | "write" | "create" | "delete" | "list",
	): never {
		if (!(error instanceof Error)) {
			throw new FileIOError(path, "Unknown error");
		}

		const systemError = error as SystemError;
		const code = systemError.code;

		switch (code) {
			case "ENOENT":
				throw new FileNotFoundError(path);
			case "EACCES":
			case "EPERM":
				throw new FilePermissionError(path, operation);
			case "ENOSPC":
				throw new FileIOError(path, "No space left on device");
			default:
				throw new FileIOError(path, error.message);
		}
	}
	/**
	 * Read content from a file using Bun.file()
	 */
	async readFile(path: string): Promise<string> {
		try {
			const file = Bun.file(path);
			return await file.text();
		} catch (error) {
			this.mapSystemError(error, path, "read");
		}
	}

	/**
	 * Write content to a file using Bun.write(), creating directories as needed
	 */
	async writeFile(path: string, content: string): Promise<void> {
		try {
			// Create parent directories first
			const dir = dirname(path);
			if (dir !== path) {
				// Avoid infinite recursion for root paths
				await this.mkdir(dir);
			}

			await Bun.write(path, content);
		} catch (error) {
			this.mapSystemError(error, path, "write");
		}
	}

	/**
	 * Check if a file or directory exists using fs.stat()
	 */
	async exists(path: string): Promise<boolean> {
		try {
			await stat(path);
			return true;
		} catch (error) {
			if (error instanceof Error) {
				const systemError = error as SystemError;

				// ENOENT means file/directory doesn't exist - return false
				if (systemError.code === "ENOENT") {
					return false;
				}

				// Permission errors should be thrown, not hidden
				if (systemError.code === "EACCES" || systemError.code === "EPERM") {
					throw new FilePermissionError(path, "exists");
				}

				// Report serious I/O errors
				if (systemError.code === "EIO" || systemError.code === "ELOOP") {
					throw new FileIOError(path, error.message);
				}
			}

			// For other errors, return false
			return false;
		}
	}

	/**
	 * Create a directory recursively using Node.js fs.mkdir()
	 */
	async mkdir(path: string): Promise<void> {
		try {
			await fsMkdir(path, { recursive: true });
		} catch (error) {
			// Handle EEXIST gracefully for idempotent behavior
			if (error instanceof Error && (error as SystemError).code === "EEXIST") {
				return; // Directory already exists, which is fine (idempotent)
			}

			this.mapSystemError(error, path, "create");
		}
	}

	/**
	 * Delete a file using Node.js fs.unlink()
	 */
	async deleteFile(path: string): Promise<void> {
		try {
			await unlink(path);
		} catch (error) {
			this.mapSystemError(error, path, "delete");
		}
	}

	/**
	 * List files in a directory using Node.js fs.readdir()
	 */
	async listFiles(path: string): Promise<string[]> {
		try {
			const entries = await readdir(path, { withFileTypes: true });
			// Return only files, not subdirectories
			return entries
				.filter((entry) => entry.isFile())
				.map((entry) => entry.name);
		} catch (error) {
			this.mapSystemError(error, path, "list");
		}
	}

	/**
	 * List files recursively in a directory and all subdirectories
	 */
	async listFilesRecursive(path: string): Promise<string[]> {
		try {
			const entries = await readdir(path, { withFileTypes: true });
			const files: string[] = [];

			for (const entry of entries) {
				if (entry.isFile()) {
					files.push(entry.name);
				} else if (entry.isDirectory()) {
					// Recursively scan subdirectories
					const subDir = join(path, entry.name);
					const subFiles = await this.listFilesRecursive(subDir);

					// Add subdirectory files with relative paths
					for (const subFile of subFiles) {
						files.push(join(entry.name, subFile));
					}
				}
			}

			return files;
		} catch (error) {
			this.mapSystemError(error, path, "list");
		}
	}

	/**
	 * Check if a path is writable
	 */
	async isWritable(path: string): Promise<boolean> {
		try {
			await access(path, constants.W_OK);
			return true;
		} catch {
			return false;
		}
	}

	/**
	 * Create hierarchical directory structure for namespace
	 */
	async createNamespaceDirectories(
		basePath: string,
		namespacePath: string,
	): Promise<string> {
		try {
			const fullPath = join(basePath, namespacePath);
			await this.mkdir(fullPath);
			return fullPath;
		} catch (error) {
			this.mapSystemError(error, join(basePath, namespacePath), "create");
		}
	}

	/**
	 * Scan directory hierarchy for command files
	 */
	async scanNamespaceHierarchy(
		basePath: string,
		maxDepth = 10,
	): Promise<NamespacedFile[]> {
		try {
			const files: NamespacedFile[] = [];
			await this.scanDirectoryRecursive(basePath, basePath, files, 0, maxDepth);
			return files;
		} catch (error) {
			this.mapSystemError(error, basePath, "list");
		}
	}

	/**
	 * Resolve path for namespaced command file
	 */
	resolveNamespacedPath(
		basePath: string,
		namespacePath: string,
		fileName: string,
	): string {
		return join(basePath, namespacePath, fileName);
	}

	/**
	 * Private helper to recursively scan directories for namespace hierarchy
	 */
	private async scanDirectoryRecursive(
		basePath: string,
		currentPath: string,
		files: NamespacedFile[],
		currentDepth: number,
		maxDepth: number,
	): Promise<void> {
		if (currentDepth > maxDepth) {
			return;
		}

		try {
			const entries = await readdir(currentPath, { withFileTypes: true });

			for (const entry of entries) {
				const fullPath = join(currentPath, entry.name);
				const relativePath = relative(basePath, fullPath);

				if (entry.isFile() && entry.name.endsWith(".md")) {
					// Extract namespace path from directory structure
					const namespacePath =
						currentDepth === 0 ? "" : relative(basePath, currentPath);

					files.push({
						filePath: fullPath,
						relativePath,
						namespacePath,
						fileName: entry.name,
						depth: currentDepth,
					});
				} else if (entry.isDirectory()) {
					// Recursively scan subdirectories
					await this.scanDirectoryRecursive(
						basePath,
						fullPath,
						files,
						currentDepth + 1,
						maxDepth,
					);
				}
			}
		} catch (error) {
			// If we can't read a directory, skip it but don't fail the entire scan
			if (error instanceof Error) {
				const systemError = error as SystemError;
				if (systemError.code === "EACCES" || systemError.code === "EPERM") {
					// Skip directories we can't access
					return;
				}
			}
			throw error;
		}
	}

	/**
	 * Remove a directory and optionally its contents
	 */
	async rmdir(path: string, options?: { recursive?: boolean }): Promise<void> {
		try {
			await fsRmdir(path, options);
		} catch (error) {
			this.mapSystemError(error, path, "delete");
		}
	}
}
