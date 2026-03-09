import { verifyWithInntris } from '../src/inntris-client';
import { AnalysisResult } from '../src/types';

const analysis: AnalysisResult = {
  violations: [],
  files_analyzed: 1,
  flagged_files: [],
  risk_level: 'none',
  action_type: 'api_call',
  warnings: []
};

afterEach(() => {
  jest.restoreAllMocks();
});

test('returns local_only in auto without creds', async () => {
  const result = await verifyWithInntris(analysis, { apiUrl: 'http://x', timeoutSeconds: 1, mode: 'auto', failOnApiError: true });
  expect(result.verdict).toBe('local_only');
});

test('normalizes base URL without trailing slash', async () => {
  const fetchMock = jest.fn().mockResolvedValue({ ok: true, status: 200, text: async () => JSON.stringify({ verdict: 'approved', reason: 'ok' }) });
  global.fetch = fetchMock as unknown as typeof fetch;

  await verifyWithInntris(analysis, { apiUrl: 'https://api.example.com', apiKey: 'k', agentId: 'a', timeoutSeconds: 1, mode: 'api', failOnApiError: true });

  expect(fetchMock).toHaveBeenCalledWith('https://api.example.com/admin/test-verify', expect.any(Object));
});

test('normalizes base URL with trailing slash', async () => {
  const fetchMock = jest.fn().mockResolvedValue({ ok: true, status: 200, text: async () => JSON.stringify({ verdict: 'approved', reason: 'ok' }) });
  global.fetch = fetchMock as unknown as typeof fetch;

  await verifyWithInntris(analysis, { apiUrl: 'https://api.example.com/', apiKey: 'k', agentId: 'a', timeoutSeconds: 1, mode: 'api', failOnApiError: true });

  expect(fetchMock).toHaveBeenCalledWith('https://api.example.com/admin/test-verify', expect.any(Object));
});

test('404 agent not found is converted to precise config error', async () => {
  global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 404, text: async () => '{\"detail\":\"Agent abc not found\"}' }) as unknown as typeof fetch;
  const result = await verifyWithInntris(analysis, { apiUrl: 'http://x/', apiKey: 'k', agentId: 'a', timeoutSeconds: 1, mode: 'api', failOnApiError: true });
  expect(result.verdict).toBe('blocked');
  expect(result.reason).toContain('rejected agent_id: agent not found');
  expect(result.reason).toContain('INNTRIS_AGENT_ID');
});

test('missing verdict in success response returns blocked when fail-closed', async () => {
  global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200, text: async () => JSON.stringify({ reason: 'ok but no verdict' }) }) as unknown as typeof fetch;
  const result = await verifyWithInntris(analysis, { apiUrl: 'http://x', apiKey: 'k', agentId: 'a', timeoutSeconds: 1, mode: 'api', failOnApiError: true });
  expect(result.verdict).toBe('blocked');
  expect(result.reason).toContain('missing verdict');
});

test('successful API response with verdict succeeds', async () => {
  global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200, text: async () => JSON.stringify({ verdict: 'approved', reason: 'ok', audit_id: 'aud_1', trust_score: 90 }) }) as unknown as typeof fetch;
  const result = await verifyWithInntris(analysis, { apiUrl: 'http://x', apiKey: 'k', agentId: 'a', timeoutSeconds: 1, mode: 'api', failOnApiError: true });
  expect(result.verdict).toBe('approved');
  expect(result.audit_id).toBe('aud_1');
  expect(result.trust_score).toBe(90);
});


test('request sends agent_id from inntris_agent_id input mapping', async () => {
  const fetchMock = jest.fn().mockResolvedValue({ ok: true, status: 200, text: async () => JSON.stringify({ verdict: 'approved' }) });
  global.fetch = fetchMock as unknown as typeof fetch;

  await verifyWithInntris(analysis, { apiUrl: 'https://api.example.com/', apiKey: 'k', agentId: 'agent-123', timeoutSeconds: 1, mode: 'api', failOnApiError: true });

  const call = fetchMock.mock.calls[0];
  const body = JSON.parse((call[1] as RequestInit).body as string);
  expect(body.agent_id).toBe('agent-123');
});
