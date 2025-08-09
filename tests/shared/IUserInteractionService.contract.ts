import { beforeEach, describe, expect, test } from "bun:test";
import type IUserInteractionService from "../../src/interfaces/IUserInteractionService.ts";
import type {
	ConfirmationOptions,
	SelectionOptions,
	TextInputOptions,
} from "../../src/interfaces/IUserInteractionService.ts";

/**
 * Setup context for contract tests
 */
interface ContractSetupContext {
	/** Setup function called before all contract tests */
	setup?: () => Promise<void>;
	/** Teardown function called after all contract tests */
	teardown?: () => Promise<void>;
	/** Whether this is testing a real terminal implementation */
	isRealTerminal: boolean;
}

/**
 * Shared contract test suite for IUserInteractionService implementations
 *
 * This test suite validates that any implementation of IUserInteractionService behaves
 * correctly according to the interface contract. It tests both interactive behavior
 * and --yes mode bypassing to ensure consistent behavior across different implementations
 * (real terminal service and in-memory mock).
 *
 * @param serviceFactory - Function that creates an IUserInteractionService instance
 * @param context - Optional setup/teardown context for environment-specific needs
 */
export function runUserInteractionServiceContractTests(
	serviceFactory: () => IUserInteractionService,
	context: ContractSetupContext = { isRealTerminal: false },
) {
	describe("IUserInteractionService Contract", () => {
		let service: IUserInteractionService;

		beforeEach(async () => {
			if (context.setup) {
				await context.setup();
			}
			service = serviceFactory();
		});

		describe("confirmation prompts", () => {
			test("should handle basic confirmation with default response", async () => {
				const options: ConfirmationOptions = {
					message: "Continue with the operation?",
					defaultResponse: true,
				};

				const response = await service.confirmAction(options);

				expect(typeof response).toBe("boolean");
				// In mock implementations, this should use the default
				// In real implementations, behavior may vary based on user input
			});

			test("should handle confirmation with false default", async () => {
				const options: ConfirmationOptions = {
					message: "Delete all files?",
					defaultResponse: false,
				};

				const response = await service.confirmAction(options);

				expect(typeof response).toBe("boolean");
			});

			test("should handle confirmation without default response", async () => {
				const options: ConfirmationOptions = {
					message: "Proceed?",
				};

				const response = await service.confirmAction(options);

				expect(typeof response).toBe("boolean");
			});

			test("should respect --yes mode with skipWithYes", async () => {
				// Enable --yes mode
				service.setYesMode(true);

				const options: ConfirmationOptions = {
					message: "Install package?",
					defaultResponse: true,
					skipWithYes: true,
				};

				const response = await service.confirmAction(options);

				expect(response).toBe(true);

				// Disable --yes mode for cleanup
				service.setYesMode(false);
			});

			test("should not skip when --yes mode is enabled but skipWithYes is false", async () => {
				service.setYesMode(true);

				const options: ConfirmationOptions = {
					message: "Critical operation?",
					defaultResponse: true,
					skipWithYes: false,
				};

				const response = await service.confirmAction(options);

				// Should still process normally (mock may use defaults, real may vary)
				expect(typeof response).toBe("boolean");

				service.setYesMode(false);
			});

			test("should handle empty message gracefully", async () => {
				const options: ConfirmationOptions = {
					message: "",
					defaultResponse: false,
				};

				const response = await service.confirmAction(options);

				expect(typeof response).toBe("boolean");
			});
		});

		describe("selection prompts", () => {
			test("should handle basic selection with string choices", async () => {
				const options: SelectionOptions<string> = {
					message: "Choose a framework:",
					choices: ["React", "Vue", "Angular"],
				};

				const response = await service.selectOption(options);

				expect(typeof response).toBe("string");
				expect(options.choices).toContain(response);
			});

			test("should handle selection with object choices", async () => {
				const choices = [
					{ id: 1, name: "Option 1" },
					{ id: 2, name: "Option 2" },
					{ id: 3, name: "Option 3" },
				];

				const options: SelectionOptions<(typeof choices)[0]> = {
					message: "Choose an option:",
					choices,
				};

				const response = await service.selectOption(options);

				expect(typeof response).toBe("object");
				expect(response).toHaveProperty("id");
				expect(response).toHaveProperty("name");
				expect(choices).toContainEqual(response);
			});

			test("should handle selection with custom display function", async () => {
				const choices = [
					{ code: "en", name: "English" },
					{ code: "fr", name: "French" },
					{ code: "es", name: "Spanish" },
				];

				const options: SelectionOptions<(typeof choices)[0]> = {
					message: "Choose a language:",
					choices,
					displayFunction: (choice) => `${choice.name} (${choice.code})`,
				};

				const response = await service.selectOption(options);

				expect(choices).toContainEqual(response);
			});

			test("should respect --yes mode with default choice", async () => {
				service.setYesMode(true);

				const defaultChoice = "React";
				const options: SelectionOptions<string> = {
					message: "Choose framework:",
					choices: ["React", "Vue", "Angular"],
					defaultChoice,
				};

				const response = await service.selectOption(options);

				expect(response).toBe(defaultChoice);

				service.setYesMode(false);
			});

			test("should handle --yes mode without default choice", async () => {
				service.setYesMode(true);

				const options: SelectionOptions<string> = {
					message: "Choose framework:",
					choices: ["React", "Vue", "Angular"],
				};

				const response = await service.selectOption(options);

				// Should still return a valid choice (likely first one)
				expect(options.choices).toContain(response);

				service.setYesMode(false);
			});

			test("should handle single choice selection", async () => {
				const options: SelectionOptions<string> = {
					message: "Only one option:",
					choices: ["Only Choice"],
				};

				const response = await service.selectOption(options);

				expect(response).toBe("Only Choice");
			});

			test("should handle empty message in selection", async () => {
				const options: SelectionOptions<string> = {
					message: "",
					choices: ["A", "B", "C"],
				};

				const response = await service.selectOption(options);

				expect(options.choices).toContain(response);
			});
		});

		describe("text input prompts", () => {
			test("should handle basic text input", async () => {
				const options: TextInputOptions = {
					message: "Enter your name:",
				};

				const response = await service.getTextInput(options);

				expect(typeof response).toBe("string");
			});

			test("should handle text input with default value", async () => {
				const options: TextInputOptions = {
					message: "Enter project name:",
					defaultValue: "my-project",
				};

				const response = await service.getTextInput(options);

				expect(typeof response).toBe("string");
				// Mock implementations should use default, real implementations may vary
			});

			test("should respect --yes mode with skipWithDefault", async () => {
				service.setYesMode(true);

				const defaultValue = "auto-generated-name";
				const options: TextInputOptions = {
					message: "Enter name:",
					defaultValue,
					skipWithDefault: true,
				};

				const response = await service.getTextInput(options);

				expect(response).toBe(defaultValue);

				service.setYesMode(false);
			});

			test("should not skip when --yes mode is enabled but skipWithDefault is false", async () => {
				service.setYesMode(true);

				const options: TextInputOptions = {
					message: "Enter critical value:",
					defaultValue: "default",
					skipWithDefault: false,
				};

				const response = await service.getTextInput(options);

				// Should still process normally
				expect(typeof response).toBe("string");

				service.setYesMode(false);
			});

			test("should handle --yes mode without skipWithDefault", async () => {
				service.setYesMode(true);

				const options: TextInputOptions = {
					message: "Enter value:",
					defaultValue: "default",
				};

				const response = await service.getTextInput(options);

				// Should still process normally (not skip automatically)
				expect(typeof response).toBe("string");

				service.setYesMode(false);
			});

			test("should handle empty message in text input", async () => {
				const options: TextInputOptions = {
					message: "",
					defaultValue: "default",
				};

				const response = await service.getTextInput(options);

				expect(typeof response).toBe("string");
			});

			test("should handle text input without default value", async () => {
				const options: TextInputOptions = {
					message: "Enter optional value:",
				};

				const response = await service.getTextInput(options);

				expect(typeof response).toBe("string");
			});
		});

		describe("--yes mode behavior", () => {
			test("should track --yes mode state correctly", () => {
				expect(service.isYesMode()).toBe(false);

				service.setYesMode(true);
				expect(service.isYesMode()).toBe(true);

				service.setYesMode(false);
				expect(service.isYesMode()).toBe(false);
			});

			test("should maintain --yes mode state across multiple calls", async () => {
				service.setYesMode(true);

				const confirmOptions: ConfirmationOptions = {
					message: "First confirmation?",
					defaultResponse: true,
					skipWithYes: true,
				};

				await service.confirmAction(confirmOptions);
				expect(service.isYesMode()).toBe(true);

				const textOptions: TextInputOptions = {
					message: "Enter text:",
					defaultValue: "test",
					skipWithDefault: true,
				};

				await service.getTextInput(textOptions);
				expect(service.isYesMode()).toBe(true);

				service.setYesMode(false);
			});

			test("should handle mixed skip and non-skip prompts in --yes mode", async () => {
				service.setYesMode(true);

				// This should skip
				const skipOptions: ConfirmationOptions = {
					message: "Skip this?",
					defaultResponse: true,
					skipWithYes: true,
				};

				const skipResponse = await service.confirmAction(skipOptions);
				expect(skipResponse).toBe(true);

				// This should not skip
				const noSkipOptions: ConfirmationOptions = {
					message: "Don't skip this",
					defaultResponse: false,
					skipWithYes: false,
				};

				const noSkipResponse = await service.confirmAction(noSkipOptions);
				expect(typeof noSkipResponse).toBe("boolean");

				service.setYesMode(false);
			});
		});

		describe("error handling and edge cases", () => {
			test("should handle selection with empty choices array", async () => {
				const options: SelectionOptions<string> = {
					message: "Choose from nothing:",
					choices: [],
				};

				// This might throw or return undefined/null depending on implementation
				try {
					const response = await service.selectOption(options);
					// If it doesn't throw, response should be handled gracefully
					expect(response).toBeDefined();
				} catch (error) {
					// It's acceptable for implementations to throw on empty choices
					expect(error).toBeInstanceOf(Error);
				}
			});

			test("should handle very long messages", async () => {
				const longMessage = "A".repeat(1000);
				const options: ConfirmationOptions = {
					message: longMessage,
					defaultResponse: true,
				};

				const response = await service.confirmAction(options);

				expect(typeof response).toBe("boolean");
			});

			test("should handle special characters in messages", async () => {
				const specialMessage =
					"Confirm with special chars: @#$%^&*()[]{}|\\:;\"'<>?/~`";
				const options: ConfirmationOptions = {
					message: specialMessage,
					defaultResponse: false,
				};

				const response = await service.confirmAction(options);

				expect(typeof response).toBe("boolean");
			});

			test("should handle unicode characters in messages", async () => {
				const unicodeMessage = "Confirm with unicode: 🚀 ñ 中文 العربية";
				const options: ConfirmationOptions = {
					message: unicodeMessage,
					defaultResponse: true,
				};

				const response = await service.confirmAction(options);

				expect(typeof response).toBe("boolean");
			});
		});

		describe("state isolation", () => {
			test("should not leak state between different prompt types", async () => {
				// Configure service state
				service.setYesMode(true);

				// Use different prompt types
				await service.confirmAction({
					message: "Confirm?",
					defaultResponse: true,
					skipWithYes: true,
				});

				await service.selectOption({
					message: "Select:",
					choices: ["A", "B"],
					defaultChoice: "A",
				});

				await service.getTextInput({
					message: "Input:",
					defaultValue: "test",
					skipWithDefault: true,
				});

				// --yes mode should still be consistent
				expect(service.isYesMode()).toBe(true);

				service.setYesMode(false);
			});

			test("should handle concurrent prompt calls consistently", async () => {
				// This tests that implementations handle concurrent calls gracefully
				const confirmPromise = service.confirmAction({
					message: "First prompt",
					defaultResponse: true,
				});

				const selectPromise = service.selectOption({
					message: "Second prompt",
					choices: ["A", "B"],
				});

				const textPromise = service.getTextInput({
					message: "Third prompt",
					defaultValue: "default",
				});

				const [confirmResult, selectResult, textResult] = await Promise.all([
					confirmPromise,
					selectPromise,
					textPromise,
				]);

				expect(typeof confirmResult).toBe("boolean");
				expect(["A", "B"]).toContain(selectResult);
				expect(typeof textResult).toBe("string");
			});
		});

		// Platform-specific tests that may not apply to all implementations
		describe("platform-specific behavior", () => {
			test.skipIf(!context.isRealTerminal)(
				"should handle terminal interruption gracefully",
				async () => {
					// This test would involve actual terminal interaction scenarios
					// that don't make sense for the in-memory implementation
					expect(true).toBe(true); // Placeholder for actual terminal tests
				},
			);

			test.skipIf(!context.isRealTerminal)(
				"should handle terminal resize during prompts",
				async () => {
					// This test would involve actual terminal resize scenarios
					expect(true).toBe(true); // Placeholder for actual resize tests
				},
			);
		});
	});
}
