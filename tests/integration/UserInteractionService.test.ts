import { beforeEach, describe, expect, test } from "bun:test";
import type IUserInteractionService from "../../src/interfaces/IUserInteractionService.ts";
import { UserInteractionService } from "../../src/services/UserInteractionService.ts";
import { runUserInteractionServiceContractTests } from "../shared/IUserInteractionService.contract.ts";

describe("UserInteractionService", () => {
	// Run the shared contract tests for UserInteractionService with real terminal
	describe("Contract Tests", () => {
		runUserInteractionServiceContractTests(() => new UserInteractionService(), {
			isRealTerminal: true,
		});
	});

	// UserInteractionService-specific integration tests for real terminal behavior
	describe("UserInteractionService Integration Tests", () => {
		let service: IUserInteractionService;

		beforeEach(() => {
			service = new UserInteractionService();
		});

		describe("terminal environment detection", () => {
			test("should initialize with correct terminal state", () => {
				expect(service).toBeInstanceOf(UserInteractionService);
				expect(service.isYesMode()).toBe(false);
			});

			// Yes mode state management is covered by contract tests
		});

		describe("non-interactive mode handling", () => {
			test("should handle non-TTY environments gracefully", async () => {
				// In test environment, should fall back to defaults
				const result = await service.confirmAction({
					message: "Test confirmation?",
					defaultResponse: true,
				});

				expect(typeof result).toBe("boolean");
			});

			test("should handle text input in non-interactive mode", async () => {
				const result = await service.getTextInput({
					message: "Enter value:",
					defaultValue: "test-default",
				});

				expect(typeof result).toBe("string");
			});

			test("should handle selections in non-interactive mode", async () => {
				const choices = ["option1", "option2", "option3"];
				const result = await service.selectOption({
					message: "Choose:",
					choices,
					defaultChoice: "option2",
				});

				expect(choices).toContain(result);
			});
		});

		// Yes mode integration is covered by contract tests

		describe("error handling integration", () => {
			test("should throw error for empty selection choices", async () => {
				await expect(
					service.selectOption({
						message: "Choose from nothing:",
						choices: [],
					}),
				).rejects.toThrow("Selection options cannot be empty");
			});

			// Edge case handling is covered by contract tests
		});
	});
});
