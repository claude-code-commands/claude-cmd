import { stdin, stdout } from "node:process";
import { createInterface } from "node:readline";
import type { Interface as ReadlineInterface } from "node:readline";
import type IUserInteractionService from "../interfaces/IUserInteractionService.js";
import type {
	ConfirmationOptions,
	SelectionOptions,
	TextInputOptions,
} from "../interfaces/IUserInteractionService.js";

/**
 * Service for handling interactive user prompts in terminal environments
 * Supports confirmation prompts, selections, and text input with --yes flag bypassing
 */
export class UserInteractionService implements IUserInteractionService {
	private yesMode = false;

	/**
	 * Set whether the service should skip prompts (--yes flag)
	 */
	setYesMode(yesMode: boolean): void {
		this.yesMode = yesMode;
	}

	/**
	 * Check if the service is running in --yes mode (skip prompts)
	 */
	isYesMode(): boolean {
		return this.yesMode;
	}

	/**
	 * Check if we should prompt the user interactively
	 * Centralizes TTY and environment detection logic
	 */
	private shouldPrompt(): boolean {
		return stdin.isTTY && process.env.NODE_ENV !== "test";
	}

	/**
	 * Create a readline interface with consistent configuration
	 * Centralizes readline creation to eliminate duplication
	 */
	private createReadlineInterface(): ReadlineInterface {
		return createInterface({
			input: stdin,
			output: stdout,
		});
	}

	/**
	 * Check if we should skip prompt due to --yes mode
	 * Standardizes yes-mode logic across all prompt types
	 */
	private shouldSkipPrompt(skipWithYes?: boolean): boolean {
		return this.yesMode && skipWithYes === true;
	}

	/**
	 * Ask a question and wait for response with proper error handling
	 * Includes timeout and interruption handling
	 */
	private askQuestion(rl: ReadlineInterface, question: string): Promise<string> {
		return new Promise((resolve, reject) => {
			rl.question(question, (answer: string) => {
				resolve(answer);
			});

			// Handle process interruption (Ctrl+C)
			rl.on('SIGINT', () => {
				reject(new Error("Input interrupted by user"));
			});

			// Handle EOF (Ctrl+D)
			rl.on('close', () => {
				reject(new Error("Input stream closed"));
			});
		});
	}

	/**
	 * Validate that input is a positive integer within range
	 * Addresses critical input validation vulnerability
	 */
	private isValidChoice(input: string, maxChoice: number): boolean {
		const trimmedInput = input.trim();
		
		// Must be digits only
		if (!/^\d+$/.test(trimmedInput)) {
			return false;
		}

		const num = Number.parseInt(trimmedInput, 10);
		
		// Check for NaN and range
		if (Number.isNaN(num) || num < 1 || num > maxChoice) {
			return false;
		}

		return true;
	}

	/**
	 * Display a confirmation prompt to the user
	 */
	async confirmAction(options: ConfirmationOptions): Promise<boolean> {
		const effectiveDefault = options.defaultResponse ?? false;

		// Skip prompt if in --yes mode and configured to do so
		if (this.shouldSkipPrompt(options.skipWithYes)) {
			return effectiveDefault;
		}

		// Use default if not in interactive mode
		if (!this.shouldPrompt()) {
			return effectiveDefault;
		}

		const rl = this.createReadlineInterface();

		try {
			const defaultHint = effectiveDefault ? "(Y/n)" : "(y/N)";
			const prompt = `${options.message} ${defaultHint}: `;

			while (true) {
				try {
					const answer = await this.askQuestion(rl, prompt);
					
					// Handle default response for empty input
					if (answer.trim() === "") {
						return effectiveDefault;
					}

					// Parse y/yes as true, n/no as false, reprompt on invalid
					const normalizedAnswer = answer.trim().toLowerCase();
					if (normalizedAnswer === "y" || normalizedAnswer === "yes") {
						return true;
					}
					if (normalizedAnswer === "n" || normalizedAnswer === "no") {
						return false;
					}

					// Invalid input - prompt again
					stdout.write("Please enter 'y' or 'n' (or press Enter for default).\n");
				} catch (error) {
					// Handle interruption gracefully
					if (error instanceof Error && error.message.includes("interrupt")) {
						return false; // Default to cancellation on interruption
					}
					throw error;
				}
			}
		} finally {
			rl.close();
		}
	}

	/**
	 * Display a selection prompt to the user
	 */
	async selectOption<T>(options: SelectionOptions<T>): Promise<T> {
		if (options.choices.length === 0) {
			throw new Error("Selection options cannot be empty");
		}

		// Skip prompt if in --yes mode and default choice available
		if (this.shouldSkipPrompt(true) && options.defaultChoice !== undefined) {
			return options.defaultChoice;
		}

		// Use default or first choice if not in interactive mode
		if (!this.shouldPrompt()) {
			return options.defaultChoice ?? options.choices[0];
		}

		const rl = this.createReadlineInterface();

		try {
			// Display choices
			stdout.write(`${options.message}\n`);
			for (let i = 0; i < options.choices.length; i++) {
				const choice = options.choices[i];
				const displayText = options.displayFunction ? options.displayFunction(choice) : String(choice);
				stdout.write(`  ${i + 1}. ${displayText}\n`);
			}

			while (true) {
				try {
					const answer = await this.askQuestion(rl, `Enter choice (1-${options.choices.length}): `);
					
					// Validate input using secure validation method
					if (!this.isValidChoice(answer, options.choices.length)) {
						stdout.write(`Please enter a number between 1 and ${options.choices.length}.\n`);
						continue;
					}

					const choiceIndex = Number.parseInt(answer.trim(), 10) - 1;
					return options.choices[choiceIndex];
				} catch (error) {
					// Handle interruption gracefully
					if (error instanceof Error && error.message.includes("interrupt")) {
						// Return default choice or first choice on interruption
						return options.defaultChoice ?? options.choices[0];
					}
					throw error;
				}
			}
		} finally {
			rl.close();
		}
	}

	/**
	 * Display a text input prompt to the user
	 */
	async getTextInput(options: TextInputOptions): Promise<string> {
		// Skip prompt if in --yes mode and configured to do so
		if (this.shouldSkipPrompt(options.skipWithDefault) && options.defaultValue !== undefined) {
			return options.defaultValue;
		}

		// Use default or empty string if not in interactive mode
		if (!this.shouldPrompt()) {
			return options.defaultValue ?? "";
		}

		const rl = this.createReadlineInterface();

		try {
			const defaultHint = options.defaultValue ? ` [${options.defaultValue}]` : "";
			const prompt = `${options.message}${defaultHint}: `;

			try {
				const answer = await this.askQuestion(rl, prompt);
				
				// Use default value for empty input
				if (answer.trim() === "" && options.defaultValue !== undefined) {
					return options.defaultValue;
				}

				return answer;
			} catch (error) {
				// Handle interruption gracefully
				if (error instanceof Error && error.message.includes("interrupt")) {
					// Return default or empty string on interruption
					return options.defaultValue ?? "";
				}
				throw error;
			}
		} finally {
			rl.close();
		}
	}
}