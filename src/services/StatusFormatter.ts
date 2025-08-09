import type { CacheInfo, InstallationInfo, SystemStatus, StatusOutputFormat } from "../types/Status.js";

/**
 * Formatter for system status output in various formats
 *
 * Provides consistent formatting of status information across different
 * output modes to meet diverse user and automation needs.
 *
 * Features:
 * - Default human-readable format with rich details
 * - Compact format optimized for quick scanning
 * - JSON format for programmatic consumption
 * - Consistent styling and messaging
 */
export class StatusFormatter {
	/**
	 * Format system status in the specified output format
	 *
	 * @param status - System status data to format
	 * @param format - Output format to use
	 * @returns Formatted status string
	 */
	format(status: SystemStatus, format: StatusOutputFormat): string {
		switch (format) {
			case "json":
				return this.formatJson(status);
			case "compact":
				return this.formatCompact(status);
			case "default":
			default:
				return this.formatDefault(status);
		}
	}

	/**
	 * Format status in default human-readable format
	 *
	 * @param status - System status data
	 * @returns Formatted status string
	 */
	private formatDefault(status: SystemStatus): string {
		const lines: string[] = [];
		
		// Header
		lines.push("Claude CMD System Status");
		lines.push("=======================");
		const dateFormatter = new Intl.DateTimeFormat(undefined, {
		dateStyle: 'full',
		timeStyle: 'long'
	});
	lines.push(`Status collected at: ${dateFormatter.format(new Date(status.timestamp))}`);
		lines.push("");

		// System Health
		lines.push("System Health:");
		const healthIcon = this.getHealthIcon(status.health.status);
		lines.push(`  Overall Status: ${healthIcon} ${status.health.status.toUpperCase()}`);
		lines.push(`  Cache Accessible: ${status.health.cacheAccessible ? "✅ Yes" : "❌ No"}`);
		lines.push(`  Installation Possible: ${status.health.installationPossible ? "✅ Yes" : "❌ No"}`);
		
		if (status.health.messages.length > 0) {
			lines.push("  Messages:");
			for (const message of status.health.messages) {
				lines.push(`    ⚠️  ${message}`);
			}
		}
		lines.push("");

		// Cache Status
		lines.push("Cache Status:");
		if (status.cache.length === 0) {
			lines.push("  No cache information available");
		} else {
			for (const cache of status.cache) {
				lines.push(`  Language: ${cache.language}`);
				lines.push(`    Exists: ${cache.exists ? "✅ Yes" : "❌ No"}`);
				if (cache.exists) {
					lines.push(`    Expired: ${cache.isExpired ? "⚠️  Yes" : "✅ No"}`);
					if (cache.ageMs !== undefined) {
						lines.push(`    Age: ${this.formatDuration(cache.ageMs)}`);
					}
					if (cache.sizeBytes !== undefined) {
						lines.push(`    Size: ${this.formatFileSize(cache.sizeBytes)}`);
					}
					if (cache.commandCount !== undefined) {
						lines.push(`    Commands: ${cache.commandCount}`);
					}
				}
				lines.push(`    Path: ${cache.path}`);
				lines.push("");
			}
		}

		// Installation Directories
		lines.push("Installation Directories:");
		if (status.installations.length === 0) {
			lines.push("  No installation directories found");
		} else {
			for (const install of status.installations) {
				lines.push(`  ${install.type.charAt(0).toUpperCase() + install.type.slice(1)} Directory:`);
				lines.push(`    Exists: ${install.exists ? "✅ Yes" : "❌ No"}`);
				if (install.exists) {
					lines.push(`    Writable: ${install.writable ? "✅ Yes" : "❌ No"}`);
					lines.push(`    Commands Installed: ${install.commandCount}`);
				}
				lines.push(`    Path: ${install.path}`);
				lines.push("");
			}
		}

		return lines.join("\n").trim();
	}

	/**
	 * Format status in compact format for quick scanning
	 *
	 * @param status - System status data
	 * @returns Compact formatted status string
	 */
	private formatCompact(status: SystemStatus): string {
		const lines: string[] = [];
		
		// One-line summary
		const healthIcon = this.getHealthIcon(status.health.status);
		lines.push(`Status: ${healthIcon} ${status.health.status.toUpperCase()}`);
		
		// Cache summary
		const validCaches = status.cache.filter(c => c.exists && !c.isExpired).length;
		const totalCaches = status.cache.length;
		lines.push(`Cache: ${validCaches}/${totalCaches} valid`);
		
		// Installation summary
		const writableInstalls = status.installations.filter(i => i.exists && i.writable).length;
		const totalInstalls = status.installations.length;
		const totalCommands = status.installations.reduce((sum, i) => sum + i.commandCount, 0);
		lines.push(`Installs: ${writableInstalls}/${totalInstalls} writable, ${totalCommands} commands`);

		// Warnings if any
		if (status.health.messages.length > 0) {
			lines.push(`Warnings: ${status.health.messages.length}`);
		}

		return lines.join(" | ");
	}

	/**
	 * Format status in JSON format for programmatic consumption
	 *
	 * @param status - System status data
	 * @returns JSON formatted status string
	 */
	private formatJson(status: SystemStatus): string {
		return JSON.stringify(status, null, 2);
	}

	/**
	 * Get appropriate icon for health status
	 *
	 * @param status - Health status
	 * @returns Icon string
	 */
	private getHealthIcon(status: "healthy" | "degraded" | "error"): string {
		switch (status) {
			case "healthy":
				return "✅";
			case "degraded":
				return "⚠️ ";
			case "error":
				return "❌";
			default:
				return "❓";
		}
	}

	/**
	 * Format duration in human-readable format
	 *
	 * @param ms - Duration in milliseconds
	 * @returns Formatted duration string
	 */
	private formatDuration(ms: number): string {
		const seconds = Math.floor(ms / 1000);
		const minutes = Math.floor(seconds / 60);
		const hours = Math.floor(minutes / 60);
		const days = Math.floor(hours / 24);

		if (days > 0) {
			return `${days}d ${hours % 24}h`;
		}
		if (hours > 0) {
			return `${hours}h ${minutes % 60}m`;
		}
		if (minutes > 0) {
			return `${minutes}m ${seconds % 60}s`;
		}
		return `${seconds}s`;
	}

	/**
	 * Format file size in human-readable format
	 *
	 * @param bytes - Size in bytes
	 * @returns Formatted size string
	 */
	private formatFileSize(bytes: number): string {
		const units = ["B", "KB", "MB", "GB"];
		let size = bytes;
		let unitIndex = 0;

		while (size >= 1024 && unitIndex < units.length - 1) {
			size /= 1024;
			unitIndex++;
		}

		return `${size.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
	}
}