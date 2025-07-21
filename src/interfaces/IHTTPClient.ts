/**
 * HTTP request options for configuring requests
 */
export interface HTTPOptions {
	/** Request timeout in milliseconds (default: 5000) */
	readonly timeout?: number;
	/** Request headers as key-value pairs */
	readonly headers?: Record<string, string>;
}

/**
 * HTTP response returned from requests
 */
export interface HTTPResponse {
	/** HTTP status code (e.g., 200, 404, 500) */
	readonly status: number;
	/** HTTP status text (e.g., "OK", "Not Found") */
	readonly statusText: string;
	/** Response headers as key-value pairs */
	readonly headers: Record<string, string>;
	/** Response body as string */
	readonly body: string;
	/** Final URL after any redirects */
	readonly url: string;
}

/**
 * Base class for all HTTP-related errors
 */
export abstract class HTTPError extends Error {
	constructor(
		message: string,
		public readonly url: string,
	) {
		super(message);
		this.name = this.constructor.name;
	}
}

/**
 * Error thrown when a request times out
 */
export class HTTPTimeoutError extends HTTPError {
	/** Timeout value in milliseconds that was exceeded */
	public readonly timeout: number;

	constructor(url: string, timeout: number) {
		super(`Request timed out after ${timeout}ms`, url);
		this.timeout = timeout;
	}
}

/**
 * Error thrown when network connectivity fails
 */
export class HTTPNetworkError extends HTTPError {
	/** The underlying cause of the network failure */
	public readonly cause?: string;

	constructor(url: string, cause?: string) {
		super(`Network error: ${cause || "Connection failed"}`, url);
		this.cause = cause;
	}
}

/**
 * Error thrown when server returns non-2xx status code
 */
export class HTTPStatusError extends HTTPError {
	/** HTTP status code that caused the error */
	public readonly status: number;
	/** HTTP status text associated with the error */
	public readonly statusText: string;

	constructor(url: string, status: number, statusText: string) {
		super(`HTTP ${status}: ${statusText}`, url);
		this.status = status;
		this.statusText = statusText;
	}
}

/**
 * HTTP client interface for network operations
 *
 * Provides a simple abstraction for HTTP GET requests with timeout support.
 * Designed to be minimal but extensible for future HTTP methods.
 */
export default interface IHTTPClient {
	/**
	 * Perform an HTTP GET request
	 *
	 * @param url - The URL to request
	 * @param options - Optional request configuration
	 * @returns Promise resolving to HTTP response
	 * @throws HTTPTimeoutError when request times out
	 * @throws HTTPNetworkError when network fails
	 * @throws HTTPStatusError when server returns error status
	 */
	get(url: string, options?: HTTPOptions): Promise<HTTPResponse>;
}
