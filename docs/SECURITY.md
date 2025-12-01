# GitHub Actions Security Analysis

## Current Security Posture

### ✅ What's Secure

1. **OIDC Authentication**: Using federated credentials instead of long-lived secrets
2. **Manual Deployments**: Deploy workflow requires manual trigger (`workflow_dispatch`)
3. **Minimal Permissions**: Workflows use least privilege (`id-token: write`, `contents: read`)
4. **Environment Protection**: Using GitHub Environments for dev/staging/prod

### ⚠️ Security Concerns

1. **CI Runs on All PRs**: Your `ci.yml` runs automatically on PRs from forks
2. **Broad OIDC Subjects**: Federated credentials allow any workflow from main/PRs
3. **No Branch Protection**: Need to verify branch protection rules are enabled
4. **Public Repository Risk**: Anyone can fork and create PRs

## Recommended Security Hardening

### 1. Restrict OIDC Subjects to Specific Workflows

**Current Issue**: Your federated credentials allow ANY workflow to authenticate.

**Solution**: Restrict OIDC subjects to specific workflow files:

```powershell
# Update setup-github-oidc.ps1 federated credentials
$credentials = @(
    @{
        Name = "github-deploy-workflow"
        Subject = "repo:${GitHubOrg}/${GitHubRepo}:workflow:deploy-azure.yml:ref:refs/heads/main"
        Description = "GitHub Actions - Deploy workflow only"
    },
    @{
        Name = "github-ci-workflow"
        Subject = "repo:${GitHubOrg}/${GitHubRepo}:workflow:ci.yml:ref:refs/heads/main"
        Description = "GitHub Actions - CI workflow only"
    },
    @{
        Name = "github-env-dev"
        Subject = "repo:${GitHubOrg}/${GitHubRepo}:environment:dev"
        Description = "GitHub Actions - dev environment"
    },
    @{
        Name = "github-env-staging"
        Subject = "repo:${GitHubOrg}/${GitHubRepo}:environment:staging"
        Description = "GitHub Actions - staging environment"
    },
    @{
        Name = "github-env-production"
        Subject = "repo:${GitHubOrg}/${GitHubRepo}:environment:production"
        Description = "GitHub Actions - production environment"
    }
    # REMOVE: github-pull-request credential (too broad)
)
```

### 2. Enable Branch Protection Rules

**Required Settings**:

1. Go to: **Settings → Branches → Branch protection rules → Add rule**
2. Branch name pattern: `main`
3. Enable:
   - ✅ Require a pull request before merging
   - ✅ Require approvals (at least 1)
   - ✅ Require status checks to pass before merging
   - ✅ Require branches to be up to date before merging
   - ✅ Do not allow bypassing the above settings
   - ✅ Restrict pushes that create files larger than 100MB
   - ✅ Block force pushes
   - ✅ Block deletions

### 3. Restrict CI Workflow to Trusted PRs Only

**Update `.github/workflows/ci.yml`**:

```yaml
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
    # Only run on PRs from the same repository (not forks)
    types: [opened, synchronize, reopened]

jobs:
  lint:
    # Skip CI for PRs from forks (they can't access secrets anyway)
    if: github.event.pull_request.head.repo.full_name == github.repository
```

### 4. Add Environment Protection Rules

**For each environment (dev/staging/prod)**:

1. Go to: **Settings → Environments**
2. Click on environment (dev/staging/prod)
3. Enable:
   - ✅ Required reviewers (add yourself/team)
   - ✅ Wait timer (optional, e.g., 5 minutes for prod)
   - ✅ Deployment branches: Only allow `main` branch

### 5. Restrict Workflow Permissions at Repository Level

**Settings → Actions → General → Workflow permissions**:

- ✅ Select: **Read repository contents and packages permissions**
- ✅ Uncheck: **Allow GitHub Actions to create and approve pull requests**
- ✅ Add: **Read and write permissions** only for specific workflows that need it

### 6. Pin Action Versions

**Current**: Using `@v4`, `@v2` (mutable tags)

**Recommended**: Pin to commit SHAs:

```yaml
- uses: actions/checkout@8e5e7e5ab8b370d6c329ec480221332ada57f0fd  # v4
- uses: azure/login@b0c2864b8b5c8e3b3e3b3e3b3e3b3e3b3e3b3e3b  # v2
```

### 7. Add Workflow Approval for Production

**For production environment**:

1. Go to: **Settings → Environments → production**
2. Add **Required reviewers** (yourself + team)
3. This requires manual approval before production deployments

## Security Checklist

- [ ] Update OIDC federated credentials to restrict to specific workflows
- [ ] Enable branch protection rules for `main`
- [ ] Restrict CI workflow to same-repo PRs only
- [ ] Configure environment protection rules (reviewers, branches)
- [ ] Pin action versions to commit SHAs
- [ ] Review and restrict repository-level workflow permissions
- [ ] Add required reviewers for production environment
- [ ] Enable "Require approval for all outside collaborators" in Actions settings

## Testing Security

1. **Test Fork PR**: Fork your repo, create a PR, verify CI runs but can't access Azure secrets
2. **Test Manual Deploy**: Verify only authorized users can trigger deployments
3. **Test Environment Protection**: Verify production requires approval

## Current Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| Fork PRs triggering CI | Low | CI can't access Azure secrets (OIDC requires main branch) |
| Unauthorized deployments | Low | Manual trigger + environment protection |
| Malicious code in PRs | Medium | Branch protection + required reviews |
| Supply chain attacks | Medium | Pin action versions to SHAs |
| Credential exposure | Low | Using OIDC (no long-lived secrets) |

## Conclusion

**Your current setup is reasonably secure** for a public repository, but implementing the recommendations above will significantly harden it. The most critical improvements are:

1. **Branch protection rules** (prevents unauthorized code merges)
2. **Environment protection** (requires approval for production)
3. **Restricted OIDC subjects** (prevents unauthorized workflow runs)

With these in place, you can safely keep the repository public while maintaining control over deployments to your private Azure tenant.
