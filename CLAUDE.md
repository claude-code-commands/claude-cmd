# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

`claude-cmd` is a CLI package manager for Claude Code slash commands, designed to solve the discovery and sharing problem for custom commands. It follows a local-first design approach with GitHub repository synchronization, built with Bun for optimal performance.

## Essential Commands

### Development
- `bun install` - Install dependencies
- `bun run dev` - Run in development mode with watch
- `bun run start` - Run the built CLI
- `bun run build` - Build for production (outputs to `dist/`)

### Testing
- `CLAUDECODE=1 bun test unit` - Run unit tests (fast, no I/O)
- `CLAUDECODE=1 bun test tests/integration/<test-file-name.test.ts>` - Run integration tests (slow, with I/O)
- `CLAUDECODE=1 bun test` - Run all tests
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

### Interface-Based Design

All I/O operations use interfaces for testability:
- `IFileService` - File system operations (implemented by `BunFileService`)
- `IHTTPClient` - HTTP requests (implemented by `BunHTTPClient`)
- `IRepository` - Command repository access (implemented by `HTTPRepository`)
- `IInstallationService` - Command installation logic

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

### Repository & Caching
- Commands stored in GitHub repository with `index.json` manifest
- Local cache in `{UserCacheDir}/claude-cmd/pages/{lang}/index.json`
- Language-specific manifests support internationalization
- Force refresh bypasses cache for development

## Testing Strategy

### Unit Tests (`tests/unit/`)
Use mock implementations (`tests/mocks/`) to test business logic without I/O:
- `InMemoryFileService` for file operations
- `InMemoryHTTPClient` for network requests
- Focus on core logic, edge cases, and error handling

### Integration Tests (`tests/integration/`)
Test real I/O implementations:
- `BunFileService` with actual file system
- `BunHTTPClient` with real HTTP requests
- CLI command integration with system

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

## Software Engineering Methodology

All features must be developed following a TDD-like workflow (DESIGN-RED-GREEN-REFACTOR-REVIEW) that respects the SOLID principles:

1. DESIGN: Design the domain models and the contracts between the different layers: the types, the interfaces
2. RED: Write the tests against a non-existing implementation and ensure they fail, covering the happy path and the various failure modes
3. GREEN: Write the minimum amount of code to make the tests pass
4. REFACTOR: Think hard about how to make the implementation better: documentation, decoupling/cohesiveness, security, performance
5. REVIEW: Use zen to review the previous steps and present your analysis and findings to the user. You MUST stop here and MUST NOT try to fix the problems you found; the user will decide how to proceed with the review.

ATTENTION: you try to reuse and adapt existing code and infrastructure as much as possible, and introduce new abstractions only when necessary. You value simplicity and try to limit the number of layers to the minimum that conforms to the principles and provides a useful solution.


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

## Bun Subprocess Handling

- When `spawn`ing subprocess with Bun and trying to read from stderr, pass as the second argument `{ stderr: "pipe" }` to the `spawn` function then read from stderr using `await proc.stderr.text()`. DO NOT use `new Response(proc.stderr)`, this doesn't work.