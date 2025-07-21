import type IFileService from "../../src/interfaces/IFileService.js";

/**
 * Mock file service for testing Repository dependency injection
 * Simulates file system operations with in-memory storage for deterministic testing
 */
export default class MockFileService implements IFileService {
	/** In-memory file system for simulation */
	private files: Map<string, string> = new Map();
	/** Track all operations for test verification */
	private operationHistory: Array<{
		operation: string;
		path: string;
		content?: string;
	}> = [];

	async readFile(path: string): Promise<string> {
		this.operationHistory.push({ operation: "readFile", path });

		// Simulate filesystem delay
		await new Promise((resolve) => setTimeout(resolve, 1));

		const content = this.files.get(path);
		if (content === undefined) {
			throw new Error(`ENOENT: no such file or directory, open '${path}'`);
		}

		return content;
	}

	async writeFile(path: string, content: string): Promise<void> {
		this.operationHistory.push({ operation: "writeFile", path, content });

		// Simulate filesystem delay
		await new Promise((resolve) => setTimeout(resolve, 1));

		// Simulate directory creation if needed
		const dirPath = path.substring(0, path.lastIndexOf("/"));
		if (dirPath && !this.files.has(`${dirPath}/.dir`)) {
			this.files.set(`${dirPath}/.dir`, "");
		}

		this.files.set(path, content);
	}

	async exists(path: string): Promise<boolean> {
		this.operationHistory.push({ operation: "exists", path });

		// Simulate filesystem delay
		await new Promise((resolve) => setTimeout(resolve, 1));

		return this.files.has(path);
	}

	async mkdir(path: string): Promise<void> {
		this.operationHistory.push({ operation: "mkdir", path });

		// Simulate filesystem delay
		await new Promise((resolve) => setTimeout(resolve, 1));

		this.files.set(`${path}/.dir`, "");
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

	/**
	 * Clear all files for clean test state
	 */
	clearFiles(): void {
		this.files.clear();
	}

	/**
	 * Set a file directly for test setup
	 */
	setFile(path: string, content: string): void {
		this.files.set(path, content);
	}
}
