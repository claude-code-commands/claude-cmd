/**
 * Represents a parsed namespace structure
 */
export interface ParsedNamespace {
	/** Original namespace string (e.g., "project:frontend:component") */
	readonly original: string;

	/** Array of namespace segments (e.g., ["project", "frontend", "component"]) */
	readonly segments: readonly string[];

	/** Path-based representation (e.g., "project/frontend/component") */
	readonly path: string;

	/** Depth of the namespace (number of segments) */
	readonly depth: number;
}

/**
 * Configuration options for namespace validation
 */
export interface NamespaceValidationOptions {
	/** Maximum allowed depth for namespaces (default: 5) */
	readonly maxDepth?: number;

	/** Minimum allowed depth for namespaces (default: 1) */
	readonly minDepth?: number;

	/** Pattern for valid segment names (default: alphanumeric with hyphens) */
	readonly segmentPattern?: RegExp;

	/** Whether to allow empty segments (default: false) */
	readonly allowEmptySegments?: boolean;
}

/**
 * Base class for all namespace-related errors
 */
export abstract class NamespaceError extends Error {
	constructor(
		message: string,
		public readonly namespace: string,
	) {
		super(message);
		this.name = this.constructor.name;
	}
}

/**
 * Error thrown when a namespace has invalid syntax
 */
export class InvalidNamespaceSyntaxError extends NamespaceError {
	constructor(namespace: string, reason: string) {
		super(`Invalid namespace syntax "${namespace}": ${reason}`, namespace);
		this.reason = reason;
	}

	public readonly reason: string;
}

/**
 * Error thrown when a namespace exceeds validation constraints
 */
export class NamespaceValidationError extends NamespaceError {
	constructor(namespace: string, constraint: string, value: number) {
		super(
			`Namespace "${namespace}" violates constraint "${constraint}": ${value}`,
			namespace,
		);
		this.constraint = constraint;
		this.value = value;
	}

	public readonly constraint: string;
	public readonly value: number;
}

/**
 * Service interface for namespace parsing, validation, and format conversion
 *
 * Provides functionality to work with namespaced command identifiers that support
 * hierarchical organization (e.g., "project:frontend:component", "backend:api:auth").
 *
 * Supports two primary formats:
 * - Colon-separated: "project:frontend:component"
 * - Path-based: "project/frontend/component"
 *
 * @example
 * ```typescript
 * const namespaceService: INamespaceService = new NamespaceService();
 *
 * const parsed = namespaceService.parse("project:frontend:component");
 * console.log(parsed.segments); // ["project", "frontend", "component"]
 * console.log(parsed.path); // "project/frontend/component"
 * console.log(parsed.depth); // 3
 *
 * const isValid = namespaceService.validate("project:frontend:component");
 * console.log(isValid); // true
 * ```
 */
export default interface INamespaceService {
	/**
	 * Parse a namespace string into its component parts
	 *
	 * Supports both colon-separated and path-based formats:
	 * - "project:frontend:component" → ParsedNamespace
	 * - "project/frontend/component" → ParsedNamespace
	 *
	 * @param namespace - Namespace string to parse
	 * @returns ParsedNamespace object with segments, path, and metadata
	 * @throws InvalidNamespaceSyntaxError when namespace format is invalid
	 */
	parse(namespace: string): ParsedNamespace;

	/**
	 * Validate a namespace against syntax rules and constraints
	 *
	 * Checks for:
	 * - Valid segment names (alphanumeric with hyphens)
	 * - Depth constraints (min/max segments)
	 * - No empty segments (unless explicitly allowed)
	 * - Proper separator usage
	 *
	 * @param namespace - Namespace string to validate
	 * @param options - Optional validation constraints
	 * @returns true if namespace is valid, false otherwise
	 */
	validate(namespace: string, options?: NamespaceValidationOptions): boolean;

	/**
	 * Validate a namespace and throw detailed error if invalid
	 *
	 * Similar to validate() but throws specific errors instead of returning false.
	 * Useful when you need detailed error information for user feedback.
	 *
	 * @param namespace - Namespace string to validate
	 * @param options - Optional validation constraints
	 * @throws InvalidNamespaceSyntaxError for syntax violations
	 * @throws NamespaceValidationError for constraint violations
	 */
	validateStrict(namespace: string, options?: NamespaceValidationOptions): void;

	/**
	 * Convert namespace from colon-separated to path-based format
	 *
	 * @param colonSeparated - Colon-separated namespace (e.g., "project:frontend:component")
	 * @returns Path-based format (e.g., "project/frontend/component")
	 * @throws InvalidNamespaceSyntaxError if input format is invalid
	 */
	toPath(colonSeparated: string): string;

	/**
	 * Convert namespace from path-based to colon-separated format
	 *
	 * @param pathBased - Path-based namespace (e.g., "project/frontend/component")
	 * @returns Colon-separated format (e.g., "project:frontend:component")
	 * @throws InvalidNamespaceSyntaxError if input format is invalid
	 */
	toColonSeparated(pathBased: string): string;
}
