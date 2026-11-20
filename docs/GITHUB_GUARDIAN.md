# GitHub Guardian — Góc Hợp Âm

The requested GitHub Actions marketplace contains many independent tools with different contracts. This repository integrates only production-relevant automation; a template shown under GitHub **Configure** is not proof that a service is configured or working.

## What is implemented

| Workflow | Purpose | Trigger | Result |
| --- | --- | --- | --- |
| Existing GitHub CodeQL default setup | CodeQL scanning already enabled for this repository; do not add an advanced CodeQL workflow alongside it | GitHub-managed default setup | Alerts in the existing Security → Code scanning dashboard |
| Guardian - PR dependency review | Reject newly introduced high/critical vulnerable dependencies | PR targeting main | PR check (no automatic dependency modification) |
| Guardian - OpenSSF supply chain scorecard | Audit dependency, maintainer, and workflow supply-chain signals | main push / weekly after merge | SARIF Actions artifact, 7-day retention |
| Guardian - public production website check | Fetch **real** HTTPS website, validate HTTP/HTML/brand, record uptime/latency result | feature push / daily after merge / manual | JSON artifact and GitHub job summary; fails on mismatch |

**Existing pipelines remain untouched.** Music service on existing Sites/Cloudflare; source main is NOT a deploy source of truth for Sites. Existing mobile releases, user records, Supabase/D1/R2 resources, signing keys and deployment credentials are not modified. This PR does not automatically deploy or merge.

### Production endpoint

Current verification endpoint: `https://goc-hop-am.onwardcrust.chatgpt.site/`. To change this, set the repository Actions variable `PRODUCTION_URL` to a real publicly accessible HTTPS production URL. No external API key is required for these workflows. If a site is protected behind a login or bot challenge, the probe reports a failure rather than silently passing.

### Safety contract

- No release, website deployment, repository-wide rename, payments, user data deletion, or production database migration.
- No auto-merge. PR must remain reviewable until Founder explicitly comments **VERIFIED**.
- No auto-fix or remote execution of untrusted PR code with elevated write permissions. External dependency review and CodeQL report findings; a human reviews fixes before merging.
- GitHub's existing CodeQL **default setup** is active. An additional advanced CodeQL workflow was removed after GitHub rejected its duplicate SARIF upload. Default setup remains untouched; inspect the repo Security → Code scanning page for its findings.
- The CodeQL workflow adds security scans, not a guarantee of vulnerability-free code; runtime authentication/RLS and Android device tests are separate concerns.
- GitHub Actions hosted runner usage depends on repository visibility and account quotas; do not enable paid resources without approval.

### Where to inspect

- GitHub Actions tab: open `Guardian` workflows and inspect individual job steps.
- GitHub Security tab: Code Scanning alerts after a successful CodeQL upload.
- GitHub PR Checks: dependency review.
- Workflow Artifacts: `guardian-ossf-scorecard` and `guardian-production-health`.

This is a staged baseline, not the entire public GitHub Actions Marketplace; unrelated Azure, Kubernetes, Java/Maven, Ruby, PHP, iOS publishing and cloud-provider actions require their own corresponding infrastructure and are deliberately not activated.

## Verified integration constraints

- The public production probe returned HTTP 200 and the expected page brand in GitHub Actions before this documentation update.
- OpenSSF Scorecard Action refuses non-default branches. Its workflow is committed for review but will only execute against `main` after a Founder-approved merge; do not count the earlier failed feature-branch run as a completed scan.
- New custom Actions cannot be considered deployed to the production website merely by creating a PR. Existing website versions are unchanged.
