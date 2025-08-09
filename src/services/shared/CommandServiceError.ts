/**
 * Internal error for command service operations
 */
export class CommandServiceError extends Error {
	constructor(
		message: string,
		public readonly operation: string,
		public readonly language: string,
		public override readonly cause?: Error,
	) {
		super(message);
		this.name = this.constructor.name;
	}
}
