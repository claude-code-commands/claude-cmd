# Makefile for claude-cmd
# Cross-platform build system for the Claude Code command CLI

# Version information
VERSION ?= $(shell git describe --tags --dirty --always 2>/dev/null || echo "dev")
COMMIT_HASH ?= $(shell git rev-parse --short HEAD 2>/dev/null || echo "unknown")
BUILD_DATE ?= $(shell date -u +"%Y-%m-%dT%H:%M:%SZ")

# Go build variables
GO_MODULE = github.com/claude-code-commands/claude-cmd
VERSION_PKG = $(GO_MODULE)/pkg/config
LDFLAGS = -X $(VERSION_PKG).Version=$(VERSION) -X $(VERSION_PKG).CommitHash=$(COMMIT_HASH) -X $(VERSION_PKG).BuildDate=$(BUILD_DATE)

# Binary name
BINARY_NAME = claude-cmd

# Output directory
OUTPUT_DIR = dist

# Build flags
GO_BUILD_FLAGS = -trimpath -ldflags "$(LDFLAGS)"

# Default target
.PHONY: all
all: build

# Build for current platform
.PHONY: build
build:
	@echo "Building $(BINARY_NAME) for current platform..."
	go build $(GO_BUILD_FLAGS) -o $(BINARY_NAME) .

# Clean build artifacts
.PHONY: clean
clean:
	@echo "Cleaning build artifacts..."
	rm -rf $(OUTPUT_DIR)
	rm -f $(BINARY_NAME)

# Cross-platform builds
.PHONY: build-all
build-all: build-linux build-darwin build-windows

# Linux builds
.PHONY: build-linux
build-linux: build-linux-amd64 build-linux-arm64

.PHONY: build-linux-amd64
build-linux-amd64:
	@echo "Building $(BINARY_NAME) for Linux (amd64)..."
	@mkdir -p $(OUTPUT_DIR)
	GOOS=linux GOARCH=amd64 go build $(GO_BUILD_FLAGS) -o $(OUTPUT_DIR)/$(BINARY_NAME)-linux-amd64 .

.PHONY: build-linux-arm64
build-linux-arm64:
	@echo "Building $(BINARY_NAME) for Linux (arm64)..."
	@mkdir -p $(OUTPUT_DIR)
	GOOS=linux GOARCH=arm64 go build $(GO_BUILD_FLAGS) -o $(OUTPUT_DIR)/$(BINARY_NAME)-linux-arm64 .

# macOS builds
.PHONY: build-darwin
build-darwin: build-darwin-amd64 build-darwin-arm64

.PHONY: build-darwin-amd64
build-darwin-amd64:
	@echo "Building $(BINARY_NAME) for macOS (amd64)..."
	@mkdir -p $(OUTPUT_DIR)
	GOOS=darwin GOARCH=amd64 go build $(GO_BUILD_FLAGS) -o $(OUTPUT_DIR)/$(BINARY_NAME)-darwin-amd64 .

.PHONY: build-darwin-arm64
build-darwin-arm64:
	@echo "Building $(BINARY_NAME) for macOS (arm64)..."
	@mkdir -p $(OUTPUT_DIR)
	GOOS=darwin GOARCH=arm64 go build $(GO_BUILD_FLAGS) -o $(OUTPUT_DIR)/$(BINARY_NAME)-darwin-arm64 .

# Windows builds
.PHONY: build-windows
build-windows: build-windows-amd64 build-windows-arm64

.PHONY: build-windows-amd64
build-windows-amd64:
	@echo "Building $(BINARY_NAME) for Windows (amd64)..."
	@mkdir -p $(OUTPUT_DIR)
	GOOS=windows GOARCH=amd64 go build $(GO_BUILD_FLAGS) -o $(OUTPUT_DIR)/$(BINARY_NAME)-windows-amd64.exe .

.PHONY: build-windows-arm64
build-windows-arm64:
	@echo "Building $(BINARY_NAME) for Windows (arm64)..."
	@mkdir -p $(OUTPUT_DIR)
	GOOS=windows GOARCH=arm64 go build $(GO_BUILD_FLAGS) -o $(OUTPUT_DIR)/$(BINARY_NAME)-windows-arm64.exe .

# Test targets
.PHONY: test
test:
	@echo "Running tests..."
	go test ./...

.PHONY: test-coverage
test-coverage:
	@echo "Running tests with coverage..."
	go test -cover ./...

.PHONY: test-verbose
test-verbose:
	@echo "Running tests with verbose output..."
	go test -v ./...

# Code quality targets
.PHONY: lint
lint:
	@echo "Running go vet..."
	go vet ./...

.PHONY: fmt
fmt:
	@echo "Formatting code..."
	go fmt ./...

.PHONY: mod-tidy
mod-tidy:
	@echo "Tidying modules..."
	go mod tidy

# Development targets
.PHONY: run
run:
	@echo "Running $(BINARY_NAME)..."
	go run . $(ARGS)

.PHONY: install
install:
	@echo "Installing $(BINARY_NAME)..."
	go install $(GO_BUILD_FLAGS) .

# Release preparation
.PHONY: prepare-release
prepare-release: clean test lint build-all
	@echo "Release preparation complete!"
	@echo "Built binaries:"
	@ls -la $(OUTPUT_DIR)/

# Create checksums for release binaries
.PHONY: checksums
checksums:
	@echo "Creating checksums for release binaries..."
	@cd $(OUTPUT_DIR) && sha256sum * > checksums.txt
	@echo "Checksums created in $(OUTPUT_DIR)/checksums.txt"

# Archive binaries for release
.PHONY: archive
archive: checksums
	@echo "Creating archives for release..."
	@cd $(OUTPUT_DIR) && \
	for binary in $(BINARY_NAME)-*; do \
		if [ -f "$$binary" ]; then \
			platform=$$(echo $$binary | sed 's/$(BINARY_NAME)-//'); \
			if [[ "$$binary" == *.exe ]]; then \
				zip "$$platform.zip" "$$binary"; \
			else \
				tar -czf "$$platform.tar.gz" "$$binary"; \
			fi; \
		fi; \
	done
	@echo "Archives created in $(OUTPUT_DIR)/"

# Help target
.PHONY: help
help:
	@echo "Available targets:"
	@echo "  build          - Build for current platform"
	@echo "  build-all      - Build for all supported platforms"
	@echo "  build-linux    - Build for Linux (amd64 and arm64)"
	@echo "  build-darwin   - Build for macOS (amd64 and arm64)"
	@echo "  build-windows  - Build for Windows (amd64 and arm64)"
	@echo "  test           - Run tests"
	@echo "  test-coverage  - Run tests with coverage"
	@echo "  test-verbose   - Run tests with verbose output"
	@echo "  lint           - Run go vet"
	@echo "  fmt            - Format code"
	@echo "  mod-tidy       - Tidy modules"
	@echo "  run            - Run the application (use ARGS=... for arguments)"
	@echo "  install        - Install the binary"
	@echo "  clean          - Clean build artifacts"
	@echo "  prepare-release - Full release preparation (clean, test, lint, build-all)"
	@echo "  checksums      - Create checksums for release binaries"
	@echo "  archive        - Create archives for release"
	@echo "  help           - Show this help message"
	@echo ""
	@echo "Example usage:"
	@echo "  make build                    # Build for current platform"
	@echo "  make build-all                # Build for all platforms"
	@echo "  make run ARGS='list --help'   # Run with arguments"
	@echo "  make VERSION=v1.0.0 build-all # Build with specific version"