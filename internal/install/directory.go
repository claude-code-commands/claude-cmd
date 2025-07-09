// Package install provides Claude Code directory detection and installation functionality.
// This package handles the detection of Claude Code directories (personal and project),
// directory creation, and command installation for the claude-cmd CLI tool.
package install

import (
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"

	"github.com/spf13/afero"
)

// CommandsSubPath defines the relative path for Claude Code commands directory.
// This constant centralizes the path definition to ensure consistency across
// all directory detection and creation functions.
const CommandsSubPath = ".claude/commands"

// validCommandName validates that command names contain only safe characters
// to prevent path traversal attacks. Only letters, numbers, underscores, and hyphens are allowed.
var validCommandName = regexp.MustCompile(`^[a-zA-Z0-9_-]+$`)

// validNamespacedCommandName validates namespaced command names in the format prefix:namespace:command
// or prefix:namespace:subnamespace:command. Each component must contain only safe characters.
var validNamespacedCommandName = regexp.MustCompile(`^(personal|project)(:([a-zA-Z0-9_-]+))+$`)

// GetPersonalDir returns the path to the personal Claude Code commands directory.
// The personal directory is located at ~/.claude/commands/ and is used when
// no project-specific directory is available.
//
// Returns:
//   - string: The absolute path to the personal Claude Code directory
//   - error: Any error encountered while determining the home directory
//
// Example:
//
//	personalDir, err := GetPersonalDir()
//	if err != nil {
//	    // handle error
//	}
//	// personalDir = "/home/user/.claude/commands" (on Linux)
func GetPersonalDir() (string, error) {
	homeDir, err := os.UserHomeDir()
	if err != nil {
		return "", fmt.Errorf("detecting user home directory: %w", err)
	}

	return filepath.Join(homeDir, CommandsSubPath), nil
}

// GetProjectDir returns the path to the project Claude Code commands directory
// and whether it exists. The project directory is located at ./.claude/commands/
// relative to the current working directory.
//
// Parameters:
//   - fs: Filesystem abstraction for testing and production use
//
// Returns:
//   - string: The path to the project Claude Code directory
//   - bool: Whether the directory exists
//   - error: Any error encountered during directory checking
//
// Example:
//
//	projectDir, exists, err := GetProjectDir(fs)
//	if err != nil {
//	    // handle error
//	}
//	if exists {
//	    // use project directory
//	}
func GetProjectDir(fs afero.Fs) (string, bool, error) {
	projectDir := filepath.Join(".", CommandsSubPath)

	exists, err := afero.DirExists(fs, projectDir)
	if err != nil {
		return projectDir, false, fmt.Errorf("checking project directory existence: %w", err)
	}

	return projectDir, exists, nil
}

// EnsureDir creates the specified directory and all necessary parent directories
// if they don't exist. This function is safe to call on existing directories.
//
// Parameters:
//   - fs: Filesystem abstraction for testing and production use
//   - dir: The directory path to create
//
// Returns:
//   - error: Any error encountered during directory creation
//
// Example:
//
//	err := EnsureDir(fs, "/home/user/.claude/commands")
//	if err != nil {
//	    // handle error
//	}
func EnsureDir(fs afero.Fs, dir string) error {
	return fs.MkdirAll(dir, 0755)
}

// SelectInstallDir chooses the appropriate directory for command installation
// based on context. It prioritizes project directories over personal directories
// to support project-specific command installations.
//
// The selection logic follows this precedence:
//  1. Project directory (./.claude/commands/) if it exists
//  2. Personal directory (~/.claude/commands/) as fallback
//
// Parameters:
//   - fs: Filesystem abstraction for testing and production use
//
// Returns:
//   - string: The selected directory path for command installation
//   - error: Any error encountered during directory detection
//
// Example:
//
//	installDir, err := SelectInstallDir(fs)
//	if err != nil {
//	    // handle error
//	}
//	// Use installDir for command installation
func SelectInstallDir(fs afero.Fs) (string, error) {
	// First, check if project directory exists and prefer it
	projectDir, exists, err := GetProjectDir(fs)
	if err != nil {
		return "", fmt.Errorf("checking project directory: %w", err)
	}

	if exists {
		// Ensure project directory is writable by creating it if needed
		if err := EnsureDir(fs, projectDir); err != nil {
			return "", fmt.Errorf("ensuring project directory: %w", err)
		}
		return projectDir, nil
	}

	// Fallback to personal directory
	personalDir, err := GetPersonalDir()
	if err != nil {
		return "", fmt.Errorf("getting personal directory: %w", err)
	}

	// Ensure personal directory is created and writable
	if err := EnsureDir(fs, personalDir); err != nil {
		return "", fmt.Errorf("ensuring personal directory: %w", err)
	}

	return personalDir, nil
}

// InstallCommand installs a Claude Code command to the specified directory.
// The command content is written to a file named <commandName>.md in the target directory.
//
// The function performs validation to ensure:
//   - The target directory exists
//   - No existing command file conflicts exist
//   - The command content is written with appropriate permissions
//
// Parameters:
//   - fs: Filesystem abstraction for testing and production use
//   - targetDir: The directory where the command should be installed
//   - commandName: The name of the command (used for filename)
//   - commandContent: The command content in Claude Code slash command format
//
// Returns:
//   - error: Any error encountered during installation, including conflicts
//
// Example:
//
//	err := InstallCommand(fs, "/home/user/.claude/commands", "debug-issue", commandContent)
//	if err != nil {
//	    // handle installation error
//	}
func InstallCommand(fs afero.Fs, targetDir, commandName, commandContent string) error {
	// Validate command name to prevent path traversal attacks
	if !validCommandName.MatchString(commandName) {
		return fmt.Errorf("invalid command name %q: only letters, numbers, underscores, and hyphens are allowed", commandName)
	}

	// Validate that target directory exists
	exists, err := afero.DirExists(fs, targetDir)
	if err != nil {
		return fmt.Errorf("checking target directory: %w", err)
	}
	if !exists {
		return fmt.Errorf("target directory %s does not exist", targetDir)
	}

	// Construct the command file path
	commandPath := filepath.Join(targetDir, commandName+".md")

	// Check if command file already exists
	exists, err = afero.Exists(fs, commandPath)
	if err != nil {
		return fmt.Errorf("checking command file existence: %w", err)
	}
	if exists {
		return fmt.Errorf("command %s already exists at %s", commandName, commandPath)
	}

	// Write the command content to file
	err = afero.WriteFile(fs, commandPath, []byte(commandContent), 0644)
	if err != nil {
		return fmt.Errorf("writing command file: %w", err)
	}

	return nil
}

// CommandLocation represents the location of an installed command
type CommandLocation struct {
	Installed bool   // Whether the command is installed
	Path      string // Full path to the command file
	Location  string // Human-readable location description
	Namespace string // Namespace for the command (e.g., "frontend", "backend")
	FullName  string // Full namespaced name (e.g., "project:frontend:component")
}

// FindInstalledCommand searches for an installed command in both project and personal directories.
// It follows the same precedence order as SelectInstallDir: project directory first, then personal directory.
// This function consolidates the command-finding logic used by multiple commands.
// Now supports both regular command names and namespaced command names (e.g., "project:frontend:component").
//
// Parameters:
//   - fs: Filesystem abstraction for testing and production use
//   - commandName: The name of the command to find (regular or namespaced format)
//
// Returns:
//   - CommandLocation: Information about the command's installation status and location
//   - error: Any error encountered during the search
//
// Example:
//
//	location, err := FindInstalledCommand(fs, "debug-issue")
//	location, err := FindInstalledCommand(fs, "project:frontend:component")
//	if err != nil {
//	    // handle error
//	}
//	if location.Installed {
//	    // command found at location.Path
//	}
func FindInstalledCommand(fs afero.Fs, commandName string) (CommandLocation, error) {
	// Handle namespaced commands
	if isNamespacedCommand(commandName) {
		return findNamespacedCommand(fs, commandName)
	}

	// Validate regular command name to prevent path traversal attacks
	if !validCommandName.MatchString(commandName) {
		return CommandLocation{}, fmt.Errorf("invalid command name %q: only letters, numbers, underscores, and hyphens are allowed", commandName)
	}

	commandFile := commandName + ".md"

	// Check project directory first (takes precedence over personal)
	projectDir, exists, err := GetProjectDir(fs)
	if err != nil {
		return CommandLocation{}, fmt.Errorf("checking project directory: %w", err)
	}

	if exists {
		projectPath := filepath.Join(projectDir, commandFile)
		exists, err := afero.Exists(fs, projectPath)
		if err != nil {
			return CommandLocation{}, fmt.Errorf("checking project command file: %w", err)
		}
		if exists {
			// Extract namespace information for consistency
			fullName, namespace := ExtractNamespaceFromPath(projectDir, projectPath)
			return CommandLocation{
				Installed: true,
				Path:      projectPath,
				Location:  projectPath,
				Namespace: namespace,
				FullName:  fullName,
			}, nil
		}
	}

	// Check personal directory as fallback
	personalDir, err := GetPersonalDir()
	if err != nil {
		return CommandLocation{}, fmt.Errorf("getting personal directory: %w", err)
	}

	personalPath := filepath.Join(personalDir, commandFile)
	exists, err = afero.Exists(fs, personalPath)
	if err != nil {
		return CommandLocation{}, fmt.Errorf("checking personal command file: %w", err)
	}
	if exists {
		// Extract namespace information for consistency
		fullName, namespace := ExtractNamespaceFromPath(personalDir, personalPath)
		return CommandLocation{
			Installed: true,
			Path:      personalPath,
			Location:  personalPath,
			Namespace: namespace,
			FullName:  fullName,
		}, nil
	}

	return CommandLocation{Installed: false}, nil
}

// findNamespacedCommand searches for a command using namespaced format
func findNamespacedCommand(fs afero.Fs, namespacedName string) (CommandLocation, error) {
	prefix, namespaceComponents, commandName := parseNamespacedCommand(namespacedName)

	// Validate individual components
	if !validCommandName.MatchString(commandName) {
		return CommandLocation{}, fmt.Errorf("invalid command name in %q: only letters, numbers, underscores, and hyphens are allowed", namespacedName)
	}

	for _, component := range namespaceComponents {
		if !validCommandName.MatchString(component) {
			return CommandLocation{}, fmt.Errorf("invalid namespace component %q in %q: only letters, numbers, underscores, and hyphens are allowed", component, namespacedName)
		}
	}

	// Determine which directory to search based on prefix
	var baseDir string
	var err error

	switch prefix {
	case "project":
		projectDir, exists, dirErr := GetProjectDir(fs)
		if dirErr != nil {
			return CommandLocation{}, fmt.Errorf("checking project directory: %w", dirErr)
		}
		if !exists {
			return CommandLocation{Installed: false}, nil
		}
		baseDir = projectDir
	case "personal":
		baseDir, err = GetPersonalDir()
		if err != nil {
			return CommandLocation{}, fmt.Errorf("getting personal directory: %w", err)
		}
	default:
		return CommandLocation{}, fmt.Errorf("invalid namespace prefix %q: must be 'project' or 'personal'", prefix)
	}

	// Construct the command path
	namespace := strings.Join(namespaceComponents, ":")
	commandPath := constructCommandPath(baseDir, namespace, commandName)

	// Check if the command file exists
	exists, err := afero.Exists(fs, commandPath)
	if err != nil {
		return CommandLocation{}, fmt.Errorf("checking namespaced command file: %w", err)
	}

	if exists {
		return CommandLocation{
			Installed: true,
			Path:      commandPath,
			Location:  commandPath,
			Namespace: strings.Join(namespaceComponents, "/"), // Use forward slashes for display
			FullName:  namespacedName,
		}, nil
	}

	return CommandLocation{Installed: false}, nil
}

// ListInstalledCommands lists all installed Claude Code commands from both project and personal directories.
// It returns a slice of CommandLocation structs sorted alphabetically by command name.
// The function handles missing directories gracefully by returning an empty slice.
//
// Parameters:
//   - fs: Filesystem abstraction for testing and production use
//
// Returns:
//   - []CommandLocation: Slice of command locations with path and installation information
//   - error: Any error encountered during directory scanning
//
// Example:
//
//	commands, err := ListInstalledCommands(fs)
//	if err != nil {
//	    // handle error
//	}
//	for _, cmd := range commands {
//	    fmt.Printf("Command: %s at %s\n", filepath.Base(cmd.Path), cmd.Location)
//	}
func ListInstalledCommands(fs afero.Fs) ([]CommandLocation, error) {
	var commands []CommandLocation

	// Check project directory first
	projectDir, exists, err := GetProjectDir(fs)
	if err == nil && exists {
		projectCommands, err := scanDirectoryForCommands(fs, projectDir)
		if err == nil {
			commands = append(commands, projectCommands...)
		}
	}

	// Check personal directory
	personalDir, err := GetPersonalDir()
	if err == nil {
		exists, err := afero.DirExists(fs, personalDir)
		if err == nil && exists {
			personalCommands, err := scanDirectoryForCommands(fs, personalDir)
			if err == nil {
				commands = append(commands, personalCommands...)
			}
		}
	}

	// Sort commands alphabetically by name
	sortCommandsByName(commands)

	return commands, nil
}

// CommandFileFilter represents the filter criteria for command files
type CommandFileFilter struct {
	Extension        string // File extension to match (e.g., ".md")
	HiddenPrefix     string // Prefix for hidden files to skip (e.g., ".")
	IncludeOnlyFiles bool   // Whether to include only files (not directories)
	Recursive        bool   // Whether to scan subdirectories recursively for namespace support
}

// DefaultCommandFileFilter returns the standard filter for Claude Code command files
func DefaultCommandFileFilter() CommandFileFilter {
	return CommandFileFilter{
		Extension:        ".md",
		HiddenPrefix:     ".",
		IncludeOnlyFiles: true,
		Recursive:        true, // Enable recursive scanning for namespace support
	}
}

// ScanDirectoryWithFilter scans a directory for files matching the given filter.
// This is a shared utility function used by both command listing and counting operations.
// When Recursive is enabled, it scans subdirectories to support namespace functionality.
func ScanDirectoryWithFilter(fs afero.Fs, dir string, filter CommandFileFilter) ([]string, error) {
	if filter.Recursive {
		return scanDirectoryRecursive(fs, dir, filter)
	}
	return scanDirectoryShallow(fs, dir, filter)
}

// scanDirectoryShallow performs non-recursive directory scanning (original behavior)
func scanDirectoryShallow(fs afero.Fs, dir string, filter CommandFileFilter) ([]string, error) {
	files, err := afero.ReadDir(fs, dir)
	if err != nil {
		return nil, err
	}

	var matchingFiles []string
	for _, file := range files {
		name := file.Name()

		// Skip hidden files
		if filter.HiddenPrefix != "" && strings.HasPrefix(name, filter.HiddenPrefix) {
			continue
		}

		// Apply file-only filter
		if filter.IncludeOnlyFiles && file.IsDir() {
			continue
		}

		// Check extension
		if filter.Extension != "" && strings.HasSuffix(strings.ToLower(name), filter.Extension) {
			matchingFiles = append(matchingFiles, filepath.Join(dir, name))
		}
	}

	return matchingFiles, nil
}

// scanDirectoryRecursive performs recursive directory scanning to support namespaces
func scanDirectoryRecursive(fs afero.Fs, dir string, filter CommandFileFilter) ([]string, error) {
	var matchingFiles []string

	err := afero.Walk(fs, dir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}

		// Skip the root directory itself
		if path == dir {
			return nil
		}

		name := info.Name()

		// Skip hidden files and directories
		if filter.HiddenPrefix != "" && strings.HasPrefix(name, filter.HiddenPrefix) {
			if info.IsDir() {
				return filepath.SkipDir
			}
			return nil
		}

		// Only process files if IncludeOnlyFiles is set
		if filter.IncludeOnlyFiles && info.IsDir() {
			return nil
		}

		// Check extension for files
		if !info.IsDir() && filter.Extension != "" && strings.HasSuffix(strings.ToLower(name), filter.Extension) {
			matchingFiles = append(matchingFiles, path)
		}

		return nil
	})

	return matchingFiles, err
}

// scanDirectoryForCommands scans a directory for .md files and returns CommandLocation structs.
// This is a helper function used by ListInstalledCommands.
// It now supports namespace extraction for commands in subdirectories.
func scanDirectoryForCommands(fs afero.Fs, dir string) ([]CommandLocation, error) {
	filePaths, err := ScanDirectoryWithFilter(fs, dir, DefaultCommandFileFilter())
	if err != nil {
		return nil, err
	}

	var commands []CommandLocation
	for _, filePath := range filePaths {
		// Extract namespace information from file path
		fullName, namespace := ExtractNamespaceFromPath(dir, filePath)

		commands = append(commands, CommandLocation{
			Installed: true,
			Path:      filePath,
			Location:  filePath,
			Namespace: namespace,
			FullName:  fullName,
		})
	}

	return commands, nil
}

// sortCommandsByName sorts a slice of CommandLocation structs alphabetically by command name.
// Command name is extracted from the filename by removing the .md extension.
func sortCommandsByName(commands []CommandLocation) {
	// Use standard library sort for O(n log n) performance
	sort.Slice(commands, func(i, j int) bool {
		nameI := strings.TrimSuffix(filepath.Base(commands[i].Path), ".md")
		nameJ := strings.TrimSuffix(filepath.Base(commands[j].Path), ".md")
		return nameI < nameJ
	})
}

// ExtractNamespaceFromPath extracts namespace information from a command file path.
// It returns the full namespaced command name and the namespace component.
//
// For commands in subdirectories, it creates namespaced names in the format:
//   - Project commands: "project:namespace:command" or "project:namespace:subnamespace:command"
//   - Personal commands: "personal:namespace:command" or "personal:namespace:subnamespace:command"
//   - Regular commands: "command" (no namespace)
//
// Parameters:
//   - basePath: The base commands directory path (e.g., ".claude/commands" or "/home/user/.claude/commands")
//   - fullPath: The full path to the command file
//
// Returns:
//   - string: The full namespaced command name
//   - string: The namespace component (empty for non-namespaced commands)
//
// Example:
//
//	basePath: ".claude/commands"
//	fullPath: ".claude/commands/frontend/component.md"
//	returns: "project:frontend:component", "frontend"
func ExtractNamespaceFromPath(basePath, fullPath string) (string, string) {
	// Clean paths to ensure consistent comparison
	basePath = filepath.Clean(basePath)
	fullPath = filepath.Clean(fullPath)

	// Get relative path from base to full path
	relPath, err := filepath.Rel(basePath, fullPath)
	if err != nil {
		// Fallback: extract command name from filename only
		commandName := strings.TrimSuffix(filepath.Base(fullPath), ".md")
		return commandName, ""
	}

	// Split the relative path into components
	pathComponents := strings.Split(filepath.ToSlash(relPath), "/")

	// Extract command name (last component without .md extension)
	commandName := strings.TrimSuffix(pathComponents[len(pathComponents)-1], ".md")

	// Determine prefix based on base path
	var prefix string
	if strings.Contains(basePath, ".claude/commands") &&
		(strings.HasPrefix(basePath, "./") || strings.HasPrefix(basePath, ".claude/") || !strings.HasPrefix(basePath, "/")) {
		prefix = "project"
	} else {
		prefix = "personal"
	}

	// If only one component (command file directly in base directory), no namespace
	if len(pathComponents) == 1 {
		return commandName, ""
	}

	// Build namespace from directory components (excluding the command file)
	namespaceComponents := pathComponents[:len(pathComponents)-1]
	namespace := strings.Join(namespaceComponents, "/")

	// Build full namespaced name
	fullName := prefix + ":" + strings.Join(namespaceComponents, ":") + ":" + commandName

	return fullName, namespace
}

// isNamespacedCommand determines if a command name is in namespaced format
func isNamespacedCommand(commandName string) bool {
	return validNamespacedCommandName.MatchString(commandName) || strings.Contains(commandName, ":")
}

// parseNamespacedCommand parses a namespaced command name into its components.
// Returns prefix, namespace components, and command name.
//
// Example:
//
//	"project:frontend:component" -> "project", ["frontend"], "component"
//	"personal:backend:api:create" -> "personal", ["backend", "api"], "create"
func parseNamespacedCommand(namespacedName string) (prefix string, namespaceComponents []string, commandName string) {
	parts := strings.Split(namespacedName, ":")
	if len(parts) < 2 {
		// Not a valid namespaced command
		return "", nil, namespacedName
	}

	prefix = parts[0]
	if len(parts) == 2 {
		// Format: "prefix:command" (no namespace)
		return prefix, nil, parts[1]
	}

	// Format: "prefix:namespace:...:command"
	commandName = parts[len(parts)-1]
	namespaceComponents = parts[1 : len(parts)-1]

	return prefix, namespaceComponents, commandName
}

// constructCommandPath builds the file path for a namespaced command.
// It takes a base directory and namespace information to construct the full path.
func constructCommandPath(baseDir, namespace, commandName string) string {
	if namespace == "" {
		// Non-namespaced command
		return filepath.Join(baseDir, commandName+".md")
	}

	// Convert namespace to directory path
	namespacePath := strings.ReplaceAll(namespace, ":", string(filepath.Separator))
	return filepath.Join(baseDir, namespacePath, commandName+".md")
}
