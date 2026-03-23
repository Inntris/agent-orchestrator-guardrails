import { analyzePullRequest } from '../src/analyzer';
import { DEFAULT_CONFIG } from '../src/types';

test('admin_action on sensitive path', () => {
  const result = analyzePullRequest([{ filename: '.github/workflows/a.yml', patch: '+safe' }], DEFAULT_CONFIG);
  expect(result.action_type).toBe('admin_action');
});

test('data_export on secret only', () => {
  const result = analyzePullRequest([{ filename: 'a.txt', patch: '+AKIA1234567890ABCDEF' }], DEFAULT_CONFIG);
  expect(result.action_type).toBe('data_export');
});

test('api_call default', () => {
  const result = analyzePullRequest([{ filename: 'README.md', patch: '+docs' }], DEFAULT_CONFIG);
  expect(result.action_type).toBe('api_call');
});
