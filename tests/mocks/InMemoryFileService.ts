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
			this.fs[path] = { type: "file", content };
		}
	}
	readFile(path: string): Promise<string> {
		const entry = this.fs[path];
		if (!entry || entry.type !== "file") {
			throw new Error(`File not found: ${path}`);
		}
		return Promise.resolve(entry.content);
	}

	writeFile(path: string, content: string): Promise<void> {
		this.fs[path] = { type: "file", content };
		return Promise.resolve();
	}

	exists(path: string): Promise<boolean> {
		// Direct match (file or explicitly created directory)
		if (path in this.fs) {
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
		if (path in this.fs) {
			return Promise.resolve();
		}
		this.fs[path] = { type: "directory" };
		return Promise.resolve();
	}
}

export default InMemoryFileService;
