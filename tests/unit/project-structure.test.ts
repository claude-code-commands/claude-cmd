import { describe, it, expect } from "bun:test";
import { existsSync, readFileSync } from "fs";
import { join } from "path";

describe("Project Structure", () => {
  const projectRoot = join(__dirname, "../../");
  
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
      "docs"
    ];

    requiredDirectories.forEach(dir => {
      const dirPath = join(projectRoot, dir);
      expect(existsSync(dirPath)).toBe(true);
    });
  });

  it("should have package.json with correct configuration", () => {
    const packageJsonPath = join(projectRoot, "package.json");
    expect(existsSync(packageJsonPath)).toBe(true);
    
    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"));
    expect(packageJson.name).toBe("claude-cmd");
    expect(packageJson.type).toBe("module");
    expect(packageJson.scripts).toHaveProperty("test");
    expect(packageJson.scripts).toHaveProperty("build");
    expect(packageJson.scripts).toHaveProperty("start");
  });

  it("should have TypeScript configuration", () => {
    const tsconfigPath = join(projectRoot, "tsconfig.json");
    expect(existsSync(tsconfigPath)).toBe(true);
    
    const tsconfig = JSON.parse(readFileSync(tsconfigPath, "utf-8"));
    expect(tsconfig.compilerOptions).toHaveProperty("target");
    expect(tsconfig.compilerOptions).toHaveProperty("module");
    expect(tsconfig.compilerOptions).toHaveProperty("moduleResolution");
  });

  it("should have main entry point", () => {
    const mainPath = join(projectRoot, "src/main.ts");
    expect(existsSync(mainPath)).toBe(true);
  });

  it("should have gitignore file", () => {
    const gitignorePath = join(projectRoot, ".gitignore");
    expect(existsSync(gitignorePath)).toBe(true);
  });
});