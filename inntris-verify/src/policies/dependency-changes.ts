import { DependencyChangesConfig, PolicyViolation } from '../types';

export function analyzeDependencyChanges(files: string[], config: DependencyChangesConfig): PolicyViolation[] {
  if (!config.enabled) return [];

  const violations: PolicyViolation[] = [];
  for (const file of files) {
    for (const filename of config.filenames) {
      if (file === filename) {
        violations.push({
          policy: 'dependency-changes',
          severity: config.severity,
          message: `Dependency manifest changed (${filename})`,
          file,
          rule: `filename:${filename}`
        });
      }
    }
  }

  return violations;
}
