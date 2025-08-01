import type INamespaceService from "../interfaces/INamespaceService.js";
import {
	InvalidNamespaceSyntaxError,
	NamespaceValidationError,
	type NamespaceValidationOptions,
	type ParsedNamespace,
} from "../interfaces/INamespaceService.js";

/**
 * Default validation options for namespace validation
 */
const DEFAULT_VALIDATION_OPTIONS: Required<NamespaceValidationOptions> = {
	maxDepth: 5,
	minDepth: 1,
	segmentPattern: /^[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]$|^[a-zA-Z0-9]$/,
	allowEmptySegments: false,
};

/**
 * Service implementation for namespace parsing, validation, and format conversion
 */
export default class NamespaceService implements INamespaceService {
	/**
	 * Parse a namespace string into its component parts
	 */
	parse(namespace: string): ParsedNamespace {
		if (!namespace || namespace.trim() === "") {
			throw new InvalidNamespaceSyntaxError(
				namespace,
				"Namespace cannot be empty",
			);
		}

		const trimmed = namespace.trim();

		// Determine separator and split
		let segments: string[];
		if (trimmed.includes(":")) {
			segments = trimmed.split(":");
		} else if (trimmed.includes("/")) {
			segments = trimmed.split("/");
		} else {
			segments = [trimmed];
		}

		// Filter out empty segments
		segments = segments.filter((segment) => segment.trim() !== "");

		if (segments.length === 0) {
			throw new InvalidNamespaceSyntaxError(
				namespace,
				"No valid segments found",
			);
		}

		// Create path representation
		const path = segments.join("/");

		return {
			original: trimmed,
			segments: segments,
			path: path,
			depth: segments.length,
		};
	}

	/**
	 * Validate a namespace against syntax rules and constraints
	 */
	validate(namespace: string, options?: NamespaceValidationOptions): boolean {
		try {
			this.validateStrict(namespace, options);
			return true;
		} catch {
			return false;
		}
	}

	/**
	 * Validate a namespace and throw detailed error if invalid
	 */
	validateStrict(
		namespace: string,
		options?: NamespaceValidationOptions,
	): void {
		const opts = { ...DEFAULT_VALIDATION_OPTIONS, ...options };

		let parsed: ParsedNamespace;
		try {
			parsed = this.parse(namespace);
		} catch (error) {
			if (error instanceof InvalidNamespaceSyntaxError) {
				throw error;
			}
			throw new InvalidNamespaceSyntaxError(
				namespace,
				"Failed to parse namespace",
			);
		}

		// Check depth constraints
		if (parsed.depth < opts.minDepth) {
			throw new NamespaceValidationError(namespace, "minDepth", parsed.depth);
		}
		if (parsed.depth > opts.maxDepth) {
			throw new NamespaceValidationError(namespace, "maxDepth", parsed.depth);
		}

		// Validate each segment
		for (const segment of parsed.segments) {
			if (!opts.allowEmptySegments && segment.trim() === "") {
				throw new InvalidNamespaceSyntaxError(
					namespace,
					"Empty segments are not allowed",
				);
			}

			if (segment.trim() !== "" && !opts.segmentPattern.test(segment)) {
				throw new InvalidNamespaceSyntaxError(
					namespace,
					`Invalid segment "${segment}": must match pattern ${opts.segmentPattern}`,
				);
			}
		}
	}

	/**
	 * Convert namespace from colon-separated to path-based format
	 */
	toPath(colonSeparated: string): string {
		const parsed = this.parse(colonSeparated);
		return parsed.path;
	}

	/**
	 * Convert namespace from path-based to colon-separated format
	 */
	toColonSeparated(pathBased: string): string {
		const parsed = this.parse(pathBased);
		return parsed.segments.join(":");
	}

	/**
	 * Get the parent namespace of a given namespace
	 */
	getParent(namespace: string): string | null {
		const parsed = this.parse(namespace);

		if (parsed.depth <= 1) {
			return null;
		}

		const parentSegments = parsed.segments.slice(0, -1);
		return parentSegments.join(":");
	}

	/**
	 * Check if one namespace is a parent of another
	 */
	isParentOf(parent: string, child: string): boolean {
		const parsedParent = this.parse(parent);
		const parsedChild = this.parse(child);

		if (parsedParent.depth >= parsedChild.depth) {
			return false;
		}

		// Check if all parent segments match the beginning of child segments
		for (let i = 0; i < parsedParent.segments.length; i++) {
			if (parsedParent.segments[i] !== parsedChild.segments[i]) {
				return false;
			}
		}

		return true;
	}

	/**
	 * Get all ancestor namespaces of a given namespace
	 */
	getAncestors(namespace: string): string[] {
		const parsed = this.parse(namespace);
		const ancestors: string[] = [];

		for (let i = 1; i < parsed.depth; i++) {
			const ancestorSegments = parsed.segments.slice(0, i);
			ancestors.push(ancestorSegments.join(":"));
		}

		return ancestors;
	}
}
