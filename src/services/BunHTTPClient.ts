import type IHTTPClient from "../interfaces/IHTTPClient.ts";
import type { HTTPOptions, HTTPResponse } from "../interfaces/IHTTPClient.ts";
import {
	HTTPNetworkError,
	HTTPStatusError,
	HTTPTimeoutError,
} from "../interfaces/IHTTPClient.ts";

/**
 * Real HTTP client implementation using Bun's Web APIs
 *
 * This class provides a production-ready HTTP client implementation that uses Bun's
 * Web-standard fetch API, Request, and Response objects. It implements proper timeout
 * handling using AbortController and maps Web API errors to the custom error types
 * defined in the IHTTPClient interface.
 *
 * Features:
 * - Web-standard fetch API with Request/Response objects
 * - Timeout handling using AbortController and AbortSignal
 * - Comprehensive error mapping from fetch errors to custom error types
 * - Header processing and normalization
 * - Input validation and URL sanitization
 * - Follows Web API standards for maximum compatibility
 *
 * @example Basic usage
 * ```typescript
 * const client = new BunHTTPClient();
 * const response = await client.get('https://api.example.com/data');
 * console.log(response.status); // 200
 * console.log(response.body); // Response content as string
 * ```
 *
 * @example With custom options
 * ```typescript
 * const client = new BunHTTPClient();
 * const response = await client.get('https://api.example.com/data', {
 *   timeout: 10000,
 *   headers: { 'User-Agent': 'MyApp/1.0' }
 * });
 * ```
 */
export default class BunHTTPClient implements IHTTPClient {
	/**
	 * Default timeout in milliseconds as specified by the interface
	 * Matches the interface default to ensure consistent behavior
	 */
	private static readonly DEFAULT_TIMEOUT = 5000;

	/**
	 * Perform an HTTP GET request using Bun's Web-standard fetch API
	 *
	 * This method implements the IHTTPClient interface using Bun's fetch API,
	 * which follows Web standards. It handles timeouts using AbortController,
	 * processes headers correctly, and maps all errors to the appropriate
	 * custom error types.
	 *
	 * @param url - The URL to request (must be a valid HTTP/HTTPS URL)
	 * @param options - Optional request configuration
	 * @param options.timeout - Request timeout in milliseconds (default: 5000)
	 * @param options.headers - Request headers as key-value pairs
	 * @returns Promise resolving to HTTP response with all required fields
	 * @throws HTTPTimeoutError when request times out
	 * @throws HTTPNetworkError when network connectivity fails or URL is invalid
	 * @throws HTTPStatusError when server returns non-2xx status code
	 *
	 * @example Successful request
	 * ```typescript
	 * const response = await client.get('https://api.example.com/users');
	 * console.log(`Status: ${response.status} ${response.statusText}`);
	 * console.log(`Content: ${response.body}`);
	 * ```
	 *
	 * @example With timeout and headers
	 * ```typescript
	 * const response = await client.get('https://api.example.com/data', {
	 *   timeout: 3000,
	 *   headers: { 'Authorization': 'Bearer token123' }
	 * });
	 * ```
	 */
	async get(url: string, options?: HTTPOptions): Promise<HTTPResponse> {
		// Extract timeout with safe fallback to default
		const timeout = options?.timeout ?? BunHTTPClient.DEFAULT_TIMEOUT;

		// Validate timeout is a positive number
		if (
			typeof timeout !== "number" ||
			timeout <= 0 ||
			!Number.isFinite(timeout)
		) {
			throw new HTTPNetworkError(
				url,
				`Invalid timeout value: ${timeout}. Must be a positive number.`,
			);
		}

		// Create AbortController for Web-standard timeout handling
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), timeout);

		try {
			// Comprehensive URL validation
			this.validateUrl(url);

			// Build Web-standard Request configuration
			const requestInit: RequestInit = {
				method: "GET",
				signal: controller.signal,
				headers: this.processHeaders(options?.headers),
			};

			// Perform the Web-standard fetch request
			const response = await fetch(url, requestInit);

			// Clear timeout since request completed successfully
			clearTimeout(timeoutId);

			// Check for HTTP status errors (non-2xx responses)
			if (!response.ok) {
				throw new HTTPStatusError(url, response.status, response.statusText);
			}

			// Process response headers and body concurrently for better performance
			const [headers, body] = await Promise.all([
				this.processResponseHeaders(response.headers),
				response.text(),
			]);

			// Return properly formatted HTTP response
			return {
				status: response.status,
				statusText: response.statusText,
				headers,
				body,
				url: response.url, // Final URL after any redirects
			};
		} catch (error) {
			// Always clear timeout on any error to prevent memory leaks
			clearTimeout(timeoutId);

			// Map Web API errors to custom error types
			throw this.mapError(error, url, timeout);
		}
	}

	/**
	 * Validate URL format and content
	 *
	 * @param url - URL to validate
	 * @throws HTTPNetworkError for invalid URLs
	 */
	private validateUrl(url: string): void {
		if (!url || typeof url !== "string" || url.trim() === "") {
			throw new HTTPNetworkError(url, "URL must be a non-empty string");
		}

		const trimmedUrl = url.trim();

		// Basic URL format validation
		if (
			!trimmedUrl.startsWith("http://") &&
			!trimmedUrl.startsWith("https://")
		) {
			throw new HTTPNetworkError(
				url,
				"URL must start with http:// or https://",
			);
		}

		// Additional URL validation using URL constructor
		try {
			new URL(trimmedUrl);
		} catch (urlError) {
			const message =
				urlError instanceof Error ? urlError.message : "Invalid URL format";
			throw new HTTPNetworkError(url, `Invalid URL format: ${message}`);
		}
	}

	/**
	 * Process and validate request headers
	 *
	 * Validates headers to prevent HTTP header injection attacks by rejecting
	 * header names or values containing control characters like CRLF sequences.
	 *
	 * @param headers - Raw headers object or undefined
	 * @returns Processed headers ready for fetch API
	 */
	private processHeaders(
		headers?: Record<string, string>,
	): Record<string, string> {
		if (!headers) {
			return {};
		}

		// Validate headers object
		if (typeof headers !== "object" || Array.isArray(headers)) {
			return {};
		}

		// Filter out invalid header values and prevent header injection
		const processedHeaders: Record<string, string> = {};
		for (const [key, value] of Object.entries(headers)) {
			if (
				typeof key === "string" &&
				typeof value === "string" &&
				key.trim() &&
				value.trim() &&
				!/[\r\n]/.test(key) && // Prevent header injection in keys
				!/[\r\n]/.test(value) // Prevent header injection in values
			) {
				processedHeaders[key.trim()] = value.trim();
			}
		}

		return processedHeaders;
	}

	/**
	 * Convert Web API Headers to Record<string, string>
	 *
	 * @param responseHeaders - Web API Headers object
	 * @returns Headers as a plain object with lowercase keys
	 */
	private processResponseHeaders(
		responseHeaders: Headers,
	): Record<string, string> {
		const headers: Record<string, string> = {};

		// Use Headers.forEach for efficient iteration
		responseHeaders.forEach((value, key) => {
			// Normalize header names to lowercase for consistent access
			headers[key.toLowerCase()] = value;
		});

		return headers;
	}

	/**
	 * Map Web API and other errors to custom error types
	 *
	 * @param error - The caught error
	 * @param url - The request URL
	 * @param timeout - The configured timeout
	 * @returns Never (always throws)
	 * @throws Appropriate custom error type
	 */
	private mapError(error: unknown, url: string, timeout: number): never {
		// Handle AbortError (timeout)
		if (error instanceof Error && error.name === "AbortError") {
			throw new HTTPTimeoutError(url, timeout);
		}

		// Re-throw our custom errors as-is (from validation, etc.)
		if (
			error instanceof HTTPTimeoutError ||
			error instanceof HTTPNetworkError ||
			error instanceof HTTPStatusError
		) {
			throw error;
		}

		// Handle TypeError (most common fetch errors: network, DNS, etc.)
		if (error instanceof TypeError) {
			// Common TypeError messages from fetch API
			const message = error.message.toLowerCase();
			if (message.includes("failed to fetch") || message.includes("network")) {
				throw new HTTPNetworkError(url, "Network connection failed");
			}
			if (message.includes("dns") || message.includes("resolve")) {
				throw new HTTPNetworkError(url, "DNS resolution failed");
			}
			throw new HTTPNetworkError(url, error.message);
		}

		// Handle other Error instances
		if (error instanceof Error) {
			throw new HTTPNetworkError(url, `Network error: ${error.message}`);
		}

		// Fallback for unknown error types
		throw new HTTPNetworkError(url, "Unknown network error occurred");
	}
}
