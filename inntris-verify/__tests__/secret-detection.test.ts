import { analyzeSecretDetection } from '../src/policies/secret-detection';

const config = { enabled: true, severity: 'critical' as const, patterns: ['AKIA[0-9A-Z]{16}'] };

test('detects secret in added line', () => {
  const result = analyzeSecretDetection([{ filename: 'a.txt', patch: '+AKIA1234567890ABCDEF' }], config);
  expect(result.violations).toHaveLength(1);
});

test('ignores removed line', () => {
  const result = analyzeSecretDetection([{ filename: 'a.txt', patch: '-AKIA1234567890ABCDEF' }], config);
  expect(result.violations).toHaveLength(0);
});

test('ignores diff header', () => {
  const result = analyzeSecretDetection([{ filename: 'a.txt', patch: '+++ b/a.txt\n+safe' }], config);
  expect(result.violations).toHaveLength(0);
});

test('warns patch unavailable', () => {
  const result = analyzeSecretDetection([{ filename: 'a.txt', patch: null }], config);
  expect(result.warning).toContain('patch unavailable');
});

test('message does not leak secret', () => {
  const result = analyzeSecretDetection([{ filename: 'a.txt', patch: '+AKIA1234567890ABCDEF' }], config);
  expect(result.violations[0].message).toBe('Potential secret detected in added line');
});

test('disabled returns none', () => {
  const result = analyzeSecretDetection([{ filename: 'a.txt', patch: '+AKIA1234567890ABCDEF' }], { ...config, enabled: false });
  expect(result.violations).toHaveLength(0);
});
