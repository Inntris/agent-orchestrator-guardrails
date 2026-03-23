# PASS Demo Playbook

Use this playbook to generate a PR that should PASS `Inntris Verified`.

## Goal
Produce a PR that is evaluated by Inntris, classified as `api_call`, approved, and recorded with an audit receipt.

## Rules for a clean PASS
Only change files in safe content locations such as:
- `docs/`
- `examples/`

Do **not** include changes to:
- `.github/workflows/`
- `scripts/`
- `packages/`
- `package.json`
- `pnpm-lock.yaml`
- `package-lock.json`
- `yarn.lock`
- any secret-like tokens or credentials in added lines

## Recommended branch flow
1. Branch from a clean base (`main` or the commit after the integration PR is merged).
2. Change only one safe file, for example:
   - `docs/pass-demo-change.md`
   - `examples/pass-demo-safe.txt`
3. Open the PR against `main`.
4. Confirm the PR diff contains only safe-file changes.
5. Wait for `Inntris Verified` to run.
6. Confirm the action resolves to the `api_call` path and returns an approved verdict.
7. Capture the resulting `audit_id` / receipt URL as the public PASS proof artifact.

## Expected outcome
- GitHub check: ✅ PASS
- Inntris verdict: approved
- Action type: `api_call`
- Public proof: PASS receipt / audit record
