import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { loadPolicyConfig } from '../src/config';

test('uses defaults when file missing', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'inntris-'));
  process.chdir(dir);
  expect(loadPolicyConfig('.inntris.yml').sensitive_paths.enabled).toBe(true);
});

test('merges overrides', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'inntris-'));
  process.chdir(dir);
  fs.writeFileSync('.inntris.yml', 'dependency_changes:\n  enabled: false\n');
  expect(loadPolicyConfig('.inntris.yml').dependency_changes.enabled).toBe(false);
});

test('appends extra patterns', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'inntris-'));
  process.chdir(dir);
  fs.writeFileSync('.inntris.yml', 'secret_detection:\n  extra_patterns:\n    - TESTSECRET[0-9]+\n');
  expect(loadPolicyConfig('.inntris.yml').secret_detection.patterns.join('|')).toContain('TESTSECRET');
});

test('loads explicit filenames', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'inntris-'));
  process.chdir(dir);
  fs.writeFileSync('.inntris.yml', 'sensitive_paths:\n  filenames:\n    - custom.txt\n');
  expect(loadPolicyConfig('.inntris.yml').sensitive_paths.filenames).toContain('custom.txt');
});
