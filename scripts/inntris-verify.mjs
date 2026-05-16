import { appendFile, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { basename } from "node:path";

const DEFAULT_POLICY = ".inntris.yml";
const DEFAULT_RECEIPT = "demo/ai-pr-protection/receipt.json";

function argValue(name, fallback = undefined) {
  const index = process.argv.indexOf(name);
  if (index === -1) return fallback;
  return process.argv[index + 1] ?? fallback;
}

function parseListBlock(yaml, key) {
  const lines = yaml.split(/\r?\n/);
  const start = lines.findIndex((line) => line.trim() === `${key}:`);
  if (start === -1) return [];

  const values = [];
  for (let index = start + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line.startsWith(" ") && line.trim().endsWith(":")) break;
    const match = line.match(/^\s*-\s+"?([^"]+)"?\s*$/);
    if (match) values.push(match[1]);
  }
  return values;
}

function parseIndentedListAfter(yaml, marker) {
  const lines = yaml.split(/\r?\n/);
  const start = lines.findIndex((line) => line.trim() === marker);
  if (start === -1) return [];

  const values = [];
  for (let index = start + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line.trim()) continue;
    const match = line.match(/^\s*-\s+"?([^"]+)"?\s*$/);
    if (match) {
      values.push(match[1]);
      continue;
    }
    break;
  }
  return values;
}

function parsePolicy(yaml) {
  const protectedPaths = parseListBlock(yaml, "protected_paths");
  const lowRiskPaths = parseIndentedListAfter(yaml, "paths_match:");
  const allowedPaths = lowRiskPaths.length > 0 ? lowRiskPaths : ["docs/**", "src/components/**"];
  const blockReason =
    yaml.match(/reason:\s+"AI-generated PR touched protected production-sensitive files"/)?.[0]
      ?.replace("reason: ", "")
      .replaceAll('"', "") || "AI-generated PR touched protected production-sensitive files";
  const allowReason =
    yaml.match(/reason:\s+"AI-generated PR only touched approved low-risk paths"/)?.[0]
      ?.replace("reason: ", "")
      .replaceAll('"', "") || "AI-generated PR only touched approved low-risk paths";

  return { protectedPaths, lowRiskPaths: allowedPaths, blockReason, allowReason };
}

function globToRegExp(pattern) {
  const placeholder = "__DOUBLE_STAR__";
  const escaped = pattern
    .replaceAll("\\", "/")
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replaceAll("**", placeholder)
    .replaceAll("*", "[^/]*")
    .replaceAll(placeholder, ".*");

  return new RegExp(`^${escaped}$`);
}

function matchesAny(path, patterns) {
  const normalized = path.replaceAll("\\", "/");
  return patterns.some((pattern) => globToRegExp(pattern).test(normalized));
}

async function readChangedFiles() {
  const explicit = argValue("--changed-files");
  if (explicit) {
    const content = await readFile(explicit, "utf8");
    return content.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  }

  if (process.env.CHANGED_FILES) {
    return process.env.CHANGED_FILES.split(/\r?\n|,/).map((line) => line.trim()).filter(Boolean);
  }

  return [];
}

async function readPromptfooEvidence() {
  const path = argValue("--promptfoo-results", process.env.PROMPTFOO_RESULTS_PATH || "demo/promptfoo/results.json");
  if (!path || !existsSync(path)) return null;

  try {
    const parsed = JSON.parse(await readFile(path, "utf8"));
    return {
      source: path,
      risk: parsed.risk || parsed.verdict || "unknown",
      summary: parsed.summary || "Promptfoo result was present"
    };
  } catch {
    return {
      source: path,
      risk: "unreadable",
      summary: "Promptfoo result file was present but could not be parsed"
    };
  }
}

function decide({ actorType, branchTarget, changedFiles, policy, promptfoo }) {
  const protectedTouched = changedFiles.filter((file) => matchesAny(file, policy.protectedPaths));
  const lowRiskOnly = changedFiles.length > 0 && changedFiles.every((file) => matchesAny(file, policy.lowRiskPaths));
  const promptfooRisky = promptfoo && ["risky", "block", "fail", "failed"].includes(String(promptfoo.risk).toLowerCase());

  if (actorType === "ai_agent" && branchTarget === "main" && protectedTouched.length > 0) {
    return {
      verdict: "BLOCK",
      reason: policy.blockReason,
      protectedTouched,
      promptfooRisky
    };
  }

  if (actorType === "ai_agent" && promptfooRisky) {
    return {
      verdict: "BLOCK",
      reason: "Promptfoo flagged risky AI output for this pull request",
      protectedTouched,
      promptfooRisky
    };
  }

  if (actorType === "ai_agent" && lowRiskOnly) {
    return {
      verdict: "PASS",
      reason: policy.allowReason,
      protectedTouched,
      promptfooRisky
    };
  }

  return {
    verdict: "PASS",
    reason: "No AI policy block matched for this pull request",
    protectedTouched,
    promptfooRisky
  };
}

async function createReceipt(payload) {
  const hasApiCredentials =
    process.env.INNTRIS_API_URL && process.env.INNTRIS_API_KEY && process.env.INNTRIS_AGENT_ID;

  if (!hasApiCredentials) {
    const demoReceipt = {
      ...payload,
      receipt_url: `https://www.inntris.com/verify/demo-${payload.verdict.toLowerCase()}`,
      mode: "demo"
    };
    await writeFile(DEFAULT_RECEIPT, JSON.stringify(demoReceipt, null, 2));
    return demoReceipt;
  }

  const response = await fetch(`${process.env.INNTRIS_API_URL.replace(/\/$/, "")}/verification-receipts`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.INNTRIS_API_KEY}`
    },
    body: JSON.stringify({
      agent_id: process.env.INNTRIS_AGENT_ID,
      ...payload
    })
  });

  if (!response.ok) {
    throw new Error(`Inntris API returned ${response.status}: ${await response.text()}`);
  }

  return response.json();
}

async function writeGithubSummary(receipt, changedFiles) {
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (!summaryPath) return;

  const rows = changedFiles.map((file) => `| ${file} |`).join("\n") || "| No changed files detected |";
  await appendFile(
    summaryPath,
    [
      "## Inntris Verification",
      "",
      `**Decision:** ${receipt.verdict}`,
      "",
      `**Reason:** ${receipt.reason}`,
      "",
      `**Receipt:** ${receipt.receipt_url || "Receipt URL unavailable"}`,
      "",
      "| Changed file |",
      "| --- |",
      rows,
      ""
    ].join("\n")
  );
}

async function main() {
  const policyPath = argValue("--policy", DEFAULT_POLICY);
  const actorType = argValue("--actor-type", process.env.INNTRIS_ACTOR_TYPE || "ai_agent");
  const branchTarget = argValue("--branch-target", process.env.INNTRIS_BRANCH_TARGET || process.env.GITHUB_BASE_REF || "main");
  const changedFiles = await readChangedFiles();
  const policy = parsePolicy(await readFile(policyPath, "utf8"));
  const promptfoo = await readPromptfooEvidence();
  const decision = decide({ actorType, branchTarget, changedFiles, policy, promptfoo });
  const receipt = await createReceipt({
    product: "AI PR Protection for GitHub",
    repository: process.env.GITHUB_REPOSITORY || basename(process.cwd()),
    branch_target: branchTarget,
    actor_type: actorType,
    changed_files: changedFiles,
    promptfoo,
    ...decision,
    decided_at: new Date().toISOString()
  });

  console.log("Inntris Verification:", receipt.verdict);
  console.log("Reason:", receipt.reason);
  console.log("Receipt:", receipt.receipt_url || "Receipt URL unavailable");
  console.log("Mode:", receipt.mode || "api");

  await writeGithubSummary(receipt, changedFiles);

  if (receipt.verdict === "BLOCK") {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(`Inntris Verification failed: ${error.message}`);
  process.exitCode = 1;
});
