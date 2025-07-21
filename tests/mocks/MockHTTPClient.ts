import type IHTTPClient from "../../src/interfaces/IHTTPClient.js";
import type { HTTPOptions, HTTPResponse } from "../../src/interfaces/IHTTPClient.js";
import { HTTPNetworkError, HTTPStatusError, HTTPTimeoutError } from "../../src/interfaces/IHTTPClient.js";

/**
 * Mock HTTP client for testing Repository dependency injection
 * Simulates network responses based on URL patterns for deterministic testing
 */
export default class MockHTTPClient implements IHTTPClient {
	/** Track all requests made for test verification */
	private requestHistory: Array<{ url: string; options?: HTTPOptions }> = [];
	
	async get(url: string, options?: HTTPOptions): Promise<HTTPResponse> {
		this.requestHistory.push({ url, options });
		
		// Simulate network delay
		await new Promise(resolve => setTimeout(resolve, 1));
		
		// Simulate timeout scenarios
		if (options?.timeout && options.timeout < 10) {
			throw new HTTPTimeoutError(url, options.timeout);
		}
		
		// Simulate different responses based on URL patterns
		if (url.includes('/en/index.json')) {
			return {
				status: 200,
				statusText: 'OK',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					version: "1.0.1",
					updated: "2025-07-09T00:41:00Z",
					commands: [
						{
							name: "debug-help",
							description: "Provide systematic debugging assistance for code issues",
							file: "debug-help.md",
							"allowed-tools": ["Read", "Glob", "Grep", "Bash(git:*)", "Edit"]
						}
					]
				}),
				url
			};
		}
		
		if (url.includes('/fr/index.json')) {
			return {
				status: 200,
				statusText: 'OK',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					version: "1.0.0",
					updated: "2025-07-08T12:00:00Z",
					commands: [
						{
							name: "debug-help",
							description: "Fournir une assistance de débogage systématique",
							file: "debug-help.md",
							"allowed-tools": ["Read", "Glob", "Grep", "Edit"]
						}
					]
				}),
				url
			};
		}
		
		if (url.includes('/debug-help.md')) {
			return {
				status: 200,
				statusText: 'OK',
				headers: { 'content-type': 'text/markdown' },
				body: "# Debug Help\n\nThis command provides systematic debugging assistance for code issues.",
				url
			};
		}
		
		// Simulate various error conditions for testing
		if (url.includes('network-error')) {
			throw new HTTPNetworkError(url, 'Connection failed');
		}
		
		if (url.includes('timeout')) {
			throw new HTTPTimeoutError(url, 5000);
		}
		
		if (url.includes('not-found')) {
			throw new HTTPStatusError(url, 404, 'Not Found');
		}
		
		// Default fallback
		throw new HTTPNetworkError(url, 'Mock: Unhandled URL pattern');
	}
	
	/**
	 * Get request history for test verification
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
}