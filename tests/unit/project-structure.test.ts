import { describe, expect, it } from "bun:test";
import { existsSync } from "node:fs";
import { join } from "node:path";

describe("Project Structure", () => {
	const projectRoot = join(import.meta.dir, "../../");

	it("should have all required directories", () => {
		const requiredDirectories = [
			"src",
			"src/interfaces",
			"src/services",
			"src/cli",
			"src/cli/commands",
			"src/types",
			"tests",
			"tests/unit",
			"tests/integration",
			"tests/mocks",
			"docs",
		];

		for (const dir of requiredDirectories) {
			const dirPath = join(projectRoot, dir);
			expect(existsSync(dirPath), `${dirPath} doesn't exist`).toBe(true);
		}
	});

	it("should have package.json with correct configuration", async () => {
		const packageJsonPath = join(projectRoot, "package.json");
		expect(await Bun.file(packageJsonPath).exists()).toBe(true);

		const packageJson = await Bun.file(packageJsonPath).json();
		expect(packageJson.name).toBe("claude-cmd");
		expect(packageJson.type).toBe("module");
		expect(packageJson.scripts).toHaveProperty("test");
		expect(packageJson.scripts).toHaveProperty("build");
		expect(packageJson.scripts).toHaveProperty("start");
	});

	it("should have TypeScript configuration", async () => {
		const tsconfigPath = join(projectRoot, "tsconfig.json");
		expect(await Bun.file(tsconfigPath).exists()).toBe(true);

		const tsconfig = await Bun.file(tsconfigPath).json();
		expect(tsconfig.compilerOptions).toHaveProperty("target");
		expect(tsconfig.compilerOptions).toHaveProperty("module");
		expect(tsconfig.compilerOptions).toHaveProperty("moduleResolution");
	});

	it("should have main entry point", async () => {
		const mainPath = join(projectRoot, "src/main.ts");
		expect(await Bun.file(mainPath).exists()).toBe(true);
	});

	it("should have gitignore file", async () => {
		const gitignorePath = join(projectRoot, ".gitignore");
		expect(await Bun.file(gitignorePath).exists()).toBe(true);
	});
});
