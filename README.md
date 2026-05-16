# Inntris AI PR Protection Demo

Inntris protects GitHub production branches from unchecked AI-generated PRs.

Normal CI checks whether code builds and tests pass. Inntris checks whether the AI agent was allowed to make that change and creates a verification receipt for the PASS/BLOCK decision.

## What this demo proves

This demo proves one narrow buyer outcome:

```text
AI-generated PR tries to touch production-sensitive code
-> optional Promptfoo risk evidence is present
-> Inntris GitHub Action runs as a required check
-> PR gets PASS or BLOCK
-> verification receipt explains why
```

The buyer should understand this in under 30 seconds: AI-generated PRs should not reach production without a policy check and proof receipt.

## The demo story

AI PR -> Inntris required check -> PASS/BLOCK receipt

### BLOCK example

An AI-generated PR modifies:

- `src/middleware.ts`
- `supabase/migrations/0012_update_rls.sql`

Expected result:

```text
Inntris Verification: BLOCK
Reason: AI-generated PR touched protected production-sensitive files
```

Run it locally:

```bash
npm run demo:block
```

### PASS example

An AI-generated PR modifies:

- `docs/setup.md`
- `src/components/SafeBanner.tsx`

Expected result:

```text
Inntris Verification: PASS
Reason: AI-generated PR only touched approved low-risk paths
```

Run it locally:

```bash
npm run demo:pass
```

## How to run locally

Use Node 18 or newer.

```bash
npm run demo:pass
npm run demo:block
```

The BLOCK command exits with a non-zero status by design. That mirrors a required GitHub Action check blocking merge.

Promptfoo is optional supporting evidence:

```bash
npm run demo:promptfoo:safe
npm run demo:promptfoo:risky
```

## Policy file

`.inntris.yml` defines protected production-sensitive paths and low-risk allowed paths.

Protected paths in this demo:

- `src/auth/**`
- `src/middleware.ts`
- `supabase/migrations/**`
- `.github/workflows/**`
- `infra/**`
- `**/.env*`

## GitHub Action

The focused workflow is:

```text
.github/workflows/inntris-verify.yml
```

It runs on pull requests, identifies changed files, reads `.inntris.yml`, optionally reads Promptfoo evidence, calls the Inntris API when credentials are present, and otherwise runs in deterministic demo mode.

Required repository secrets for real API mode:

```text
INNTRIS_API_URL
INNTRIS_API_KEY
INNTRIS_AGENT_ID
```

When those secrets are missing, the workflow still shows the buyer-visible PASS/BLOCK behavior in demo mode.

## How to trigger PASS

Open a PR that only changes approved low-risk paths:

```text
docs/**
src/components/**
```

Use `docs/setup.md` and `src/components/SafeBanner.tsx` for the recording.

## How to trigger BLOCK

Open a PR that changes protected production-sensitive paths:

```text
src/middleware.ts
supabase/migrations/**
.github/workflows/**
infra/**
**/.env*
```

Use `src/middleware.ts` and `supabase/migrations/0012_update_rls.sql` for the recording.

## Make the check required

In GitHub:

1. Go to `Settings` -> `Branches`.
2. Add or edit the branch protection rule for `main`.
3. Enable `Require status checks to pass before merging`.
4. Select `Inntris Verification`.
5. Save the rule.

## 60-second buyer explanation

"Your CI can tell you whether code builds. It cannot tell you whether Cursor, Codex, Claude Code, or another AI coding agent was allowed to touch auth, payments, migrations, secrets, workflows, or infra.

Inntris adds a required GitHub Action check for AI-generated PRs. If the PR only touches approved low-risk paths, it PASSes. If it touches protected production-sensitive files, it BLOCKs. Every decision creates a receipt showing what changed, which policy matched, and why the PR was allowed or blocked.

We can test it on one repo for $200/month, setup included for the first 3 design partners."

## Design partner onboarding

Minimum setup:

1. Confirm buyer, repo, and protected branch.
2. Pick protected paths: auth, payments, secrets, migrations, infra, workflows.
3. Install `.inntris.yml`.
4. Add `.github/workflows/inntris-verify.yml`.
5. Add Inntris API secrets if using real receipts.
6. Open one PASS PR and one BLOCK PR.
7. Turn `Inntris Verification` into a required branch protection check.
8. Collect first-month payment and agree success criteria.

## Trust-safe wording

Say:

- adds an AI-specific policy gate
- creates verification evidence
- supports review and audit

Avoid saying:

- prevents all bad code
- guarantees security
- replaces code review
- replaces CI

Inntris supports review and audit. It does not replace CI, secure coding, code review, or security testing.
