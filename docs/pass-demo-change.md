# PASS Demo Change

This file is intentionally a docs-only change to demonstrate a safe PR path.

Expected Inntris behavior:
- Classification remains low-risk (`api_call` path).
- No sensitive workflow, script, dependency, or secret policy triggers.
- Verification check should pass when backend policies allow normal API calls.
