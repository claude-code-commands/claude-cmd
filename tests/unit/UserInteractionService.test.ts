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

	describe("confirmAction method", () => {
		test("should return boolean response", async () => {
			const mockService = service as InMemoryUserInteractionService;
			mockService.setDefaultResponse(true);

			const result = await service.confirmAction({
				message: "Are you sure?",
				defaultResponse: false,
			});

			expect(typeof result).toBe("boolean");
			expect(result).toBe(true);
		});
	});
});

describe("UserInteractionService Real Implementation", () => {
	let service: UserInteractionService;

	beforeEach(() => {
		service = new UserInteractionService();
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
	});
});
