# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

`claude-cmd` is a CLI package manager for Claude Code slash commands, designed to solve the discovery and sharing problem for custom commands. This is the **Bun TypeScript implementation** that's actively catching up to feature parity with the mature Go implementation in `../claude-cmd-go/`.

**Current Status**: In active development following the plan in `../ai_docs/PLAN.Bun.md` to achieve complete feature parity with the Go version.

## Essential Commands

### Development
- `bun install` - Install dependencies
- `bun run dev` - Run in development mode with watch
- `bun run start` - Run the built CLI
- `bun run build` - Build for production (outputs to `dist/`)

### Testing
- `bun test unit` - Run unit tests only (fast, no I/O)
- `bun test tests/integration/` - Run integration tests (slower, real I/O)
- `bun test tests/integration/<specific-test.test.ts>` - Run specific integration test
- `bun test` - Run all tests (unit + integration)
- `bun run typecheck` - TypeScript type checking

### Code Quality
- `bun run check` - Run Biome linter checks
- `bun run check-fix` - Run Biome linter with auto-fix
- Code uses tab indentation and double quotes (configured in `biome.json`)

## Architecture

The project follows a clean, testable architecture with dependency injection:

```
CLI Commands (src/cli/commands/)
    ↓
Service Factory (src/services/serviceFactory.ts)
    ↓
Business Logic Services (src/services/)
    ↓
I/O Interfaces (src/interfaces/)
```

### Core Service Dependencies

The `serviceFactory.ts` creates singleton instances with this dependency graph:
- **CommandService**: Main orchestrator, depends on repository, cache, language detection, and installation services
- **InstallationService**: Handles command installation to Claude Code directories
- **HTTPRepository**: Manages GitHub repository communication and local caching
- **CacheManager**: Local cache management in OS-specific user cache directory
- **DirectoryDetector**: Finds `.claude/commands/` (project) or `~/.claude/commands/` (user) directories

### Interface-Based Design (Critical for Testing)

All I/O operations use interfaces for testability:
- `IFileService` - File system operations (implemented by `BunFileService`)
- `IHTTPClient` - HTTP requests (implemented by `BunHTTPClient`)
- `IRepository` - Command repository access (implemented by `HTTPRepository`)
- `IInstallationService` - Command installation logic
- `INamespaceService` - Namespace parsing and validation (in development)
- `IUserInteractionService` - User prompts and confirmations (in development)

### Error Handling Patterns

The codebase uses typed error hierarchies:
- `FileSystemError` family for file operations
- `RepositoryError` family for repository operations
- All async operations properly propagate errors with specific types

## Key Domain Concepts

### Command Structure
Commands are defined by the `Command` interface with:
- `name`: Unique identifier (e.g., "debug-help", "frontend:component")
- `description`: Human-readable purpose
- `file`: Path to markdown content
- `allowed-tools`: Tool permissions (array or comma-separated string)
- `argument-hint`: Optional completion hint

### Namespace Support (In Development)
- Namespaced commands: `"project:frontend:component"`
- Hierarchical directory structure in `.claude/commands/`
- Colon-separated vs path-based format conversion
- Backward compatibility with flat commands

### Repository & Caching
- Commands stored in GitHub repository with `index.json` manifest
- Local cache in `{UserCacheDir}/claude-cmd/pages/{lang}/index.json`
- Language-specific manifests support internationalization
- Force refresh bypasses cache for development

## Testing Strategy (CRITICAL)

### Unit Tests (`tests/unit/`)
Use mock implementations (`tests/mocks/`) to test business logic without I/O:
- `InMemoryFileService` for file operations
- `InMemoryHTTPClient` for network requests
- `InMemoryRepository` for repository operations
- `InMemoryUserInteractionService` for user prompts
- Focus on core logic, edge cases, and error handling

### Integration Tests (`tests/integration/`)
Test real I/O implementations with actual systems:
- `BunFileService` with actual file system
- `BunHTTPClient` with real HTTP requests
- CLI command integration testing
- Service factory integration testing

### Test Contract Pattern
Shared contract tests ensure mock implementations match real ones:
- `tests/shared/IFileService.contract.ts` - Tests both real and mock implementations
- `tests/shared/IHTTPClient.contract.ts` - Ensures behavior consistency

## Bun-Specific Considerations

- Project uses Bun runtime instead of Node.js
- File operations use Bun's optimized APIs in `BunFileService`
- HTTP client uses Bun's fetch implementation
- Entry point uses `#!/usr/bin/env bun` shebang
- TypeScript config optimized for Bun with `module: "Preserve"`

## Development Workflow

1. All file operations must go through `IFileService` interface
2. All HTTP operations must go through `IHTTPClient` interface
3. Services are accessed via `getServices()` factory function
4. Use `resetServices()` in tests for clean state
5. Follow existing error handling patterns with typed exceptions
6. Commander.js provides CLI structure - add new commands to `src/cli/commands/`

## Development Methodology & Current Status

**This implementation is actively catching up to feature parity with the Go version.** Follow the development priorities and task dependencies outlined in `../ai_docs/PLAN.Bun.md`.

### TDD Workflow (MANDATORY)

All features must follow a DESIGN-RED-GREEN-REFACTOR-REVIEW workflow:

1. **DESIGN**: Design domain models and contracts between layers (types, interfaces)
2. **RED**: Write failing tests covering happy path and failure modes
3. **GREEN**: Write minimal code to make tests pass
4. **REFACTOR**: Improve code quality while keeping tests green
5. **REVIEW**: Use zen to review and present findings to user (STOP here)

### Key Development Principles

- **Reuse First**: Adapt existing infrastructure before creating new abstractions
- **Simplicity**: Limit layers to a minimum that conforms to principles
- **Interface Isolation**: All I/O operations must use interface abstractions
- **Dependency Injection**: Use `serviceFactory.ts` for service management
- **Test Coverage**: Maintain comprehensive unit and integration test coverage
- **MVP mode**: UX/UI breaking changes are authorized since there are no users yet

## Cache Directory Structure

Cache location: `{UserCacheDir}/claude-cmd/pages/`
```
pages/
├── en/index.json      # English commands manifest
├── fr/index.json      # French commands manifest
└── {lang}/index.json  # Other language manifests
```

## Command Installation

Commands install to Claude Code directories:
- Project-specific: `.claude/commands/` (if exists in project)
- User-global: `~/.claude/commands/` (fallback)
- Installation preserves directory structure from repository
