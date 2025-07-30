import {
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	test,
} from "bun:test";
import type IHTTPClient from "../../src/interfaces/IHTTPClient.ts";
import {
	HTTPNetworkError,
	HTTPStatusError,
	HTTPTimeoutError,
} from "../../src/interfaces/IHTTPClient.ts";
import BunHTTPClient from "../../src/services/BunHTTPClient.ts";
import { startMockServer, stopMockServer } from "../helpers/mockHttpServer.ts";

describe("BunHTTPClient", () => {
	let httpClient: IHTTPClient;
	let server: { baseUrl: string };

	beforeAll(() => {
		server = startMockServer();
	});

	afterAll(async () => {
		await stopMockServer();
	});

	beforeEach(() => {
		httpClient = new BunHTTPClient();
	});

	describe("get method", () => {
		test("should perform successful GET request", async () => {
			const response = await httpClient.get(`${server.baseUrl}/get`);

			expect(response.status).toBe(200);
			expect(response.statusText).toBe("OK");
			expect(response.body).toBeTruthy();
			expect(response.url).toBe(`${server.baseUrl}/get`);
			expect(response.headers).toBeDefined();
			expect(typeof response.headers).toBe("object");
		});

		test("should handle custom headers in request", async () => {
			const headers = {
				"User-Agent": "claude-cmd/1.0",
				Accept: "application/json",
			};

			const response = await httpClient.get(`${server.baseUrl}/headers`, {
				headers,
			});

			expect(response.status).toBe(200);
			const responseBody = JSON.parse(response.body);
			expect(responseBody.headers["user-agent"]).toBe("claude-cmd/1.0");
			expect(responseBody.headers.accept).toBe("application/json");
		});

		test("should handle custom timeout configuration", async () => {
			const response = await httpClient.get(`${server.baseUrl}/get`, {
				timeout: 10000,
			});

			expect(response.status).toBe(200);
		});

		test("should return proper response headers as Record", async () => {
			const response = await httpClient.get(`${server.baseUrl}/get`);

			expect(response.headers).toBeDefined();
			expect(typeof response.headers).toBe("object");
			expect(response.headers["content-type"]).toBeDefined();
		});

		test("should handle empty response body", async () => {
			const response = await httpClient.get(`${server.baseUrl}/status/204`);

			expect(response.status).toBe(204);
			expect(response.body).toBe("");
		});

		test("should handle JSON response body", async () => {
			const response = await httpClient.get(`${server.baseUrl}/json`);

			expect(response.status).toBe(200);
			expect(response.body).toBeTruthy();
			expect(() => JSON.parse(response.body)).not.toThrow();
		});

		test("should handle text response body", async () => {
			const response = await httpClient.get(`${server.baseUrl}/html`);

			expect(response.status).toBe(200);
			expect(typeof response.body).toBe("string");
			expect(response.body).toContain("html");
		});
	});

	describe("error handling", () => {
		test("should throw HTTPTimeoutError on timeout", async () => {
			await expect(
				httpClient.get(`${server.baseUrl}/delay/10`, { timeout: 100 }),
			).rejects.toThrow(HTTPTimeoutError);
		});

		test("should throw HTTPNetworkError on network failure", async () => {
			await expect(
				httpClient.get("https://invalid-domain-that-does-not-exist-12345.com"),
			).rejects.toThrow(HTTPNetworkError);
		});

		test("should throw HTTPStatusError on 404 Not Found", async () => {
			await expect(
				httpClient.get(`${server.baseUrl}/status/404`),
			).rejects.toThrow(HTTPStatusError);
		});

		test("should throw HTTPStatusError on 500 Internal Server Error", async () => {
			await expect(
				httpClient.get(`${server.baseUrl}/status/500`),
			).rejects.toThrow(HTTPStatusError);
		});

		test("should include status code in HTTPStatusError", async () => {
			try {
				await httpClient.get(`${server.baseUrl}/status/404`);
			} catch (error) {
				expect(error).toBeInstanceOf(HTTPStatusError);
				expect((error as HTTPStatusError).status).toBe(404);
				expect((error as HTTPStatusError).statusText).toBe("Not Found");
			}
		});

		test("should include URL in all error types", async () => {
			const url = `${server.baseUrl}/status/404`;

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
			const response = await httpClient.get(`${server.baseUrl}/get`);
			expect(response.status).toBe(200);
		});

		test("should respect custom timeout values", async () => {
			await expect(
				httpClient.get(`${server.baseUrl}/delay/2`, { timeout: 50 }),
			).rejects.toThrow(HTTPTimeoutError);
		});

		test("should include timeout value in timeout error message", async () => {
			const timeout = 100;

			try {
				await httpClient.get(`${server.baseUrl}/delay/5`, { timeout });
			} catch (error) {
				expect(error).toBeInstanceOf(HTTPTimeoutError);
				expect((error as HTTPTimeoutError).message).toContain(`${timeout}ms`);
				expect((error as HTTPTimeoutError).timeout).toBe(timeout);
			}
		});
	});

	describe("response format", () => {
		test("should return all required response fields", async () => {
			const response = await httpClient.get(`${server.baseUrl}/get`);

			expect(response).toHaveProperty("status");
			expect(response).toHaveProperty("statusText");
			expect(response).toHaveProperty("headers");
			expect(response).toHaveProperty("body");
			expect(response).toHaveProperty("url");
		});

		test("should preserve final URL after redirects", async () => {
			const response = await httpClient.get(`${server.baseUrl}/redirect/1`);

			expect(response.status).toBe(200);
			expect(response.url).toBe(`${server.baseUrl}/get`);
		});
	});

	describe("header handling", () => {
		test("should handle case-insensitive response headers", async () => {
			const response = await httpClient.get(`${server.baseUrl}/get`);

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

			const response = await httpClient.get(`${server.baseUrl}/headers`, {
				headers,
			});

			expect(response.status).toBe(200);
			const responseBody = JSON.parse(response.body);
			expect(responseBody.headers.authorization).toBe("Bearer token123");
			expect(responseBody.headers["content-type"]).toBe("application/json");
		});

		test("should filter out headers with CRLF characters", async () => {
			const maliciousHeaders = {
				"User-Agent": "MyApp\r\nX-Admin: true",
				Authorization: "Bearer token\nSet-Cookie: evil=true",
				"Valid-Header": "ValidValue",
				"\r\nMalicious-Key": "value",
			};

			// BunHTTPClient proactively filters CRLF headers for security
			const response = await httpClient.get(`${server.baseUrl}/headers`, {
				headers: maliciousHeaders,
			});

			expect(response.status).toBe(200);
			const responseBody = JSON.parse(response.body);

			// Malicious headers should be filtered out by BunHTTPClient
			// User-Agent with CRLF was filtered, Bun adds its default user-agent
			expect(responseBody.headers["user-agent"]).toBe("Bun/1.2.18");
			expect(responseBody.headers.authorization).toBeUndefined();
			expect(responseBody.headers["malicious-key"]).toBeUndefined();

			// Valid header should be preserved
			expect(responseBody.headers["valid-header"]).toBe("ValidValue");
		});
	});

	describe("HTTP methods and options", () => {
		test("should handle GET requests with query parameters", async () => {
			const response = await httpClient.get(`${server.baseUrl}/get?test=123`);

			expect(response.status).toBe(200);
			const responseBody = JSON.parse(response.body);
			expect(responseBody.args.test).toBe("123");
		});

		test("should handle different content types", async () => {
			const xmlResponse = await httpClient.get(`${server.baseUrl}/xml`);
			expect(xmlResponse.status).toBe(200);
			expect(xmlResponse.body).toContain("<?xml");

			const jsonResponse = await httpClient.get(`${server.baseUrl}/json`);
			expect(jsonResponse.status).toBe(200);
			expect(() => JSON.parse(jsonResponse.body)).not.toThrow();
		});
	});

	describe("edge cases", () => {
		test("should handle very long URLs", async () => {
			const longPath = "a".repeat(100);
			const response = await httpClient.get(
				`${server.baseUrl}/get?long=${longPath}`,
			);

			expect(response.status).toBe(200);
		});

		test("should handle special characters in URLs", async () => {
			const response = await httpClient.get(
				`${server.baseUrl}/get?special=%20%21%40%23`,
			);

			expect(response.status).toBe(200);
		});

		test("should handle multiple headers with same name", async () => {
			const response = await httpClient.get(`${server.baseUrl}/get`);

			expect(response.status).toBe(200);
			expect(response.headers).toBeDefined();
		});
	});
});
