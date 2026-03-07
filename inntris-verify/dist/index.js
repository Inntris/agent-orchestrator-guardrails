"use strict";
const core = require('@actions/core');
const github = require('@actions/github');
const fs = require('node:fs');
const path = require('node:path');
const yaml = require('js-yaml');

const DEFAULT_CONFIG = {
  sensitive_paths: { enabled: true, severity: 'high', prefixes: ['.github/workflows/', 'scripts/', 'infra/'], filenames: ['Dockerfile', 'docker-compose.yml'] },
  dependency_changes: { enabled: true, severity: 'medium', filenames: ['package.json', 'pnpm-lock.yaml', 'package-lock.json', 'yarn.lock'] },
  secret_detection: { enabled: true, severity: 'critical', patterns: ['AKIA[0-9A-Z]{16}', 'ghp_[A-Za-z0-9]{36}', 'xox[baprs]-[A-Za-z0-9-]{10,80}', '-----BEGIN (?:RSA|EC|OPENSSH|DSA) PRIVATE KEY-----', 'AIza[0-9A-Za-z\\-_]{35}', "(?i)(?:api|secret|token|password)[\"'\\s:=]{1,6}[A-Za-z0-9_\-]{12,}"] }
};

function parseBool(v) { return String(v).toLowerCase() === 'true'; }
function deepCopy(v) { return JSON.parse(JSON.stringify(v)); }
function hasGlobLikePattern(value) { return /[*?\[\]]/.test(value); }

function loadPolicyConfig(configPath) {
  const resolved = path.resolve(process.cwd(), configPath);
  const config = deepCopy(DEFAULT_CONFIG);
  if (!fs.existsSync(resolved)) return config;

  const parsed = yaml.load(fs.readFileSync(resolved, 'utf-8')) || {};
  if (parsed.sensitive_paths) {
    config.sensitive_paths = Object.assign({}, config.sensitive_paths, parsed.sensitive_paths, {
      prefixes: parsed.sensitive_paths.prefixes || config.sensitive_paths.prefixes,
      filenames: parsed.sensitive_paths.filenames || config.sensitive_paths.filenames
    });
  }
  if (parsed.dependency_changes) {
    config.dependency_changes = Object.assign({}, config.dependency_changes, parsed.dependency_changes, {
      filenames: parsed.dependency_changes.filenames || config.dependency_changes.filenames
    });
  }
  if (parsed.secret_detection) {
    config.secret_detection = Object.assign({}, config.secret_detection, parsed.secret_detection, { patterns: [...config.secret_detection.patterns] });
    config.secret_detection.patterns.push(...(parsed.secret_detection.extra_patterns || []));
  }

  [...config.sensitive_paths.prefixes, ...config.sensitive_paths.filenames, ...config.dependency_changes.filenames]
    .filter(hasGlobLikePattern)
    .forEach((p) => core.warning(`Unsupported glob-like pattern ignored in v1: ${p}`));
  return config;
}

function analyze(files, config) {
  const violations = [];
  const warnings = [];

  for (const file of files) {
    if (config.sensitive_paths.enabled) {
      for (const prefix of config.sensitive_paths.prefixes) {
        if (prefix.endsWith('/') && file.filename.startsWith(prefix)) violations.push({ policy: 'sensitive-paths', severity: config.sensitive_paths.severity, message: `Change in sensitive path prefix (${prefix})`, file: file.filename, rule: `prefix:${prefix}` });
      }
      for (const name of config.sensitive_paths.filenames) {
        if (file.filename === name || file.filename.split('/').pop() === name) violations.push({ policy: 'sensitive-paths', severity: config.sensitive_paths.severity, message: `Change in sensitive filename (${name})`, file: file.filename, rule: `filename:${name}` });
      }
    }

    if (config.dependency_changes.enabled) {
      for (const name of config.dependency_changes.filenames) {
        if (file.filename === name) violations.push({ policy: 'dependency-changes', severity: config.dependency_changes.severity, message: `Dependency manifest changed (${name})`, file: file.filename, rule: `filename:${name}` });
      }
    }
  }

  if (config.secret_detection.enabled) {
    const patterns = config.secret_detection.patterns.map((p) => new RegExp(p));
    let skipped = 0;
    for (const file of files) {
      if (!file.patch) { skipped += 1; continue; }
      for (const line of String(file.patch).split('\n')) {
        if (!line.startsWith('+') || line.startsWith('+++')) continue;
        for (const pattern of patterns) {
          if (pattern.test(line)) violations.push({ policy: 'secret-detection', severity: config.secret_detection.severity, message: 'Potential secret detected in added line', file: file.filename, rule: `pattern:${pattern.source}` });
        }
      }
    }
    if (skipped > 0) warnings.push(`Secret scan skipped for ${skipped} files (patch unavailable)`);
  }

  const order = ['none', 'low', 'medium', 'high', 'critical'];
  let risk = 'none';
  for (const v of violations) if (order.indexOf(v.severity) > order.indexOf(risk)) risk = v.severity;
  const action_type = violations.some((v) => v.policy === 'sensitive-paths') ? 'admin_action' : violations.some((v) => v.policy === 'secret-detection') ? 'data_export' : 'api_call';

  return { violations, warnings, files_analyzed: files.length, flagged_files: [...new Set(violations.map((v) => v.file))], risk_level: risk, action_type };
}

async function verifyWithApi(analysis, options) {
  const hasCreds = Boolean(options.apiKey && options.agentId);
  if (options.mode === 'local' || (options.mode === 'auto' && !hasCreds)) return { verdict: 'local_only', reason: 'Missing API credentials; local-only mode', mode_used: 'local', risk_level: analysis.risk_level };
  if (options.mode === 'api' && !hasCreds) throw new Error('mode=api requires inntris_api_key and inntris_agent_id');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutSeconds * 1000);
  try {
    const response = await fetch(`${options.apiUrl}/admin/test-verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': options.apiKey },
      signal: controller.signal,
      body: JSON.stringify({ agent_id: options.agentId, action_type: analysis.action_type, payload: { risk_level: analysis.risk_level, violations: analysis.violations, files_analyzed: analysis.files_analyzed } })
    });
    const body = await response.json();
    if (!body || !body.verdict) throw new Error(`Inntris response missing verdict (HTTP ${response.status})`);
    return { verdict: body.verdict, reason: body.reason || `API verdict: ${body.verdict}`, audit_id: body.audit_id, trust_score: body.trust_score, mode_used: 'api', risk_level: analysis.risk_level };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown API error';
    if (options.failOnApiError) return { verdict: 'blocked', reason: `API error (fail-closed): ${message}`, mode_used: 'api', risk_level: analysis.risk_level };
    return { verdict: 'local_only', reason: `API error (continuing local): ${message}`, mode_used: 'local', risk_level: analysis.risk_level };
  } finally {
    clearTimeout(timeout);
  }
}

async function report(analysis, verify, failOnBlock) {
  const verdictLabel = verify.verdict === 'approved' ? '✅ PASS' : verify.verdict === 'blocked' ? '❌ BLOCK' : 'ℹ️ LOCAL_ONLY';
  core.setOutput('verdict', verify.verdict);
  core.setOutput('reason', verify.reason);
  core.setOutput('audit_id', verify.audit_id || '');
  core.setOutput('trust_score', verify.trust_score != null ? String(verify.trust_score) : '');
  core.setOutput('violations', JSON.stringify(analysis.violations));
  core.setOutput('mode_used', verify.mode_used);
  core.setOutput('risk_level', analysis.risk_level);

  const summary = core.summary.addHeading(`Inntris Verified: ${verdictLabel}`).addRaw(`<p><strong>Mode:</strong> ${verify.mode_used}</p>`, true).addRaw(`<p><strong>Risk level:</strong> ${analysis.risk_level}</p>`, true).addRaw(`<p><strong>Reason:</strong> ${verify.reason}</p>`, true);
  if (analysis.violations.length > 0) {
    summary.addTable([[{ data: 'Policy', header: true }, { data: 'Severity', header: true }, { data: 'File', header: true }, { data: 'Rule', header: true }, { data: 'Message', header: true }], ...analysis.violations.map((v) => [v.policy, v.severity, v.file, v.rule, v.message])]);
  }
  if (verify.audit_id) summary.addRaw(`<p><strong>Audit ID:</strong> ${verify.audit_id}</p>`, true);
  if (analysis.warnings.length > 0) summary.addHeading('Warnings', 2).addList(analysis.warnings);
  await summary.write();

  if (failOnBlock && verify.verdict === 'blocked') core.setFailed(`Inntris blocked PR: ${verify.reason}`);
}

async function run() {
  if (github.context.eventName !== 'pull_request') return core.setFailed(`This action only supports pull_request events. Received: ${github.context.eventName}`);
  const token = core.getInput('github_token') || process.env.GITHUB_TOKEN;
  if (!token) return core.setFailed('GITHUB_TOKEN is required');
  const pr = github.context.payload.pull_request;
  if (!pr) return core.setFailed('No pull request payload found');

  const octokit = github.getOctokit(token);
  const files = await octokit.paginate(octokit.rest.pulls.listFiles, { owner: github.context.repo.owner, repo: github.context.repo.repo, pull_number: pr.number, per_page: 100 });

  const config = loadPolicyConfig(core.getInput('policy_config'));
  const analysis = analyze(files.map((f) => ({ filename: f.filename, patch: f.patch })), config);

  const verify = await verifyWithApi(analysis, {
    apiUrl: core.getInput('inntris_api_url'),
    apiKey: core.getInput('inntris_api_key'),
    agentId: core.getInput('inntris_agent_id'),
    timeoutSeconds: Number(core.getInput('timeout_seconds') || '10'),
    mode: core.getInput('mode'),
    failOnApiError: parseBool(core.getInput('fail_on_api_error'))
  });

  await report(analysis, verify, parseBool(core.getInput('fail_on_block')));
}

run().catch((error) => core.setFailed(error instanceof Error ? error.message : 'Unknown error'));
