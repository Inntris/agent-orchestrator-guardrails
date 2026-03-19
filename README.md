# agent-orchestrator-guardrails

Action-level governance for AI agent pull requests. When an agent opens a PR, Inntris evaluates it against your policy, issues a signed **PASS** or **BLOCK** verdict, and anchors a cryptographic receipt on-chain — verifiable by anyone, without access to your infrastructure.

This repo is a live demo. PR #1 and PR #2 are **permanently open and blocked** — that's the product working, not a bug.

## What you're looking at

An AI agent (Composio Agent Orchestrator) opened two pull requests that added GitHub Action workflows, policy configurations, and test scaffolding. The [inntris-verify](https://github.com/Inntris/inntris-verify) GitHub Action evaluated each PR, classified the changes as high-risk — workflow files and policy definitions are sensitive by default — and issued BLOCK verdicts before merge.

The agent was trying to add governance tooling itself. The governance layer blocked it. That's the product working: any change that touches sensitive paths requires human approval, regardless of intent.

Each verdict is:

- **Signed** with Ed25519 — the agent cannot forge or alter it
- **Anchored on-chain** via Merkle tree on Base L2 — tamper-evident and permanent
- **Publicly verifiable** — no login, no access to the repo, no trust required

### Live receipts

| PR | Verdict | Verify |
|----|---------|--------|
| [#1 — Add inntris-verify Action scaffold + demo workflow and policies](https://github.com/Inntris/agent-orchestrator-guardrails/pull/1) | BLOCK | [Verify receipt →](https://www.inntris.com/verify/2f41036e-cd54-4ec1-86e1-22f96cbc09aa) |
| [#2 — Add Inntris Verified GitHub Action, policies, docs and tests](https://github.com/Inntris/agent-orchestrator-guardrails/pull/2) | BLOCK | [Verify receipt →](https://www.inntris.com/verify/e8025672-096d-4c5c-b621-e3daeea4baa6) |

> Click any verify link. You'll see the agent identity, the policy decision, the risk classification, the Ed25519 signature status, and the on-chain transaction hash linking to BaseScan. No account needed.

## Why the PRs stay open

Closing or merging them would remove the proof. These PRs exist as permanent, publicly visible evidence that:

1. An AI agent attempted to modify sensitive paths in a real repo
2. Policy enforcement caught it before merge — not after
3. The verdict is independently verifiable by a third party

This is what audit-ready agent governance looks like.

## How it works

```
Agent opens PR → inntris-verify Action runs → Policy evaluation →
Signed PASS or BLOCK verdict → Receipt anchored on-chain → 
Verify page live at inntris.com/verify/{id}
```

The agent never sees the policy rules. It receives a verdict. That's the security property — enforcement happens outside the agent's reasoning loop, so it cannot be reasoned around.

## Add this to your repo

Install the [inntris-verify GitHub Action](https://github.com/Inntris/inntris-verify) on any repo where AI agents open pull requests.

```yaml
# .github/workflows/inntris-verify.yml
name: Inntris Verify
on:
  pull_request:
    types: [opened, synchronize]

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: Inntris/inntris-verify@v1
```

Every agent PR gets a cryptographic receipt. Every receipt is publicly verifiable. The Action is MIT licensed — zero cost to install.

## Policy configuration

Define what your agents are and aren't allowed to touch in `.inntris.yml` at your repo root:

```yaml
# .inntris.yml
sensitive_paths:
  enabled: true
  severity: high
  prefixes:
    - .github/workflows/
    - scripts/
  filenames:
    - Dockerfile
    - docker-compose.yml

dependency_changes:
  enabled: true
  severity: medium
  filenames:
    - package.json
    - pnpm-lock.yaml
    - package-lock.json
    - yarn.lock
    - requirements.txt
    - poetry.lock

secret_detection:
  enabled: true
  severity: critical
  extra_patterns: []
```

Three rule types out of the box: **sensitive_paths** (CI, infra, scripts), **dependency_changes** (lockfiles, manifests), and **secret_detection** (keys, tokens, credentials). Each can be toggled independently and assigned a severity level.

## Who this is for

Teams running AI agents that open pull requests, execute code changes, or modify infrastructure in production repositories. If your agents touch code and you need to prove what they did to someone outside your team — a regulator, an auditor, an enterprise customer — this is the governance layer.

**Works with any agent framework:** Claude, CrewAI, Composio, LangChain, AutoGen, custom agents.

## Links

- [Inntris — Product](https://www.inntris.com)
- [Inntris — Docs](https://www.inntris.com/docs)
- [Contact](https://www.inntris.com/contact)

## License

This demo repo is public for verification purposes. The Inntris platform is licensed under [BSL 1.1](https://github.com/KingsmanRon/Inntris/blob/main/LICENSE).
