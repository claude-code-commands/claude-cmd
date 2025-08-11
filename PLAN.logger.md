# Debug Logging Implementation Plan

## Objective
Add comprehensive debug logging to the claude-cmd CLI application using LogTape to provide visibility into cache operations, HTTP requests, and file system operations.

## Requirements

### Primary Focus Areas
1. **Cache Operations** - Log whether cache has been hit or not, cache age, TTL status
2. **HTTP Requests** - Log full URLs, timeouts, response codes, content lengths
3. **File System Operations** - Log which operations are being performed, paths, success/error states
4. **Global Flag** - Add `--verbose`/`-V` flag that activates debug logs

## Implementation Plan

### 1. Add LogTape Package Dependency
- Install `logtape` npm package (native TypeScript support, no @types needed)
- Package provides hierarchical logging with environment variable control
- Superior to `debug` with structured logging and explicit log levels

### 2. Add CLI Verbose Flag
- Add `--verbose` / `-V` option to main.ts Commander configuration
- Flag should call `rootLogger.setDefaultLevel(LogLevel.Debug)` for verbose output
- Environment variables `LOG_LEVEL` and `LOG_FILTER` provide additional control

### 3. Add Debug Logging to Real Implementations
Add logging statements to all real service implementations:
- **BunFileService** - File operations (read, write, exists, mkdir, delete, list)
- **BunHTTPClient** - HTTP requests (URL, timeout, response status, errors)
- **HTTPRepository** - Cache operations (hit/miss, age, TTL), manifest fetching
- **InstallationService** - Installation flow, directory detection, user confirmations
- **ConfigService** - Configuration loading and saving
- **NamespaceService** - Namespace parsing and validation
- **ManifestComparison** - Manifest comparison operations
- **UserInteractionService** - User prompts and confirmations

### 4. Add Debug Logging to Mock Implementations
Add logging statements to mock implementations for test debugging:
- **InMemoryFileService** - Mock file operations
- **InMemoryHTTPClient** - Mock HTTP requests
- **InMemoryRepository** - Mock repository operations
- **InMemoryUserInteractionService** - Mock user interactions
- **InMemoryManifestComparison** - Mock manifest comparisons

### 5. Logger Hierarchy Convention
Use hierarchical logger structure instead of colon-separated namespaces:

```typescript
// Create logger hierarchy
const rootLogger = createLogger('claude-cmd');
const fileLogger = rootLogger.child('file');
const httpLogger = rootLogger.child('http');
const repoLogger = rootLogger.child('repo');
const installLogger = rootLogger.child('install');
const interactionLogger = rootLogger.child('interaction');

// Specific implementation loggers
const realFileLogger = fileLogger.child('real');
const mockFileLogger = fileLogger.child('mock');
const realHttpLogger = httpLogger.child('real');
const mockHttpLogger = httpLogger.child('mock');
```

Logger naming convention:
- `claude-cmd` - Root logger
- `claude-cmd:file:real` - Real file operations
- `claude-cmd:file:mock` - Mock file operations
- `claude-cmd:http:real` - Real HTTP operations
- `claude-cmd:http:mock` - Mock HTTP operations
- `claude-cmd:repo:real` - Repository operations
- `claude-cmd:install:real` - Installation operations
- `claude-cmd:interaction:real` - User interaction operations
- `claude-cmd:interaction:mock` - Mock user interactions

### 6. Logging Statement Pattern
Each logging statement should include:
- Operation name
- Key parameters (paths, URLs, etc.)
- Success/failure status
- Relevant metrics (byte counts, cache age, response times)

Example:
```typescript
// Import logger
import { createLogger } from 'logtape';
const logger = createLogger('claude-cmd').child('file').child('real');

// Usage examples
logger.info("read: %s", path);
logger.debug("read success: %s (%d bytes)", path, content.length);
logger.info("cache hit: %s (age: %dms, ttl: %dms)", cacheKey, cacheAge, ttl);
logger.warn("cache miss: %s (file not found)", cacheKey);
logger.error("operation failed: %s (error: %s)", operation, error.message);
```

### 7. Environment Variable Control
LogTape uses two environment variables for control:
- **LOG_LEVEL**: Sets minimum severity (`TRACE`, `DEBUG`, `INFO`, `WARN`, `ERROR`, `SILENT`)
- **LOG_FILTER**: Filters by namespace with wildcard support (replaces DEBUG env var)

### 8. Verbose Flag Implementation
```typescript
// In main.ts
import { createLogger, LogLevel } from 'logtape';

const rootLogger = createLogger('claude-cmd');

program
  .option('-V, --verbose', 'Enable verbose debug logging')
  .action((options) => {
    if (options.verbose) {
      rootLogger.setDefaultLevel(LogLevel.Debug);
      rootLogger.info('Verbose logging enabled.');
    } else {
      rootLogger.setDefaultLevel(LogLevel.Info);
    }
    // ... rest of CLI logic
  });
```

### 9. Testing Strategy
- Verify verbose flag works with actual commands
- Run existing test suite to ensure no regressions
- Test that debug output appears when LOG_LEVEL/LOG_FILTER env vars are set
- Test hierarchical logger filtering

## Expected Outcome

Users will be able to run commands with debug output:

```bash
# Using environment variables (recommended for full output)
LOG_LEVEL=DEBUG LOG_FILTER=claude-cmd:* claude-cmd list

# Using verbose flag (programmatic control)
claude-cmd --verbose list

# Filtering specific namespaces
LOG_LEVEL=DEBUG LOG_FILTER=claude-cmd:file:*,claude-cmd:http:* claude-cmd list

# Only cache operations
LOG_LEVEL=DEBUG LOG_FILTER=claude-cmd:repo:* claude-cmd list
```

Debug output will provide detailed visibility into:
- Cache hit/miss status with age and TTL information
- Full URLs for all HTTP requests with response codes
- File system operations with paths and byte counts
- Installation flow decisions and user interactions
- Error conditions with full context
- Hierarchical filtering for precise debugging

This significantly improves debugging capabilities with better structure, TypeScript support, and more granular control than the previous `debug` implementation.