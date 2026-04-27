import { Octokit } from 'octokit'

export async function syncToProject (org, projectId) {
  // Initialize Octokit client with authentication if available
  const token = process.env.GITHUB_TOKEN
  const octokit = new Octokit({
    auth: token,
    throttle: {
      onRateLimit: (retryAfter, { method, url }) => {
        console.log(`Request quota exhausted for request ${method} ${url}`)
      },
      onSecondaryRateLimit: (retryAfter, { method, url }) => {
        console.log(`Secondary rate limit detected for request ${method} ${url}`)
      }
    }
  })

  try {
    console.log(`Syncing GitHub organization: ${org}`)
    console.log(`Project ID: ${projectId}`)

    // Get all public repos from the organization
    const repos = await octokit.paginate(
      octokit.rest.repos.listForOrg,
      { org, type: 'public', per_page: 100 }
    )

    const nonArchivedRepos = repos.filter(repo => !repo.archived)

    console.log(`Found ${nonArchivedRepos.length} public, non-archived repositories`)

    // Get existing project items to check what's already added
    const existingItems = await octokit.paginate(
      octokit.rest.projects.listItemsForOrg,
      { org, project_number: projectId }
    )
    const existingIssueIds = new Set(
      existingItems
      .filter((item) => item.content_type === "Issue")
      .map((item) => item.content.id)
    )
    const existingPullRequestIds = new Set(
      existingItems
      .filter((item) => item.content_type === "PullRequest")
      .map((item) => item.content.id)
    )
    // Process each repository
    for (const repo of nonArchivedRepos) {
      console.log(`\nProcessing repository: ${repo.name}`)
      console.log(`  Star count: ${repo.stargazers_count}`)

      // Get the last successful check run for the default branch
      const defaultBranch = repo.default_branch
      try {
        const checkRunsResp = await octokit.rest.checks.listForRef({
          owner: repo.owner.login,
          repo: repo.name,
          ref: defaultBranch
        })

        const successfulCheckRuns = checkRunsResp.data.check_runs.filter(s => s.conclusion === 'success')
        const lastSuccessful = successfulCheckRuns.reduce((max, current) => {
          return new Date(current.started_at) > new Date(max.started_at) ? current : max
        }, successfulCheckRuns[0])

        if (lastSuccessful) {
          console.log(`  Last successful check run: ${lastSuccessful.started_at}`)
        } else {
          console.log('  No successful check runs found')
        }
      } catch (error) {
        console.log(`  Error fetching check runs: ${error.message}`)
      }

      // Get open issues
      // All PRs are issues. But we can't really use the PRs from the issues
      // endpoint because they only include PRs' _issue_ IDs, not their _PR_
      // IDs. And the PR IDs are what are stored on the project items.
      const issuesAndPullRequests = await octokit.paginate(
        octokit.rest.issues.listForRepo, {
          owner: repo.owner.login,
          repo: repo.name,
          state: 'open',
          per_page: 100
        }
      )
      // Filter out PRs
      const issues = issuesAndPullRequests.filter((thing) => !thing.pull_request)
      console.log(`  Found ${issues.length} open issues`)

      // Get open pull requests
      const pullRequests = await octokit.paginate(
        octokit.rest.pulls.list, {
          owner: repo.owner.login,
          repo: repo.name,
          state: 'open',
          per_page: 100
        }
      )
      console.log(`  Found ${pullRequests.length} open pull requests`)

      // Process issues
      for (const issue of issues) {
        if (existingIssueIds.has(issue.id)) {
          console.log(`  Issue #${issue.number} is already in the project. Skipping.`)
          continue
        }
        console.log(`  Adding issue #${issue.number} to project with status 'To triage' (Created: ${issue.created_at})`)
        try {
          await octokit.rest.projects.addItemForOrg({
            org,
            project_number: projectId,
            type: 'Issue',
            id: issue.id
          })
        } catch (error) {
          console.log(`  Error adding issue #${issue.number}: ${error.message}`)
        }
      }

      // Process pull requests
      for (const pr of pullRequests) {
        if (existingPullRequestIds.has(pr.id)) {
          console.log(`  Pull request #${pr.number} is already in the project. Skipping.`)
          continue
        }
        // Check if this is a Dependabot PR
        const isDependabot = pr.user?.login === 'dependabot[bot]'

        console.log(`  Adding pull request #${pr.number} to project with status 'To triage' (Dependabot: ${isDependabot}, Created: ${pr.created_at})`)
        try {
          await octokit.rest.projects.addItemForOrg({
            org,
            project_number: projectId,
            type: 'PullRequest',
            id: pr.id
          })
        } catch (error) {
          console.log(`  Error adding pull request #${pr.number}: ${error.message}`)
        }
      }
    }
  } catch (error) {
    console.log(`Error: ${error.message}`)
  }
}
