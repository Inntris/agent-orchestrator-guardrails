import { analyzeDependencyChanges } from '../src/policies/dependency-changes';

const config = { enabled: true, severity: 'medium' as const, filenames: ['package.json', 'pnpm-lock.yaml'] };

test('matches package.json exact', () => expect(analyzeDependencyChanges(['package.json'], config)).toHaveLength(1));
test('does not match subdir package.json', () => expect(analyzeDependencyChanges(['apps/a/package.json'], config)).toHaveLength(0));
test('matches pnpm lock exact', () => expect(analyzeDependencyChanges(['pnpm-lock.yaml'], config)).toHaveLength(1));
test('no match random file', () => expect(analyzeDependencyChanges(['README.md'], config)).toHaveLength(0));
test('disabled returns empty', () => expect(analyzeDependencyChanges(['package.json'], { ...config, enabled: false })).toHaveLength(0));
