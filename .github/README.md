# GitHub Actions Workflows

This directory contains automated CI/CD workflows for the Skyflow MCP Server.

## Available Workflows

### 1. Unit Tests (`test.yml`)

**Triggers:**
- Every push to `main` or `master` branch
- Every pull request targeting `main` or `master` branch

**What it does:**
- ✅ Checks out the code
- ✅ Sets up Node.js 20
- ✅ Installs pnpm and caches dependencies
- ✅ Runs all unit tests (`pnpm test`)
- ✅ Performs TypeScript type checking (`tsc --noEmit`)

**Status:** Shows ✅ or ❌ next to commits and PRs

---

### 2. Test Coverage (`coverage.yml`)

**Triggers:**
- Every push to `main` or `master` branch
- Every pull request targeting `main` or `master` branch

**What it does:**
- ✅ Runs all tests with coverage reporting
- ✅ Generates coverage reports (JSON, HTML)
- ✅ Uploads coverage to Codecov (optional)

**Setup Codecov (Optional):**
1. Sign up at [codecov.io](https://codecov.io)
2. Add your repository
3. Get your `CODECOV_TOKEN`
4. Add it to GitHub Secrets: `Settings` → `Secrets and variables` → `Actions` → `New repository secret`
5. Name: `CODECOV_TOKEN`
6. Value: Your token from Codecov

> **Note:** Coverage upload will not fail the build if the token is missing.

---

## Viewing Results

### In Pull Requests
- Workflows run automatically on every PR
- Check marks (✅) or X marks (❌) appear next to the PR
- Click "Details" to see full logs

### In GitHub Actions Tab
1. Go to your repository
2. Click "Actions" tab
3. See all workflow runs
4. Click on any run to see detailed logs

---

## Local Testing

Before pushing, you can run the same checks locally:

```bash
# Run tests
pnpm test

# Run tests with coverage
pnpm test:coverage

# Type check
npx tsc --noEmit

# Watch mode (for development)
pnpm test:watch
```

---

## Workflow Configuration

Both workflows use:
- **Node.js:** v20
- **pnpm:** v10
- **OS:** Ubuntu Latest
- **Caching:** pnpm store is cached for faster builds

---

## Troubleshooting

### Tests failing in CI but passing locally?

1. **Check Node version:** Ensure you're using Node 20 locally
2. **Clean install:** Run `pnpm install --frozen-lockfile`
3. **Environment:** CI runs in a clean environment without `.env.local`

### Slow CI builds?

- First run is slower (no cache)
- Subsequent runs use cached dependencies (~2x faster)

### Need to skip CI for a commit?

Add `[skip ci]` to your commit message:
```bash
git commit -m "docs: update README [skip ci]"
```

---

## Badge for README

Add this to your main README.md to show test status:

```markdown
![Tests](https://github.com/YOUR_USERNAME/YOUR_REPO/actions/workflows/test.yml/badge.svg)
![Coverage](https://github.com/YOUR_USERNAME/YOUR_REPO/actions/workflows/coverage.yml/badge.svg)
```
