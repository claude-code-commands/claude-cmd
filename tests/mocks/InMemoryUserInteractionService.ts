import type IUserInteractionService from "../../src/interfaces/IUserInteractionService.js";
import type { ConfirmationOptions } from "../../src/interfaces/IUserInteractionService.js";

type InteractionLog = {
	type: "confirmation";
	options: ConfirmationOptions;
	response: boolean;
	timestamp: Date;
};

/**
 * In-memory implementation of IUserInteractionService for testing
 *
 * This mock allows pre-configured responses and tracks all interaction calls
 * for verification in tests. Supports both --yes mode simulation and custom responses.
 */
export default class InMemoryUserInteractionService
	implements IUserInteractionService
{
	private yesMode = false;
	private interactionHistory: InteractionLog[] = [];
	private preConfiguredResponses: Map<string, boolean> = new Map();
	private defaultResponse?: boolean;

	/**
	 * Set whether the service is in --yes mode (skips prompts with defaults)
	 */
	setYesMode(yesMode: boolean): void {
		this.yesMode = yesMode;
	}

	/**
	 * Pre-configure response for a specific message
	 * Useful for testing specific interaction scenarios
	 */
	setPreConfiguredResponse(message: string, response: boolean): void {
		this.preConfiguredResponses.set(message, response);
	}

	/**
	 * Set default response for confirmation prompts when no specific response is configured
	 */
	setDefaultResponse(response: boolean): void {
		this.defaultResponse = response;
	}

	/**
	 * Display a confirmation prompt (y/N)
	 */
	async confirmAction(options: ConfirmationOptions): Promise<boolean> {
		// In --yes mode, skip prompt if configured to do so
		if (this.yesMode && options.skipWithYes) {
			const response = options.defaultResponse ?? false;
			this.logInteraction("confirmation", options, response);
			return response;
		}

		// Check for pre-configured response first
		if (this.preConfiguredResponses.has(options.message)) {
			const response = this.preConfiguredResponses.get(options.message)!;
			this.logInteraction("confirmation", options, response);
			return response;
		}

		// Fall back to default response or the option's default
		const response = this.defaultResponse ?? options.defaultResponse ?? false;
		this.logInteraction("confirmation", options, response);
		return response;
	}

	/**
	 * Private helper to log interactions
	 */
	private logInteraction(
		type: "confirmation",
		options: ConfirmationOptions,
		response: boolean,
	): void {
		this.interactionHistory.push({
			type,
			options,
			response,
			timestamp: new Date(),
		});
	}
}
