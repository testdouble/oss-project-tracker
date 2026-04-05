import { Octokit } from 'octokit'

export async function syncToProject (org, projectPath) {
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
    console.log(`Project path: ${projectPath}`)

    // Get all public repos from the organization
    const repos = await octokit.paginate(
      octokit.rest.repos.listForOrg,
      {
        org,
        type: 'public',
        per_page: 100
      }
    )

    const nonArchivedRepos = repos.filter(repo => !repo.archived)

    console.log(`Found ${nonArchivedRepos.length} public, non-archived repositories`)

    // TODO: Get existing project items to check what's already added

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
      const issues = await octokit.paginate(
        octokit.rest.issues.listForRepo, {
          owner: repo.owner.login,
          repo: repo.name,
          state: 'open',
          per_page: 100
        }
      )
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
        // Since we can't check existing items due to octokit bugs, we'll add all items
        console.log(`  Adding issue #${issue.number} to project with status 'To triage' (Created: ${issue.created_at})`)
        // TODO: add the item to the project
      }

      // Process pull requests
      for (const pr of pullRequests) {
        // Check if this is a Dependabot PR
        const isDependabot = pr.user?.login === 'dependabot[bot]'

        // Since we can't check existing items due to octokit bugs, we'll add all items
        console.log(`  Adding pull request #${pr.number} to project with status 'To triage' (Dependabot: ${isDependabot}, Created: ${pr.created_at})`)
        // TODO: add the item to the project
      }
    }
  } catch (error) {
    console.log(`Error: ${error.message}`)
  }
}
