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
 * Uses data-driven approach for maintainable and focused testing
 */
export default class MockHTTPClient implements IHTTPClient {
	/** Track all requests made for test verification */
	private requestHistory: Array<{ url: string; options?: HTTPOptions }> = [];

	/** Map of URL patterns to responses for easy maintenance */
	private readonly responses: Map<string, HTTPResponse | Error> = new Map();

	constructor() {
		this.setupDefaultResponses();
	}

	/**
	 * Setup default responses in a maintainable, data-driven way
	 */
	private setupDefaultResponses(): void {
		// English manifest
		this.responses.set("/en/index.json", {
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
			url: "/en/index.json",
		});

		// French manifest (simplified)
		this.responses.set("/fr/index.json", {
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
			url: "/fr/index.json",
		});

		// Command content responses
		const commandResponses: Array<[string, string]> = [
			[
				"/en/debug-help.md",
				"# Debug Help\n\nThis command provides systematic debugging assistance for code issues.\n\n## Usage\n\nUse this command when you need debugging assistance.",
			],
			[
				"/fr/debug-help.md",
				"# Aide au débogage\n\nCette commande fournit une assistance de débogage systématique.\n\n## Utilisation\n\nUtilisez cette commande pour obtenir de l'aide.",
			],
			[
				"/en/frontend-component.md",
				"# Frontend Component\n\nGenerate React components with best practices.",
			],
			[
				"/en/backend-api.md",
				"# Backend API\n\nCreate REST API endpoints with proper structure.",
			],
			[
				"/en/code-review.md",
				"# Code Review\n\nSystematic code review assistance.",
			],
			[
				"/en/test-gen.md",
				"# Test Generation\n\nGenerate comprehensive test suites.",
			],
		];

		commandResponses.forEach(([urlPattern, content]) => {
			this.responses.set(urlPattern, {
				status: 200,
				statusText: "OK",
				headers: { "content-type": "text/markdown" },
				body: content,
				url: urlPattern,
			});
		});

		// Error scenarios
		this.responses.set(
			"/en/content-error.md",
			new HTTPNetworkError("/en/content-error.md", "File corrupted"),
		);
		this.responses.set(
			"/fr/missing-file.md",
			new HTTPStatusError(
				"/fr/missing-file.md",
				404,
				"File not found on server",
			),
		);
		this.responses.set(
			"network-error",
			new HTTPNetworkError("network-error", "Connection failed"),
		);
		this.responses.set("timeout", new HTTPTimeoutError("timeout", 5000));
		this.responses.set(
			"not-found",
			new HTTPStatusError("not-found", 404, "Not Found"),
		);
	}

	async get(url: string, options?: HTTPOptions): Promise<HTTPResponse> {
		this.requestHistory.push({ url, options });

		// Simulate network delay
		await new Promise((resolve) => setTimeout(resolve, 1));

		// Simulate timeout scenarios
		if (options?.timeout && options.timeout < 10) {
			throw new HTTPTimeoutError(url, options.timeout);
		}

		// Find matching response by URL pattern
		for (const [pattern, response] of this.responses) {
			if (url.includes(pattern)) {
				if (response instanceof Error) {
					throw response;
				}
				return response;
			}
		}

		// Default fallback for unhandled URLs
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
