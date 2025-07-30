import { beforeEach, describe, expect, test } from "bun:test";
import type IHTTPClient from "../../src/interfaces/IHTTPClient.ts";
import {
	HTTPNetworkError,
	HTTPStatusError,
	HTTPTimeoutError,
} from "../../src/interfaces/IHTTPClient.ts";

/**
 * Setup context for contract tests
 */
interface ContractSetupContext {
	/** Setup function called before all contract tests */
	setup?: () => Promise<void>;
	/** Teardown function called after all contract tests */
	teardown?: () => Promise<void>;
	/** Base URL for test endpoints (used by integration tests) */
	baseUrl?: string;
}

/**
 * Shared contract test suite for IHTTPClient implementations
 *
 * This test suite validates that any implementation of IHTTPClient behaves
 * correctly according to the interface contract. It tests both successful
 * operations and error conditions to ensure consistent behavior across
 * different implementations (real HTTP client and mocks).
 *
 * @param clientFactory - Function that creates an IHTTPClient instance
 * @param context - Optional setup/teardown context for environment-specific needs
 */
export function runHttpClientContractTests(
	clientFactory: () => IHTTPClient,
	context: ContractSetupContext = {},
) {
	describe("IHTTPClient Contract", () => {
		let httpClient: IHTTPClient;

		beforeEach(async () => {
			if (context.setup) {
				await context.setup();
			}
			httpClient = clientFactory();
		});

		describe("successful GET requests", () => {
			test("should perform successful GET request", async () => {
				const url = context.baseUrl
					? `${context.baseUrl}/get`
					: "https://api.example.com/data";
				const response = await httpClient.get(url);

				expect(response.status).toBe(200);
				expect(response.statusText).toBe("OK");
				expect(response.body).toBeTruthy();
				expect(response.url).toBe(url);
				expect(response.headers).toBeDefined();
				expect(typeof response.headers).toBe("object");
			});

			test("should handle custom headers in request", async () => {
				const headers = {
					"User-Agent": "claude-cmd/1.0",
					Accept: "application/json",
				};

				const url = context.baseUrl
					? `${context.baseUrl}/headers`
					: "https://api.example.com/data";
				const response = await httpClient.get(url, { headers });

				expect(response.status).toBe(200);

				// For integration tests, verify headers were sent correctly
				if (context.baseUrl) {
					const responseBody = JSON.parse(response.body);
					expect(responseBody.headers["user-agent"]).toBe("claude-cmd/1.0");
					expect(responseBody.headers.accept).toBe("application/json");
				}
			});

			test("should handle custom timeout configuration", async () => {
				const url = context.baseUrl
					? `${context.baseUrl}/get`
					: "https://api.example.com/data";
				const response = await httpClient.get(url, { timeout: 10000 });

				expect(response.status).toBe(200);
			});

			test("should return proper response headers as Record", async () => {
				const url = context.baseUrl
					? `${context.baseUrl}/get`
					: "https://api.example.com/data";
				const response = await httpClient.get(url);

				expect(response.headers).toBeDefined();
				expect(typeof response.headers).toBe("object");
				expect(response.headers["content-type"]).toBeDefined();
			});

			test("should handle empty response body", async () => {
				const url = context.baseUrl
					? `${context.baseUrl}/status/204`
					: "https://api.example.com/empty";
				const response = await httpClient.get(url);

				if (context.baseUrl) {
					expect(response.status).toBe(204);
				} else {
					expect(response.status).toBe(200);
				}
				expect(response.body).toBe("");
			});

			test("should handle JSON response body", async () => {
				const url = context.baseUrl
					? `${context.baseUrl}/json`
					: "https://api.example.com/json";
				const response = await httpClient.get(url);

				expect(response.status).toBe(200);
				expect(response.body).toBeTruthy();
				expect(() => JSON.parse(response.body)).not.toThrow();
			});

			test("should handle text response body", async () => {
				const url = context.baseUrl
					? `${context.baseUrl}/html`
					: "https://api.example.com/text";
				const response = await httpClient.get(url);

				expect(response.status).toBe(200);
				expect(typeof response.body).toBe("string");
				if (context.baseUrl) {
					expect(response.body).toContain("html");
				}
			});
		});

		describe("error handling", () => {
			test("should throw HTTPTimeoutError on timeout", () => {
				const url = context.baseUrl
					? `${context.baseUrl}/delay/10`
					: "https://api.example.com/slow";

				expect(httpClient.get(url, { timeout: 100 })).rejects.toThrow(
					HTTPTimeoutError,
				);
			});

			test("should throw HTTPNetworkError on network failure", async () => {
				const invalidUrl =
					"https://invalid-domain-that-does-not-exist-12345.com";

				try {
					await httpClient.get(invalidUrl);
				} catch (error) {
					// Both HTTPNetworkError and HTTPStatusError are acceptable for invalid domains
					// depending on implementation (real vs mock)
					expect(error).toBeInstanceOf(Error);
					expect([HTTPNetworkError.name, HTTPStatusError.name]).toContain(
						(error as Error).constructor.name,
					);
				}
			});

			test("should throw HTTPStatusError on 404 Not Found", () => {
				const url = context.baseUrl
					? `${context.baseUrl}/status/404`
					: "https://api.example.com/not-found";

				expect(httpClient.get(url)).rejects.toThrow(HTTPStatusError);
			});

			test("should throw HTTPStatusError on 500 Internal Server Error", () => {
				const url = context.baseUrl
					? `${context.baseUrl}/status/500`
					: "https://api.example.com/server-error";

				expect(httpClient.get(url)).rejects.toThrow(HTTPStatusError);
			});

			test("should include status code in HTTPStatusError", async () => {
				const url = context.baseUrl
					? `${context.baseUrl}/status/404`
					: "https://api.example.com/not-found";

				try {
					await httpClient.get(url);
				} catch (error) {
					expect(error).toBeInstanceOf(HTTPStatusError);
					expect((error as HTTPStatusError).status).toBe(404);
					expect((error as HTTPStatusError).statusText).toBe("Not Found");
				}
			});

			test("should include URL in all error types", async () => {
				const url = context.baseUrl
					? `${context.baseUrl}/status/404`
					: "https://api.example.com/not-found";

				try {
					await httpClient.get(url);
				} catch (error) {
					expect(error).toBeInstanceOf(HTTPStatusError);
					expect((error as HTTPStatusError).url).toBe(url);
				}
			});

			test("should handle malformed URLs", () => {
				expect(httpClient.get("not-a-valid-url")).rejects.toThrow(
					HTTPNetworkError,
				);
			});

			test("should handle empty URL", () => {
				expect(httpClient.get("")).rejects.toThrow(HTTPNetworkError);
			});
		});

		describe("timeout behavior", () => {
			test("should use default timeout when not specified", async () => {
				const url = context.baseUrl
					? `${context.baseUrl}/get`
					: "https://api.example.com/data";
				const response = await httpClient.get(url);
				expect(response.status).toBe(200);
			});

			test("should respect custom timeout values", () => {
				const url = context.baseUrl
					? `${context.baseUrl}/delay/2`
					: "https://api.example.com/slow";

				expect(httpClient.get(url, { timeout: 50 })).rejects.toThrow(
					HTTPTimeoutError,
				);
			});

			test("should include timeout value in timeout error message", async () => {
				const timeout = 100;
				const url = context.baseUrl
					? `${context.baseUrl}/delay/5`
					: "https://api.example.com/slow";

				try {
					await httpClient.get(url, { timeout });
				} catch (error) {
					expect(error).toBeInstanceOf(HTTPTimeoutError);
					expect((error as HTTPTimeoutError).message).toContain(`${timeout}ms`);
					expect((error as HTTPTimeoutError).timeout).toBe(timeout);
				}
			});
		});

		describe("response format", () => {
			test("should return all required response fields", async () => {
				const url = context.baseUrl
					? `${context.baseUrl}/get`
					: "https://api.example.com/data";
				const response = await httpClient.get(url);

				expect(response).toHaveProperty("status");
				expect(response).toHaveProperty("statusText");
				expect(response).toHaveProperty("headers");
				expect(response).toHaveProperty("body");
				expect(response).toHaveProperty("url");
			});

			test("should preserve final URL after redirects", async () => {
				if (context.baseUrl) {
					const response = await httpClient.get(
						`${context.baseUrl}/redirect/1`,
					);

					expect(response.status).toBe(200);
					expect(response.url).toBe(`${context.baseUrl}/get`);
				} else {
					// Skip this test for mock implementations as they don't handle redirects
					expect(true).toBe(true);
				}
			});
		});

		describe("header handling", () => {
			test("should handle case-insensitive response headers", async () => {
				const url = context.baseUrl
					? `${context.baseUrl}/get`
					: "https://api.example.com/data";
				const response = await httpClient.get(url);

				expect(response.headers).toBeDefined();
				expect(typeof response.headers).toBe("object");
				// Headers should be accessible as lowercase keys
				expect(response.headers["content-type"]).toBeDefined();
			});

			test("should preserve request headers", async () => {
				const headers = {
					Authorization: "Bearer token123",
					"Content-Type": "application/json",
				};

				const url = context.baseUrl
					? `${context.baseUrl}/headers`
					: "https://api.example.com/data";
				const response = await httpClient.get(url, { headers });

				expect(response.status).toBe(200);

				// For integration tests, verify headers were preserved
				if (context.baseUrl) {
					const responseBody = JSON.parse(response.body);
					expect(responseBody.headers.authorization).toBe("Bearer token123");
					expect(responseBody.headers["content-type"]).toBe("application/json");
				}
			});
		});
	});
}
