# Ruby Project Scaffold

This project is a Ruby project with multiple executables that use the octokit gem to interact with the GitHub API.

## Requirements

- Ruby 4.0.2
- Bundler

## Setup

1. Install dependencies:
   ```
   bundle install
   ```

2. Run the script:
   ```
   ./oss-project-tracker
   ```

3. Run the linter/formatter:
   ```
   bundle exec standardrb
   ```

## Usage

The main executable `oss-project-tracker` can be used to sync GitHub issues and pull requests from an organization to a project board:

```
./oss-project-tracker sync-to-project ORG PROJECT_PATH
```

Where:
- `ORG` is the GitHub organization name
- `PROJECT_PATH` is the full path to the project board (e.g., "owner/repo/PROJECT_ID" or "owner/PROJECT_ID")

### Authentication

The tool supports GitHub personal access token authentication via the `GITHUB_TOKEN` environment variable:

```
GITHUB_TOKEN=your_personal_access_token ./oss-project-tracker sync-to-project ORG PROJECT_PATH
```

This allows for higher rate limits and access to private repositories when needed.

## Structure

- `oss-project-tracker` - Main executable for syncing OSS projects (with octokit)
- `script/test` - Script to demonstrate standard usage
- `Gemfile` - Dependencies including octokit, thor, and standard gems
- `.ruby-version` - Ruby version specification
