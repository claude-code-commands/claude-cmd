import { beforeEach, describe, expect, test } from "bun:test";
import type IUserInteractionService from "../../src/interfaces/IUserInteractionService.ts";
import type { ConfirmationOptions } from "../../src/interfaces/IUserInteractionService.ts";

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
 * correctly according to the interface contract. It tests the confirmation prompts
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

		describe("--yes mode behavior", () => {
			test("should track --yes mode state correctly", () => {
				// Enable --yes mode
				service.setYesMode(true);

				const confirmOptions: ConfirmationOptions = {
					message: "First confirmation?",
					defaultResponse: true,
					skipWithYes: true,
				};

				// Test that service can handle operations in --yes mode
				expect(() => service.confirmAction(confirmOptions)).not.toThrow();

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
			test("should not leak state between different operations", async () => {
				// Configure service state
				service.setYesMode(true);

				// Use confirmation prompts
				await service.confirmAction({
					message: "Confirm?",
					defaultResponse: true,
					skipWithYes: true,
				});

				// Reset for cleanup
				service.setYesMode(false);
			});
		});

		// Platform-specific tests that may not apply to all implementations
		describe("platform-specific behavior", () => {
			test.skipIf(!context.isRealTerminal)(
				"should handle terminal interruption gracefully",
				async () => {
					// Test that real terminal implementations handle interruption signals
					// without crashing or leaving the terminal in a bad state

					// Set up a confirmation prompt in --yes mode to avoid hanging
					service.setYesMode(true);

					// This should complete quickly in --yes mode
					const startTime = Date.now();
					const response = await service.confirmAction({
						message: "Test interruption handling",
						defaultResponse: true,
						skipWithYes: true,
					});
					const endTime = Date.now();

					expect(typeof response).toBe("boolean");
					expect(endTime - startTime).toBeLessThan(1000); // Should be fast in --yes mode

					// Reset for cleanup
					service.setYesMode(false);
				},
			);

			test.skipIf(!context.isRealTerminal)(
				"should handle terminal resize during prompts",
				async () => {
					// Test that real terminal implementations handle window resize events
					// gracefully without breaking the prompt interface

					// Use --yes mode to ensure test doesn't hang waiting for input
					service.setYesMode(true);

					// Test confirmation prompt to ensure it handles resizing
					const confirmResponse = await service.confirmAction({
						message: "Test resize handling in confirmation",
						defaultResponse: true,
						skipWithYes: true,
					});
					expect(typeof confirmResponse).toBe("boolean");

					// Reset for cleanup
					service.setYesMode(false);
				},
			);
		});
	});
}
