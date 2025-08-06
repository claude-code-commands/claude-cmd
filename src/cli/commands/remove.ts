import { Command } from "commander";
import { getServices } from "../../services/serviceFactory.js";
import { handleError } from "../cliUtils.js";

export const removeCommand = new Command("remove")
	.description(
		"Remove an installed Claude Code command from your local system.",
	)
	.argument("<command-name>", "Name of the command to remove")
	.option("-y, --yes", "Skip confirmation prompt")
	.action(async (commandName, options) => {
		try {
			// Get singleton service instances from factory
			const { installationService } = getServices();

			// Check if command is installed before attempting removal
			if (!(await installationService.isInstalled(commandName))) {
				console.log(`Command '${commandName}' is not installed.`);
				return;
			}

			// Prepare removal options
			const removeOptions = {
				yes: options.yes,
			};

			// Remove the command (includes interactive confirmation)
			await installationService.removeCommand(commandName, removeOptions);

			console.log(`✓ Successfully removed command: ${commandName}`);
		} catch (error) {
			handleError(error, `Failed to remove command '${commandName}'`);
		}
	});
