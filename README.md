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

### Public proof artifacts

For this demo to feel complete to evaluators, it needs **both** receipt types publicly visible:

- **PASS receipt** — a controlled safe action that was evaluated, approved, signed, and anchored.
- **BLOCK receipt** — a risky action that was evaluated, denied, and anchored as a governance proof record.

The BLOCK path proves enforcement. The PASS path proves the full happy-path verification loop developers actually want to install.

Add these links once available:

- PASS receipt / audit proof: `TODO-add-pass-receipt-link`
- BLOCK receipt / audit proof: `TODO-add-block-receipt-link`

### Recommended PASS scenario

Use the dedicated safe files `docs/pass-demo-change.md` or `examples/pass-demo-safe.txt` as PASS artifact sources. Pair them with the step-by-step guide in `docs/pass-demo-playbook.md`. These files are designed to stay out of sensitive paths and resolve to the low-risk `api_call` path rather than `admin_action`.

### Workflow used

See `.github/workflows/inntris-verified.yml` for the exact action wiring (this demo uses `./inntris-verify` so CI runs immediately in this repository) and `.inntris.yml` for policy configuration.

## Inntris Verify Action source

The demo also includes a full build of `inntris/inntris-verify` under `inntris-verify/` with:

- Node 20 action scaffold
- local + API (`/admin/test-verify`) verification modes
- fail-closed API error behavior by default
- policy engine (sensitive paths, dependency manifests, secret detection)
- Jest test suite
