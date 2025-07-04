package cmd

import (
	"fmt"
	"io"
	"net/http"
	"path"
	"path/filepath"
	"strings"
	"time"

	"github.com/claude-code-commands/claude-cmd/internal/cache"
	"github.com/claude-code-commands/claude-cmd/internal/command"
	"github.com/claude-code-commands/claude-cmd/internal/install"
	"github.com/claude-code-commands/claude-cmd/internal/interfaces"
	"github.com/spf13/afero"
	"github.com/spf13/cobra"
	"gopkg.in/yaml.v3"
)

// InfoOption configures the info command
type InfoOption func(*infoConfig)

// infoConfig holds configuration for the info command
type infoConfig struct {
	cacheManager interfaces.CacheManagerInterface
	httpClient   HTTPClientInterface
	baseURL      string
}

// WithInfoCacheManager sets a custom cache manager for testing
func WithInfoCacheManager(cm interfaces.CacheManagerInterface) InfoOption {
	return func(config *infoConfig) {
		config.cacheManager = cm
	}
}

// WithInfoHTTPClient sets a custom HTTP client for testing
func WithInfoHTTPClient(client HTTPClientInterface) InfoOption {
	return func(config *infoConfig) {
		config.httpClient = client
	}
}

// WithInfoBaseURL sets a custom base URL for testing
func WithInfoBaseURL(url string) InfoOption {
	return func(config *infoConfig) {
		config.baseURL = url
	}
}

// newInfoCommand creates the info command for displaying command information
func newInfoCommand(fs afero.Fs, opts ...InfoOption) *cobra.Command {
	// Apply configuration options with defaults
	config := &infoConfig{
		baseURL: "https://raw.githubusercontent.com/claude-code-commands/commands/refs/heads/main",
	}
	for _, opt := range opts {
		opt(config)
	}

	cmd := &cobra.Command{
		Use:   "info <command-name>",
		Short: "Show detailed information about a Claude Code command",
		Long: `Info displays detailed information about a Claude Code slash command from the repository.

Shows command description, installation status, and optionally the full command content.
Use --detailed flag to fetch and display the complete command file content.`,
		Args: cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			commandName := args[0]
			detailed, _ := cmd.Flags().GetBool("detailed")
			return runInfoCommand(cmd, fs, commandName, detailed, config)
		},
	}

	// Add detailed flag with clear description
	cmd.Flags().BoolP("detailed", "d", false, "Show detailed command content with full file preview")

	return cmd
}

// runInfoCommand executes the info command logic
func runInfoCommand(cmd *cobra.Command, fs afero.Fs, commandName string, detailed bool, config *infoConfig) error {
	// Set up default HTTP client if not provided (for detailed mode)
	if config.httpClient == nil {
		config.httpClient = &http.Client{
			Timeout: 15 * time.Second,
			Transport: &http.Transport{
				Proxy: http.ProxyFromEnvironment,
			},
		}
	}

	// Use shared command setup utilities to eliminate duplication
	baseConfig := &command.BaseConfig{
		CacheManager: config.cacheManager,
		FileSystem:   fs,
	}

	manifest, lang, err := command.CommonCommandSetup(baseConfig, getCurrentLanguage)
	if err != nil {
		return err
	}

	// Look up command in manifest
	var targetCommand *cache.Command
	for _, command := range manifest.Commands {
		if command.Name == commandName {
			targetCommand = &command
			break
		}
	}

	if targetCommand == nil {
		return fmt.Errorf("command %q not found. Run 'claude-cmd list' to see available commands", commandName)
	}

	// Display basic command information
	fmt.Fprintf(cmd.OutOrStdout(), "Command: %s\n", targetCommand.Name)
	fmt.Fprintf(cmd.OutOrStdout(), "Description: %s\n", targetCommand.Description)
	fmt.Fprintf(cmd.OutOrStdout(), "Repository File: %s\n", targetCommand.File)

	// Check installation status
	status := getInstallationStatus(fs, commandName)
	fmt.Fprintf(cmd.OutOrStdout(), "Installation Status: %s\n", status)

	// Fetch and display detailed content if requested
	if detailed {
		err := displayDetailedContent(cmd, fs, targetCommand, lang, config)
		if err != nil {
			// Don't fail completely on detailed mode errors - show basic info
			fmt.Fprintf(cmd.OutOrStderr(), "\nWarning: Failed to fetch detailed content: %v\n", err)
		}
	}

	return nil
}

// installStatus represents the installation status of a command
type installStatus struct {
	installed bool
	location  string
}

// String returns a formatted string representation of the installation status
func (s installStatus) String() string {
	if s.installed {
		return fmt.Sprintf("Installed at %s", s.location)
	}
	return "Not installed"
}

// getInstallationStatus checks if a command is installed and returns its status.
// This function checks project directory first (higher precedence), then personal directory.
func getInstallationStatus(fs afero.Fs, commandName string) installStatus {
	commandFile := commandName + ".md"

	// Check project directory first (takes precedence over personal)
	if projectStatus := checkProjectInstallation(fs, commandFile); projectStatus.installed {
		return projectStatus
	}

	// Check personal directory as fallback
	if personalStatus := checkPersonalInstallation(fs, commandFile); personalStatus.installed {
		return personalStatus
	}

	return installStatus{installed: false}
}

// checkProjectInstallation checks if command is installed in project directory
func checkProjectInstallation(fs afero.Fs, commandFile string) installStatus {
	projectDir, exists, err := install.GetProjectDir(fs)
	if err != nil || !exists {
		return installStatus{installed: false}
	}

	projectPath := filepath.Join(projectDir, commandFile)
	if exists, _ := afero.Exists(fs, projectPath); exists {
		return installStatus{installed: true, location: projectPath}
	}

	return installStatus{installed: false}
}

// checkPersonalInstallation checks if command is installed in personal directory
func checkPersonalInstallation(fs afero.Fs, commandFile string) installStatus {
	personalDir, err := install.GetPersonalDir()
	if err != nil {
		return installStatus{installed: false}
	}

	personalPath := filepath.Join(personalDir, commandFile)
	if exists, _ := afero.Exists(fs, personalPath); exists {
		return installStatus{installed: true, location: personalPath}
	}

	return installStatus{installed: false}
}

// displayDetailedContent fetches and displays the detailed command content
func displayDetailedContent(cmd *cobra.Command, fs afero.Fs, command *cache.Command, lang string, config *infoConfig) error {
	// Sanitize file path to prevent path traversal attacks
	cleanFile := filepath.ToSlash(path.Clean("/" + command.File))[1:]
	if strings.Contains(cleanFile, "..") {
		return fmt.Errorf("invalid file path in manifest: %s", command.File)
	}

	// Construct URL for command content
	commandURL := fmt.Sprintf("%s/pages/%s/%s", config.baseURL, lang, cleanFile)

	// Fetch content from repository
	resp, err := config.httpClient.Get(commandURL)
	if err != nil {
		return fmt.Errorf("failed to fetch command content: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("failed to fetch content: server returned status %d", resp.StatusCode)
	}

	// Read and parse content
	content, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("failed to read command content: %w", err)
	}

	// Parse and display content
	parsedContent, err := parseCommandContent(string(content))
	if err != nil {
		return fmt.Errorf("failed to parse command content: %w", err)
	}

	// Display detailed content
	fmt.Fprintf(cmd.OutOrStdout(), "\nContent Preview:\n")
	fmt.Fprintf(cmd.OutOrStdout(), "%s\n", parsedContent)

	return nil
}

// commandContent represents parsed command file structure
type commandContent struct {
	frontmatter string
	body        string
}

// String returns formatted display of the command content
func (c commandContent) String() string {
	var result strings.Builder

	if c.frontmatter != "" {
		result.WriteString("---\n")
		result.WriteString(c.frontmatter)
		result.WriteString("---\n\n")
	}

	// Apply intelligent truncation for content preview
	lines := strings.Split(c.body, "\n")
	if len(lines) > maxPreviewLines {
		result.WriteString(strings.Join(lines[:maxPreviewLines], "\n"))
		result.WriteString(contentTruncateMsg)
	} else if len(c.body) > maxPreviewCharacters {
		result.WriteString(c.body[:maxPreviewCharacters])
		result.WriteString(contentTruncateMsg)
	} else {
		result.WriteString(c.body)
	}

	return result.String()
}

const (
	// Preview limits for content display
	maxPreviewLines      = 10
	maxPreviewCharacters = 500
	contentTruncateMsg   = "\n\n[... content truncated ...]"
)

// parseCommandContent parses YAML frontmatter and markdown content.
// Handles both files with and without YAML frontmatter gracefully.
// If YAML parsing fails, treats the entire content as plain text.
func parseCommandContent(content string) (commandContent, error) {
	// Split on YAML frontmatter delimiters
	parts := strings.SplitN(content, "---", 3)
	if len(parts) < 3 {
		// No valid frontmatter structure, treat entire content as body
		return commandContent{body: strings.TrimSpace(content)}, nil
	}

	frontmatterRaw := strings.TrimSpace(parts[1])
	body := strings.TrimSpace(parts[2])

	// Validate YAML frontmatter by attempting to parse it
	var frontmatterData map[string]interface{}
	if err := yaml.Unmarshal([]byte(frontmatterRaw), &frontmatterData); err != nil {
		// If YAML parsing fails, treat entire content as plain text
		return commandContent{body: strings.TrimSpace(content)}, nil
	}

	return commandContent{
		frontmatter: frontmatterRaw,
		body:        body,
	}, nil
}
