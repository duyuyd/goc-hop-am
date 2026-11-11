# Security policy — Góc Hợp Âm

## Scope
Security fixes should target the existing repository and deployment. Never overwrite the active Sites project with an older GitHub snapshot, disclose user data, or rotate production credentials without the owner's approval.

## Reporting vulnerabilities
Use **Security → Advisories → Report a vulnerability** when private reporting is enabled for this repository. Do **not** publish secret values, user records, exploit details, or proofs of compromise in a public issue.

For dependency warnings, consult **Security → Dependabot → Vulnerable dependencies**. For static-analysis findings, consult **Security → Code scanning**. Prioritize high/critical vulnerabilities that affect deployed runtime, authentication, user data, server rendering, or Android/iOS release tooling.

## Fix and validation
1. Confirm the exact vulnerable package/code path, impacted version, and advisory or rule ID.
2. Create a focused fix branch/PR from the latest `main`. Preserve Sites runtime bindings, D1/R2, admin accounts, music data, and mobile signing identity.
3. Run lockfile-aware dependency audit, applicable unit/integration tests, typecheck/build, Android/iOS CI where affected, and compare the alert state after the patch.
4. Deploy to Sites only after verifying the Sites source state and its own deployment workflow. A GitHub merge is **not** proof of a Sites release.
5. Do not dismiss alerts solely to reduce counters; document false positives with evidence.

No new paid service or unapproved public release is authorized by this policy.
