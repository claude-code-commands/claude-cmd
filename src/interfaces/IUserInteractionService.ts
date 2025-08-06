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
 * Options for selection prompts
 */
export interface SelectionOptions<T> {
	/** Available choices */
	readonly choices: readonly T[];
	/** Function to display each choice */
	readonly displayFunction?: (choice: T) => string;
	/** Message to display to the user */
	readonly message: string;
	/** Skip prompt if --yes flag was provided and use this default */
	readonly defaultChoice?: T;
}

/**
 * Options for free text input
 */
export interface TextInputOptions {
	/** Message to display to the user */
	readonly message: string;
	/** Default value if user just presses enter */
	readonly defaultValue?: string;
	/** Skip prompt if --yes flag was provided and use default */
	readonly skipWithDefault?: boolean;
}

/**
 * Service for handling interactive user prompts in the terminal
 * Supports confirmation prompts, selections, and text input with --yes flag bypassing
 */
export default interface IUserInteractionService {
	/**
	 * Display a confirmation prompt to the user
	 * @param options - Prompt configuration
	 * @returns Promise resolving to user's choice (true/false)
	 */
	confirmAction(options: ConfirmationOptions): Promise<boolean>;

	/**
	 * Display a selection prompt to the user
	 * @param options - Selection configuration
	 * @returns Promise resolving to selected choice
	 */
	selectOption<T>(options: SelectionOptions<T>): Promise<T>;

	/**
	 * Display a text input prompt to the user
	 * @param options - Input configuration
	 * @returns Promise resolving to user's input
	 */
	getTextInput(options: TextInputOptions): Promise<string>;

	/**
	 * Check if the service is running in --yes mode (skip prompts)
	 * @returns true if prompts should be bypassed
	 */
	isYesMode(): boolean;

	/**
	 * Set whether the service should skip prompts (--yes flag)
	 * @param yesMode - true to skip all prompts with defaults
	 */
	setYesMode(yesMode: boolean): void;
}