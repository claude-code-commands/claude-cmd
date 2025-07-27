import { Command } from "commander";
import { getServices } from "../../services/serviceFactory.js";
import { handleError } from "../cliUtils.js";

export const addCommand = new Command("add")
	.description(
		"Download and install a Claude Code slash command from the repository.",
	)
	.argument("<command-name>", "Name of the command to install")
	.option("-f, --force", "Overwrite existing command if it exists")
	.option("-l, --language <lang>", "Language for the command (default: en)")
	.option(
		"-t, --target <target>",
		"Install target: 'personal' or 'project' (default: personal)",
	)
	.action(async (commandName, options) => {
		try {
			console.log(`Installing command: ${commandName}`);

			// Get singleton service instances from factory
			const { installationService } = getServices();

			// Prepare installation options
			const installOptions = {
				force: options.force,
				language: options.language || "en",
				target: options.target || "personal",
			};

			// Install the command
			await installationService.installCommand(commandName, installOptions);

			console.log(`✓ Successfully installed command: ${commandName}`);
		} catch (error) {
			handleError(error, `Failed to install command '${commandName}'`);
		}
	});
