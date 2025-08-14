import { configure, getConsoleSink, getLogger } from "@logtape/logtape";

/**
 * Centralized logger configuration for claude-cmd
 *
 * Creates a hierarchical logger structure:
 * - claude-cmd (root)
 *   - file (real/mock)
 *   - http (real/mock)
 *   - repo (real)
 *   - install (real)
 *   - interaction (real/mock)
 */

let isConfigured = false;

/**
 * Configure LogTape with the specified log level
 * This function should be called only once, early in the application lifecycle
 */
export async function configureLogger(level: string = "info"): Promise<void> {
	if (isConfigured) {
		return; // Already configured, ignore subsequent calls
	}

	await configure({
		sinks: {
			console: getConsoleSink(),
		},
		loggers: [
			{
				category: "claude-cmd",
				lowestLevel: level as any, // Use the provided level
				sinks: ["console"],
			},
			{
				category: ["logtape", "meta"],
				lowestLevel: "warning", // Suppress info-level meta logger messages
				sinks: ["console"],
			},
		],
	});

	isConfigured = true;
}

// Root logger - will be properly initialized after configure() is called
let rootLogger: ReturnType<typeof getLogger>;

/**
 * Get the root logger instance (call this after configureLogger)
 */
export function getRootLogger() {
	if (!rootLogger) {
		rootLogger = getLogger(["claude-cmd"]);
	}
	return rootLogger;
}

// Implementation-specific loggers
export const fileLogger = getLogger(["claude-cmd", "file"]);
export const httpLogger = getLogger(["claude-cmd", "http"]);
export const repoLogger = getLogger(["claude-cmd", "repo"]);
export const installLogger = getLogger(["claude-cmd", "install"]);
export const interactionLogger = getLogger(["claude-cmd", "interaction"]);

// Export root logger getter for main.ts verbose flag control
export { getRootLogger as rootLogger };

/**
 * Enable verbose logging message
 * Called when --verbose flag is detected (but LogTape is already configured with debug level)
 */
export function enableVerboseLogging(): void {
	// LogTape is already configured with the correct level based on early argument parsing
	// This function just logs a confirmation message
	getRootLogger().info("Verbose logging enabled.");
}
