import { Command } from "commander";

export const languageCommand = new Command("language").description(
	"Manage language settings for claude-cmd.",
);

languageCommand
	.command("list")
	.description("List available languages and show current language setting")
	.action(() => {
		console.log("Available languages and current setting:");
		// TODO: Implement actual language list functionality
	});

languageCommand
	.command("set")
	.description("Set the preferred language for command retrieval")
	.argument("<language>", "Language code to set")
	.action((language) => {
		console.log(`Setting preferred language to: ${language}`);
		// TODO: Implement actual language set functionality
	});
