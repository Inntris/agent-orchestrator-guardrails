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

test('uses verdict from 200 json', async () => {
  global.fetch = jest.fn().mockResolvedValue({ json: async () => ({ verdict: 'approved', reason: 'ok' }) }) as unknown as typeof fetch;
  const result = await verifyWithInntris(analysis, { apiUrl: 'http://x', apiKey: 'k', agentId: 'a', timeoutSeconds: 1, mode: 'api', failOnApiError: true });
  expect(result.verdict).toBe('approved');
});

test('401 handled as blocked fail closed', async () => {
  global.fetch = jest.fn().mockRejectedValue(new Error('401 unauthorized')) as unknown as typeof fetch;
  const result = await verifyWithInntris(analysis, { apiUrl: 'http://x', apiKey: 'k', agentId: 'a', timeoutSeconds: 1, mode: 'api', failOnApiError: true });
  expect(result.verdict).toBe('blocked');
});

test('404 handled as local when open', async () => {
  global.fetch = jest.fn().mockRejectedValue(new Error('404 not found')) as unknown as typeof fetch;
  const result = await verifyWithInntris(analysis, { apiUrl: 'http://x', apiKey: 'k', agentId: 'a', timeoutSeconds: 1, mode: 'api', failOnApiError: false });
  expect(result.verdict).toBe('local_only');
});

test('429 handled as blocked fail closed', async () => {
  global.fetch = jest.fn().mockRejectedValue(new Error('429 rate limit')) as unknown as typeof fetch;
  const result = await verifyWithInntris(analysis, { apiUrl: 'http://x', apiKey: 'k', agentId: 'a', timeoutSeconds: 1, mode: 'api', failOnApiError: true });
  expect(result.verdict).toBe('blocked');
});

test('timeout handled as blocked', async () => {
  global.fetch = jest.fn().mockRejectedValue(new Error('The operation was aborted')) as unknown as typeof fetch;
  const result = await verifyWithInntris(analysis, { apiUrl: 'http://x', apiKey: 'k', agentId: 'a', timeoutSeconds: 1, mode: 'api', failOnApiError: true });
  expect(result.verdict).toBe('blocked');
});
