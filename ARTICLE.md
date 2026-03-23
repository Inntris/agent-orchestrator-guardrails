# Inntris x Composio Demo Teardown

## Thesis
Composio Agent Orchestrator solves orchestration. Inntris adds action-level governance. A green CI run is not the same as a safe PR.

## What was built
- A reusable GitHub Action (`inntris-verify`) that analyzes PR file diffs, applies policy checks, and optionally calls Inntris API for live verification + `audit_id`.
- A demo workflow in this repository that runs on pull requests and blocks risky changes.
- A repository-level `.inntris.yml` policy file tuned for orchestrator repos.

## Key design points
- API endpoint: `POST {INNTRIS_API_URL}/admin/test-verify` with `X-API-Key`
- Optional API creds (supports forks/no-secrets through `mode=auto` local mode)
- Verdict comes from JSON `verdict` field (source of truth)
- Fail-closed behavior for API errors by default
- No glob matching in v1 policy config
- Secret scanner inspects only added patch lines and never logs secret material

## User journey
1. Developer opens PR
2. `inntris-verified.yml` runs
3. Action classifies risk and chooses `action_type`
4. Action calls Inntris API when creds exist; otherwise local-only verdict
5. Job summary renders PASS/BLOCK, risk level, violations table, warnings, and audit metadata

## Proof artifacts the demo should expose
A compelling public demo needs **two proof records**, not just one:

1. **BLOCK proof** — shows governance refusing a risky `admin_action`.
2. **PASS proof** — shows a normal low-risk action being evaluated, approved, signed, and anchored.

The BLOCK proof demonstrates enforcement, but the PASS proof demonstrates operability and developer confidence. Together they show the system is not only capable of denial, but also capable of allowing legitimate work with verifiable receipts.

## Recommended controlled PASS scenario
- Branch from a clean base.
- Change only docs/examples content (for example `docs/pass-demo-change.md`).
- Avoid `.github/workflows/`, `scripts/`, `packages/`, dependency manifests, and secret-like strings.
- Capture the resulting PASS `audit_id` / receipt link and publish it alongside the BLOCK artifact.

## Why this is compelling
- Protects automation pipelines from risky self-modifying changes
- Makes governance visible directly in the PR conversation
- Works in forks and OSS contexts without requiring secrets
- Produces public proof for both approval and denial paths
