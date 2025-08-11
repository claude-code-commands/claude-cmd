import { constants } from "node:fs";
import {
	access,
	mkdir as fsMkdir,
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
import { realFileLogger } from "../utils/logger.js";

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
		realFileLogger.debug("read: {path}", { path });
		try {
			const file = Bun.file(path);
			const content = await file.text();
			realFileLogger.debug("read success: {path} ({bytes} bytes)", {
				path,
				bytes: content.length,
			});
			return content;
		} catch (error) {
			realFileLogger.error("read failed: {path} (error: {error})", {
				path,
				error: error instanceof Error ? error.message : String(error),
			});
			this.mapSystemError(error, path, "read");
		}
	}

	/**
	 * Write content to a file using Bun.write(), creating directories as needed
	 */
	async writeFile(path: string, content: string): Promise<void> {
		realFileLogger.debug("write: {path} ({bytes} bytes)", {
			path,
			bytes: content.length,
		});
		try {
			// Create parent directories first
			const dir = dirname(path);
			if (dir !== path) {
				// Avoid infinite recursion for root paths
				await this.mkdir(dir);
			}

			await Bun.write(path, content);
			realFileLogger.debug("write success: {path}", { path });
		} catch (error) {
			realFileLogger.error("write failed: {path} (error: {error})", {
				path,
				error: error instanceof Error ? error.message : String(error),
			});
			this.mapSystemError(error, path, "write");
		}
	}

	/**
	 * Check if a file or directory exists using fs.stat()
	 */
	async exists(path: string): Promise<boolean> {
		realFileLogger.debug("exists: {path}", { path });
		try {
			await stat(path);
			realFileLogger.debug("exists success: {path} (true)", { path });
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
			realFileLogger.debug("exists: {path} (false)", { path });
			return false;
		}
	}

	/**
	 * Create a directory recursively using Node.js fs.mkdir()
	 */
	async mkdir(path: string): Promise<void> {
		realFileLogger.debug("mkdir: {path}", { path });
		try {
			await fsMkdir(path, { recursive: true });
			realFileLogger.debug("mkdir success: {path}", { path });
		} catch (error) {
			// Handle EEXIST gracefully for idempotent behavior
			if (error instanceof Error && (error as SystemError).code === "EEXIST") {
				realFileLogger.debug("mkdir: {path} (already exists)", { path });
				return; // Directory already exists, which is fine (idempotent)
			}

			realFileLogger.error("mkdir failed: {path} (error: {error})", {
				path,
				error: error instanceof Error ? error.message : String(error),
			});
			this.mapSystemError(error, path, "create");
		}
	}

	/**
	 * Delete a file using Node.js fs.unlink()
	 */
	async deleteFile(path: string): Promise<void> {
		realFileLogger.debug("deleteFile: {path}", { path });
		try {
			await unlink(path);
			realFileLogger.debug("deleteFile success: {path}", { path });
		} catch (error) {
			realFileLogger.error("deleteFile failed: {path} (error: {error})", {
				path,
				error: error instanceof Error ? error.message : String(error),
			});
			this.mapSystemError(error, path, "delete");
		}
	}

	/**
	 * List files in a directory using Node.js fs.readdir()
	 */
	async listFiles(path: string): Promise<string[]> {
		realFileLogger.debug("listFiles: {path}", { path });
		try {
			const entries = await readdir(path, { withFileTypes: true });
			// Return only files, not subdirectories
			const files = entries
				.filter((entry) => entry.isFile())
				.map((entry) => entry.name);
			realFileLogger.debug("listFiles success: {path} ({count} files)", {
				path,
				count: files.length,
			});
			return files;
		} catch (error) {
			realFileLogger.error("listFiles failed: {path} (error: {error})", {
				path,
				error: error instanceof Error ? error.message : String(error),
			});
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
		realFileLogger.debug("isWritable: {path}", { path });
		try {
			await access(path, constants.W_OK);
			realFileLogger.debug("isWritable: {path} (true)", { path });
			return true;
		} catch {
			realFileLogger.debug("isWritable: {path} (false)", { path });
			return false;
		}
	}

	/**
	 * Scan directory hierarchy for command files
	 */
	async scanNamespaceHierarchy(
		basePath: string,
		maxDepth = 10,
	): Promise<NamespacedFile[]> {
		realFileLogger.debug(
			"scanNamespaceHierarchy: {basePath} (maxDepth: {maxDepth})",
			{
				basePath,
				maxDepth,
			},
		);
		try {
			const files: NamespacedFile[] = [];
			await this.scanDirectoryRecursive(basePath, basePath, files, 0, maxDepth);
			realFileLogger.debug(
				"scanNamespaceHierarchy success: {basePath} ({count} files)",
				{
					basePath,
					count: files.length,
				},
			);
			return files;
		} catch (error) {
			realFileLogger.error(
				"scanNamespaceHierarchy failed: {basePath} (error: {error})",
				{
					basePath,
					error: error instanceof Error ? error.message : String(error),
				},
			);
			this.mapSystemError(error, basePath, "list");
		}
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
}
