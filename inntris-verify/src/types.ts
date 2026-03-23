export type Severity = 'critical' | 'high' | 'medium' | 'low';
export type RiskLevel = Severity | 'none';

export interface PolicyViolation {
  policy: 'sensitive-paths' | 'dependency-changes' | 'secret-detection';
  severity: Severity;
  message: string;
  file: string;
  rule: string;
}

export interface AnalysisResult {
  violations: PolicyViolation[];
  files_analyzed: number;
  flagged_files: string[];
  risk_level: RiskLevel;
  action_type: 'admin_action' | 'data_export' | 'api_call';
  warnings: string[];
}

export interface SensitivePathConfig {
  enabled: boolean;
  severity: Severity;
  prefixes: string[];
  filenames: string[];
}

export interface DependencyChangesConfig {
  enabled: boolean;
  severity: Severity;
  filenames: string[];
}

export interface SecretDetectionConfig {
  enabled: boolean;
  severity: Severity;
  patterns: string[];
  extra_patterns?: string[];
}

export interface PolicyConfig {
  sensitive_paths: SensitivePathConfig;
  dependency_changes: DependencyChangesConfig;
  secret_detection: SecretDetectionConfig;
}

export interface PRFile {
  filename: string;
  patch?: string | null;
}

export const DEFAULT_CONFIG: PolicyConfig = {
  sensitive_paths: {
    enabled: true,
    severity: 'high',
    prefixes: ['.github/workflows/', 'scripts/', 'infra/'],
    filenames: ['Dockerfile', 'docker-compose.yml']
  },
  dependency_changes: {
    enabled: true,
    severity: 'medium',
    filenames: ['package.json', 'pnpm-lock.yaml', 'package-lock.json', 'yarn.lock']
  },
  secret_detection: {
    enabled: true,
    severity: 'critical',
    patterns: [
      'AKIA[0-9A-Z]{16}',
      'ghp_[A-Za-z0-9]{36}',
      'xox[baprs]-[A-Za-z0-9-]{10,80}',
      '-----BEGIN (?:RSA|EC|OPENSSH|DSA) PRIVATE KEY-----',
      'AIza[0-9A-Za-z\\-_]{35}',
      "(?i)(?:api|secret|token|password)[\"'\\s:=]{1,6}[A-Za-z0-9_\-]{12,}"
    ]
  }
};
