import {
	HTTPNetworkError,
	HTTPStatusError,
	HTTPTimeoutError,
} from "../../src/interfaces/IHTTPClient.js";
import type InMemoryHTTPClient from "../mocks/InMemoryHTTPClient.js";

/**
 * English manifest data for claude-cmd testing
 */
const englishManifest = {
	version: "1.0.1",
	updated: "2025-07-09T00:41:00Z",
	commands: [
		{
			name: "debug-help",
			description: "Provide systematic debugging assistance for code issues",
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
};

/**
 * French manifest data for claude-cmd testing
 */
const frenchManifest = {
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
			description: "Générer des composants React avec les meilleures pratiques",
			file: "frontend-component.md",
			"allowed-tools": ["Write", "Edit", "Read"],
		},
	],
};

/**
 * Command content data for testing
 */
const commandContents = {
	"debug-help.md": {
		en: "# Debug Help\n\nThis command provides systematic debugging assistance for code issues.\n\n## Usage\n\nUse this command when you need debugging assistance.",
		fr: "# Aide au débogage\n\nCette commande fournit une assistance de débogage systématique.\n\n## Utilisation\n\nUtilisez cette commande pour obtenir de l'aide.",
	},
	"frontend-component.md": {
		en: "# Frontend Component\n\nGenerate React components with best practices.",
	},
	"backend-api.md": {
		en: "# Backend API\n\nCreate REST API endpoints with proper structure.",
	},
	"code-review.md": {
		en: "# Code Review\n\nSystematic code review assistance.",
	},
	"test-gen.md": {
		en: "# Test Generation\n\nGenerate comprehensive test suites.",
	},
};

/**
 * Create HTTP responses for claude-cmd domain-specific testing
 *
 * This factory function populates an HTTP client with responses that simulate
 * the claude-cmd repository structure, including manifests and command files.
 *
 * @param client - The HTTP client to populate with responses
 *
 * @example
 * ```typescript
 * const client = new InMemoryHTTPClient();
 * createClaudeCmdResponses(client);
 * const manifest = await client.get('https://example.com/en/manifest.json');
 * ```
 */
export function createClaudeCmdResponses(client: InMemoryHTTPClient): void {
	// English manifest responses
	client.setResponseWithMatcher(
		(url: string) => url.includes("/en/manifest.json"),
		{
			status: 200,
			statusText: "OK",
			headers: { "content-type": "application/json" },
			body: JSON.stringify(englishManifest),
			url: "/en/manifest.json",
		},
	);

	// French manifest responses
	client.setResponseWithMatcher(
		(url: string) => url.includes("/fr/manifest.json"),
		{
			status: 200,
			statusText: "OK",
			headers: { "content-type": "application/json" },
			body: JSON.stringify(frenchManifest),
			url: "/fr/manifest.json",
		},
	);

	// Command content responses
	const commandFileResponses: Array<[string, string, string]> = [
		["/en/debug-help.md", "en", "debug-help.md"],
		["/fr/debug-help.md", "fr", "debug-help.md"],
		["/en/frontend-component.md", "en", "frontend-component.md"],
		["/en/backend-api.md", "en", "backend-api.md"],
		["/en/code-review.md", "en", "code-review.md"],
		["/en/test-gen.md", "en", "test-gen.md"],
	];

	commandFileResponses.forEach(([urlPattern, lang, commandFile]) => {
		const content =
			commandContents[commandFile as keyof typeof commandContents];
		const body =
			content && typeof content === "object"
				? content[lang as keyof typeof content] || content.en
				: content;

		if (body) {
			client.setResponseWithMatcher((url: string) => url.includes(urlPattern), {
				status: 200,
				statusText: "OK",
				headers: { "content-type": "text/markdown" },
				body,
				url: urlPattern,
			});
		}
	});

	// Error simulation responses
	client.setResponseWithMatcher(
		(url: string) => url.includes("/en/content-error.md"),
		new HTTPNetworkError("/en/content-error.md", "File corrupted"),
	);

	client.setResponseWithMatcher(
		(url: string) => url.includes("/fr/missing-file.md"),
		new HTTPStatusError("/fr/missing-file.md", 404, "File not found on server"),
	);

	// Generic error scenarios for testing
	client.setResponseWithMatcher(
		(url: string) => url.includes("network-error"),
		new HTTPNetworkError("network-error", "Connection failed"),
	);

	client.setResponseWithMatcher(
		(url: string) => url.includes("timeout"),
		new HTTPTimeoutError("timeout", 5000),
	);

	client.setResponseWithMatcher(
		(url: string) => url.includes("not-found"),
		new HTTPStatusError("not-found", 404, "Not Found"),
	);
}
