import type IFileService from "../../src/interfaces/IFileService.ts";
import {
	FileIOError,
	FileNotFoundError,
	type NamespacedFile,
} from "../../src/interfaces/IFileService.ts";
import { mockFileLogger } from "../../src/utils/logger.js";

type FileEntry = { type: "file"; content: string };
type DirectoryEntry = { type: "directory" };
type Entry = FileEntry | DirectoryEntry;
type FileSystem = Record<string, Entry>;

class InMemoryFileService implements IFileService {
	readonly fs: FileSystem;
	private operationHistory: Array<{
		operation: string;
		path: string;
		content?: string;
	}> = [];

	constructor(initialFiles: Record<string, string> = {}) {
		this.fs = {};
		// Convert legacy file format to new entry format
		for (const [path, content] of Object.entries(initialFiles)) {
			if (path.endsWith("/")) {
				this.fs[path] = { type: "directory" };
				continue;
			}
			this.fs[path] = { type: "file", content };
		}
	}
	async readFile(path: string): Promise<string> {
		mockFileLogger.debug("read: {path}", { path });
		this.operationHistory.push({ operation: "readFile", path });
		const entry = this.fs[path];
		if (!entry || entry.type !== "file") {
			throw new FileNotFoundError(path);
		}
		mockFileLogger.debug("read success: {path} ({bytes} bytes)", {
			path,
			bytes: entry.content.length,
		});
		return entry.content;
	}

	async writeFile(path: string, content: string): Promise<void> {
		this.operationHistory.push({ operation: "writeFile", path, content });
		// Check for collision with directory at same logical location
		const dirPath = path.endsWith("/") ? path : `${path}/`;
		const filePath = path.endsWith("/") ? path.slice(0, -1) : path;

		if (
			this.fs[filePath]?.type === "directory" ||
			this.fs[dirPath]?.type === "directory"
		) {
			throw new FileIOError(
				path,
				"Cannot write file: conflicts with directory",
			);
		}

		// Create parent directories implicitly
		const parentPath = filePath.substring(0, filePath.lastIndexOf("/"));
		if (parentPath && !(await this.exists(parentPath))) {
			await this.mkdir(parentPath);
		}

		this.fs[filePath] = { type: "file", content };
	}

	async exists(path: string): Promise<boolean> {
		this.operationHistory.push({ operation: "exists", path });
		// Normalize paths for consistent lookups
		const dirPath = path.endsWith("/") ? path : `${path}/`;
		const filePath = path.endsWith("/") ? path.slice(0, -1) : path;

		// Direct match (file or explicitly created directory)
		if (this.fs[filePath] || this.fs[dirPath]) {
			return true;
		}

		// Check if path is a parent directory of any existing files
		for (const existingPath in this.fs) {
			if (existingPath.startsWith(dirPath) && existingPath !== dirPath) {
				return true;
			}
		}

		return false;
	}

	async mkdir(path: string): Promise<void> {
		this.operationHistory.push({ operation: "mkdir", path });
		// Normalize paths for collision detection
		const dirPath = path.endsWith("/") ? path : `${path}/`;
		const filePath = path.endsWith("/") ? path.slice(0, -1) : path;

		// Check for collision with file at same logical location FIRST
		if (this.fs[filePath]?.type === "file") {
			throw new FileIOError(
				path,
				"Cannot create directory: conflicts with file",
			);
		}

		// Check if directory already exists (idempotent)
		if (this.fs[dirPath]?.type === "directory") {
			return;
		}

		// For implicit directories, check if already exists via file paths
		const hasExistingChildren = Object.keys(this.fs).some(
			(existingPath) =>
				existingPath.startsWith(dirPath) && existingPath !== dirPath,
		);
		if (hasExistingChildren) {
			return; // Directory exists implicitly
		}

		// Create parent directories recursively
		const parentPath = filePath.substring(0, filePath.lastIndexOf("/"));
		if (parentPath && !(await this.exists(parentPath))) {
			await this.mkdir(parentPath);
		}

		this.fs[dirPath] = { type: "directory" };
	}

	/**
	 * Get operation history for test verification
	 */
	getOperationHistory(): Array<{
		operation: string;
		path: string;
		content?: string;
	}> {
		return [...this.operationHistory];
	}

	/**
	 * Clear operation history for clean test state
	 */
	clearOperationHistory(): void {
		this.operationHistory.length = 0;
	}

	async deleteFile(path: string): Promise<void> {
		this.operationHistory.push({ operation: "deleteFile", path });
		const entry = this.fs[path];

		if (!entry || entry.type !== "file") {
			throw new FileNotFoundError(path);
		}

		delete this.fs[path];
	}

	async listFiles(path: string): Promise<string[]> {
		this.operationHistory.push({ operation: "listFiles", path });

		// Normalize directory path
		const dirPath = path.endsWith("/") ? path : `${path}/`;

		// Check if directory exists
		if (!this.fs[dirPath]) {
			// Check if directory exists implicitly (has files in it)
			const hasChildFiles = Object.keys(this.fs).some(
				(filePath) => filePath.startsWith(dirPath) && filePath !== dirPath,
			);

			if (!hasChildFiles) {
				throw new FileNotFoundError(path);
			}
		}

		// Find all direct files in this directory (non-recursive)
		// Like BunFileService, we should return only files, not directories
		const files: string[] = [];
		for (const filePath in this.fs) {
			if (filePath.startsWith(dirPath) && filePath !== dirPath) {
				// Get relative path from directory
				const relativePath = filePath.substring(dirPath.length);

				// Check if this is a direct file (no more path separators)
				if (!relativePath.includes("/")) {
					// This is a direct file in this directory
					const entry = this.fs[filePath];
					if (entry?.type === "file") {
						files.push(relativePath);
					}
				}
			}
		}

		return files;
	}

	/**
	 * List all entries (files and directories) in a directory (non-recursive)
	 * This method is needed for StatusService to discover cached language directories
	 */
	async listEntries(path: string): Promise<string[]> {
		this.operationHistory.push({ operation: "listEntries", path });

		// Normalize directory path
		const dirPath = path.endsWith("/") ? path : `${path}/`;

		// Check if directory exists
		if (!this.fs[dirPath]) {
			// Check if directory exists implicitly (has files in it)
			const hasChildFiles = Object.keys(this.fs).some(
				(filePath) => filePath.startsWith(dirPath) && filePath !== dirPath,
			);

			if (!hasChildFiles) {
				throw new FileNotFoundError(path);
			}
		}

		// Find all files and directories in this directory (non-recursive)
		const entries = new Set<string>();
		for (const filePath in this.fs) {
			if (filePath.startsWith(dirPath) && filePath !== dirPath) {
				// Get relative path from directory
				const relativePath = filePath.substring(dirPath.length);

				// Extract the first part (file or directory name)
				const firstPart = relativePath.split("/")[0];
				if (firstPart) {
					entries.add(firstPart);
				}
			}
		}

		return Array.from(entries);
	}

	/**
	 * List all files recursively in a directory and its subdirectories
	 */
	async listFilesRecursive(path: string): Promise<string[]> {
		this.operationHistory.push({ operation: "listFilesRecursive", path });

		// Normalize directory path
		const dirPath = path.endsWith("/") ? path : `${path}/`;

		// Check if directory exists
		if (!this.fs[dirPath]) {
			// Check if directory exists implicitly (has files in it)
			const hasChildFiles = Object.keys(this.fs).some(
				(filePath) => filePath.startsWith(dirPath) && filePath !== dirPath,
			);

			if (!hasChildFiles) {
				throw new FileNotFoundError(path);
			}
		}

		// Find all files recursively with their relative paths
		const files: string[] = [];
		for (const filePath in this.fs) {
			if (filePath.startsWith(dirPath) && filePath !== dirPath) {
				// Get relative path from directory
				const relativePath = filePath.substring(dirPath.length);

				// Only include files, not directories
				const entry = this.fs[filePath];
				if (entry?.type === "file") {
					files.push(relativePath);
				}
			}
		}

		return files;
	}

	/**
	 * Clear all files for clean test state
	 */
	clearFiles(): void {
		Object.keys(this.fs).forEach((key) => delete this.fs[key]);
	}

	/**
	 * Set a file directly for test setup
	 */
	setFile(path: string, content: string): void {
		this.fs[path] = { type: "file", content };
	}

	/**
	 * Check if a path is writable (simplified for testing - always returns true for existing paths)
	 */
	async isWritable(path: string): Promise<boolean> {
		this.operationHistory.push({ operation: "isWritable", path });

		// For testing purposes, we assume all paths are writable if they exist or their parent exists
		if (await this.exists(path)) {
			return true;
		}

		// Check if parent directory exists (for non-existent files)
		const parentPath = path.substring(0, path.lastIndexOf("/"));
		if (parentPath && (await this.exists(parentPath))) {
			return true;
		}

		return false;
	}

	/**
	 * Scan directory hierarchy for command files
	 */
	async scanNamespaceHierarchy(
		basePath: string,
		maxDepth = 10,
	): Promise<NamespacedFile[]> {
		this.operationHistory.push({
			operation: "scanNamespaceHierarchy",
			path: basePath,
		});

		const files: NamespacedFile[] = [];
		await this.scanDirectoryRecursive(basePath, basePath, files, 0, maxDepth);
		return files;
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

		const dirPath = currentPath.endsWith("/") ? currentPath : `${currentPath}/`;

		// Normalize base path for comparison
		const normalizedBasePath = basePath.endsWith("/")
			? basePath
			: `${basePath}/`;

		// Check if directory exists (explicit or implicit)
		if (!this.fs[dirPath]) {
			const hasChildFiles = Object.keys(this.fs).some(
				(filePath) => filePath.startsWith(dirPath) && filePath !== dirPath,
			);
			if (!hasChildFiles) {
				throw new FileNotFoundError(currentPath);
			}
		}

		// Collect direct children (files and subdirectories)
		const directChildren = new Set<string>();

		for (const filePath in this.fs) {
			if (filePath.startsWith(dirPath) && filePath !== dirPath) {
				const relativePath = filePath.substring(dirPath.length);
				const firstSegment = relativePath.split("/")[0];
				if (firstSegment) {
					directChildren.add(firstSegment);
				}
			}
		}

		// Process direct child files
		for (const childName of directChildren) {
			const childPath = dirPath + childName;
			const entry = this.fs[childPath];

			if (entry?.type === "file" && childName.endsWith(".md")) {
				// Extract namespace path from directory structure
				const namespacePath =
					currentDepth === 0
						? ""
						: currentPath.substring(normalizedBasePath.length);

				files.push({
					filePath: childPath,
					relativePath: childPath.substring(normalizedBasePath.length),
					namespacePath,
					fileName: childName,
					depth: currentDepth,
				});
			}
		}

		// Recursively scan subdirectories
		for (const childName of directChildren) {
			const childPath = dirPath + childName;
			const entry = this.fs[childPath];

			// Check if this is a directory (explicit or has children)
			const isExplicitDir = entry?.type === "directory";
			const hasChildren = Object.keys(this.fs).some((filePath) =>
				filePath.startsWith(`${childPath}/`),
			);

			if (isExplicitDir || hasChildren) {
				await this.scanDirectoryRecursive(
					basePath,
					childPath,
					files,
					currentDepth + 1,
					maxDepth,
				);
			}
		}
	}
}

export default InMemoryFileService;
