import type IHTTPClient from "../../src/interfaces/IHTTPClient.ts";
import type {
	HTTPOptions,
	HTTPResponse,
} from "../../src/interfaces/IHTTPClient.ts";
import {
	HTTPNetworkError,
	HTTPStatusError,
	HTTPTimeoutError,
} from "../../src/interfaces/IHTTPClient.ts";
import { mockHttpLogger } from "../../src/utils/logger.js";

/**
 * Matcher type for flexible URL matching
 */
type URLMatcher = string | RegExp | ((url: string) => boolean);

/**
 * In-memory HTTP client implementation for testing
 *
 * Simulates HTTP responses based on URL patterns and can trigger various error conditions
 * for comprehensive testing scenarios. Provides a deterministic mock for unit testing
 * without requiring actual network connectivity.
 *
 * Features:
 * - Exact URL matching for precise control
 * - Pattern matching with RegExp and custom functions
 * - Request history tracking for test verification
 * - Comprehensive error simulation capabilities
 * - Backward compatibility with existing setResponse API
 *
 * @example Basic usage
 * ```typescript
 * const client = new InMemoryHTTPClient();
 * const response = await client.get('https://api.example.com/data');
 * console.log(response.status); // 200
 * ```
 *
 * @example Pattern matching
 * ```typescript
 * const client = new InMemoryHTTPClient();
 * client.setResponseWithMatcher(/\.json$/, { status: 200, body: '{}' });
 * client.setResponseWithMatcher(url => url.includes('manifest'), manifestResponse);
 * ```
 */
class InMemoryHTTPClient implements IHTTPClient {
	/** Pre-configured responses mapped by URL */
	private readonly responses: Map<string, HTTPResponse | Error>;
	/** Pattern-based responses for flexible matching */
	private readonly patternResponses: Array<{
		matcher: URLMatcher;
		response: HTTPResponse | Error;
	}>;
	/** History of all requests made to this client instance */
	private readonly requestHistory: Array<{
		url: string;
		options?: HTTPOptions;
	}>;

	constructor() {
		this.responses = new Map();
		this.patternResponses = [];
		this.requestHistory = [];
		this.setupDefaultResponses();
	}

	/**
	 * Initialize default response mappings for common test scenarios
	 * Includes successful responses, error conditions, and edge cases
	 */
	private setupDefaultResponses(): void {
		this.responses.set("https://api.example.com/data", {
			status: 200,
			statusText: "OK",
			headers: {
				"content-type": "application/json",
				server: "nginx/1.18.0",
			},
			body: '{"message": "Hello, World!", "data": [1, 2, 3]}',
			url: "https://api.example.com/data",
		});

		this.responses.set("https://api.example.com/empty", {
			status: 200,
			statusText: "OK",
			headers: {
				"content-type": "text/plain",
			},
			body: "",
			url: "https://api.example.com/empty",
		});

		this.responses.set("https://api.example.com/large", {
			status: 200,
			statusText: "OK",
			headers: {
				"content-type": "text/plain",
			},
			body: "A".repeat(2000), // Large response
			url: "https://api.example.com/large",
		});

		this.responses.set("https://api.example.com/json", {
			status: 200,
			statusText: "OK",
			headers: {
				"content-type": "application/json",
			},
			body: '{"status": "success", "items": ["a", "b", "c"]}',
			url: "https://api.example.com/json",
		});

		this.responses.set("https://api.example.com/text", {
			status: 200,
			statusText: "OK",
			headers: {
				"content-type": "text/plain",
			},
			body: "This is plain text content",
			url: "https://api.example.com/text",
		});

		// HTTP status error responses
		this.responses.set(
			"https://api.example.com/not-found",
			new HTTPStatusError(
				"https://api.example.com/not-found",
				404,
				"Not Found",
			),
		);

		this.responses.set(
			"https://api.example.com/server-error",
			new HTTPStatusError(
				"https://api.example.com/server-error",
				500,
				"Internal Server Error",
			),
		);

		this.responses.set(
			"https://invalid-domain-that-does-not-exist.com",
			new HTTPNetworkError(
				"https://invalid-domain-that-does-not-exist.com",
				"DNS lookup failed",
			),
		);

		// Network timeout simulation
		this.responses.set(
			"https://api.example.com/slow",
			new HTTPTimeoutError("https://api.example.com/slow", 100),
		);

		// Invalid URL format responses
		this.responses.set(
			"not-a-valid-url",
			new HTTPNetworkError("not-a-valid-url", "Invalid URL format"),
		);

		this.responses.set("", new HTTPNetworkError("", "Empty URL"));
	}

	/**
	 * Perform an HTTP GET request using pre-configured response mappings
	 *
	 * @param url - The URL to request
	 * @param options - Optional request configuration
	 * @returns Promise resolving to HTTP response or throwing configured error
	 * @throws HTTPTimeoutError when request times out
	 * @throws HTTPNetworkError when network fails
	 * @throws HTTPStatusError when server returns error status
	 */
	async get(url: string, options?: HTTPOptions): Promise<HTTPResponse> {
		// Record request for verification in tests
		this.requestHistory.push({ url, options });

		// Extract timeout with sensible default
		const timeout = options?.timeout ?? 5000;

		// Simulate timeout behavior for slow endpoint
		if (url === "https://api.example.com/slow" && timeout < 1000) {
			throw new HTTPTimeoutError(url, timeout);
		}

		// First check exact matches (higher priority)
		const exactResponse = this.responses.get(url);
		if (exactResponse) {
			if (exactResponse instanceof Error) {
				throw exactResponse;
			}
			// Simulate minimal network delay for realism
			await new Promise((resolve) => setTimeout(resolve, 1));
			return exactResponse;
		}

		// Then check pattern matches
		for (const { matcher, response } of this.patternResponses) {
			if (this.matchesPattern(url, matcher)) {
				if (response instanceof Error) {
					throw response;
				}
				// Simulate minimal network delay for realism
				await new Promise((resolve) => setTimeout(resolve, 1));
				return response;
			}
		}

		// Default behavior for unmapped URLs
		throw new HTTPStatusError(url, 404, "Not Found");
	}

	/**
	 * Helper method to check if a URL matches a given pattern
	 */
	private matchesPattern(url: string, matcher: URLMatcher): boolean {
		if (typeof matcher === "string") {
			return url === matcher;
		}
		if (matcher instanceof RegExp) {
			return matcher.test(url);
		}
		if (typeof matcher === "function") {
			return matcher(url);
		}
		return false;
	}

	/**
	 * Get the history of requests made to this client (for testing verification)
	 *
	 * @returns Copy of request history to prevent external modification
	 */
	getRequestHistory(): Array<{ url: string; options?: HTTPOptions }> {
		return [...this.requestHistory];
	}

	/**
	 * Clear request history for clean test state
	 */
	clearRequestHistory(): void {
		this.requestHistory.length = 0;
	}

	/**
	 * Add a custom response mapping for dynamic testing scenarios
	 *
	 * @param url - The URL to map
	 * @param response - The response or error to return for this URL
	 */
	setResponse(url: string, response: HTTPResponse | Error): void {
		this.responses.set(url, response);
	}

	/**
	 * Add a response mapping with flexible URL matching
	 *
	 * @param matcher - URL matcher (string for exact match, RegExp for pattern, function for custom logic)
	 * @param response - The response or error to return for matching URLs
	 */
	setResponseWithMatcher(
		matcher: URLMatcher,
		response: HTTPResponse | Error,
	): void {
		// If it's a string matcher, use exact matching for better performance
		if (typeof matcher === "string") {
			this.responses.set(matcher, response);
		} else {
			// Add to pattern responses for flexible matching
			this.patternResponses.push({ matcher, response });
		}
	}
}

export default InMemoryHTTPClient;
