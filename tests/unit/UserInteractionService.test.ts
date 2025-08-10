import { beforeEach, describe, expect, test } from "bun:test";
import type IUserInteractionService from "../../src/interfaces/IUserInteractionService.js";
import { UserInteractionService } from "../../src/services/UserInteractionService.js";
import InMemoryUserInteractionService from "../mocks/InMemoryUserInteractionService.js";
import { runUserInteractionServiceContractTests } from "../shared/IUserInteractionService.contract.js";

describe("UserInteractionService Interface Contract", () => {
	let service: IUserInteractionService;

	beforeEach(() => {
		service = new InMemoryUserInteractionService();
	});

	// Run contract tests to ensure InMemoryUserInteractionService behaves like real implementation
	runUserInteractionServiceContractTests(
		() => new InMemoryUserInteractionService(),
		{
			isRealTerminal: false,
		},
	);

	// Yes mode functionality is covered by contract tests

	describe("confirmAction method", () => {
		test("should return boolean response", async () => {
			const mockService = service as InMemoryUserInteractionService;
			mockService.setDefaultResponses({ confirmation: true });

			const result = await service.confirmAction({
				message: "Are you sure?",
				defaultResponse: false,
			});

			expect(typeof result).toBe("boolean");
			expect(result).toBe(true);
		});

		// Skip behavior and default response handling covered by contract tests
	});

	describe("selectOption method", () => {
		test("should return selected option from choices", async () => {
			const mockService = service as InMemoryUserInteractionService;
			const choices = ["option1", "option2", "option3"];
			mockService.setPreConfiguredResponse("Choose an option:", choices[1]);

			const result = await service.selectOption({
				message: "Choose an option:",
				choices,
			});

			expect(result).toBe("option2");
			expect(choices).toContain(result);
		});

		// Yes mode default choice and custom display function behavior covered by contract tests
	});

	describe("getTextInput method", () => {
		test("should return string input", async () => {
			const mockService = service as InMemoryUserInteractionService;
			mockService.setPreConfiguredResponse("Enter name:", "John Doe");

			const result = await service.getTextInput({
				message: "Enter name:",
			});

			expect(typeof result).toBe("string");
			expect(result).toBe("John Doe");
		});

		// skipWithDefault behavior covered by contract tests
	});
});

describe("UserInteractionService Real Implementation", () => {
	let service: UserInteractionService;

	beforeEach(() => {
		// This will fail until we implement the real UserInteractionService
		service = new UserInteractionService();
	});

	// Yes mode initialization and toggling covered by contract tests

	// Basic confirmation behavior and yes mode handling covered by contract tests

	describe("error handling", () => {
		test("should handle invalid confirmation options gracefully", async () => {
			// Should not throw error for missing defaultResponse
			const result = await service.confirmAction({
				message: "Continue?",
			});

			// Should default to false when no default provided
			expect(typeof result).toBe("boolean");
		});

		test("should handle empty choice arrays gracefully", async () => {
			// Should handle empty choices array without crashing
			await expect(
				service.selectOption({
					message: "Choose:",
					choices: [],
				}),
			).rejects.toThrow(); // Should throw an error for empty choices
		});

		test("should handle text input with no default", async () => {
			service.setYesMode(true);

			const result = await service.getTextInput({
				message: "Enter value:",
				skipWithDefault: true,
			});

			// Should return empty string when no default provided
			expect(result).toBe("");
		});
	});
});

// Command removal confirmation scenarios are covered by contract tests
// Mock service testing with setPreConfiguredResponse and wasMessagePrompted

// Edge cases and error conditions are covered by contract tests
// Mock-specific functionality like concurrent testing with countInteractions
