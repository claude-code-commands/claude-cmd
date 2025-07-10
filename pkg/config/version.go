// Package config version management provides build-time version injection
// and version information retrieval for the claude-cmd CLI tool.
//
// The Version, CommitHash, and BuildDate variables can be set at build time using linker flags:
//
//	go build -ldflags "-X github.com/claude-code-commands/claude-cmd/pkg/config.Version=v1.0.0 -X github.com/claude-code-commands/claude-cmd/pkg/config.CommitHash=abc123 -X github.com/claude-code-commands/claude-cmd/pkg/config.BuildDate=2023-01-01T00:00:00Z"
//
// If no version is set at build time, the tool will report "dev" for development builds.
package config

import "fmt"

// Version holds the version string that can be set at build time via linker flags.
// This variable should be set using -ldflags during the build process.
// Example: go build -ldflags "-X pkg/config.Version=v1.0.0"
var Version string

// CommitHash holds the git commit hash that can be set at build time via linker flags.
// This variable should be set using -ldflags during the build process.
// Example: go build -ldflags "-X pkg/config.CommitHash=abc123"
var CommitHash string

// BuildDate holds the build date that can be set at build time via linker flags.
// This variable should be set using -ldflags during the build process.
// Example: go build -ldflags "-X pkg/config.BuildDate=2023-01-01T00:00:00Z"
var BuildDate string

// GetVersion returns the current version of the application.
// If no version was set at build time (Version is empty), it returns "dev"
// to indicate this is a development build.
//
// Returns:
//   - string: The version string ("dev" for development builds, or the build-time version)
//
// Example:
//
//	version := GetVersion()
//	// Returns "dev" for development builds
//	// Returns "v1.0.0" if built with -ldflags "-X pkg/config.Version=v1.0.0"
func GetVersion() string {
	if Version == "" {
		return "dev"
	}
	return Version
}

// GetCommitHash returns the git commit hash used to build the application.
// If no commit hash was set at build time (CommitHash is empty), it returns "unknown".
//
// Returns:
//   - string: The commit hash ("unknown" for development builds, or the build-time commit hash)
func GetCommitHash() string {
	if CommitHash == "" {
		return "unknown"
	}
	return CommitHash
}

// GetBuildDate returns the date when the application was built.
// If no build date was set at build time (BuildDate is empty), it returns "unknown".
//
// Returns:
//   - string: The build date ("unknown" for development builds, or the build-time date)
func GetBuildDate() string {
	if BuildDate == "" {
		return "unknown"
	}
	return BuildDate
}

// GetFullVersion returns a comprehensive version string that includes version, commit hash, and build date.
// This is useful for detailed version information in help text or debugging.
//
// Returns:
//   - string: A formatted version string with all build information
//
// Example:
//
//	fullVersion := GetFullVersion()
//	// Returns "claude-cmd v1.0.0 (abc123) built on 2023-01-01T00:00:00Z"
//	// Returns "claude-cmd dev (unknown) built on unknown" for development builds
func GetFullVersion() string {
	return fmt.Sprintf("claude-cmd %s (%s) built on %s", GetVersion(), GetCommitHash(), GetBuildDate())
}
