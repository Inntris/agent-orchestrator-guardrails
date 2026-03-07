import { AnalysisResult } from './types';

export type VerifyMode = 'auto' | 'api' | 'local';

export interface ClientOptions {
  apiUrl: string;
  apiKey?: string;
  agentId?: string;
  timeoutSeconds: number;
  mode: VerifyMode;
  failOnApiError: boolean;
}

export interface VerifyResult {
  verdict: 'approved' | 'blocked' | 'rate_limited' | 'local_only';
  reason: string;
  audit_id?: string;
  trust_score?: number;
  mode_used: 'api' | 'local';
  risk_level: string;
}

export async function verifyWithInntris(analysis: AnalysisResult, options: ClientOptions): Promise<VerifyResult> {
  const hasCreds = Boolean(options.apiKey && options.agentId);

  if (options.mode === 'local' || (options.mode === 'auto' && !hasCreds)) {
    return {
      verdict: 'local_only',
      reason: hasCreds ? 'Local mode forced' : 'Missing API credentials; local-only mode',
      mode_used: 'local',
      risk_level: analysis.risk_level
    };
  }

  if (options.mode === 'api' && !hasCreds) {
    throw new Error('mode=api requires inntris_api_key and inntris_agent_id');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutSeconds * 1000);

  try {
    const response = await fetch(`${options.apiUrl}/admin/test-verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': options.apiKey as string
      },
      signal: controller.signal,
      body: JSON.stringify({
        agent_id: options.agentId,
        action_type: analysis.action_type,
        payload: {
          risk_level: analysis.risk_level,
          violations: analysis.violations,
          files_analyzed: analysis.files_analyzed
        }
      })
    });

    const body = await response.json();
    if (!body?.verdict) {
      throw new Error(`Inntris response missing verdict (HTTP ${response.status})`);
    }

    return {
      verdict: body.verdict,
      reason: body.reason ?? `API verdict: ${body.verdict}`,
      audit_id: body.audit_id,
      trust_score: body.trust_score,
      mode_used: 'api',
      risk_level: analysis.risk_level
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown API error';
    if (options.failOnApiError) {
      return {
        verdict: 'blocked',
        reason: `API error (fail-closed): ${message}`,
        mode_used: 'api',
        risk_level: analysis.risk_level
      };
    }
    return {
      verdict: 'local_only',
      reason: `API error (continuing local): ${message}`,
      mode_used: 'local',
      risk_level: analysis.risk_level
    };
  } finally {
    clearTimeout(timeout);
  }
}
