import {
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	test,
} from "bun:test";
import type IHTTPClient from "../../src/interfaces/IHTTPClient.ts";
import BunHTTPClient from "../../src/services/BunHTTPClient.ts";
import { startMockServer, stopMockServer } from "../helpers/mockHttpServer.ts";
import { runHttpClientContractTests } from "../shared/IHTTPClient.contract.ts";

describe("BunHTTPClient", () => {
	let server: { baseUrl: string };

	beforeAll(() => {
		server = startMockServer();
	});

	afterAll(async () => {
		await stopMockServer();
	});

	// Run the shared contract tests for BunHTTPClient
	describe("Contract Tests", () => {
		runHttpClientContractTests(() => new BunHTTPClient(), {
			get baseUrl() {
				return server.baseUrl;
			},
		});
	});

	// BunHTTPClient-specific tests for real network behavior
	describe("BunHTTPClient Specific Tests", () => {
		let httpClient: IHTTPClient;

		beforeEach(() => {
			httpClient = new BunHTTPClient();
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
