import { join } from "node:path";
import { spawn } from "bun";

export async function runCli(args?: string[], tempDir?: string) {
	const cliPath = join(import.meta.dir, "../index.ts");

	const spawnOptions: Bun.SpawnOptions.OptionsObject<"ignore", "pipe", "pipe"> =
		{
			stdout: "pipe",
			stderr: "pipe",
		};
	if (tempDir) {
		spawnOptions.cwd = tempDir;
	}

	const cliCmd = ["bun", cliPath];
	if (args) {
		cliCmd.push(...args);
	}
	const proc = spawn(cliCmd, spawnOptions);

	const result = await proc.exited;
	const stdout = await proc.stdout.text();
	const stderr = await proc.stderr.text();

	return { result, stdout, stderr };
}
