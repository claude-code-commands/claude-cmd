// Package config version management provides build-time version injection
// and version information retrieval for the claude-cmd CLI tool.
//
// The Version variable can be set at build time using linker flags:
//
//	go build -ldflags "-X github.com/claude-code-commands/claude-cmd/pkg/config.Version=v1.0.0"
//
// If no version is set at build time, the tool will report "dev" for development builds.
package config

// Version holds the version string that can be set at build time via linker flags.
// This variable should be set using -ldflags during the build process.
// Example: go build -ldflags "-X pkg/config.Version=v1.0.0"
var Version string

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
