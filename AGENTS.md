# AGENTS.md

This document provides essential information for agents working with this Node.js project to help them understand the codebase structure, conventions, and operational patterns.

## Project Overview

This is a Node.js project that uses the Octokit library to interact with the GitHub API. It provides one executable:
1. `oss-project-tracker` - Main executable for syncing GitHub issues and pull requests from an organization to a project board

## Key Technologies

- **Node.js 24.14.1** - The project requires Node.js 24.14.1
- **octokit 5.0.5** - GitHub API client library
- **Commander 14.0.3** - Command-line interface framework
- **Standard 17.1.2** - JavaScript linter and formatter

## Project Structure

```
.
├── oss-project-tracker          # Main executable for syncing OSS projects
├── lib/
│   └── index.js                 # Core library code with syncToProject function
├── package.json                 # Dependencies and scripts
├── README.md                    # Project documentation
└── AGENTS.md                    # This file
```

## Essential Commands

### Setup
```bash
npm install
```

### Running the main executable
```bash
./oss-project-tracker sync-to-project ORG PROJECT_NUMBER
```

### Linting and formatting
```bash
npm run lint
```

To fix issues automatically:
```bash
npm run lint:fix
```

## Code Organization

- The main executable (`oss-project-tracker`) is a Commander-based CLI application
- Uses octokit for GitHub API interactions
- Implements a sync-to-project command that:
  - Fetches public repositories from a GitHub organization
  - Retrieves open issues and pull requests from each repository
  - Processes and displays information about these items

## Naming Conventions and Style Patterns

- Uses standard JavaScript naming conventions
- ES modules (import/export syntax)
- Async/await for asynchronous operations
- Follows the standard JavaScript style guide

## Testing Approach

The project uses the `standard` package for code style checking.

## Important Gotchas

1. The project uses octokit version 5.0.5
2. Node.js version 24.14.1 is required
3. Uses ES modules (type: "module" in package.json)

## Environment Requirements

- Node.js 24.14.1
- npm for dependency management
- GitHub API access (requires authentication for high-volume usage)
