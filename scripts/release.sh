#!/bin/bash
# Release script for claude-cmd
# This script helps create releases locally for testing

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Print colored output
print_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if version is provided
if [ $# -eq 0 ]; then
    print_error "Usage: $0 <version>"
    print_info "Example: $0 v1.0.0"
    exit 1
fi

VERSION=$1
if [[ ! $VERSION =~ ^v[0-9]+\.[0-9]+\.[0-9]+(-[a-zA-Z0-9.-]+)?$ ]]; then
    print_error "Version must follow semantic versioning (e.g., v1.0.0 or v1.0.0-beta.1)"
    exit 1
fi

# Check if we're in a git repository
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    print_error "This script must be run from within a git repository"
    exit 1
fi

# Check if working directory is clean
if [ -n "$(git status --porcelain)" ]; then
    print_warning "Working directory is not clean. The following files have changes:"
    git status --porcelain
    read -p "Do you want to continue anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

print_info "Creating release $VERSION..."

# Extract version information
COMMIT_HASH=$(git rev-parse --short HEAD)
BUILD_DATE=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

print_info "Build information:"
echo "  Version: $VERSION"
echo "  Commit: $COMMIT_HASH"
echo "  Date: $BUILD_DATE"

# Clean previous builds
print_info "Cleaning previous builds..."
make clean

# Run tests
print_info "Running tests..."
if ! make test; then
    print_error "Tests failed. Aborting release."
    exit 1
fi

# Run linting
print_info "Running linting..."
if ! make lint; then
    print_error "Linting failed. Aborting release."
    exit 1
fi

# Build all platforms
print_info "Building cross-platform binaries..."
export VERSION=$VERSION
export COMMIT_HASH=$COMMIT_HASH
export BUILD_DATE=$BUILD_DATE

if ! make build-all; then
    print_error "Cross-platform build failed. Aborting release."
    exit 1
fi

# Create archives and checksums
print_info "Creating archives and checksums..."
if ! make archive; then
    print_error "Archive creation failed. Aborting release."
    exit 1
fi

# Display build results
print_info "Build completed successfully!"
echo
print_info "Built binaries:"
ls -la dist/claude-cmd-*
echo
print_info "Archives:"
ls -la dist/*.tar.gz dist/*.zip 2>/dev/null || true
echo
print_info "Checksums:"
cat dist/checksums.txt

# Test a binary
print_info "Testing built binary..."
if ./dist/claude-cmd-$(uname -s | tr '[:upper:]' '[:lower:]')-$(uname -m | sed 's/x86_64/amd64/') --version; then
    print_info "Binary test successful!"
else
    print_warning "Binary test failed, but continuing..."
fi

echo
print_info "Release preparation complete!"
print_info "Next steps:"
echo "  1. Review the built artifacts in the dist/ directory"
echo "  2. Create a git tag: git tag $VERSION"
echo "  3. Push the tag: git push origin $VERSION"
echo "  4. The GitHub Actions workflow will automatically create a release"

# Optionally create and push tag
read -p "Do you want to create and push the git tag now? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    print_info "Creating git tag..."
    git tag $VERSION
    print_info "Pushing tag to origin..."
    git push origin $VERSION
    print_info "Tag pushed! GitHub Actions should start building the release shortly."
fi