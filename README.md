# claude-cmd

CLI package manager for Claude Code slash commands, designed to solve the discovery and sharing problem for custom commands.

## Installation

```bash
bun install
```

## Development

```bash
# Run in development mode
bun run dev

# Run tests
bun test

# Build for production
bun run build

# Run built version
bun run start
```

## Project Structure

- `src/` - Source code
  - `interfaces/` - TypeScript interfaces for I/O abstraction
  - `services/` - Business logic layer
  - `cli/` - CLI command handlers
  - `types/` - Type definitions
  - `main.ts` - Entry point
- `tests/` - Test files
  - `unit/` - Unit tests
  - `integration/` - Integration tests
  - `mocks/` - Mock implementations
- `docs/` - Documentation

## Architecture

This project follows a test-driven development approach with clean architecture principles:

1. **CLI Layer** - Command handlers and user interaction
2. **Business Logic Layer** - Core functionality and orchestration
3. **I/O Interface Layer** - Abstractions for filesystem, network, and repository operations

Built with [Bun](https://bun.sh) - a fast all-in-one JavaScript runtime.
