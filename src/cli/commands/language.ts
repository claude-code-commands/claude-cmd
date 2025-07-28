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
			const { languageConfigService } = getServices();
			
			const [currentLanguage, availableLanguages] = await Promise.all([
				languageConfigService.getCurrentLanguage(),
				languageConfigService.getAvailableLanguages(),
			]);

			console.log("Available languages:");
			for (const lang of availableLanguages) {
				const status = lang.available ? "✓" : "✗";
				const marker = currentLanguage === lang.code ? " (current)" : "";
				console.log(`  ${status} ${lang.code} - ${lang.name}${marker}`);
			}

			console.log(`\nCurrent language: ${currentLanguage || "not set (using auto-detection)"}`);
		} catch (error) {
			console.error("Error listing languages:", error instanceof Error ? error.message : error);
			process.exit(1);
		}
	});

languageCommand
	.command("set")
	.description("Set the preferred language for command retrieval")
	.argument("<language>", "Language code to set")
	.action(async (language) => {
		try {
			const { languageConfigService } = getServices();
			await languageConfigService.setLanguage(language);
			console.log(`Language preference set to: ${language}`);
		} catch (error) {
			console.error("Error setting language:", error instanceof Error ? error.message : error);
			process.exit(1);
		}
	});
