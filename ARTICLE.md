# AI PR Protection for GitHub

## Thesis

AI coding agents can open pull requests and edit production-sensitive files. CI can still pass. The missing control is a required policy gate that asks whether the agent was allowed to make that change and produces proof for the decision.

## What this demo shows

Inntris adds a required GitHub Action check to pull requests:

1. The action identifies changed files.
2. It reads `.inntris.yml`.
3. It optionally includes Promptfoo risk evidence.
4. It returns PASS or BLOCK.
5. It creates a verification receipt.

The narrow offer is AI PR Protection for GitHub: $200/month per repo, setup included for the first 3 design partners.

## Why it matters

Normal CI answers: does the code build and do tests pass?

Inntris answers: was this AI-generated PR allowed to touch this production surface, and where is the evidence?

## Demo script

Show two PRs:

- PASS: docs and safe UI component only.
- BLOCK: middleware and database migration.

Then show the GitHub Action summary and the receipt URL.

## Buyer-safe positioning

Inntris adds an AI-specific policy gate, creates verification evidence, and supports review and audit. It does not replace CI, code review, secure development, or security testing.
