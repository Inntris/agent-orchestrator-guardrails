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

## Why this is compelling
- Protects automation pipelines from risky self-modifying changes
- Makes governance visible directly in the PR conversation
- Works in forks and OSS contexts without requiring secrets
