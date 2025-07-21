import { beforeEach, describe, expect, it } from "bun:test";
import {
	type DetectionContext,
	LanguageDetector,
} from "../../src/services/LanguageDetector";

describe("LanguageDetector", () => {
	let detector: LanguageDetector;

	beforeEach(() => {
		detector = new LanguageDetector();
	});

	describe("detect method", () => {
		it("should return CLI flag language when provided (highest precedence)", () => {
			const context: DetectionContext = {
				cliFlag: "fr",
				envVar: "es",
				posixLocale: "de_DE.UTF-8",
			};

			const result = detector.detect(context);
			expect(result).toBe("fr");
		});

		it("should return environment variable language when CLI flag is empty", () => {
			const context: DetectionContext = {
				cliFlag: "",
				envVar: "es",
				posixLocale: "de_DE.UTF-8",
			};

			const result = detector.detect(context);
			expect(result).toBe("es");
		});

		it("should return POSIX locale language when CLI flag and env var are empty", () => {
			const context: DetectionContext = {
				cliFlag: "",
				envVar: "",
				posixLocale: "de_DE.UTF-8",
			};

			const result = detector.detect(context);
			expect(result).toBe("de");
		});

		it("should return 'en' fallback when all sources are empty", () => {
			const context: DetectionContext = {
				cliFlag: "",
				envVar: "",
				posixLocale: "",
			};

			const result = detector.detect(context);
			expect(result).toBe("en");
		});

		it("should sanitize and validate language codes", () => {
			const context: DetectionContext = {
				cliFlag: "  FR  ", // Should be normalized to lowercase and trimmed
				envVar: "",
				posixLocale: "",
			};

			const result = detector.detect(context);
			expect(result).toBe("fr");
		});

		it("should skip invalid language codes and try next source", () => {
			const context: DetectionContext = {
				cliFlag: "invalid-language-code",
				envVar: "es",
				posixLocale: "",
			};

			const result = detector.detect(context);
			expect(result).toBe("es");
		});

		it("should handle complex POSIX locale formats", () => {
			const context: DetectionContext = {
				cliFlag: "",
				envVar: "",
				posixLocale: "pt_BR.UTF-8",
			};

			const result = detector.detect(context);
			expect(result).toBe("pt");
		});
	});

	describe("parseLocale method", () => {
		it("should parse standard POSIX locale formats", () => {
			expect(detector.parseLocale("en_US.UTF-8")).toBe("en");
			expect(detector.parseLocale("fr_FR.ISO-8859-1")).toBe("fr");
			expect(detector.parseLocale("de_DE")).toBe("de");
		});

		it("should parse ISO format locales", () => {
			expect(detector.parseLocale("en-US")).toBe("en");
			expect(detector.parseLocale("pt-BR")).toBe("pt");
		});

		it("should parse language-only codes", () => {
			expect(detector.parseLocale("fr")).toBe("fr");
			expect(detector.parseLocale("es")).toBe("es");
		});

		it("should handle locales with modifiers", () => {
			expect(detector.parseLocale("en_US.UTF-8@euro")).toBe("en");
			expect(detector.parseLocale("de_DE.UTF-8@currency=EUR")).toBe("de");
		});

		it("should throw error for empty locale string", () => {
			expect(() => detector.parseLocale("")).toThrow(
				"locale string cannot be empty",
			);
			expect(() => detector.parseLocale("   ")).toThrow(
				"locale string cannot be empty",
			);
		});

		it("should throw error for special locale names", () => {
			expect(() => detector.parseLocale("C")).toThrow(
				"special locale names 'C' and 'POSIX' are not supported",
			);
			expect(() => detector.parseLocale("POSIX")).toThrow(
				"special locale names 'C' and 'POSIX' are not supported",
			);
		});

		it("should throw error for invalid locale formats", () => {
			expect(() => detector.parseLocale("123")).toThrow(
				"invalid language code",
			);
			expect(() => detector.parseLocale("invalid-format-123")).toThrow(
				"invalid language code",
			);
		});
	});

	describe("sanitizeLanguageCode method", () => {
		it("should normalize case and trim whitespace", () => {
			expect(detector.sanitizeLanguageCode("  FR  ")).toBe("fr");
			expect(detector.sanitizeLanguageCode("EN")).toBe("en");
			expect(detector.sanitizeLanguageCode("es")).toBe("es");
		});

		it("should return empty string for invalid codes", () => {
			expect(detector.sanitizeLanguageCode("")).toBe("");
			expect(detector.sanitizeLanguageCode("123")).toBe("");
			expect(detector.sanitizeLanguageCode("invalid-code")).toBe("");
			expect(detector.sanitizeLanguageCode("x")).toBe(""); // Too short
			expect(detector.sanitizeLanguageCode("abcd")).toBe(""); // Too long
		});

		it("should accept valid 2-letter codes", () => {
			expect(detector.sanitizeLanguageCode("en")).toBe("en");
			expect(detector.sanitizeLanguageCode("fr")).toBe("fr");
		});

		it("should accept valid 3-letter codes", () => {
			expect(detector.sanitizeLanguageCode("deu")).toBe("deu");
			expect(detector.sanitizeLanguageCode("spa")).toBe("spa");
		});
	});

	describe("isValidLanguageCode method", () => {
		it("should accept valid 2-letter codes", () => {
			expect(detector.isValidLanguageCode("en")).toBe(true);
			expect(detector.isValidLanguageCode("fr")).toBe(true);
			expect(detector.isValidLanguageCode("de")).toBe(true);
		});

		it("should accept valid 3-letter codes", () => {
			expect(detector.isValidLanguageCode("deu")).toBe(true);
			expect(detector.isValidLanguageCode("fra")).toBe(true);
			expect(detector.isValidLanguageCode("spa")).toBe(true);
		});

		it("should reject codes that are too short or too long", () => {
			expect(detector.isValidLanguageCode("a")).toBe(false);
			expect(detector.isValidLanguageCode("abcd")).toBe(false);
			expect(detector.isValidLanguageCode("")).toBe(false);
		});

		it("should reject codes with non-letter characters", () => {
			expect(detector.isValidLanguageCode("e1")).toBe(false);
			expect(detector.isValidLanguageCode("en-")).toBe(false);
			expect(detector.isValidLanguageCode("e_n")).toBe(false);
			expect(detector.isValidLanguageCode("123")).toBe(false);
		});

		it("should reject codes with uppercase letters", () => {
			expect(detector.isValidLanguageCode("EN")).toBe(false);
			expect(detector.isValidLanguageCode("Fr")).toBe(false);
			expect(detector.isValidLanguageCode("DEU")).toBe(false);
		});
	});
});
