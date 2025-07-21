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

	public readonly cause?: string;
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
}
