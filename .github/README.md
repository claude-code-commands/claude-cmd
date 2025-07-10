# GitHub Actions Workflows

This directory contains the GitHub Actions workflows for the claude-cmd project.

## Workflows

### CI Workflow (`ci.yml`)

**Triggers:**
- Push to `main` or `develop` branches
- Pull requests to `main` or `develop` branches

**Jobs:**
- **Test**: Runs tests on multiple OS (Ubuntu, macOS, Windows) and Go versions (1.21, 1.22)
- **Lint**: Runs golangci-lint for code quality checks
- **Build**: Tests cross-platform builds to ensure compatibility
- **Security**: Runs Gosec security scanner

**Features:**
- Cross-platform testing
- Code coverage reporting to Codecov
- Security vulnerability scanning
- Build artifact validation

### Release Workflow (`release.yml`)

**Triggers:**
- Push of version tags (e.g., `v1.0.0`)
- Manual workflow dispatch with version input

**Jobs:**
- **Test**: Runs comprehensive tests before release
- **Build**: Creates cross-platform binaries for all supported platforms
- **Release**: Creates GitHub release with binaries and documentation
- **Draft Release**: Creates draft release for manual workflow dispatch

**Features:**
- Automatic release creation on version tags
- Cross-platform binary builds (Linux, macOS, Windows on AMD64 and ARM64)
- Checksum generation for security verification
- Archive creation (tar.gz for Unix, zip for Windows)
- Comprehensive release notes with installation instructions

## Platform Support

The workflows build binaries for the following platforms:

| Platform | Architecture | Binary Name |
|----------|-------------|-------------|
| Linux | AMD64 | `claude-cmd-linux-amd64` |
| Linux | ARM64 | `claude-cmd-linux-arm64` |
| macOS | AMD64 | `claude-cmd-darwin-amd64` |
| macOS | ARM64 | `claude-cmd-darwin-arm64` |
| Windows | AMD64 | `claude-cmd-windows-amd64.exe` |
| Windows | ARM64 | `claude-cmd-windows-arm64.exe` |

## Dependabot Configuration

The `dependabot.yml` file configures automatic dependency updates for:
- Go modules (weekly on Mondays)
- GitHub Actions (weekly on Mondays)

## Release Process

### Release Types Comparison

| Type | When to Use | Visibility | Creates Tag | Use Case |
|------|-------------|------------|-------------|----------|
| **Automatic Release** | Ready to publish | Public immediately | Requires existing tag | Production releases |
| **Draft Release** | Testing needed | Hidden draft | No tag created | Testing, review, QA |
| **Manual Release** | Special situations | Public immediately | No tag created | Hotfixes, special builds |

### Automatic Release (Recommended for Production)

**Best for**: Final releases that are ready for public use

1. Create a version tag following semantic versioning:
   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```

2. The release workflow will automatically:
   - Run tests and build cross-platform binaries
   - Create checksums and archives
   - Generate release notes
   - **Publish the GitHub release immediately**

### Manual Release (For Special Cases)

**Best for**: Hotfixes or releases that need immediate publication without a tag

1. Use the release script:
   ```bash
   ./scripts/release.sh v1.0.0
   ```

2. Or trigger the workflow manually:
   - Go to Actions tab in GitHub
   - Select "Release" workflow
   - Click "Run workflow"
   - Enter the version tag (e.g., `v1.0.0`)
   - **This publishes immediately**

### Draft Release (Testing & Review)

Draft releases allow you to build and test release binaries **before** making them public. This is useful for:

- **Release Candidates**: Test `v1.0.0-rc1` before the final `v1.0.0`
- **Team Review**: Let colleagues review binaries before public release
- **Quality Assurance**: Thoroughly test binaries on different platforms
- **Version Testing**: Test any version without creating permanent tags

**How to create a draft release:**

1. Go to GitHub → **Actions** tab
2. Click **"Release"** workflow
3. Click **"Run workflow"** button
4. Enter the version (e.g., `v1.0.0-rc1`, `v1.0.0`)
5. Click **"Run workflow"**

**What happens:**
- Builds all platform binaries
- Creates a **hidden draft release** (not public)
- Uploads binaries, checksums, and archives
- You can download and test everything

**After testing:**
- **To publish**: Go to Releases → Edit the draft → Click "Publish release"
- **To discard**: Go to Releases → Delete the draft

**Typical Draft Release Workflow:**

```bash
# You're preparing v1.0.0 but want to test first

# 1. Go to GitHub Actions and manually trigger "Release" workflow
#    Enter version: v1.0.0-rc1
#    This creates a DRAFT (hidden from public)

# 2. Download the draft release binaries and test them:
wget https://github.com/.../releases/download/untagged-.../claude-cmd-linux-amd64
chmod +x claude-cmd-linux-amd64
./claude-cmd-linux-amd64 --version  # Test it works

# 3. Test on multiple platforms, check functionality

# 4. If everything works, create the real release:
git tag v1.0.0
git push origin v1.0.0
# This creates the PUBLIC release automatically

# 5. Optional: Delete the draft release (no longer needed)
```

**Real-world example:**
- You want to release v2.0.0 but it's a major version
- Create draft release with v2.0.0-rc1
- Share with team members for testing
- They download and test on Windows, macOS, Linux
- Once approved, create the real v2.0.0 tag
- Public gets the tested, approved version

## Environment Variables

The workflows use the following environment variables:

- `GO_VERSION`: Go version to use (default: 1.21)
- `VERSION`: Version string for builds
- `COMMIT_HASH`: Git commit hash
- `BUILD_DATE`: Build timestamp

## Secrets Required

The workflows require the following GitHub secrets:

- `GITHUB_TOKEN`: Automatically provided by GitHub
- `CODECOV_TOKEN`: (Optional) For code coverage reporting

## Code Quality

The workflows enforce the following quality standards:

- All tests must pass on multiple platforms
- Code must pass golangci-lint checks
- Security scans must not find critical vulnerabilities
- Cross-platform builds must succeed
- Code formatting must be consistent

## Troubleshooting

### Common Issues

1. **Build failures**: Check that all dependencies are properly declared in `go.mod`
2. **Test failures**: Ensure tests pass locally before pushing
3. **Lint failures**: Run `make lint` locally to fix issues
4. **Permission errors**: Verify that `GITHUB_TOKEN` has appropriate permissions

### Debug Builds

To debug build issues locally:

```bash
# Clean and test build
make clean
make test
make build-all

# Test with specific version
VERSION=v1.0.0-debug make build
./claude-cmd --version
```

### Workflow Debugging

To debug workflow issues:

1. Check the Actions tab for detailed logs
2. Look for error messages in specific job steps
3. Verify that all required files are present
4. Check that environment variables are set correctly

## Security Considerations

- All builds are performed in isolated GitHub-hosted runners
- Checksums are provided for all binary releases
- Security scanning is performed on every build
- Dependencies are automatically updated via Dependabot
- No secrets are exposed in build logs