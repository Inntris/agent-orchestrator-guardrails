# agent-orchestrator-guardrails

Action-level governance demo for Composio Agent Orchestrator: **Inntris Verified** blocks risky PRs (CI/workflow edits, dependency changes, and potential secret leaks) and logs an `audit_id` when API credentials are available.

## Try it

1. Fork this repository.
2. Add repository secrets:
   - `INNTRIS_API_URL`
   - `INNTRIS_API_KEY`
   - `INNTRIS_AGENT_ID`
3. Open a PR touching safe files (expect ✅ PASS).
4. Open a PR touching `.github/workflows/*`, lockfiles, or adding a secret-like token (expect ❌ BLOCK).

### Demo PR links

- PASS PR: `TODO-add-pass-pr-link`
- BLOCK PR: `TODO-add-block-pr-link`

### Workflow used

See `.github/workflows/inntris-verified.yml` for the exact action wiring and `.inntris.yml` for policy configuration.

## Inntris Verify Action source

The demo also includes a full build of `inntris/inntris-verify` under `inntris-verify/` with:

- Node 20 action scaffold
- local + API (`/admin/test-verify`) verification modes
- fail-closed API error behavior by default
- policy engine (sensitive paths, dependency manifests, secret detection)
- Jest test suite
