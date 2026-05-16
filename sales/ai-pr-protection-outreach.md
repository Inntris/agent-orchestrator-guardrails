# AI PR Protection Outreach

## 60-second demo script

"Here is the problem: AI coding agents can open PRs that touch auth, payments, migrations, secrets, workflows, or infra. CI may still pass, because CI checks whether code builds and tests pass. It does not prove the AI agent was allowed to make that production-sensitive change.

Inntris adds a required GitHub Action check for AI-generated PRs. In this demo, an AI PR tries to edit middleware and a Supabase migration. Inntris reads the repo policy, sees protected production paths, and returns BLOCK. The PR cannot merge while the required check is failing. Then we open the receipt: it shows the actor type, changed paths, matched policy, decision, and reason.

For safe changes like docs or a UI component, Inntris returns PASS and still creates a receipt. So the buyer gets an AI-specific policy gate with verification evidence, without replacing CI or code review."

## LinkedIn DM for AI agency

Are you using Cursor, Codex, Claude Code, or other AI coding agents on production repos? I am onboarding 3 design partners for AI PR Protection for GitHub. It adds a required PASS/BLOCK check before AI-generated PRs can reach production and creates a receipt showing what happened and why. $200/month per repo, setup included. Worth testing on one repo?

## LinkedIn DM for fractional CTO

Quick question: are any of your clients letting AI coding agents open PRs against production repos? I'm onboarding 3 design partners for Inntris AI PR Protection for GitHub. It adds a required PASS/BLOCK GitHub check for AI-generated PRs and creates a verification receipt for audit/review. $200/month per repo, setup included. Want to test it on one client repo?

## LinkedIn DM for security consultant

Do your clients use Cursor, Codex, Claude Code, or similar agents in GitHub? I'm packaging Inntris as AI PR Protection for GitHub: a required PASS/BLOCK check that stops AI-generated PRs from touching protected production paths without a receipt. $200/month per repo, setup included for 3 design partners. Could be a clean add-on to your review/audit work. Worth a 15-minute look?

## Email for startup CTO

Subject: Required check for AI-generated PRs

Hi {{first_name}},

Are you using Cursor, Codex, Claude Code, or other AI coding agents on production repos?

I'm onboarding 3 design partners for Inntris AI PR Protection for GitHub. It adds a required PASS/BLOCK check before AI-generated PRs can reach production and creates a receipt showing what happened and why.

Example: AI PR touches middleware or database migrations -> Inntris blocks the PR -> receipt shows the changed files and policy reason. Docs/UI-only changes can pass with a receipt.

It is $200/month per repo, setup included for the first 3 design partners.

Worth testing on one repo this week?

{{your_name}}

## Follow-up after no reply

Worth a quick no-pressure test? The setup target is one repo, one protected branch, and a basic policy for auth/payments/secrets/migrations/workflows/infra. You'll know in one demo PR whether this belongs in your branch protection rules.

## Follow-up after demo viewed

Saw you had a look at the AI PR Protection demo. The simplest next step is a 30-minute setup on one repo: add the policy, add the GitHub Action, run one PASS PR and one BLOCK PR, then decide if `Inntris Verification` should become a required check.

## Objection handling

"We already have CI."

CI checks whether code builds/tests pass. Inntris adds an AI-specific policy gate showing whether the agent was allowed to touch production-sensitive paths.

"We already require code review."

Good. Inntris supports review with verification evidence. Reviewers get a receipt explaining what the AI PR attempted and why it was allowed or blocked.

"We are not ready for a platform."

This is not a broad governance rollout. The offer is one repo, one protected branch, one required GitHub check, and receipts.

"Will this guarantee security?"

No. It does not replace secure coding, CI, review, or security testing. It adds a focused control for AI-generated PRs.

"Why $200/month?"

It is priced as a lightweight production safety check: setup included, one repo protected, monthly summary, and receipts for PASS/BLOCK decisions.

"Can it work without real API credentials for evaluation?"

Yes. Demo mode produces deterministic PASS/BLOCK output so the buyer can see the workflow before connecting real Inntris credentials.
