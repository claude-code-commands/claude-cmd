import { beforeEach, describe, expect, test } from "bun:test";
import {
	HTTPNetworkError,
	HTTPStatusError,
	HTTPTimeoutError,
} from "../../src/interfaces/IHTTPClient.ts";
import InMemoryHTTPClient from "../mocks/InMemoryHTTPClient.ts";
import { runHttpClientContractTests } from "../shared/IHTTPClient.contract.ts";

describe("InMemoryHTTPClient", () => {
	// Run the shared contract tests for InMemoryHTTPClient
	describe("Contract Tests", () => {
		runHttpClientContractTests(() => new InMemoryHTTPClient());
	});

	// InMemoryHTTPClient-specific tests for mock functionality
	describe("InMemoryHTTPClient Specific Tests", () => {
		let client: InMemoryHTTPClient;

		beforeEach(() => {
			client = new InMemoryHTTPClient();
		});

		describe("setResponseWithMatcher method", () => {
			test("should support exact string matching (backward compatibility)", async () => {
				const testResponse = {
					status: 201,
					statusText: "Created",
					headers: { "content-type": "application/json" },
					body: '{"test": true}',
					url: "https://test.example.com/exact",
				};

				client.setResponseWithMatcher(
					"https://test.example.com/exact",
					testResponse,
				);
				const response = await client.get("https://test.example.com/exact");

				expect(response.status).toBe(201);
				expect(response.body).toBe('{"test": true}');
			});

			test("should support RegExp matching", async () => {
				const testResponse = {
					status: 200,
					statusText: "OK",
					headers: { "content-type": "text/markdown" },
					body: "# Test Command",
					url: "https://example.com/test.md",
				};

				client.setResponseWithMatcher(/\.md$/, testResponse);

				const response1 = await client.get("https://example.com/test.md");
				const response2 = await client.get(
					"https://api.example.com/command.md",
				);

				expect(response1.status).toBe(200);
				expect(response1.body).toBe("# Test Command");
				expect(response2.status).toBe(200);
				expect(response2.body).toBe("# Test Command");
			});

			test("should support function predicate matching", async () => {
				const manifestResponse = {
					status: 200,
					statusText: "OK",
					headers: { "content-type": "application/json" },
					body: '{"version": "1.0.0"}',
					url: "https://example.com/manifest",
				};

				client.setResponseWithMatcher(
					(url: string) => url.includes("index.json"),
					manifestResponse,
				);

				const response1 = await client.get(
					"https://api.example.com/en/index.json",
				);
				const response2 = await client.get(
					"https://api.example.com/fr/index.json",
				);

				expect(response1.status).toBe(200);
				expect(response1.body).toBe('{"version": "1.0.0"}');
				expect(response2.status).toBe(200);
				expect(response2.body).toBe('{"version": "1.0.0"}');
			});

			test("should support error responses with pattern matching", async () => {
				const networkError = new HTTPNetworkError(
					"test-url",
					"Simulated network failure",
				);

				client.setResponseWithMatcher(/error/, networkError);

				await expect(
					client.get("https://api.example.com/network-error"),
				).rejects.toThrow(HTTPNetworkError);
				await expect(
					client.get("https://api.example.com/server-error-test"),
				).rejects.toThrow(HTTPNetworkError);
			});

			test("should prioritize exact matches over patterns", async () => {
				const exactResponse = {
					status: 200,
					statusText: "OK",
					headers: {},
					body: "exact match",
					url: "https://example.com/test",
				};

				const patternResponse = {
					status: 200,
					statusText: "OK",
					headers: {},
					body: "pattern match",
					url: "https://example.com/test",
				};

				// Set pattern first, then exact - exact should win
				client.setResponseWithMatcher(/test/, patternResponse);
				client.setResponseWithMatcher(
					"https://example.com/test",
					exactResponse,
				);

				const response = await client.get("https://example.com/test");
				expect(response.body).toBe("exact match");
			});

			test("should handle multiple pattern matchers correctly", async () => {
				const jsonResponse = {
					status: 200,
					statusText: "OK",
					headers: { "content-type": "application/json" },
					body: '{"type": "json"}',
					url: "test",
				};

				const mdResponse = {
					status: 200,
					statusText: "OK",
					headers: { "content-type": "text/markdown" },
					body: "# Markdown",
					url: "test",
				};

				client.setResponseWithMatcher(/\.json$/, jsonResponse);
				client.setResponseWithMatcher(/\.md$/, mdResponse);

				const jsonResult = await client.get(
					"https://api.example.com/data.json",
				);
				const mdResult = await client.get("https://api.example.com/readme.md");

				expect(jsonResult.body).toBe('{"type": "json"}');
				expect(mdResult.body).toBe("# Markdown");
			});

			test("should maintain backward compatibility with existing setResponse", async () => {
				const oldResponse = {
					status: 200,
					statusText: "OK",
					headers: {},
					body: "old method",
					url: "https://example.com/old",
				};

				client.setResponse("https://example.com/old", oldResponse);
				const response = await client.get("https://example.com/old");

				expect(response.body).toBe("old method");
			});

			test("should throw 404 for unmatched URLs", async () => {
				client.setResponseWithMatcher(/specific-pattern/, {
					status: 200,
					statusText: "OK",
					headers: {},
					body: "matched",
					url: "test",
				});

				await expect(
					client.get("https://unmatched.example.com"),
				).rejects.toThrow(HTTPStatusError);
			});
		});

		describe("request history tracking", () => {
			test("should track request history", async () => {
				await client.get("https://api.example.com/data");
				await client.get("https://api.example.com/json", { timeout: 1000 });

				const history = client.getRequestHistory();
				expect(history).toHaveLength(2);
				expect(history[0]?.url).toBe("https://api.example.com/data");
				expect(history[1]?.url).toBe("https://api.example.com/json");
				expect(history[1]?.options?.timeout).toBe(1000);
			});

			test("should clear request history", async () => {
				await client.get("https://api.example.com/data");
				expect(client.getRequestHistory()).toHaveLength(1);

				client.clearRequestHistory();
				expect(client.getRequestHistory()).toHaveLength(0);
			});

			test("should return copy of history to prevent external modification", async () => {
				await client.get("https://api.example.com/data");
				const history = client.getRequestHistory();
				history.push({ url: "external-modification" });

				// Original history should be unaffected
				expect(client.getRequestHistory()).toHaveLength(1);
			});
		});

		describe("default response mappings", () => {
			test("should have default response for large content", async () => {
				const response = await client.get("https://api.example.com/large");

				expect(response.status).toBe(200);
				expect(response.body.length).toBeGreaterThan(1000);
			});

			test("should simulate timeout behavior correctly", async () => {
				// Long timeout should work for most endpoints
				const response = await client.get("https://api.example.com/data", {
					timeout: 5000,
				});
				expect(response).toBeDefined(); // Should not throw

				// Short timeout should throw for slow endpoint
				await expect(
					client.get("https://api.example.com/slow", { timeout: 50 }),
				).rejects.toThrow(HTTPTimeoutError);
			});
		});
	});
});
