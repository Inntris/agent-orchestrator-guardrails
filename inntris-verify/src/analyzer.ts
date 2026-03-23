import { analyzeDependencyChanges } from './policies/dependency-changes';
import { analyzeSecretDetection } from './policies/secret-detection';
import { analyzeSensitivePaths } from './policies/sensitive-paths';
import { AnalysisResult, PolicyConfig, PRFile, RiskLevel, Severity } from './types';

const severityOrder: RiskLevel[] = ['none', 'low', 'medium', 'high', 'critical'];

function highestSeverity(severities: Severity[]): RiskLevel {
  if (!severities.length) return 'none';
  return severities.reduce<RiskLevel>((acc, current) =>
    severityOrder.indexOf(current) > severityOrder.indexOf(acc) ? current : acc, 'none');
}

export function analyzePullRequest(files: PRFile[], config: PolicyConfig): AnalysisResult {
  const filenames = files.map((f) => f.filename);
  const sensitive = analyzeSensitivePaths(filenames, config.sensitive_paths);
  const deps = analyzeDependencyChanges(filenames, config.dependency_changes);
  const secrets = analyzeSecretDetection(files, config.secret_detection);

  const violations = [...sensitive, ...deps, ...secrets.violations];
  const action_type = sensitive.length > 0 ? 'admin_action' : secrets.violations.length > 0 ? 'data_export' : 'api_call';

  return {
    violations,
    files_analyzed: files.length,
    flagged_files: [...new Set(violations.map((v) => v.file))],
    risk_level: highestSeverity(violations.map((v) => v.severity)),
    action_type,
    warnings: secrets.warning ? [secrets.warning] : []
  };
}
