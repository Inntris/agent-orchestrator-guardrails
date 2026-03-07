import { analyzeSensitivePaths } from '../src/policies/sensitive-paths';

const config = { enabled: true, severity: 'high' as const, prefixes: ['.github/workflows/', 'scripts/'], filenames: ['Dockerfile'] };

test('matches prefix', () => expect(analyzeSensitivePaths(['.github/workflows/a.yml'], config)).toHaveLength(1));
test('prefix requires trailing slash', () => expect(analyzeSensitivePaths(['scriptsx/a.sh'], config)).toHaveLength(0));
test('matches exact filename', () => expect(analyzeSensitivePaths(['Dockerfile'], config)).toHaveLength(1));
test('matches basename filename', () => expect(analyzeSensitivePaths(['infra/Dockerfile'], config)).toHaveLength(1));
test('disabled policy returns empty', () => expect(analyzeSensitivePaths(['Dockerfile'], { ...config, enabled: false })).toHaveLength(0));
