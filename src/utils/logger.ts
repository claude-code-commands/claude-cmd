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
			// Service-specific loggers inherit from root but ensure debug level
			{
				category: ["claude-cmd", "repo"],
				lowestLevel: level as any,
				sinks: ["console"],
			},
			{
				category: ["claude-cmd", "http"],
				lowestLevel: level as any,
				sinks: ["console"],
			},
			{
				category: ["claude-cmd", "file"],
				lowestLevel: level as any,
				sinks: ["console"],
			},
			{
				category: ["claude-cmd", "install"],
				lowestLevel: level as any,
				sinks: ["console"],
			},
			{
				category: ["claude-cmd", "interaction"],
				lowestLevel: level as any,
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

// Service loggers
const fileLogger = getLogger(["claude-cmd", "file"]);
const httpLogger = getLogger(["claude-cmd", "http"]);
const repoLogger = getLogger(["claude-cmd", "repo"]);
const installLogger = getLogger(["claude-cmd", "install"]);
const interactionLogger = getLogger(["claude-cmd", "interaction"]);

// Implementation-specific loggers
export const realFileLogger = getLogger(["claude-cmd", "file", "real"]);
export const mockFileLogger = getLogger(["claude-cmd", "file", "mock"]);
export const realHttpLogger = getLogger(["claude-cmd", "http", "real"]);
export const mockHttpLogger = getLogger(["claude-cmd", "http", "mock"]);
export const realRepoLogger = getLogger(["claude-cmd", "repo", "real"]);
export const realInstallLogger = getLogger(["claude-cmd", "install", "real"]);
export const realInteractionLogger = getLogger([
	"claude-cmd",
	"interaction",
	"real",
]);
export const mockInteractionLogger = getLogger([
	"claude-cmd",
	"interaction",
	"mock",
]);

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
