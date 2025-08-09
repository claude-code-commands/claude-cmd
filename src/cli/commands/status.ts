import { Command } from "commander";
import { getServices } from "../../services/serviceFactory.js";
import type { StatusOutputFormat } from "../../types/Status.js";
import { handleError } from "../cliUtils.js";

export const statusCommand = new Command("status")
	.description(
		"Display comprehensive system status including cache, installations, and health information.\nProvides insights into the current state of your claude-cmd environment.",
	)
	.option(
		"--output <format>",
		"Output format: default (human-readable), compact (one-line summary), json (structured data)",
		"default",
	)
	.action(async (options) => {
		try {
			// Validate format option
			const format = options.output as StatusOutputFormat;
			if (!["default", "compact", "json"].includes(format)) {
				throw new Error(
					`Invalid format: ${format}. Must be one of: default, compact, json`,
				);
			}

			// Get singleton service instances from factory
			const { statusService, statusFormatter } = getServices();

			// Collect system status information
			const status = await statusService.getSystemStatus();

			// Format and display output
			const output = statusFormatter.format(status, format);
			console.log(output);
		} catch (error) {
			handleError(error, "Failed to collect system status");
		}
	});
