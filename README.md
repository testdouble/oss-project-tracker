# oss-project-tracker

This project is a Node.js application that uses the octokit library to interact with the GitHub API, syncing GitHub issues and pull requests from an organization to a project board.

## Requirements

- Node.js
- npm

## Setup

1. Install dependencies:
   ```
   npm install
   ```

2. Run the script:
   ```
   ./oss-project-tracker
   ```

3. Run the linter/formatter:
   ```
   npm run lint
   ```

## Usage

The main executable `oss-project-tracker` can be used to sync GitHub issues and pull requests from an organization to a project board:

```
./oss-project-tracker sync-to-project ORG PROJECT_NUMBER
```

Where:
- `ORG` is the GitHub organization name
- `PROJECT_NUMBER` is the project number (e.g., 12) of the project within the organization

### Authentication

The tool supports GitHub personal access token authentication via the `GITHUB_TOKEN` environment variable:

```
GITHUB_TOKEN=your_personal_access_token ./oss-project-tracker sync-to-project ORG PROJECT_NUMBER
```

This allows for higher rate limits and access to private repositories when needed.

### Functionality

The tool will:
1. Fetch all public repositories from the specified organization
2. Retrieve all open issues and pull requests from those repositories
3. Add each issue and pull request to the specified project board in the "To triage" column
4. Skip items that are already in the project (based on item ID)

## Structure

- `oss-project-tracker` - Main executable for syncing OSS projects (with Commander and Octokit)
- `lib/index.js` - Core library code with syncToProject function
- `package.json` - Dependencies including octokit, commander, and standard
