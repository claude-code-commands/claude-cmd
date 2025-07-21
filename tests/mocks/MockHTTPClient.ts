import type IHTTPClient from "../../src/interfaces/IHTTPClient.js";
import type {
	HTTPOptions,
	HTTPResponse,
} from "../../src/interfaces/IHTTPClient.js";
import {
	HTTPNetworkError,
	HTTPStatusError,
	HTTPTimeoutError,
} from "../../src/interfaces/IHTTPClient.js";

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
		await new Promise((resolve) => setTimeout(resolve, 1));

		// Simulate timeout scenarios
		if (options?.timeout && options.timeout < 10) {
			throw new HTTPTimeoutError(url, options.timeout);
		}

		// Simulate different responses based on URL patterns
		if (url.includes("/en/index.json")) {
			return {
				status: 200,
				statusText: "OK",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					version: "1.0.1",
					updated: "2025-07-09T00:41:00Z",
					commands: [
						{
							name: "debug-help",
							description:
								"Provide systematic debugging assistance for code issues",
							file: "debug-help.md",
							"allowed-tools": ["Read", "Glob", "Grep", "Bash(git:*)", "Edit"],
						},
						{
							name: "frontend:component",
							description: "Generate React components with best practices",
							file: "frontend-component.md",
							"allowed-tools": "Write,Edit,Read",
						},
						{
							name: "backend:api",
							description: "Create REST API endpoints with proper structure",
							file: "backend-api.md",
							"allowed-tools": ["Write", "Edit", "Bash"],
						},
						{
							name: "code-review",
							description: "Systematic code review assistance",
							file: "code-review.md",
							"allowed-tools": ["Read", "Grep", "Edit"],
						},
						{
							name: "test-gen",
							description: "Generate comprehensive test suites",
							file: "test-gen.md",
							"allowed-tools": ["Read", "Write", "Edit", "Bash"],
						},
						{
							name: "content-error",
							description: "Command that simulates content error",
							file: "content-error.md",
							"allowed-tools": ["Read"],
						},
					],
				}),
				url,
			};
		}

		if (url.includes("/fr/index.json")) {
			return {
				status: 200,
				statusText: "OK",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					version: "1.0.0",
					updated: "2025-07-08T12:00:00Z",
					commands: [
						{
							name: "debug-help",
							description:
								"Fournir une assistance de débogage systématique pour les problèmes de code",
							file: "debug-help.md",
							"allowed-tools": ["Read", "Glob", "Grep", "Edit"],
						},
						{
							name: "missing-file",
							description: "Command that simulates missing file error",
							file: "missing-file.md",
							"allowed-tools": ["Read"],
						},
						{
							name: "frontend:component",
							description:
								"Générer des composants React avec les meilleures pratiques",
							file: "frontend-component.md",
							"allowed-tools": ["Write", "Edit", "Read"],
						},
					],
				}),
				url,
			};
		}

		// Handle command content requests
		if (url.includes("/en/debug-help.md")) {
			return {
				status: 200,
				statusText: "OK",
				headers: { "content-type": "text/markdown" },
				body: "# Debug Help\n\nThis command provides systematic debugging assistance for code issues.\n\n## Usage\n\nUse this command when you need debugging assistance.",
				url,
			};
		}

		if (url.includes("/fr/debug-help.md")) {
			return {
				status: 200,
				statusText: "OK",
				headers: { "content-type": "text/markdown" },
				body: "# Aide au débogage\n\nCette commande fournit une assistance de débogage systématique.\n\n## Utilisation\n\nUtilisez cette commande pour obtenir de l'aide.",
				url,
			};
		}

		if (url.includes("/en/frontend-component.md")) {
			return {
				status: 200,
				statusText: "OK",
				headers: { "content-type": "text/markdown" },
				body: "# Frontend Component\n\nGenerate React components with best practices.",
				url,
			};
		}

		if (url.includes("/en/backend-api.md")) {
			return {
				status: 200,
				statusText: "OK",
				headers: { "content-type": "text/markdown" },
				body: "# Backend API\n\nCreate REST API endpoints with proper structure.",
				url,
			};
		}

		if (url.includes("/en/code-review.md")) {
			return {
				status: 200,
				statusText: "OK",
				headers: { "content-type": "text/markdown" },
				body: "# Code Review\n\nSystematic code review assistance.",
				url,
			};
		}

		if (url.includes("/en/test-gen.md")) {
			return {
				status: 200,
				statusText: "OK",
				headers: { "content-type": "text/markdown" },
				body: "# Test Generation\n\nGenerate comprehensive test suites.",
				url,
			};
		}

		// Error simulation for specific commands
		if (url.includes("/en/content-error.md")) {
			throw new HTTPNetworkError(url, "File corrupted");
		}

		if (url.includes("/fr/missing-file.md")) {
			throw new HTTPStatusError(url, 404, "File not found on server");
		}

		// Simulate various error conditions for testing
		if (url.includes("network-error")) {
			throw new HTTPNetworkError(url, "Connection failed");
		}

		if (url.includes("timeout")) {
			throw new HTTPTimeoutError(url, 5000);
		}

		if (url.includes("not-found")) {
			throw new HTTPStatusError(url, 404, "Not Found");
		}

		// Default fallback
		throw new HTTPNetworkError(url, "Mock: Unhandled URL pattern");
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
