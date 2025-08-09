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
			const { userConfigService, configManager } = getServices();

			const [availableLanguages, currentLanguage] = await Promise.all([
				userConfigService.getAvailableLanguages(),
				configManager.getEffectiveLanguage(),
			]);

			console.log(`Current language: ${currentLanguage}`);
			console.log("\nAvailable languages:");

			for (const lang of availableLanguages) {
				const status = lang.available ? "✓" : "✗";
				const marker = currentLanguage === lang.code ? " (current)" : "";
				console.log(`  ${status} ${lang.code} - ${lang.name}${marker}`);
			}

			console.log(
				"\nNote: You can set any valid language code (e.g., 'ru' for Russian, 'pl' for Polish).",
			);
			console.log(
				"If a command set exists for that language, it will be used automatically.",
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
