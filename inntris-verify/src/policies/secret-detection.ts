import { PRFile, PolicyViolation, SecretDetectionConfig } from '../types';

export function analyzeSecretDetection(files: PRFile[], config: SecretDetectionConfig): { violations: PolicyViolation[]; warning?: string } {
  if (!config.enabled) return { violations: [] };

  const patterns = config.patterns.map((p) => new RegExp(p));
  const violations: PolicyViolation[] = [];
  let skipped = 0;

  for (const file of files) {
    if (!file.patch) {
      skipped += 1;
      continue;
    }

    const lines = file.patch.split('\n');
    for (const line of lines) {
      if (!line.startsWith('+') || line.startsWith('+++')) continue;
      for (const pattern of patterns) {
        if (pattern.test(line)) {
          violations.push({
            policy: 'secret-detection',
            severity: config.severity,
            message: 'Potential secret detected in added line',
            file: file.filename,
            rule: `pattern:${pattern.source}`
          });
        }
      }
    }
  }

  return {
    violations,
    warning: skipped > 0 ? `Secret scan skipped for ${skipped} files (patch unavailable)` : undefined
  };
}
