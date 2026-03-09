import * as core from '@actions/core';
import { createHash } from 'node:crypto';
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

function redactUrl(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl);
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return rawUrl;
  }
}

function getAgentIdFingerprint(agentId?: string): string {
  if (!agentId) return 'missing';
  return createHash('sha256').update(agentId).digest('hex').slice(0, 10);
}

function classifyAgentId(agentId?: string): 'uuid_like' | 'slug_like' | 'unknown' | 'missing' {
  if (!agentId) return 'missing';
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(agentId)) return 'uuid_like';
  if (/^[a-z0-9][a-z0-9_-]{2,127}$/i.test(agentId)) return 'slug_like';
  return 'unknown';
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

  const baseUrl = String(options.apiUrl || '').replace(/\/+$/, '');
  const requestUrl = `${baseUrl}/admin/test-verify`;

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
    throw new Error('Inntris API payload is empty');
  }

  const agentIdType = classifyAgentId(options.agentId);
  core.info(`[inntris-verify] API base URL input: ${redactUrl(baseUrl)}`);
  core.info(`[inntris-verify] API final URL: ${redactUrl(requestUrl)}`);
  core.info(`[inntris-verify] API key present: ${Boolean(options.apiKey)}`);
  core.info(`[inntris-verify] Request body keys: ${Object.keys(payload).join(', ')}`);
  core.info(`[inntris-verify] Nested payload keys: ${Object.keys(payload.payload).join(', ')}`);
  core.info(`[inntris-verify] agent_id present: ${Boolean(options.agentId)} | length: ${options.agentId?.length ?? 0} | fingerprint: ${getAgentIdFingerprint(options.agentId)} | format: ${agentIdType}`);
  core.info('[inntris-verify] Backend agent_id format expectation is backend-defined; validate INNTRIS_AGENT_ID against your Inntris dashboard/API.');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutSeconds * 1000);

  try {
    const response = await fetch(requestUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': options.apiKey as string
      },
      signal: controller.signal,
      body: JSON.stringify(payload)
    });

    const text = await response.text();
    if (!response.ok) {
      const lower = text.toLowerCase();
      if (response.status === 404 && lower.includes('agent') && lower.includes('not found')) {
        throw new Error(`Inntris API rejected agent_id: agent not found (format=${agentIdType}, fingerprint=${getAgentIdFingerprint(options.agentId)}). Verify INNTRIS_AGENT_ID in repo secrets.`);
      }
      throw new Error(`Inntris API ${response.status} at ${redactUrl(requestUrl)}: ${text}`);
    }

    let body: Record<string, unknown>;
    try {
      body = JSON.parse(text) as Record<string, unknown>;
    } catch {
      throw new Error(`Inntris API returned non-JSON success response at ${redactUrl(requestUrl)}: ${text}`);
    }

    if (!body?.verdict) {
      throw new Error(`Inntris API success response missing verdict: ${text}`);
    }

    return {
      verdict: body.verdict as VerifyResult['verdict'],
      reason: (body.reason as string | undefined) ?? `API verdict: ${body.verdict}`,
      audit_id: body.audit_id as string | undefined,
      trust_score: body.trust_score as number | undefined,
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
