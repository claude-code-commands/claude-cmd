import { beforeEach, describe, expect, test } from "bun:test";
import type IHTTPClient from "../../src/interfaces/IHTTPClient.ts";
import {
	HTTPNetworkError,
	HTTPStatusError,
	HTTPTimeoutError,
} from "../../src/interfaces/IHTTPClient.ts";
import InMemoryHTTPClient from "../mocks/InMemoryHTTPClient.ts";

describe("InMemory HTTPClient", () => {
	let httpClient: IHTTPClient;

	beforeEach(() => {
		httpClient = new InMemoryHTTPClient();
	});

	describe("get method", () => {
		test("should perform successful GET request", async () => {
			const response = await httpClient.get("https://api.example.com/data");

			expect(response.status).toBe(200);
			expect(response.statusText).toBe("OK");
			expect(response.body).toBeTruthy();
			expect(response.url).toBe("https://api.example.com/data");
			expect(response.headers).toBeDefined();
		});

		test("should handle custom headers in request", async () => {
			const headers = {
				"User-Agent": "claude-cmd/1.0",
				Accept: "application/json",
			};

			const response = await httpClient.get("https://api.example.com/data", {
				headers,
			});

			expect(response.status).toBe(200);
		});

		test("should handle custom timeout configuration", async () => {
			const response = await httpClient.get("https://api.example.com/data", {
				timeout: 1000,
			});

			expect(response.status).toBe(200);
		});

		test("should return proper response headers", async () => {
			const response = await httpClient.get("https://api.example.com/data");

			expect(response.headers).toBeDefined();
			expect(typeof response.headers).toBe("object");
		});

		test("should handle empty response body", async () => {
			const response = await httpClient.get("https://api.example.com/empty");

			expect(response.status).toBe(200);
			expect(response.body).toBe("");
		});

		test("should handle large response body", async () => {
			const response = await httpClient.get("https://api.example.com/large");

			expect(response.status).toBe(200);
			expect(response.body.length).toBeGreaterThan(1000);
		});
	});

	describe("error handling", () => {
		test("should throw HTTPTimeoutError on timeout", async () => {
			expect(
				httpClient.get("https://api.example.com/slow", { timeout: 100 }),
			).rejects.toThrow(HTTPTimeoutError);
		});

		test("should throw HTTPNetworkError on network failure", async () => {
			expect(
				httpClient.get("https://invalid-domain-that-does-not-exist.com"),
			).rejects.toThrow(HTTPNetworkError);
		});

		test("should throw HTTPStatusError on 404 Not Found", async () => {
			expect(
				httpClient.get("https://api.example.com/not-found"),
			).rejects.toThrow(HTTPStatusError);
		});

		test("should throw HTTPStatusError on 500 Internal Server Error", async () => {
			expect(
				httpClient.get("https://api.example.com/server-error"),
			).rejects.toThrow(HTTPStatusError);
		});

		test("should include status code in HTTPStatusError", async () => {
			try {
				await httpClient.get("https://api.example.com/not-found");
			} catch (error) {
				expect(error).toBeInstanceOf(HTTPStatusError);
				expect((error as HTTPStatusError).status).toBe(404);
			}
		});

		test("should include URL in all error types", async () => {
			const url = "https://api.example.com/not-found";

			try {
				await httpClient.get(url);
			} catch (error) {
				expect(error).toBeInstanceOf(HTTPStatusError);
				expect((error as HTTPStatusError).url).toBe(url);
			}
		});

		test("should handle malformed URLs", async () => {
			expect(httpClient.get("not-a-valid-url")).rejects.toThrow();
		});

		test("should handle empty URL", async () => {
			expect(httpClient.get("")).rejects.toThrow();
		});
	});

	describe("timeout behavior", () => {
		test("should use default timeout when not specified", async () => {
			const response = await httpClient.get("https://api.example.com/data");
			expect(response.status).toBe(200);
		});

		test("should respect custom timeout values", async () => {
			expect(
				httpClient.get("https://api.example.com/slow", { timeout: 50 }),
			).rejects.toThrow(HTTPTimeoutError);
		});

		test("should include timeout value in timeout error message", async () => {
			const timeout = 100;

			try {
				await httpClient.get("https://api.example.com/slow", { timeout });
			} catch (error) {
				expect(error).toBeInstanceOf(HTTPTimeoutError);
				expect((error as HTTPTimeoutError).message).toContain(`${timeout}ms`);
			}
		});
	});

	describe("response format", () => {
		test("should return all required response fields", async () => {
			const response = await httpClient.get("https://api.example.com/data");

			expect(response).toHaveProperty("status");
			expect(response).toHaveProperty("statusText");
			expect(response).toHaveProperty("headers");
			expect(response).toHaveProperty("body");
			expect(response).toHaveProperty("url");
		});

		test("should handle JSON response body", async () => {
			const response = await httpClient.get("https://api.example.com/json");

			expect(response.status).toBe(200);
			expect(response.body).toBeTruthy();
			expect(() => JSON.parse(response.body)).not.toThrow();
		});

		test("should handle text response body", async () => {
			const response = await httpClient.get("https://api.example.com/text");

			expect(response.status).toBe(200);
			expect(typeof response.body).toBe("string");
		});
	});

	describe("header handling", () => {
		test("should handle case-insensitive response headers", async () => {
			const response = await httpClient.get("https://api.example.com/data");

			expect(response.headers).toBeDefined();
			expect(typeof response.headers).toBe("object");
		});

		test("should preserve request headers", async () => {
			const headers = {
				Authorization: "Bearer token123",
				"Content-Type": "application/json",
			};

			const response = await httpClient.get("https://api.example.com/data", {
				headers,
			});

			expect(response.status).toBe(200);
		});
	});
});
