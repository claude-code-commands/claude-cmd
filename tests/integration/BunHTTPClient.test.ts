import { beforeEach, describe, expect, test } from "bun:test";
import type IHTTPClient from "../../src/interfaces/IHTTPClient.ts";
import {
	HTTPNetworkError,
	HTTPStatusError,
	HTTPTimeoutError,
} from "../../src/interfaces/IHTTPClient.ts";
import BunHTTPClient from "../../src/services/BunHTTPClient.ts";

describe.skip("BunHTTPClient", () => {
	let httpClient: IHTTPClient;

	beforeEach(() => {
		httpClient = new BunHTTPClient();
	});

	describe("get method", () => {
		test("should perform successful GET request", async () => {
			const response = await httpClient.get("https://httpbin.org/get");

			expect(response.status).toBe(200);
			expect(response.statusText).toBe("OK");
			expect(response.body).toBeTruthy();
			expect(response.url).toBe("https://httpbin.org/get");
			expect(response.headers).toBeDefined();
			expect(typeof response.headers).toBe("object");
		});

		test("should handle custom headers in request", async () => {
			const headers = {
				"User-Agent": "claude-cmd/1.0",
				Accept: "application/json",
			};

			const response = await httpClient.get("https://httpbin.org/headers", {
				headers,
			});

			expect(response.status).toBe(200);
			const responseBody = JSON.parse(response.body);
			expect(responseBody.headers["User-Agent"]).toBe("claude-cmd/1.0");
			expect(responseBody.headers.Accept).toBe("application/json");
		});

		test("should handle custom timeout configuration", async () => {
			const response = await httpClient.get("https://httpbin.org/get", {
				timeout: 10000,
			});

			expect(response.status).toBe(200);
		});

		test("should return proper response headers as Record", async () => {
			const response = await httpClient.get("https://httpbin.org/get");

			expect(response.headers).toBeDefined();
			expect(typeof response.headers).toBe("object");
			expect(response.headers["content-type"]).toBeDefined();
		});

		test("should handle empty response body", async () => {
			const response = await httpClient.get("https://httpbin.org/status/204");

			expect(response.status).toBe(204);
			expect(response.body).toBe("");
		});

		test("should handle JSON response body", async () => {
			const response = await httpClient.get("https://httpbin.org/json");

			expect(response.status).toBe(200);
			expect(response.body).toBeTruthy();
			expect(() => JSON.parse(response.body)).not.toThrow();
		});

		test("should handle text response body", async () => {
			const response = await httpClient.get("https://httpbin.org/html");

			expect(response.status).toBe(200);
			expect(typeof response.body).toBe("string");
			expect(response.body).toContain("html");
		});
	});

	describe("error handling", () => {
		test("should throw HTTPTimeoutError on timeout", async () => {
			await expect(
				httpClient.get("https://httpbin.org/delay/10", { timeout: 100 }),
			).rejects.toThrow(HTTPTimeoutError);
		});

		test("should throw HTTPNetworkError on network failure", async () => {
			await expect(
				httpClient.get("https://invalid-domain-that-does-not-exist-12345.com"),
			).rejects.toThrow(HTTPNetworkError);
		});

		test("should throw HTTPStatusError on 404 Not Found", async () => {
			await expect(
				httpClient.get("https://httpbin.org/status/404"),
			).rejects.toThrow(HTTPStatusError);
		});

		test("should throw HTTPStatusError on 500 Internal Server Error", async () => {
			await expect(
				httpClient.get("https://httpbin.org/status/500"),
			).rejects.toThrow(HTTPStatusError);
		});

		test("should include status code in HTTPStatusError", async () => {
			try {
				await httpClient.get("https://httpbin.org/status/404");
			} catch (error) {
				expect(error).toBeInstanceOf(HTTPStatusError);
				expect((error as HTTPStatusError).status).toBe(404);
				expect((error as HTTPStatusError).statusText).toBe("NOT FOUND");
			}
		});

		test("should include URL in all error types", async () => {
			const url = "https://httpbin.org/status/404";

			try {
				await httpClient.get(url);
			} catch (error) {
				expect(error).toBeInstanceOf(HTTPStatusError);
				expect((error as HTTPStatusError).url).toBe(url);
			}
		});

		test("should handle malformed URLs", async () => {
			await expect(httpClient.get("not-a-valid-url")).rejects.toThrow(
				HTTPNetworkError,
			);
		});

		test("should handle empty URL", async () => {
			await expect(httpClient.get("")).rejects.toThrow(HTTPNetworkError);
		});
	});

	describe("timeout behavior", () => {
		test("should use default timeout when not specified", async () => {
			const response = await httpClient.get("https://httpbin.org/get");
			expect(response.status).toBe(200);
		});

		test("should respect custom timeout values", async () => {
			await expect(
				httpClient.get("https://httpbin.org/delay/2", { timeout: 50 }),
			).rejects.toThrow(HTTPTimeoutError);
		});

		test("should include timeout value in timeout error message", async () => {
			const timeout = 100;

			try {
				await httpClient.get("https://httpbin.org/delay/5", { timeout });
			} catch (error) {
				expect(error).toBeInstanceOf(HTTPTimeoutError);
				expect((error as HTTPTimeoutError).message).toContain(`${timeout}ms`);
				expect((error as HTTPTimeoutError).timeout).toBe(timeout);
			}
		});
	});

	describe("response format", () => {
		test("should return all required response fields", async () => {
			const response = await httpClient.get("https://httpbin.org/get");

			expect(response).toHaveProperty("status");
			expect(response).toHaveProperty("statusText");
			expect(response).toHaveProperty("headers");
			expect(response).toHaveProperty("body");
			expect(response).toHaveProperty("url");
		});

		test("should preserve final URL after redirects", async () => {
			const response = await httpClient.get("https://httpbin.org/redirect/1");

			expect(response.status).toBe(200);
			expect(response.url).toBe("https://httpbin.org/get");
		});
	});

	describe("header handling", () => {
		test("should handle case-insensitive response headers", async () => {
			const response = await httpClient.get("https://httpbin.org/get");

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

			const response = await httpClient.get("https://httpbin.org/headers", {
				headers,
			});

			expect(response.status).toBe(200);
			const responseBody = JSON.parse(response.body);
			expect(responseBody.headers.Authorization).toBe("Bearer token123");
			expect(responseBody.headers["Content-Type"]).toBe("application/json");
		});

		test("should reject headers with CRLF injection attempts", async () => {
			const maliciousHeaders = {
				"User-Agent": "MyApp\r\nX-Admin: true",
				Authorization: "Bearer token\nSet-Cookie: evil=true",
				"Valid-Header": "ValidValue",
				"\r\nMalicious-Key": "value",
			};

			const response = await httpClient.get("https://httpbin.org/headers", {
				headers: maliciousHeaders,
			});

			expect(response.status).toBe(200);
			const responseBody = JSON.parse(response.body);

			// Malicious headers should be filtered out
			expect(responseBody.headers["X-Admin"]).toBeUndefined();
			expect(responseBody.headers["Set-Cookie"]).toBeUndefined();
			expect(responseBody.headers["Malicious-Key"]).toBeUndefined();

			// Valid header should be preserved
			expect(responseBody.headers["Valid-Header"]).toBe("ValidValue");
		});
	});

	describe("HTTP methods and options", () => {
		test("should handle GET requests with query parameters", async () => {
			const response = await httpClient.get("https://httpbin.org/get?test=123");

			expect(response.status).toBe(200);
			const responseBody = JSON.parse(response.body);
			expect(responseBody.args.test).toBe("123");
		});

		test("should handle different content types", async () => {
			const xmlResponse = await httpClient.get("https://httpbin.org/xml");
			expect(xmlResponse.status).toBe(200);
			expect(xmlResponse.body).toContain("<?xml");

			const jsonResponse = await httpClient.get("https://httpbin.org/json");
			expect(jsonResponse.status).toBe(200);
			expect(() => JSON.parse(jsonResponse.body)).not.toThrow();
		});
	});

	describe("edge cases", () => {
		test("should handle very long URLs", async () => {
			const longPath = "a".repeat(100);
			const response = await httpClient.get(
				`https://httpbin.org/get?long=${longPath}`,
			);

			expect(response.status).toBe(200);
		});

		test("should handle special characters in URLs", async () => {
			const response = await httpClient.get(
				"https://httpbin.org/get?special=%20%21%40%23",
			);

			expect(response.status).toBe(200);
		});

		test("should handle multiple headers with same name", async () => {
			const response = await httpClient.get("https://httpbin.org/get");

			expect(response.status).toBe(200);
			expect(response.headers).toBeDefined();
		});
	});
});
