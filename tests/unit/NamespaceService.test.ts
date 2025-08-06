import { beforeEach, describe, expect, test } from "bun:test";
import {
	InvalidNamespaceSyntaxError,
	NamespaceValidationError,
} from "../../src/interfaces/INamespaceService.js";
import NamespaceService from "../../src/services/NamespaceService.js";

describe("NamespaceService", () => {
	let service: NamespaceService;

	beforeEach(() => {
		service = new NamespaceService();
	});

	describe("parse", () => {
		test("should parse colon-separated namespace", () => {
			const result = service.parse("frontend:component");

			expect(result.original).toBe("frontend:component");
			expect(result.segments).toEqual(["frontend", "component"]);
			expect(result.path).toBe("frontend/component");
			expect(result.depth).toBe(2);
		});

		test("should parse path-separated namespace", () => {
			const result = service.parse("backend/auth/jwt");

			expect(result.original).toBe("backend/auth/jwt");
			expect(result.segments).toEqual(["backend", "auth", "jwt"]);
			expect(result.path).toBe("backend/auth/jwt");
			expect(result.depth).toBe(3);
		});

		test("should parse single segment", () => {
			const result = service.parse("tools");

			expect(result.original).toBe("tools");
			expect(result.segments).toEqual(["tools"]);
			expect(result.path).toBe("tools");
			expect(result.depth).toBe(1);
		});

		test("should throw error for empty namespace", () => {
			expect(() => service.parse("")).toThrow(InvalidNamespaceSyntaxError);
			expect(() => service.parse("   ")).toThrow(InvalidNamespaceSyntaxError);
		});

		test("should filter out empty segments", () => {
			const result = service.parse("frontend::component");

			expect(result.segments).toEqual(["frontend", "component"]);
			expect(result.path).toBe("frontend/component");
		});
	});

	describe("validate", () => {
		test("should validate correct namespace", () => {
			expect(service.validate("frontend:component")).toBe(true);
			expect(service.validate("backend/auth/jwt")).toBe(true);
			expect(service.validate("tools")).toBe(true);
		});

		test("should return false for invalid namespace", () => {
			expect(service.validate("")).toBe(false);
			expect(service.validate("invalid@segment")).toBe(false);
		});

		test("should respect depth constraints", () => {
			const options = { maxDepth: 2, minDepth: 1 };

			expect(service.validate("tools", options)).toBe(true);
			expect(service.validate("frontend:component", options)).toBe(true);
			expect(service.validate("a:b:c:d", options)).toBe(false); // Too deep
		});
	});

	describe("validateStrict", () => {
		test("should throw detailed errors", () => {
			expect(() => service.validateStrict("")).toThrow(
				InvalidNamespaceSyntaxError,
			);

			const options = { maxDepth: 2, minDepth: 1 };
			expect(() => service.validateStrict("a:b:c:d", options)).toThrow(
				NamespaceValidationError,
			);
		});
	});

	describe("format conversion", () => {
		test("should convert to path format", () => {
			expect(service.toPath("frontend:component")).toBe("frontend/component");
			expect(service.toPath("backend:auth:jwt")).toBe("backend/auth/jwt");
		});

		test("should convert to colon-separated format", () => {
			expect(service.toColonSeparated("frontend/component")).toBe(
				"frontend:component",
			);
			expect(service.toColonSeparated("backend/auth/jwt")).toBe(
				"backend:auth:jwt",
			);
		});
	});

	describe("hierarchy operations", () => {
		test("should get parent namespace", () => {
			expect(service.getParent("frontend:component:button")).toBe(
				"frontend:component",
			);
			expect(service.getParent("frontend:component")).toBe("frontend");
			expect(service.getParent("frontend")).toBe(null);
		});

		test("should check parent relationship", () => {
			expect(service.isParentOf("frontend", "frontend:component")).toBe(true);
			expect(
				service.isParentOf("frontend:component", "frontend:component:button"),
			).toBe(true);
			expect(service.isParentOf("frontend", "backend:api")).toBe(false);
			expect(service.isParentOf("frontend:component", "frontend")).toBe(false);
		});

		test("should get ancestors", () => {
			expect(service.getAncestors("frontend:component:button")).toEqual([
				"frontend",
				"frontend:component",
			]);
			expect(service.getAncestors("frontend:component")).toEqual(["frontend"]);
			expect(service.getAncestors("frontend")).toEqual([]);
		});
	});
});
