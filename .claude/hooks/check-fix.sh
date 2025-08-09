#!/bin/bash

# Hook script to run bun check-fix when code files are modified
# Triggered by PostToolUse events for file modification tools

set -euo pipefail

# Read JSON input from stdin
input=$(cat)

# Extract tool name and file path using jq
tool_name=$(echo "$input" | jq -r '.tool_name // ""')
file_path=""

# Extract file path based on tool type
case "$tool_name" in
    "Write")
        file_path=$(echo "$input" | jq -r '.tool_input.file_path // ""')
        ;;
    "Edit"|"MultiEdit")
        file_path=$(echo "$input" | jq -r '.tool_input.file_path // ""')
        ;;
    *)
        # Not a file modification tool we care about
        exit 0
        ;;
esac

# Check if we got a valid file path
if [ -z "$file_path" ] || [ "$file_path" = "null" ]; then
    exit 0
fi

# Check if the file has a code extension we care about
case "$file_path" in
    *.json|*.js|*.jsx|*.ts|*.tsx|*.yaml|*.yml)
        echo "Code file modified: $file_path"
        echo "Running bun run check-fix..."
        
        # Change to project directory and run check-fix
        cd "$CLAUDE_PROJECT_DIR"
        
        # Run bun check-fix and capture output
        if bun run check-fix; then
            echo "✅ Code formatting completed successfully"
        else
            echo "⚠️  Code formatting had issues but continued"
        fi
        ;;
    *)
        # Not a code file extension we care about
        exit 0
        ;;
esac