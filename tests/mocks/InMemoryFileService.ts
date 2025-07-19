import type IFileService from "../../src/interfaces/IFileService.ts";

type FileEntry = { type: "file"; content: string };
type DirectoryEntry = { type: "directory" };
type Entry = FileEntry | DirectoryEntry;
type FileSystem = Record<string, Entry>;

class InMemoryFileService implements IFileService {
	readonly fs: FileSystem;

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
		const entry = this.fs[path];
		if (!entry || entry.type !== "file") {
			return Promise.reject(`File not found: ${path}`);
		}
		return Promise.resolve(entry.content);
	}

	writeFile(path: string, content: string): Promise<void> {
		// Check for collision with directory at same logical location
		const dirPath = path.endsWith("/") ? path : path + "/";
		const filePath = path.endsWith("/") ? path.slice(0, -1) : path;
		
		if (this.fs[filePath]?.type === "directory" || this.fs[dirPath]?.type === "directory") {
			return Promise.reject(`Cannot write file: ${path} conflicts with directory`);
		}

		this.fs[filePath] = { type: "file", content };
		return Promise.resolve();
	}

	exists(path: string): Promise<boolean> {
		// Normalize paths for consistent lookups
		const dirPath = path.endsWith("/") ? path : path + "/";
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
		// Normalize paths for collision detection
		const dirPath = path.endsWith("/") ? path : path + "/";
		const filePath = path.endsWith("/") ? path.slice(0, -1) : path;
		
		// Check if directory already exists (idempotent)
		if (this.fs[dirPath]?.type === "directory") {
			return Promise.resolve();
		}
		
		// Check for collision with file at same logical location
		if (this.fs[filePath]?.type === "file") {
			return Promise.reject(`Cannot create directory: ${path} conflicts with file`);
		}
		
		this.fs[dirPath] = { type: "directory" };
		return Promise.resolve();
	}
}

export default InMemoryFileService;
