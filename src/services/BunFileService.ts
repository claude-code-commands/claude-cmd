import { mkdir as fsMkdir, stat } from "node:fs/promises";
import { dirname } from "node:path";
import type IFileService from "../interfaces/IFileService.ts";
import {
	FileIOError,
	FileNotFoundError,
	FilePermissionError,
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
		operation: "read" | "write" | "create",
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
}
