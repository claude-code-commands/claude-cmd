import type { Server } from "bun";

let server: Server | null = null;

// Simple router to handle httpbin-compatible requests
async function router(req: Request): Promise<Response> {
	const url = new URL(req.url);
	const { pathname, searchParams } = url;

	if (pathname === "/get") {
		return Response.json({
			args: Object.fromEntries(searchParams),
			headers: Object.fromEntries(req.headers),
			url: req.url,
		});
	}

	if (pathname === "/headers") {
		return Response.json({
			headers: Object.fromEntries(req.headers),
		});
	}

	if (pathname === "/json") {
		return Response.json({
			slideshow: {
				title: "Sample Slide Show",
				slides: [{ title: "Wake up to WonderWidgets!" }],
			},
		});
	}

	if (pathname === "/html") {
		return new Response(
			"<!DOCTYPE html><html><body><h1>Herman Melville - Moby-Dick</h1></body></html>",
			{ headers: { "Content-Type": "text/html" } },
		);
	}

	if (pathname === "/xml") {
		return new Response(
			'<?xml version="1.0" encoding="UTF-8"?><slideshow><slide><title>Sample</title></slide></slideshow>',
			{ headers: { "Content-Type": "application/xml" } },
		);
	}

	// Handle status codes
	const statusMatch = pathname.match(/^\/status\/(\d{3})$/);
	if (statusMatch?.[1]) {
		const code = parseInt(statusMatch[1], 10);
		const statusText = getStatusText(code);
		return new Response(code === 204 ? null : statusText, {
			status: code,
			statusText,
		});
	}

	// Handle delays
	const delayMatch = pathname.match(/^\/delay\/(\d+)$/);
	if (delayMatch?.[1]) {
		const seconds = parseInt(delayMatch[1], 10);
		await Bun.sleep(seconds * 1000);
		return Response.json({
			args: Object.fromEntries(searchParams),
			delayed: true,
		});
	}

	// Handle redirects
	const redirectMatch = pathname.match(/^\/redirect\/(\d+)$/);
	if (redirectMatch?.[1]) {
		const redirectCount = parseInt(redirectMatch[1], 10);
		if (redirectCount > 1) {
			return Response.redirect(
				`${url.origin}/redirect/${redirectCount - 1}`,
				302,
			);
		}
		return Response.redirect(`${url.origin}/get`, 302);
	}

	return new Response("Not Found", { status: 404 });
}

function getStatusText(code: number): string {
	const statusTexts: Record<number, string> = {
		200: "OK",
		204: "No Content",
		404: "Not Found",
		500: "Internal Server Error",
	};
	return statusTexts[code] || "Unknown";
}

export function startMockServer(): { baseUrl: string } {
	if (server) {
		throw new Error("Server is already running");
	}

	server = Bun.serve({
		port: 0, // Let the OS assign a random available port
		fetch: router,
	});

	return { baseUrl: `http://${server.hostname}:${server.port}` };
}

export async function stopMockServer(): Promise<void> {
	if (server) {
		await server.stop(true);
		server = null;
	}
}
