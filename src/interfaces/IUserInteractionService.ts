/**
 * Interface for user interaction services that handle terminal prompts and confirmations
 * Supports cross-platform terminal input handling with --yes flag bypassing
 */

/**
 * Options for confirmation prompts
 */
export interface ConfirmationOptions {
	/** Default response if user just presses enter */
	readonly defaultResponse?: boolean;
	/** Message to display to the user */
	readonly message: string;
	/** Skip prompt if --yes flag was provided */
	readonly skipWithYes?: boolean;
}

/**
 * Service for handling interactive user prompts in the terminal
 * Supports confirmation prompts with --yes flag bypassing
 */
export default interface IUserInteractionService {
	/**
	 * Display a confirmation prompt to the user
	 * @param options - Prompt configuration
	 * @returns Promise resolving to user's choice (true/false)
	 */
	confirmAction(options: ConfirmationOptions): Promise<boolean>;

	/**
	 * Set whether the service should skip prompts (--yes flag)
	 * @param yesMode - true to skip all prompts with defaults
	 */
	setYesMode(yesMode: boolean): void;
}
