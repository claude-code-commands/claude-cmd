import type IFileService from "../../src/interfaces/IFileService.js";

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
	readFile(path: string): Promise<string> {
		this.operationHistory.push({ operation: "readFile", path });
		const entry = this.fs[path];
		if (!entry || entry.type !== "file") {
			return Promise.reject(`File not found: ${path}`);
		}
		return Promise.resolve(entry.content);
	}

	writeFile(path: string, content: string): Promise<void> {
		this.operationHistory.push({ operation: "writeFile", path, content });
		// Check for collision with directory at same logical location
		const dirPath = path.endsWith("/") ? path : `${path}/`;
		const filePath = path.endsWith("/") ? path.slice(0, -1) : path;

		if (
			this.fs[filePath]?.type === "directory" ||
			this.fs[dirPath]?.type === "directory"
		) {
			return Promise.reject(
				`Cannot write file: ${path} conflicts with directory`,
			);
		}

		this.fs[filePath] = { type: "file", content };
		return Promise.resolve();
	}

	exists(path: string): Promise<boolean> {
		this.operationHistory.push({ operation: "exists", path });
		// Normalize paths for consistent lookups
		const dirPath = path.endsWith("/") ? path : `${path}/`;
		const filePath = path.endsWith("/") ? path.slice(0, -1) : path;

		// Direct match (file or explicitly created directory)
		if (this.fs[filePath] || this.fs[dirPath]) {
			return Promise.resolve(true);
		}

		// Check if path is a parent directory of any existing files
		if (path.endsWith("/")) {
			for (const existingPath in this.fs) {
				if (existingPath.startsWith(path)) {
					return Promise.resolve(true);
				}
			}
		}

		return Promise.resolve(false);
	}

	mkdir(path: string): Promise<void> {
		this.operationHistory.push({ operation: "mkdir", path });
		// Normalize paths for collision detection
		const dirPath = path.endsWith("/") ? path : `${path}/`;
		const filePath = path.endsWith("/") ? path.slice(0, -1) : path;

		// Check if directory already exists (idempotent)
		if (this.fs[dirPath]?.type === "directory") {
			return Promise.resolve();
		}

		// Check for collision with file at same logical location
		if (this.fs[filePath]?.type === "file") {
			return Promise.reject(
				`Cannot create directory: ${path} conflicts with file`,
			);
		}

		this.fs[dirPath] = { type: "directory" };
		return Promise.resolve();
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

	deleteFile(path: string): Promise<void> {
		this.operationHistory.push({ operation: "deleteFile", path });
		const entry = this.fs[path];

		if (!entry || entry.type !== "file") {
			return Promise.reject(`File not found: ${path}`);
		}

		delete this.fs[path];
		return Promise.resolve();
	}

	listFiles(path: string): Promise<string[]> {
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
				return Promise.reject(`Directory not found: ${path}`);
			}
		}

		// Find all files in this directory (non-recursive)
		const files: string[] = [];
		for (const filePath in this.fs) {
			if (filePath.startsWith(dirPath) && filePath !== dirPath) {
				// Get relative path from directory
				const relativePath = filePath.substring(dirPath.length);

				// Only include direct children (no subdirectories)
				if (!relativePath.includes("/")) {
					// Only include files, not directories
					const entry = this.fs[filePath];
					if (entry?.type === "file") {
						files.push(relativePath);
					}
				}
			}
		}

		return Promise.resolve(files);
	}

	/**
	 * List all files recursively in a directory and its subdirectories
	 */
	listFilesRecursive(path: string): Promise<string[]> {
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
				return Promise.reject(`Directory not found: ${path}`);
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

		return Promise.resolve(files);
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
		if (parentPath && await this.exists(parentPath)) {
			return true;
		}
		
		return false;
	}
}

export default InMemoryFileService;
