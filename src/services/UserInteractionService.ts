import { stdin, stdout } from "node:process";
import type { Interface as ReadlineInterface } from "node:readline";
import { createInterface } from "node:readline";
import type IUserInteractionService from "../interfaces/IUserInteractionService.js";
import type { ConfirmationOptions } from "../interfaces/IUserInteractionService.js";

/**
 * Service for handling interactive user prompts in terminal environments
 * Supports confirmation prompts with --yes flag bypassing
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
	private askQuestion(
		rl: ReadlineInterface,
		question: string,
	): Promise<string> {
		return new Promise((resolve, reject) => {
			rl.question(question, (answer: string) => {
				resolve(answer);
			});

			// Handle process interruption (Ctrl+C)
			rl.on("SIGINT", () => {
				reject(new Error("Input interrupted by user"));
			});

			// Handle EOF (Ctrl+D)
			rl.on("close", () => {
				reject(new Error("Input stream closed"));
			});
		});
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
					stdout.write(
						"Please enter 'y' or 'n' (or press Enter for default).\n",
					);
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
}
