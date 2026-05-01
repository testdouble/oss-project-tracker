import { Octokit } from 'octokit'

function getFieldByName(fields, name) {
  const foundField = fields.find((field) => field.name === name)
  if (!foundField) {
    throw new Error(`Missing field '${name}'`)
  }
  return foundField
}

function getFieldOptionByName(field, name) {
  const foundOption = field.options.find((option) => option.name.raw === name)
  if (!foundOption) {
    throw new Error(`Missing option '${name}' for field '${field.name}'`)
  }
  return foundOption
}

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

  console.log(`Syncing GitHub organization: ${org}`)
  console.log(`Project ID: ${projectId}`)

  console.log('Fetching project info')
  // Get project fields
  const fields = await octokit.paginate(
    octokit.rest.projects.listFieldsForOrg,
    { org, project_number: projectId }
  )
  const dependabotField = getFieldByName(fields, "Dependabot?")
  const dependabotYesOption = getFieldOptionByName(dependabotField, "Yes")
  const dependabotNoOption = getFieldOptionByName(dependabotField, "No")
  const parentCreatedDateField = getFieldByName(fields, "Parent created date")
  const repoStarsField = getFieldByName(fields, "Repo stars")
  const lastSuccessfulCiRunField = getFieldByName(fields, "Last successful CI run")

  // Get existing project items to check what's already added
  const existingItems = await octokit.paginate(
    octokit.rest.projects.listItemsForOrg,
    { org, project_number: projectId }
  )
  const existingIssueItems = existingItems
    .filter((item) => item.content_type === "Issue")
  const existingPrItems = existingItems
    .filter((item) => item.content_type === "PullRequest")
  const existingIssueIds = new Set(
    existingIssueItems.map((item) => item.content.id)
  )
  const existingPullRequestIds = new Set(
    existingPrItems.map((item) => item.content.id)
  )

  const issueToItemMap = existingIssueItems.reduce(
    (acc, item) => acc.set(item.content.id, item),
    new Map(),
  )
  const prToItemMap = existingPrItems.reduce(
    (acc, item) => acc.set(item.content.id, item),
    new Map(),
  )

  // Get all public repos from the organization
  const repos = await octokit.paginate(
    octokit.rest.repos.listForOrg,
    { org, type: 'public', per_page: 100 }
  )
  const nonArchivedRepos = repos.filter(repo => !repo.archived)
  console.log(`Found ${nonArchivedRepos.length} public, non-archived repositories`)

  // Process each repository
  for (const repo of nonArchivedRepos) {
    console.log(`\nProcessing repository: ${repo.name}`)
    console.log(`  Star count: ${repo.stargazers_count}`)

    // Get the last successful check run for the default branch
    const defaultBranch = repo.default_branch
    let lastSuccessfulCheckRun
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
        lastSuccessfulCheckRun = lastSuccessful.started_at
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
        const { data: newItem } = await octokit.rest.projects.addItemForOrg({
          org,
          project_number: projectId,
          type: 'Issue',
          id: issue.id
        })
        issueToItemMap.set(issue.id, newItem)
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
        const { data: newItem } = await octokit.rest.projects.addItemForOrg({
          org,
          project_number: projectId,
          type: 'PullRequest',
          id: pr.id
        })
        prToItemMap.set(pr.id, newItem)
      } catch (error) {
        console.log(`  Error adding pull request #${pr.number}: ${error.message}`)
      }
    }

    for (const issue of issues) {
      const fields = [
        {
          id: parentCreatedDateField.id,
          value: issue.created_at,
        },
        {
          id: repoStarsField.id,
          value: repo.stargazers_count,
        },
        ...(
          lastSuccessfulCheckRun ?
          [
            {
              id: lastSuccessfulCiRunField.id,
              value: lastSuccessfulCheckRun,
            }
          ] :
          []
        ),
      ]
      const item = issueToItemMap.get(issue.id)
      await octokit.rest.projects.updateItemForOrg({
        org,
        project_number: projectId,
        item_id: item.id,
        fields,
      })
    }

    for (const pr of pullRequests) {
      const isDependabot = pr.user?.login === 'dependabot[bot]'
      const fields = [
        {
          id: dependabotField.id,
          value: isDependabot ? dependabotYesOption.id : dependabotNoOption.id,
        },
        {
          id: parentCreatedDateField.id,
          value: pr.created_at,
        },
        {
          id: repoStarsField.id,
          value: repo.stargazers_count,
        },
        ...(
          lastSuccessfulCheckRun ?
          [
            {
              id: lastSuccessfulCiRunField.id,
              value: lastSuccessfulCheckRun,
            }
          ] :
          []
        ),
      ]
      const item = prToItemMap.get(pr.id)
      await octokit.rest.projects.updateItemForOrg({
        org,
        project_number: projectId,
        item_id: item.id,
        fields,
      })
    }
  }
}
