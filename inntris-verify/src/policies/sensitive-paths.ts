import { PolicyViolation, SensitivePathConfig } from '../types';

export function analyzeSensitivePaths(files: string[], config: SensitivePathConfig): PolicyViolation[] {
  if (!config.enabled) return [];

  const violations: PolicyViolation[] = [];
  for (const file of files) {
    for (const prefix of config.prefixes) {
      if (prefix.endsWith('/') && file.startsWith(prefix)) {
        violations.push({
          policy: 'sensitive-paths',
          severity: config.severity,
          message: `Change in sensitive path prefix (${prefix})`,
          file,
          rule: `prefix:${prefix}`
        });
      }
    }

    for (const filename of config.filenames) {
      if (file === filename || file.split('/').pop() === filename) {
        violations.push({
          policy: 'sensitive-paths',
          severity: config.severity,
          message: `Change in sensitive filename (${filename})`,
          file,
          rule: `filename:${filename}`
        });
      }
    }
  }

  return violations;
}
