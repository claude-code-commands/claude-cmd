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

	describe("--yes mode functionality", () => {
		test("should start in non-yes mode by default", () => {
			expect(service.isYesMode()).toBe(false);
		});

		test("should allow setting yes mode", () => {
			service.setYesMode(true);
			expect(service.isYesMode()).toBe(true);

			service.setYesMode(false);
			expect(service.isYesMode()).toBe(false);
		});
	});

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

		test("should skip prompt in yes mode when skipWithYes is true", async () => {
			service.setYesMode(true);
			const mockService = service as InMemoryUserInteractionService;

			const result = await service.confirmAction({
				message: "Delete command?",
				defaultResponse: true,
				skipWithYes: true,
			});

			expect(result).toBe(true);
			expect(mockService.getInteractionHistory()).toHaveLength(1);
		});

		test("should not skip prompt in yes mode when skipWithYes is false", async () => {
			service.setYesMode(true);
			const mockService = service as InMemoryUserInteractionService;
			mockService.setDefaultResponses({ confirmation: false });

			const result = await service.confirmAction({
				message: "Delete command?",
				defaultResponse: true,
				skipWithYes: false,
			});

			// Should use default response from mock service, not the option's default
			expect(result).toBe(false);
		});

		test("should use defaultResponse when provided", async () => {
			const result = await service.confirmAction({
				message: "Continue?",
				defaultResponse: true,
			});

			expect(result).toBe(true);
		});
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

		test("should use defaultChoice in yes mode", async () => {
			service.setYesMode(true);
			const choices = ["red", "green", "blue"];

			const result = await service.selectOption({
				message: "Pick a color:",
				choices,
				defaultChoice: "green",
			});

			expect(result).toBe("green");
		});

		test("should support custom display function", async () => {
			const mockService = service as InMemoryUserInteractionService;
			const choices = [
				{ id: 1, name: "First" },
				{ id: 2, name: "Second" },
			];
			mockService.setPreConfiguredResponse("Select item:", choices[0]);

			const result = await service.selectOption({
				message: "Select item:",
				choices,
				displayFunction: (item) => item.name,
			});

			expect(result).toEqual({ id: 1, name: "First" });
		});
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

		test("should use default value in yes mode when skipWithDefault is true", async () => {
			service.setYesMode(true);

			const result = await service.getTextInput({
				message: "Enter name:",
				defaultValue: "Default Name",
				skipWithDefault: true,
			});

			expect(result).toBe("Default Name");
		});

		test("should not skip with default when skipWithDefault is false", async () => {
			service.setYesMode(true);
			const mockService = service as InMemoryUserInteractionService;
			mockService.setDefaultResponses({ textInput: "Mock Input" });

			const result = await service.getTextInput({
				message: "Enter name:",
				defaultValue: "Default Name",
				skipWithDefault: false,
			});

			expect(result).toBe("Mock Input");
		});
	});
});

describe("UserInteractionService Real Implementation", () => {
	let service: UserInteractionService;

	beforeEach(() => {
		// This will fail until we implement the real UserInteractionService
		service = new UserInteractionService();
	});

	describe("initialization", () => {
		test("should start in non-yes mode", () => {
			expect(service.isYesMode()).toBe(false);
		});

		test("should allow toggling yes mode", () => {
			service.setYesMode(true);
			expect(service.isYesMode()).toBe(true);

			service.setYesMode(false);
			expect(service.isYesMode()).toBe(false);
		});
	});

	describe("confirmation prompts", () => {
		test("should handle basic confirmation", async () => {
			// This test will fail until implementation exists
			// For now, we'll simulate what the behavior should be
			service.setYesMode(true);

			const result = await service.confirmAction({
				message: "Are you sure you want to remove 'test-command'?",
				defaultResponse: false,
				skipWithYes: true,
			});

			// In yes mode with skipWithYes=true, should use defaultResponse
			expect(result).toBe(false);
		});

		test("should handle confirmation with custom default", async () => {
			service.setYesMode(true);

			const result = await service.confirmAction({
				message: "Overwrite existing command?",
				defaultResponse: true,
				skipWithYes: true,
			});

			expect(result).toBe(true);
		});
	});

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

describe("Command Removal Confirmation Scenarios", () => {
	let service: IUserInteractionService;

	beforeEach(() => {
		service = new InMemoryUserInteractionService();
	});

	describe("single command removal", () => {
		test("should confirm removal with command details", async () => {
			const mockService = service as InMemoryUserInteractionService;
			mockService.setPreConfiguredResponse(
				"Are you sure you want to remove 'debug-helper' from personal directory: /home/user/.claude/commands/debug-helper.md? (y/N)",
				true,
			);

			const result = await service.confirmAction({
				message:
					"Are you sure you want to remove 'debug-helper' from personal directory: /home/user/.claude/commands/debug-helper.md? (y/N)",
				defaultResponse: false,
			});

			expect(result).toBe(true);
			expect(
				mockService.wasMessagePrompted(
					"Are you sure you want to remove 'debug-helper' from personal directory: /home/user/.claude/commands/debug-helper.md? (y/N)",
				),
			).toBe(true);
		});

		test("should handle cancellation", async () => {
			const mockService = service as InMemoryUserInteractionService;
			mockService.setDefaultResponses({ confirmation: false });

			const result = await service.confirmAction({
				message: "Are you sure you want to remove 'test-command'? (y/N)",
				defaultResponse: false,
			});

			expect(result).toBe(false);
		});
	});

	describe("namespace-aware removal", () => {
		test("should confirm namespaced command removal", async () => {
			const mockService = service as InMemoryUserInteractionService;
			mockService.setPreConfiguredResponse(
				"Are you sure you want to remove 'frontend:component' from project directory: ./.claude/commands/frontend/component.md? (y/N)",
				true,
			);

			const result = await service.confirmAction({
				message:
					"Are you sure you want to remove 'frontend:component' from project directory: ./.claude/commands/frontend/component.md? (y/N)",
				defaultResponse: false,
			});

			expect(result).toBe(true);
		});
	});

	describe("--yes flag behavior", () => {
		test("should bypass confirmation with --yes flag", async () => {
			service.setYesMode(true);

			const result = await service.confirmAction({
				message: "Are you sure you want to remove 'test-command'?",
				defaultResponse: false,
				skipWithYes: true,
			});

			// Should use default response without prompting
			expect(result).toBe(false);
		});

		test("should still prompt when skipWithYes is not set", async () => {
			service.setYesMode(true);
			const mockService = service as InMemoryUserInteractionService;
			mockService.setDefaultResponses({ confirmation: true });

			const result = await service.confirmAction({
				message: "This requires confirmation",
				defaultResponse: false,
				// skipWithYes not set, should still prompt
			});

			expect(result).toBe(true); // Uses mock default, not option default
		});
	});
});

describe("Edge Cases and Error Conditions", () => {
	let service: IUserInteractionService;

	beforeEach(() => {
		service = new InMemoryUserInteractionService();
	});

	test("should handle very long confirmation messages", async () => {
		const longMessage = `${"A".repeat(1000)}?`;
		const mockService = service as InMemoryUserInteractionService;
		mockService.setDefaultResponses({ confirmation: false });

		const result = await service.confirmAction({
			message: longMessage,
		});

		expect(result).toBe(false);
	});

	test("should handle special characters in messages", async () => {
		const specialMessage = "Remove 'command-with-@#$%^&*()' file?";
		const mockService = service as InMemoryUserInteractionService;
		mockService.setDefaultResponses({ confirmation: true });

		const result = await service.confirmAction({
			message: specialMessage,
		});

		expect(result).toBe(true);
	});

	test("should handle null/undefined in choice arrays", async () => {
		const mockService = service as InMemoryUserInteractionService;
		const choices = ["valid", null, undefined, "another"] as any[];
		mockService.setPreConfiguredResponse("Choose:", "valid");

		const result = await service.selectOption({
			message: "Choose:",
			choices,
		});

		expect(result).toBe("valid");
	});

	test("should handle concurrent confirmation calls", async () => {
		const mockService = service as InMemoryUserInteractionService;
		mockService.setDefaultResponses({ confirmation: true });

		const promises = [
			service.confirmAction({ message: "First?" }),
			service.confirmAction({ message: "Second?" }),
			service.confirmAction({ message: "Third?" }),
		];

		const results = await Promise.all(promises);

		expect(results).toEqual([true, true, true]);
		expect(mockService.countInteractions("confirmation")).toBe(3);
	});
});
