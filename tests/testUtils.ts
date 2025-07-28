import { spawn } from "bun";

export const spawnWithSandbox = (args: string[], tempDir: string) => {
	return spawn(args, {
		cwd: tempDir,
		env: { ...process.env },
	});
};
