import { Command } from "commander";
import { getServices } from "../../services/serviceFactory.js";

export const languageCommand = new Command("language").description(
	"Manage language settings for claude-cmd.",
);

languageCommand
	.command("list")
	.description("List available languages and show current language setting")
	.action(async () => {
		try {
			const { userConfigService } = getServices();
			const status = await userConfigService.getLanguageStatus();
			
			console.log(`Current language: ${status.current}`);
			
			if (status.repository.length > 0) {
				console.log("\nRepository languages:");
				for (const lang of status.repository) {
					const marker = status.current === lang.code ? " (current)" : "";
					console.log(`  ✓ ${lang.code} - ${lang.name} (${lang.commandCount} commands)${marker}`);
				}
			}
			
			if (status.common.length > 0) {
				console.log("\nCommon languages (not yet in repository):");
				for (const lang of status.common) {
					console.log(`  - ${lang.code} - ${lang.name}`);
				}
				console.log("\nNote: You can set any of these and start contributing commands!");
			}
			
			console.log(
				"\nYou can set any valid language code (e.g., 'ru' for Russian, 'pl' for Polish).",
			);
			console.log(
				"If commands exist for that language, they will be used automatically.",
			);
		} catch (error) {
			console.error(
				"Error listing languages:",
				error instanceof Error ? error.message : error,
			);
			process.exit(1);
		}
	});

languageCommand
	.command("set")
	.description("Set the preferred language for command retrieval")
	.argument("<language>", "Language code to set")
	.action(async (language) => {
		try {
			const { userConfigService } = getServices();

			// Get current config and update just the language
			const currentConfig = (await userConfigService.getConfig()) || {};
			const updatedConfig = { ...currentConfig, preferredLanguage: language };

			await userConfigService.setConfig(updatedConfig);
			console.log(`Language preference set to: ${language}`);
		} catch (error) {
			console.error(
				"Error setting language:",
				error instanceof Error ? error.message : error,
			);
			process.exit(1);
		}
	});
