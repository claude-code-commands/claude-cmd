import type IUserInteractionService from "../../src/interfaces/IUserInteractionService.js";
import type {
	ConfirmationOptions,
	SelectionOptions,
	TextInputOptions,
} from "../../src/interfaces/IUserInteractionService.js";

type InteractionLog = {
	type: "confirmation" | "selection" | "textInput";
	options: ConfirmationOptions | SelectionOptions<any> | TextInputOptions;
	response: boolean | any | string;
	timestamp: Date;
};

/**
 * In-memory implementation of IUserInteractionService for testing
 * 
 * This mock allows pre-configured responses and tracks all interaction calls
 * for verification in tests. Supports both --yes mode simulation and custom responses.
 */
export default class InMemoryUserInteractionService implements IUserInteractionService {
	private yesMode = false;
	private interactionHistory: InteractionLog[] = [];
	private preConfiguredResponses: Map<string, any> = new Map();
	private defaultResponses: {
		confirmation?: boolean;
		selection?: any;
		textInput?: string;
	} = {};

	/**
	 * Set whether the service is in --yes mode (skips prompts with defaults)
	 */
	setYesMode(yesMode: boolean): void {
		this.yesMode = yesMode;
	}

	/**
	 * Check if the service is in --yes mode
	 */
	isYesMode(): boolean {
		return this.yesMode;
	}

	/**
	 * Pre-configure response for a specific message
	 * Useful for testing specific interaction scenarios
	 */
	setPreConfiguredResponse(message: string, response: any): void {
		this.preConfiguredResponses.set(message, response);
	}

	/**
	 * Set default responses for each type when no specific response is configured
	 */
	setDefaultResponses(defaults: {
		confirmation?: boolean;
		selection?: any;
		textInput?: string;
	}): void {
		this.defaultResponses = { ...defaults };
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
			const response = this.preConfiguredResponses.get(options.message) as boolean;
			this.logInteraction("confirmation", options, response);
			return response;
		}

		// Fall back to default confirmation response or the option's default
		const response = this.defaultResponses.confirmation ?? options.defaultResponse ?? false;
		this.logInteraction("confirmation", options, response);
		return response;
	}

	/**
	 * Display a selection prompt
	 */
	async selectOption<T>(options: SelectionOptions<T>): Promise<T> {
		// In --yes mode, use default choice if available
		if (this.yesMode && options.defaultChoice !== undefined) {
			const response = options.defaultChoice;
			this.logInteraction("selection", options, response);
			return response;
		}

		// Check for pre-configured response first
		if (this.preConfiguredResponses.has(options.message)) {
			const response = this.preConfiguredResponses.get(options.message) as T;
			this.logInteraction("selection", options, response);
			return response;
		}

		// Fall back to default selection response or first choice
		const response = ((this.defaultResponses.selection as T) ?? options.choices[0]) as T;
		this.logInteraction("selection", options, response);
		return response;
	}

	/**
	 * Display a text input prompt
	 */
	async getTextInput(options: TextInputOptions): Promise<string> {
		// In --yes mode, use default value if configured to do so
		if (this.yesMode && options.skipWithDefault && options.defaultValue !== undefined) {
			const response = options.defaultValue;
			this.logInteraction("textInput", options, response);
			return response;
		}

		// Check for pre-configured response first
		if (this.preConfiguredResponses.has(options.message)) {
			const response = this.preConfiguredResponses.get(options.message) as string;
			this.logInteraction("textInput", options, response);
			return response;
		}

		// Fall back to default text input response or empty string
		const response = this.defaultResponses.textInput ?? options.defaultValue ?? "";
		this.logInteraction("textInput", options, response);
		return response;
	}

	/**
	 * Get the history of all interactions for test verification
	 */
	getInteractionHistory(): InteractionLog[] {
		return [...this.interactionHistory];
	}

	/**
	 * Clear interaction history for clean test state
	 */
	clearInteractionHistory(): void {
		this.interactionHistory.length = 0;
	}

	/**
	 * Clear all pre-configured responses
	 */
	clearPreConfiguredResponses(): void {
		this.preConfiguredResponses.clear();
	}

	/**
	 * Get the last interaction that occurred
	 */
	getLastInteraction(): InteractionLog | null {
		return this.interactionHistory[this.interactionHistory.length - 1] ?? null;
	}

	/**
	 * Check if a specific message was prompted
	 */
	wasMessagePrompted(message: string): boolean {
		return this.interactionHistory.some(
			(log) => 
				(log.options as any).message === message
		);
	}

	/**
	 * Count how many interactions of a specific type occurred
	 */
	countInteractions(type: "confirmation" | "selection" | "textInput"): number {
		return this.interactionHistory.filter((log) => log.type === type).length;
	}

	/**
	 * Private helper to log interactions
	 */
	private logInteraction(
		type: "confirmation" | "selection" | "textInput",
		options: any,
		response: any,
	): void {
		this.interactionHistory.push({
			type,
			options,
			response,
			timestamp: new Date(),
		});
	}
}