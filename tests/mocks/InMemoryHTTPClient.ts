import type IHTTPClient from "../../src/interfaces/IHTTPClient.ts";
import type { HTTPOptions, HTTPResponse } from "../../src/interfaces/IHTTPClient.ts";
import {
	HTTPTimeoutError,
	HTTPNetworkError,
	HTTPStatusError,
} from "../../src/interfaces/IHTTPClient.ts";

/**
 * In-memory HTTP client implementation for testing
 * 
 * Simulates HTTP responses based on URL patterns and can trigger various error conditions
 * for comprehensive testing scenarios. Provides a deterministic mock for unit testing
 * without requiring actual network connectivity.
 * 
 * @example
 * ```typescript
 * const client = new InMemoryHTTPClient();
 * const response = await client.get('https://api.example.com/data');
 * console.log(response.status); // 200
 * ```
 */
class InMemoryHTTPClient implements IHTTPClient {
	/** Pre-configured responses mapped by URL */
	private readonly responses: Map<string, HTTPResponse | Error>;
	/** History of all requests made to this client instance */
	private readonly requestHistory: Array<{ url: string; options?: HTTPOptions }>;

	constructor() {
		this.responses = new Map();
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
				"server": "nginx/1.18.0",
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
		this.responses.set("https://api.example.com/not-found", 
			new HTTPStatusError("https://api.example.com/not-found", 404, "Not Found")
		);

		this.responses.set("https://api.example.com/server-error", 
			new HTTPStatusError("https://api.example.com/server-error", 500, "Internal Server Error")
		);

		this.responses.set("https://invalid-domain-that-does-not-exist.com", 
			new HTTPNetworkError("https://invalid-domain-that-does-not-exist.com", "DNS lookup failed")
		);

		// Network timeout simulation
		this.responses.set("https://api.example.com/slow", 
			new HTTPTimeoutError("https://api.example.com/slow", 100)
		);

		// Invalid URL format responses
		this.responses.set("not-a-valid-url", 
			new HTTPNetworkError("not-a-valid-url", "Invalid URL format")
		);

		this.responses.set("", 
			new HTTPNetworkError("", "Empty URL")
		);
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

		// Retrieve pre-configured response or error for this URL
		const response = this.responses.get(url);

		if (!response) {
			// Default behavior for unmapped URLs
			throw new HTTPStatusError(url, 404, "Not Found");
		}

		if (response instanceof Error) {
			throw response;
		}

		// Simulate minimal network delay for realism
		await new Promise(resolve => setTimeout(resolve, 1));

		return response;
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
}

export default InMemoryHTTPClient;