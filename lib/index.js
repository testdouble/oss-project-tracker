import { Octokit } from 'octokit'

function compare(a, b) {
  if (a < b) {
    return -1;
  } else if (a > b) {
    return 1;
  }
  return 0;
}

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

  // Get project fields
  const fields = await octokit.paginate(
    octokit.rest.projects.listFieldsForOrg,
    { org, project_number: projectId }
  )
  console.log(`Project fields count: ${fields.length}`)
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
  console.log(`Existing project items count: ${existingItems.length}`)
  const existingIssueItems = existingItems
    .filter((item) => item.content_type === "Issue")
  const existingPrItems = existingItems
    .filter((item) => item.content_type === "PullRequest")
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
  const nonArchivedRepos = repos
    .filter((repo) => !repo.archived)
    .toSorted((repoA, repoB) => compare(repoA.name, repoB.name))
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
      let item = issueToItemMap.get(issue.id)
      if (!item) {
        try {
          console.log(`  Adding issue #${issue.number} to project with status 'To triage'`)
          const itemResponse = await octokit.rest.projects.addItemForOrg({
            org,
            project_number: projectId,
            type: 'Issue',
            id: issue.id
          })
          item = itemResponse.data
        } catch (error) {
          console.log(`  Error adding issue #${issue.number}: ${error.message}`)
          continue
        }
      }

      console.log(`  Updating issue #${issue.number} in project with (Parent created date: ${issue.created_at}, Repo stars, Last successful CI run)`)
      const fields = [
        { id: parentCreatedDateField.id, value: issue.created_at },
        { id: repoStarsField.id, value: repo.stargazers_count },
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
      await octokit.rest.projects.updateItemForOrg({
        org,
        project_number: projectId,
        item_id: item.id,
        fields,
      })
    }

    // Process pull requests
    for (const pr of pullRequests) {
      let item = prToItemMap.get(pr.id)
      if (!item) {
        console.log(`  Adding pull request #${pr.number} to project with status 'To triage'`)
        try {
          const itemResponse = await octokit.rest.projects.addItemForOrg({
            org,
            project_number: projectId,
            type: 'PullRequest',
            id: pr.id
          })
          item = itemResponse.data
        } catch (error) {
          console.log(`  Error adding pull request #${pr.number}: ${error.message}`)
          continue
        }
      }

      const isDependabot = pr.user?.login === 'dependabot[bot]'
      console.log(`  Updating PR #${pr.number} in project with (Dependabot?: ${isDependabot}, Parent created date: ${pr.created_at}, Repo stars, Last successful CI run)`)
      const fields = [
        {
          id: dependabotField.id,
          value: isDependabot ? dependabotYesOption.id : dependabotNoOption.id,
        },
        { id: parentCreatedDateField.id, value: pr.created_at },
        { id: repoStarsField.id, value: repo.stargazers_count },
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
      await octokit.rest.projects.updateItemForOrg({
        org,
        project_number: projectId,
        item_id: item.id,
        fields,
      })
    }
  }
}
