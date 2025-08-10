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
	});
});
