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

			const [userConfig, availableLanguages, effectiveLanguage] =
				await Promise.all([
					userConfigService.getConfig(),
					userConfigService.getAvailableLanguages(),
					configManager.getEffectiveLanguage(),
				]);

			const currentUserLanguage = userConfig?.preferredLanguage;

			console.log("Available languages:");
			for (const lang of availableLanguages) {
				const status = lang.available ? "✓" : "✗";
				const marker = currentUserLanguage === lang.code ? " (current)" : "";
				console.log(`  ${status} ${lang.code} - ${lang.name}${marker}`);
			}

			console.log(
				`\nCurrent user language: ${currentUserLanguage || "not set (using auto-detection)"}`,
			);
			console.log(`Effective language: ${effectiveLanguage}`);
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
