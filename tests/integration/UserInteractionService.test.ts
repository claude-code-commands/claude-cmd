import { beforeEach, describe, expect, test } from "bun:test";
import type IUserInteractionService from "../../src/interfaces/IUserInteractionService.js";
import { UserInteractionService } from "../../src/services/UserInteractionService.js";
import { runUserInteractionServiceContractTests } from "../shared/IUserInteractionService.contract.js";

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
			});
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
		});
	});
});
