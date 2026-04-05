# AGENTS.md

This document provides essential information for agents working with this Ruby project to help them understand the codebase structure, conventions, and operational patterns.

## Project Overview

This is a Ruby project that uses the Octokit gem to interact with the GitHub API. It provides one executable:
1. `oss-project-tracker` - Main executable for syncing GitHub issues and pull requests from an organization to a project board

## Key Technologies

- **Ruby 4.0.2** - The project requires Ruby 4.0.2
- **Octokit** - GitHub API client library
- **Thor** - Command-line interface framework
- **Standard** - Ruby linter and formatter
- **Bundler** - Dependency management

## Project Structure

```
.
├── oss-project-tracker          # Main executable for syncing OSS projects
├── bin/                         # CLI binaries (currently empty)
├── lib/                         # Library code (currently empty)
├── script/test                  # Script to demonstrate standard usage
├── Gemfile                      # Dependencies including octokit, thor, and standard gems
├── Gemfile.lock                 # Locked dependencies
├── README.md                    # Project documentation
├── .ruby-version                # Ruby version specification
```

## Essential Commands

### Setup
```bash
bundle install
```

### Running the main executable
```bash
./oss-project-tracker sync-to-project ORG PROJECT_PATH
```

### Linting and formatting
```bash
bundle exec standardrb
```

To fix issues automatically:
```bash
bundle exec standardrb --fix
```

## Code Organization

- The main executable (`oss-project-tracker`) is a Thor-based CLI application
- Uses Octokit for GitHub API interactions
- Implements a sync-to-project command that:
  - Fetches public repositories from a GitHub organization
  - Retrieves open issues and pull requests from each repository
  - Processes and displays information about these items

## Naming Conventions and Style Patterns

- Uses standard Ruby naming conventions
- Thor-based CLI with descriptive command names
- Uses frozen string literals (`# frozen_string_literal: true`)
- Follows the standard Ruby project layout

## Testing Approach

The project uses the `standard` gem for code style checking. The test script demonstrates how to run the linter.

## Important Gotchas

1. The project uses Octokit version 10.0
2. Ruby version 4.0.2 is required

## Environment Requirements

- Ruby 4.0.2
- Bundler for dependency management
- GitHub API access (requires authentication for high-volume usage)
