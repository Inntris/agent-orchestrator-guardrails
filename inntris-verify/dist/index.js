"use strict";

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

function getInput(name, options = {}) {
  const key = `INPUT_${name.replace(/ /g, "_").toUpperCase()}`;
  const val = process.env[key] || "";
  if (!val && options.required) {
    throw new Error(`Input required and not supplied: ${name}`);
  }
  return val.trim();
}

function setOutput(name, value) {
  const out = process.env.GITHUB_OUTPUT;
  if (out) {
    fs.appendFileSync(out, `${name}=${String(value)}\n`);
  } else {
    console.log(`::set-output name=${name}::${String(value)}`);
  }
}

function info(msg) { console.log(msg); }
function warning(msg) { console.log(`::warning::${msg}`); }
function setFailed(msg) { console.log(`::error::${msg}`); process.exitCode = 1; }

class Summary {
  constructor() { this.buf = ""; }
  addHeading(text, level = 1) { this.buf += `${"#".repeat(level)} ${text}\n\n`; return this; }
  addRaw(text, addEOL = false) { this.buf += text + (addEOL ? "\n" : ""); return this; }
  addList(items) { for (const i of items) this.buf += `- ${i}\n`; this.buf += "\n"; return this; }
  addTable(rows) {
    if (!rows.length) return this;
    const toCell = (c) => typeof c === "string" ? c : c.data;
    const header = rows[0].map(toCell);
    this.buf += `| ${header.join(" | ")} |\n`;
    this.buf += `| ${header.map(() => "---").join(" | ")} |\n`;
    for (let i = 1; i < rows.length; i++) this.buf += `| ${rows[i].map(toCell).join(" | ")} |\n`;
    this.buf += "\n";
    return this;
  }
  async write() {
    const file = process.env.GITHUB_STEP_SUMMARY;
    if (file) fs.appendFileSync(file, this.buf);
    else console.log(this.buf);
  }
}

const summary = new Summary();

function parseBool(v, fallback = false) {
  if (v === "") return fallback;
  return String(v).toLowerCase() === "true";
}

function parseSimpleYaml(yamlText) {
  const root = {};
  const lines = yamlText.split(/\r?\n/);
  let section = null;
  let sub = null;

  for (const raw of lines) {
    const line = raw.replace(/\t/g, "    ");
    if (!line.trim() || line.trimStart().startsWith("#")) continue;

    const topMatch = /^([a-zA-Z0-9_]+):\s*$/.exec(line);
    if (topMatch && !line.startsWith("  ")) {
      section = topMatch[1];
      root[section] = root[section] || {};
      sub = null;
      continue;
    }

    const subMatch = /^  ([a-zA-Z0-9_]+):\s*(.*)$/.exec(line);
    if (subMatch && section) {
      sub = subMatch[1];
      const v = subMatch[2].trim();
      if (v === "") {
        root[section][sub] = [];
      } else if (v === "true" || v === "false") {
        root[section][sub] = v === "true";
      } else {
        root[section][sub] = v.replace(/^['"]|['"]$/g, "");
      }
      continue;
    }

    const listMatch = /^\s*-\s*(.+)$/.exec(line);
    if (listMatch && section && sub) {
      if (!Array.isArray(root[section][sub])) root[section][sub] = [];
      root[section][sub].push(listMatch[1].replace(/^['"]|['"]$/g, ""));
    }
  }
  return root;
}

const DEFAULT_CONFIG = {
  sensitive_paths: { enabled: true, severity: "high", prefixes: [".github/workflows/", "scripts/", "infra/"], filenames: ["Dockerfile", "docker-compose.yml"] },
  dependency_changes: { enabled: true, severity: "medium", filenames: ["package.json", "pnpm-lock.yaml", "package-lock.json", "yarn.lock"] },
  secret_detection: {
    enabled: true,
    severity: "critical",
    patterns: [
      "AKIA[0-9A-Z]{16}",
      "ghp_[A-Za-z0-9]{36}",
      "xox[baprs]-[A-Za-z0-9-]{10,80}",
      "-----BEGIN (?:RSA|EC|OPENSSH|DSA) PRIVATE KEY-----",
      "AIza[0-9A-Za-z\\-_]{35}",
      "(?:api|secret|token|password)[\"'\\s:=]{1,6}[A-Za-z0-9_\\-]{12,}"
    ]
  }
};

function loadPolicyConfig(configPath) {
  const cfg = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
  const full = path.resolve(process.cwd(), configPath);
  if (!fs.existsSync(full)) {
    info(`Policy config not found at ${configPath}, using defaults.`);
    return cfg;
  }

  const parsed = parseSimpleYaml(fs.readFileSync(full, "utf8"));

  if (parsed.sensitive_paths) {
    Object.assign(cfg.sensitive_paths, parsed.sensitive_paths);
    if (parsed.sensitive_paths.extra_patterns && Array.isArray(parsed.sensitive_paths.extra_patterns)) {
      // noop
    }
  }
  if (parsed.dependency_changes) {
    Object.assign(cfg.dependency_changes, parsed.dependency_changes);
  }
  if (parsed.secret_detection) {
    Object.assign(cfg.secret_detection, parsed.secret_detection);
    const extra = parsed.secret_detection.extra_patterns || [];
    if (Array.isArray(extra)) cfg.secret_detection.patterns.push(...extra);
  }

  const globLike = [...(cfg.sensitive_paths.prefixes || []), ...(cfg.sensitive_paths.filenames || []), ...(cfg.dependency_changes.filenames || [])]
    .filter((p) => /[*?\[\]]/.test(p));
  for (const p of globLike) warning(`Unsupported glob-like pattern ignored in v1: ${p}`);

  return cfg;
}

function analyze(files, cfg) {
  const violations = [];
  const warnings = [];

  if (cfg.sensitive_paths.enabled) {
    for (const f of files) {
      for (const prefix of cfg.sensitive_paths.prefixes || []) {
        if (prefix.endsWith("/") && f.filename.startsWith(prefix)) {
          violations.push({ policy: "sensitive-paths", severity: cfg.sensitive_paths.severity, message: `Change in sensitive path prefix (${prefix})`, file: f.filename, rule: `prefix:${prefix}` });
        }
      }
      for (const name of cfg.sensitive_paths.filenames || []) {
        if (f.filename === name || f.filename.split("/").pop() === name) {
          violations.push({ policy: "sensitive-paths", severity: cfg.sensitive_paths.severity, message: `Change in sensitive filename (${name})`, file: f.filename, rule: `filename:${name}` });
        }
      }
    }
  }

  if (cfg.dependency_changes.enabled) {
    for (const f of files) {
      for (const name of cfg.dependency_changes.filenames || []) {
        if (f.filename === name) {
          violations.push({ policy: "dependency-changes", severity: cfg.dependency_changes.severity, message: `Dependency manifest changed (${name})`, file: f.filename, rule: `filename:${name}` });
        }
      }
    }
  }

  if (cfg.secret_detection.enabled) {
    const patterns = (cfg.secret_detection.patterns || []).map((p) => {
      try { return new RegExp(p, "i"); } catch { return null; }
    }).filter(Boolean);

    let skipped = 0;
    for (const f of files) {
      if (!f.patch) { skipped += 1; continue; }
      for (const line of String(f.patch).split("\n")) {
        if (!line.startsWith("+") || line.startsWith("+++")) continue;
        for (const pat of patterns) {
          if (pat.test(line)) {
            violations.push({ policy: "secret-detection", severity: cfg.secret_detection.severity, message: "Potential secret detected in added line", file: f.filename, rule: `pattern:${pat.source}` });
          }
        }
      }
    }
    if (skipped > 0) warnings.push(`Secret scan skipped for ${skipped} files (patch unavailable)`);
  }

  const order = ["none", "low", "medium", "high", "critical"];
  let risk = "none";
  for (const v of violations) if (order.indexOf(v.severity) > order.indexOf(risk)) risk = v.severity;
  const action_type = violations.some((v) => v.policy === "sensitive-paths") ? "admin_action" : violations.some((v) => v.policy === "secret-detection") ? "data_export" : "api_call";

  return {
    violations,
    files_analyzed: files.length,
    flagged_files: [...new Set(violations.map((v) => v.file))],
    risk_level: risk,
    action_type,
    warnings
  };
}

async function githubRequest(url, token) {
  const r = await fetch(url, {
    headers: {
      "Accept": "application/vnd.github+json",
      "Authorization": `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "inntris-verify-action"
    }
  });
  if (!r.ok) throw new Error(`GitHub API request failed (${r.status})`);
  return r.json();
}

async function listPrFiles(owner, repo, prNumber, token) {
  const out = [];
  let page = 1;
  while (true) {
    const url = `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}/files?per_page=100&page=${page}`;
    const items = await githubRequest(url, token);
    if (!Array.isArray(items) || items.length === 0) break;
    out.push(...items.map((f) => ({ filename: f.filename, patch: f.patch || null })));
    if (items.length < 100) break;
    page += 1;
  }
  return out;
}

async function verifyWithInntris(analysis, options) {
  const hasCreds = Boolean(options.apiKey && options.agentId);

  const getAgentIdFingerprint = (agentId) => {
    if (!agentId) return "missing";
    return crypto.createHash("sha256").update(agentId).digest("hex").slice(0, 10);
  };

  const classifyAgentId = (agentId) => {
    if (!agentId) return "missing";
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(agentId)) return "uuid_like";
    if (/^[a-z0-9][a-z0-9_-]{2,127}$/i.test(agentId)) return "slug_like";
    return "unknown";
  };

  if (options.mode === "local" || (options.mode === "auto" && !hasCreds)) {
    const localVerdict = analysis.violations.length > 0 ? "blocked" : "approved";
    return {
      verdict: localVerdict,
      reason: hasCreds ? "Local mode forced" : "Missing API credentials; local-only mode",
      mode_used: "local",
      risk_level: analysis.risk_level
    };
  }
  if (options.mode === "api" && !hasCreds) {
    throw new Error("mode=api requires inntris_api_key and inntris_agent_id");
  }

  const baseUrl = String(options.apiUrl || "").replace(/\/+$/, "");
  const url = `${baseUrl}/admin/test-verify`;

  const payload = {
    agent_id: options.agentId,
    action_type: analysis.action_type,
    payload: {
      risk_level: analysis.risk_level,
      violations: analysis.violations,
      files_analyzed: analysis.files_analyzed,
      flagged_files: analysis.flagged_files
    }
  };

  if (!payload || Object.keys(payload).length === 0) {
    throw new Error("Inntris API payload is empty");
  }

  const redactUrl = (rawUrl) => {
    try {
      const parsed = new URL(rawUrl);
      return `${parsed.origin}${parsed.pathname}`;
    } catch {
      return rawUrl;
    }
  };

  const agentIdType = classifyAgentId(options.agentId);
  info(`[inntris-verify] API base URL input: ${redactUrl(baseUrl)}`);
  info(`[inntris-verify] API final URL: ${redactUrl(url)}`);
  info(`[inntris-verify] API key present: ${Boolean(options.apiKey)}`);
  info(`[inntris-verify] Request body keys: ${Object.keys(payload).join(", ")}`);
  info(`[inntris-verify] Nested payload keys: ${Object.keys(payload.payload).join(", ")}`);
  info(`[inntris-verify] agent_id present: ${Boolean(options.agentId)} | length: ${options.agentId ? options.agentId.length : 0} | fingerprint: ${getAgentIdFingerprint(options.agentId)} | format: ${agentIdType}`);
  info("[inntris-verify] Backend agent_id format expectation is backend-defined; validate INNTRIS_AGENT_ID against your Inntris dashboard/API.");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutSeconds * 1000);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-API-Key": options.apiKey },
      signal: controller.signal,
      body: JSON.stringify(payload)
    });

    const text = await res.text();
    if (!res.ok) {
      const lower = text.toLowerCase();
      if (res.status === 404 && lower.includes("agent") && lower.includes("not found")) {
        throw new Error(`Inntris API rejected agent_id: agent not found (format=${agentIdType}, fingerprint=${getAgentIdFingerprint(options.agentId)}). Verify INNTRIS_AGENT_ID in repo secrets.`);
      }
      if (res.status >= 500) {
        throw new Error(`Inntris backend crashed at /admin/test-verify (HTTP ${res.status}) at ${redactUrl(url)}: ${text}`);
      }
      throw new Error(`Inntris API ${res.status} at ${redactUrl(url)}: ${text}`);
    }

    let data;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error(`Inntris API returned non-JSON success response at ${redactUrl(url)}: ${text}`);
    }

    if (!data?.verdict) {
      throw new Error(`Inntris API success response missing verdict: ${text}`);
    }

    return {
      verdict: data.verdict,
      reason: data.reason || `API verdict: ${data.verdict}`,
      audit_id: data.audit_id,
      trust_score: data.trust_score,
      mode_used: "api",
      risk_level: analysis.risk_level
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown API error";
    if (options.failOnApiError) {
      return { verdict: "blocked", reason: `API error (fail-closed): ${message}`, mode_used: "api", risk_level: analysis.risk_level };
    }
    return { verdict: analysis.violations.length > 0 ? "blocked" : "approved", reason: `API error (continuing local): ${message}`, mode_used: "local", risk_level: analysis.risk_level };
  } finally {
    clearTimeout(timer);
  }
}


async function report(analysis, verify, failOnBlock) {
  const verdictLabel = verify.verdict === "approved" ? "✅ PASS" : verify.verdict === "blocked" ? "❌ BLOCK" : "ℹ️ INFO";

  setOutput("verdict", verify.verdict);
  setOutput("reason", verify.reason || "");
  setOutput("audit_id", verify.audit_id || "");
  setOutput("trust_score", verify.trust_score ?? "");
  setOutput("violations", JSON.stringify(analysis.violations));
  setOutput("mode_used", verify.mode_used);
  setOutput("risk_level", analysis.risk_level);

  summary
    .addHeading(`Inntris Verified: ${verdictLabel}`)
    .addRaw(`<p><strong>Mode:</strong> ${verify.mode_used}</p>`, true)
    .addRaw(`<p><strong>Risk level:</strong> ${analysis.risk_level}</p>`, true)
    .addRaw(`<p><strong>Reason:</strong> ${verify.reason}</p>`, true);

  if (analysis.violations.length) {
    summary.addTable([
      [{ data: "Policy", header: true }, { data: "Severity", header: true }, { data: "File", header: true }, { data: "Rule", header: true }, { data: "Message", header: true }],
      ...analysis.violations.map((v) => [v.policy, v.severity, v.file, v.rule, v.message])
    ]);
  }

  if (verify.audit_id) summary.addRaw(`<p><strong>Audit ID:</strong> ${verify.audit_id}</p>`, true);
  if (analysis.warnings.length) summary.addHeading("Warnings", 2).addList(analysis.warnings);
  await summary.write();

  if (failOnBlock && verify.verdict === "blocked") {
    setFailed(`Inntris blocked PR: ${verify.reason}`);
  }
}

async function run() {
  if (process.env.GITHUB_EVENT_NAME !== "pull_request") {
    setFailed(`This action only supports pull_request events. Received: ${process.env.GITHUB_EVENT_NAME || "unknown"}`);
    return;
  }

  const token = getInput("github_token") || process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  if (!token) throw new Error("GITHUB_TOKEN is required");

  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (!eventPath || !fs.existsSync(eventPath)) throw new Error("GITHUB_EVENT_PATH missing");
  const event = JSON.parse(fs.readFileSync(eventPath, "utf8"));
  const prNumber = event?.pull_request?.number;
  if (!prNumber) throw new Error("No pull request payload found");

  const repoSlug = process.env.GITHUB_REPOSITORY || "";
  const [owner, repo] = repoSlug.split("/");
  if (!owner || !repo) throw new Error("GITHUB_REPOSITORY missing owner/repo");

  const files = await listPrFiles(owner, repo, prNumber, token);

  const cfg = loadPolicyConfig(getInput("policy_config") || ".inntris.yml");
  const analysis = analyze(files, cfg);

  const verify = await verifyWithInntris(analysis, {
    apiUrl: getInput("inntris_api_url") || "https://inntris-api.up.railway.app",
    apiKey: getInput("inntris_api_key"),
    agentId: getInput("inntris_agent_id"),
    mode: getInput("mode") || "auto",
    timeoutSeconds: Number(getInput("timeout_seconds") || "10"),
    failOnApiError: parseBool(getInput("fail_on_api_error"), true)
  });

  await report(analysis, verify, parseBool(getInput("fail_on_block"), true));
}

run().catch((e) => setFailed(e instanceof Error ? e.message : "Unknown error"));
