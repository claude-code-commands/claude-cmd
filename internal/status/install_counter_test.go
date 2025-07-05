package status

import (
	"path/filepath"
	"testing"

	"github.com/claude-code-commands/claude-cmd/internal/install"
	"github.com/spf13/afero"
)

// RED PHASE: Test basic InstallCounter interface and structure
func TestNewInstallCounter_Success(t *testing.T) {
	fs := afero.NewMemMapFs()

	counter := NewInstallCounter(fs)

	if counter == nil {
		t.Fatal("NewInstallCounter returned nil")
	}
}

// RED PHASE: Test counting no installed commands
func TestInstallCounter_NoCommandsInstalled(t *testing.T) {
	fs := afero.NewMemMapFs()
	counter := NewInstallCounter(fs)

	status, err := counter.GetInstalledStatus("en")

	if err != nil {
		t.Fatalf("Expected no error for empty directories, got: %v", err)
	}

	if status == nil {
		t.Fatal("Expected InstalledStatus to be returned, got nil")
	}

	if status.TotalCount != 0 {
		t.Errorf("Expected TotalCount to be 0, got: %d", status.TotalCount)
	}

	if status.PersonalCount != 0 {
		t.Errorf("Expected PersonalCount to be 0, got: %d", status.PersonalCount)
	}

	if status.ProjectCount != 0 {
		t.Errorf("Expected ProjectCount to be 0, got: %d", status.ProjectCount)
	}
}

// RED PHASE: Test counting commands in project directory only
func TestInstallCounter_ProjectCommandsOnly(t *testing.T) {
	fs := afero.NewMemMapFs()

	// Create project directory with commands
	projectDir := filepath.Join(".", install.CommandsSubPath)
	err := fs.MkdirAll(projectDir, 0755)
	if err != nil {
		t.Fatalf("Failed to create project directory: %v", err)
	}

	// Create test command files
	testCommands := []string{"debug-issue.md", "write-tests.md", "optimize-code.md"}
	for _, cmd := range testCommands {
		cmdPath := filepath.Join(projectDir, cmd)
		err := afero.WriteFile(fs, cmdPath, []byte("test content"), 0644)
		if err != nil {
			t.Fatalf("Failed to create test command %s: %v", cmd, err)
		}
	}

	counter := NewInstallCounter(fs)
	status, err := counter.GetInstalledStatus("en")

	if err != nil {
		t.Fatalf("Expected no error, got: %v", err)
	}

	if status.TotalCount != 3 {
		t.Errorf("Expected TotalCount to be 3, got: %d", status.TotalCount)
	}

	if status.ProjectCount != 3 {
		t.Errorf("Expected ProjectCount to be 3, got: %d", status.ProjectCount)
	}

	if status.PersonalCount != 0 {
		t.Errorf("Expected PersonalCount to be 0, got: %d", status.PersonalCount)
	}
}

// RED PHASE: Test counting commands in personal directory only
func TestInstallCounter_PersonalCommandsOnly(t *testing.T) {
	fs := afero.NewMemMapFs()

	// Get personal directory (use a mock path since we can't easily mock os.UserHomeDir)
	// For testing, we'll create a personal-like directory structure
	personalDir := filepath.Join("home", "user", install.CommandsSubPath)
	err := fs.MkdirAll(personalDir, 0755)
	if err != nil {
		t.Fatalf("Failed to create personal directory: %v", err)
	}

	// Create test command files
	testCommands := []string{"personal-debug.md", "personal-test.md"}
	for _, cmd := range testCommands {
		cmdPath := filepath.Join(personalDir, cmd)
		err := afero.WriteFile(fs, cmdPath, []byte("test content"), 0644)
		if err != nil {
			t.Fatalf("Failed to create test command %s: %v", cmd, err)
		}
	}

	// Create InstallCounter with mock personal directory path
	counter := NewInstallCounterWithPersonalDir(fs, personalDir)
	status, err := counter.GetInstalledStatus("en")

	if err != nil {
		t.Fatalf("Expected no error, got: %v", err)
	}

	if status.TotalCount != 2 {
		t.Errorf("Expected TotalCount to be 2, got: %d", status.TotalCount)
	}

	if status.PersonalCount != 2 {
		t.Errorf("Expected PersonalCount to be 2, got: %d", status.PersonalCount)
	}

	if status.ProjectCount != 0 {
		t.Errorf("Expected ProjectCount to be 0, got: %d", status.ProjectCount)
	}
}

// RED PHASE: Test counting commands in both directories
func TestInstallCounter_BothDirectories(t *testing.T) {
	fs := afero.NewMemMapFs()

	// Create project directory with commands
	projectDir := filepath.Join(".", install.CommandsSubPath)
	err := fs.MkdirAll(projectDir, 0755)
	if err != nil {
		t.Fatalf("Failed to create project directory: %v", err)
	}

	// Create personal directory with commands
	personalDir := filepath.Join("home", "user", install.CommandsSubPath)
	err = fs.MkdirAll(personalDir, 0755)
	if err != nil {
		t.Fatalf("Failed to create personal directory: %v", err)
	}

	// Create project commands
	projectCommands := []string{"project-debug.md", "project-test.md"}
	for _, cmd := range projectCommands {
		cmdPath := filepath.Join(projectDir, cmd)
		err := afero.WriteFile(fs, cmdPath, []byte("project content"), 0644)
		if err != nil {
			t.Fatalf("Failed to create project command %s: %v", cmd, err)
		}
	}

	// Create personal commands
	personalCommands := []string{"personal-debug.md", "personal-test.md", "personal-extra.md"}
	for _, cmd := range personalCommands {
		cmdPath := filepath.Join(personalDir, cmd)
		err := afero.WriteFile(fs, cmdPath, []byte("personal content"), 0644)
		if err != nil {
			t.Fatalf("Failed to create personal command %s: %v", cmd, err)
		}
	}

	// Create InstallCounter with mock personal directory path
	counter := NewInstallCounterWithPersonalDir(fs, personalDir)
	status, err := counter.GetInstalledStatus("en")

	if err != nil {
		t.Fatalf("Expected no error, got: %v", err)
	}

	if status.TotalCount != 5 {
		t.Errorf("Expected TotalCount to be 5, got: %d", status.TotalCount)
	}

	if status.ProjectCount != 2 {
		t.Errorf("Expected ProjectCount to be 2, got: %d", status.ProjectCount)
	}

	if status.PersonalCount != 3 {
		t.Errorf("Expected PersonalCount to be 3, got: %d", status.PersonalCount)
	}
}

// RED PHASE: Test handling directory access errors
func TestInstallCounter_DirectoryAccessError(t *testing.T) {
	// Using ReadOnlyFs to simulate permission errors
	baseFs := afero.NewMemMapFs()
	fs := afero.NewReadOnlyFs(baseFs)

	counter := NewInstallCounter(fs)
	status, err := counter.GetInstalledStatus("en")

	// Should handle errors gracefully
	if err != nil {
		t.Fatalf("Expected no error for directory access issues, got: %v", err)
	}

	// Should return zero counts when directories can't be accessed
	if status.TotalCount != 0 {
		t.Errorf("Expected TotalCount to be 0 on access error, got: %d", status.TotalCount)
	}
}

// RED PHASE: Test filtering non-.md files
func TestInstallCounter_FilterNonMdFiles(t *testing.T) {
	fs := afero.NewMemMapFs()

	// Create project directory
	projectDir := filepath.Join(".", install.CommandsSubPath)
	err := fs.MkdirAll(projectDir, 0755)
	if err != nil {
		t.Fatalf("Failed to create project directory: %v", err)
	}

	// Create mix of .md and non-.md files
	files := []string{
		"valid-command.md",
		"another-command.md",
		"readme.txt",  // Should be ignored
		"config.json", // Should be ignored
		"hidden-file", // Should be ignored
		".hidden.md",  // Should be ignored (hidden file)
		"script.sh",   // Should be ignored
	}

	for _, file := range files {
		filePath := filepath.Join(projectDir, file)
		err := afero.WriteFile(fs, filePath, []byte("content"), 0644)
		if err != nil {
			t.Fatalf("Failed to create test file %s: %v", file, err)
		}
	}

	counter := NewInstallCounter(fs)
	status, err := counter.GetInstalledStatus("en")

	if err != nil {
		t.Fatalf("Expected no error, got: %v", err)
	}

	// Should only count .md files (excluding hidden files)
	if status.TotalCount != 2 {
		t.Errorf("Expected TotalCount to be 2 (.md files only), got: %d", status.TotalCount)
	}

	if status.ProjectCount != 2 {
		t.Errorf("Expected ProjectCount to be 2, got: %d", status.ProjectCount)
	}
}

// RED PHASE: Test language parameter (placeholder for future i18n support)
func TestInstallCounter_LanguageParameter(t *testing.T) {
	fs := afero.NewMemMapFs()
	counter := NewInstallCounter(fs)

	// Test that different language codes work (even if functionality is same for now)
	languages := []string{"en", "es", "fr", "de"}

	for _, lang := range languages {
		status, err := counter.GetInstalledStatus(lang)
		if err != nil {
			t.Errorf("Expected no error for language %s, got: %v", lang, err)
		}
		if status == nil {
			t.Errorf("Expected status for language %s, got nil", lang)
		}
	}
}
