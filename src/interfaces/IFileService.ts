/**
 * Base class for all file system operation errors
 */
export abstract class FileSystemError extends Error {
	constructor(
		message: string,
		public readonly path: string,
	) {
		super(message);
		this.name = this.constructor.name;
	}
}

/**
 * Error thrown when a file or directory is not found
 */
export class FileNotFoundError extends FileSystemError {
	constructor(path: string) {
		super(`File or directory not found: ${path}`, path);
	}
}

/**
 * Error thrown when file access is denied due to permissions
 */
export class FilePermissionError extends FileSystemError {
	constructor(path: string, operation: string) {
		super(`Permission denied for ${operation} operation on: ${path}`, path);
		this.operation = operation;
	}

	public readonly operation: string;
}

/**
 * Error thrown when a file operation fails due to disk space or other I/O issues
 */
export class FileIOError extends FileSystemError {
	constructor(path: string, cause?: string) {
		super(`File I/O error on ${path}: ${cause || "Unknown error"}`, path);
		this.cause = cause;
	}

	public override readonly cause?: string;
}

/**
 * File service interface for local file system operations
 *
 * Provides abstractions for file operations needed by repository caching.
 * All methods are async and may throw FileSystemError subclasses.
 *
 * @example
 * ```typescript
 * const fileService: IFileService = new BunFileService();
 *
 * try {
 *   const content = await fileService.readFile('/path/to/file.txt');
 * } catch (error) {
 *   if (error instanceof FileNotFoundError) {
 *     console.log('File does not exist');
 *   }
 * }
 * ```
 */
export default interface IFileService {
	/**
	 * Read content from a file
	 *
	 * @param path - Absolute or relative path to the file
	 * @returns Promise resolving to file content as string
	 * @throws FileNotFoundError when file doesn't exist
	 * @throws FilePermissionError when read access is denied
	 * @throws FileIOError for other I/O failures
	 */
	readFile(path: string): Promise<string>;

	/**
	 * Write content to a file, creating directories as needed
	 *
	 * @param path - Absolute or relative path to the file
	 * @param content - Content to write to the file
	 * @returns Promise that resolves when write is complete
	 * @throws FilePermissionError when write access is denied
	 * @throws FileIOError for disk space or other I/O failures
	 */
	writeFile(path: string, content: string): Promise<void>;

	/**
	 * Check if a file or directory exists
	 *
	 * @param path - Absolute or relative path to check
	 * @returns Promise resolving to true if path exists, false otherwise
	 * @throws FileIOError for unexpected I/O failures during check
	 */
	exists(path: string): Promise<boolean>;

	/**
	 * Create a directory, including parent directories as needed
	 *
	 * @param path - Absolute or relative path to the directory
	 * @returns Promise that resolves when directory is created
	 * @throws FilePermissionError when create access is denied
	 * @throws FileIOError for other I/O failures
	 */
	mkdir(path: string): Promise<void>;

	/**
	 * Delete a file
	 *
	 * @param path - Absolute or relative path to the file
	 * @returns Promise that resolves when file is deleted
	 * @throws FileNotFoundError when file doesn't exist
	 * @throws FilePermissionError when delete access is denied
	 * @throws FileIOError for other I/O failures
	 */
	deleteFile(path: string): Promise<void>;

	/**
	 * List files in a directory
	 *
	 * @param path - Absolute or relative path to the directory
	 * @returns Promise resolving to array of file names in the directory
	 * @throws FileNotFoundError when directory doesn't exist
	 * @throws FilePermissionError when read access is denied
	 * @throws FileIOError for other I/O failures
	 */
	listFiles(path: string): Promise<string[]>;

	/**
	 * List files recursively in a directory and all subdirectories
	 *
	 * @param path - Absolute or relative path to the directory
	 * @returns Promise resolving to array of relative file paths from the root directory
	 * @throws FileNotFoundError when directory doesn't exist
	 * @throws FilePermissionError when read access is denied
	 * @throws FileIOError for other I/O failures
	 */
	listFilesRecursive(path: string): Promise<string[]>;

	/**
	 * Check if a path is writable
	 *
	 * @param path - Absolute or relative path to check
	 * @returns Promise resolving to true if path is writable, false otherwise
	 * @throws FileIOError for unexpected I/O failures during check
	 */
	isWritable(path: string): Promise<boolean>;

	/**
	 * Create hierarchical directory structure for namespace
	 *
	 * @param basePath - Base directory path (e.g., ~/.claude/commands)
	 * @param namespacePath - Namespace path (e.g., "project/frontend/component")
	 * @returns Promise resolving to the full directory path
	 * @throws FilePermissionError when create access is denied
	 * @throws FileIOError for other I/O failures
	 */
	createNamespaceDirectories(basePath: string, namespacePath: string): Promise<string>;

	/**
	 * Scan directory hierarchy for command files
	 *
	 * @param basePath - Base directory to scan from
	 * @param maxDepth - Maximum depth to scan (default: 10)
	 * @returns Promise resolving to array of file paths with namespace information
	 * @throws FileNotFoundError when base directory doesn't exist
	 * @throws FilePermissionError when read access is denied
	 * @throws FileIOError for other I/O failures
	 */
	scanNamespaceHierarchy(basePath: string, maxDepth?: number): Promise<NamespacedFile[]>;

	/**
	 * Resolve path for namespaced command file
	 *
	 * @param basePath - Base directory path
	 * @param namespacePath - Namespace path (e.g., "project/frontend/component") 
	 * @param fileName - Command file name (e.g., "create-component.md")
	 * @returns Full path to the command file
	 */
	resolveNamespacedPath(basePath: string, namespacePath: string, fileName: string): string;
}

/**
 * Represents a file found during namespace hierarchy scanning
 */
export interface NamespacedFile {
	/** Full file path */
	readonly filePath: string;
	
	/** Relative path from base directory */
	readonly relativePath: string;
	
	/** Namespace path (directory structure) */
	readonly namespacePath: string;
	
	/** File name without path */
	readonly fileName: string;
	
	/** Depth level in hierarchy (0 = root) */
	readonly depth: number;
}
