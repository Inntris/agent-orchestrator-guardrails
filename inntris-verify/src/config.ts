import * as core from '@actions/core';
import * as fs from 'node:fs';
import * as path from 'node:path';
import yaml from 'js-yaml';
import { DEFAULT_CONFIG, PolicyConfig } from './types';

const hasGlobLikePattern = (value: string): boolean => /[*?\[\]]/.test(value);

export function loadPolicyConfig(configPath: string): PolicyConfig {
  const resolved = path.resolve(process.cwd(), configPath);
  const config: PolicyConfig = JSON.parse(JSON.stringify(DEFAULT_CONFIG));

  if (!fs.existsSync(resolved)) {
    core.info(`Policy config not found at ${configPath}, using defaults.`);
    return config;
  }

  const raw = fs.readFileSync(resolved, 'utf-8');
  const parsed = (yaml.load(raw) as Partial<PolicyConfig>) ?? {};

  if (parsed.sensitive_paths) {
    config.sensitive_paths = {
      ...config.sensitive_paths,
      ...parsed.sensitive_paths,
      prefixes: parsed.sensitive_paths.prefixes ?? config.sensitive_paths.prefixes,
      filenames: parsed.sensitive_paths.filenames ?? config.sensitive_paths.filenames
    };
  }

  if (parsed.dependency_changes) {
    config.dependency_changes = {
      ...config.dependency_changes,
      ...parsed.dependency_changes,
      filenames: parsed.dependency_changes.filenames ?? config.dependency_changes.filenames
    };
  }

  if (parsed.secret_detection) {
    config.secret_detection = {
      ...config.secret_detection,
      ...parsed.secret_detection,
      patterns: [...config.secret_detection.patterns]
    };
    const extra = parsed.secret_detection.extra_patterns ?? [];
    config.secret_detection.patterns.push(...extra);
  }

  [...config.sensitive_paths.prefixes, ...config.sensitive_paths.filenames, ...config.dependency_changes.filenames]
    .filter(hasGlobLikePattern)
    .forEach((pattern) => core.warning(`Unsupported glob-like pattern ignored in v1: ${pattern}`));

  return config;
}
