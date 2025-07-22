import type { Manifest } from "../types/Command.js";
import { ManifestError } from "../types/Command.js";

/**
 * Field validation schema for manifest and command objects
 */
interface FieldSchema {
	/** Field name */
	readonly name: string;
	/** Expected type(s) - string types or 'array' for array validation */
	readonly type: string | string[];
	/** Whether this field is required */
	readonly required: boolean;
	/** Custom validation function (optional) */
	readonly validator?: (value: any) => boolean;
}

/**
 * Parser for command repository manifest files
 *
 * Handles parsing and validation of the index.json manifest format used by
 * the Claude command repository. Provides comprehensive validation and error
 * recovery for malformed manifest data with DRY validation patterns.
 */
export default class ManifestParser {
	/** Schema for top-level manifest fields */
	private static readonly MANIFEST_SCHEMA: ReadonlyArray<FieldSchema> = [
		{ name: "version", type: "string", required: true },
		{ name: "updated", type: "string", required: true },
		{ name: "commands", type: "array", required: true },
	];

	/** Schema for command fields */
	private static readonly COMMAND_SCHEMA: ReadonlyArray<FieldSchema> = [
		{ name: "name", type: "string", required: true },
		{ name: "description", type: "string", required: true },
		{ name: "file", type: "string", required: true },
		{
			name: "allowed-tools",
			type: ["array", "string"],
			required: true,
			validator: (value: any) => {
				if (typeof value === "string") return true;
				if (Array.isArray(value))
					return value.every((tool) => typeof tool === "string");
				return false;
			},
		},
	];

	/**
	 * Parse raw JSON string into a validated Manifest object
	 *
	 * @param jsonString - Raw JSON string from repository
	 * @param language - Language code for error reporting
	 * @returns Validated manifest object
	 * @throws ManifestError for invalid JSON or validation failures
	 */
	parseManifest(jsonString: string, language: string): Manifest {
		// 1. Parse JSON
		const rawData = this.parseJSON(jsonString, language);

		// 2. Validate structure and create manifest
		this.validateObjectStructure(
			rawData,
			language,
			ManifestParser.MANIFEST_SCHEMA,
		);

		// 3. Validate commands array
		this.validateCommandsArray(rawData.commands, language);

		// 4. Return validated manifest
		return this.createValidatedManifest(rawData);
	}

	/**
	 * Parse JSON string with error handling
	 */
	private parseJSON(jsonString: string, language: string): any {
		try {
			const rawData = JSON.parse(jsonString);

			// Basic structure validation
			if (
				rawData === null ||
				typeof rawData !== "object" ||
				Array.isArray(rawData)
			) {
				throw new ManifestError(language, "Manifest must be an object");
			}

			return rawData;
		} catch (error) {
			if (error instanceof ManifestError) {
				throw error;
			}
			throw new ManifestError(language, "Invalid JSON format");
		}
	}

	/**
	 * Generic validation method using field schema
	 */
	private validateObjectStructure(
		obj: any,
		language: string,
		schema: ReadonlyArray<FieldSchema>,
		prefix = "",
	): void {
		for (const field of schema) {
			// Check required fields
			if (field.required && !(field.name in obj)) {
				const errorMessage = prefix
					? `${prefix} Missing required field: ${field.name}`
					: `Missing required field: ${field.name}`;
				throw new ManifestError(language, errorMessage);
			}

			// Skip validation if field is optional and missing
			if (!field.required && !(field.name in obj)) {
				continue;
			}

			const value = obj[field.name];

			// Type validation
			this.validateFieldType(value, field, language, prefix);

			// Custom validation for allowed-tools array content
			if (field.validator && !field.validator(value)) {
				if (field.name === "allowed-tools" && Array.isArray(value)) {
					const errorMessage = prefix
						? `${prefix} Invalid allowed-tools array: all elements must be strings`
						: "Invalid allowed-tools array: all elements must be strings";
					throw new ManifestError(language, errorMessage);
				}
				throw new ManifestError(
					language,
					`${prefix}Invalid field value: ${field.name}`,
				);
			}
		}
	}

	/**
	 * Validate field type against schema
	 */
	private validateFieldType(
		value: any,
		field: FieldSchema,
		language: string,
		prefix: string,
	): void {
		const types = Array.isArray(field.type) ? field.type : [field.type];
		const isValid = types.some((expectedType) => {
			switch (expectedType) {
				case "string":
					return typeof value === "string";
				case "array":
					return Array.isArray(value);
				case "object":
					return (
						value !== null && typeof value === "object" && !Array.isArray(value)
					);
				default:
					return typeof value === expectedType;
			}
		});

		if (!isValid) {
			const expectedTypesStr =
				types.length === 1 ? types[0] : types.join(" or ");

			const errorMessage = prefix
				? `${prefix} Invalid field type: ${field.name} must be ${expectedTypesStr}`
				: `Invalid field type: ${field.name} must be ${expectedTypesStr}`;

			throw new ManifestError(language, errorMessage);
		}
	}

	/**
	 * Validate commands array using schema
	 */
	private validateCommandsArray(commands: any[], language: string): void {
		for (let i = 0; i < commands.length; i++) {
			const prefix = `Command at index ${i}:`;
			this.validateObjectStructure(
				commands[i],
				language,
				ManifestParser.COMMAND_SCHEMA,
				prefix,
			);
		}
	}

	/**
	 * Create validated manifest object
	 */
	private createValidatedManifest(rawData: any): Manifest {
		return {
			version: rawData.version,
			updated: rawData.updated,
			commands: rawData.commands.map((cmd: any) => ({
				name: cmd.name,
				description: cmd.description,
				file: cmd.file,
				"allowed-tools": cmd["allowed-tools"],
			})),
		};
	}

	/**
	 * Validate that a parsed object conforms to the Manifest interface
	 *
	 * @param data - Object to validate
	 * @returns true if valid, false otherwise
	 */
	validateManifest(data: any): data is Manifest {
		try {
			// Reuse the same validation logic but catch errors instead of throwing
			this.validateObjectStructure(
				data,
				"validation",
				ManifestParser.MANIFEST_SCHEMA,
			);

			// Validate commands array
			if (Array.isArray(data.commands)) {
				this.validateCommandsArray(data.commands, "validation");
			}

			return true;
		} catch {
			return false;
		}
	}
}
