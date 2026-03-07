import * as core from '@actions/core';
import { AnalysisResult } from './types';
import { VerifyResult } from './inntris-client';

export async function reportResults(analysis: AnalysisResult, verify: VerifyResult, failOnBlock: boolean): Promise<void> {
  const verdictLabel = verify.verdict === 'approved' ? '✅ PASS' : verify.verdict === 'blocked' ? '❌ BLOCK' : 'ℹ️ LOCAL_ONLY';

  core.setOutput('verdict', verify.verdict);
  core.setOutput('reason', verify.reason);
  core.setOutput('audit_id', verify.audit_id ?? '');
  core.setOutput('trust_score', verify.trust_score?.toString() ?? '');
  core.setOutput('violations', JSON.stringify(analysis.violations));
  core.setOutput('mode_used', verify.mode_used);
  core.setOutput('risk_level', analysis.risk_level);

  const summary = core.summary
    .addHeading(`Inntris Verified: ${verdictLabel}`)
    .addRaw(`<p><strong>Mode:</strong> ${verify.mode_used}</p>`, true)
    .addRaw(`<p><strong>Risk level:</strong> ${analysis.risk_level}</p>`, true)
    .addRaw(`<p><strong>Reason:</strong> ${verify.reason}</p>`, true);

  if (analysis.violations.length > 0) {
    summary.addTable([
      [{ data: 'Policy', header: true }, { data: 'Severity', header: true }, { data: 'File', header: true }, { data: 'Rule', header: true }, { data: 'Message', header: true }],
      ...analysis.violations.map((v) => [v.policy, v.severity, v.file, v.rule, v.message])
    ]);
  }

  if (verify.audit_id) {
    summary.addRaw(`<p><strong>Audit ID:</strong> ${verify.audit_id}</p>`, true);
  }

  if (analysis.warnings.length > 0) {
    summary.addHeading('Warnings', 2).addList(analysis.warnings);
  }

  await summary.write();

  if (failOnBlock && verify.verdict === 'blocked') {
    core.setFailed(`Inntris blocked PR: ${verify.reason}`);
  }
}
