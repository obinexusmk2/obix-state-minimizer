import { USCNormalizer, normalizeInput, isPathSafe } from '../src/normalizer/USCNormalizer';

describe('USCNormalizer - basic normalization', () => {
  const uscn = new USCNormalizer();

  it('returns canonical form unchanged when already canonical', () => {
    const result = uscn.normalize('hello/world');
    expect(result.canonical).toBe('hello/world');
    expect(result.normalized).toBe(false);
  });

  it('decodes URI-encoded path separators', () => {
    const result = uscn.normalize('%2e%2e%2f');
    expect(result.canonical).toContain('..');
    expect(result.normalized).toBe(true);
  });

  it('decodes standard percent-encoded characters', () => {
    const result = normalizeInput('/api%2Fusers%2F123');
    expect(result.canonical).toBe('/api/users/123');
  });

  it('collapses double slashes', () => {
    const result = uscn.normalize('foo//bar///baz');
    expect(result.canonical).toBe('foo/bar/baz');
  });

  it('detects a valid encoding type', () => {
    const result = uscn.normalize('%41%42%43');
    const validTypes = ['uri-encoded', 'canonical', 'direct', 'mixed', 'utf8-overlong'];
    expect(validTypes).toContain(result.detectedEncoding);
  });
});

describe('USCNormalizer - path safety (security invariant)', () => {
  it('blocks direct path traversal', () => {
    expect(isPathSafe('../etc/passwd')).toBe(false);
  });

  it('blocks URI-encoded path traversal', () => {
    expect(isPathSafe('%2e%2e%2fetc%2fpasswd')).toBe(false);
  });

  it('blocks double-encoded path traversal', () => {
    expect(isPathSafe('%252e%252e%252f')).toBe(false);
  });

  it('allows safe relative path', () => {
    expect(isPathSafe('assets/images/logo.png')).toBe(true);
  });

  it('allows safe absolute path', () => {
    expect(isPathSafe('/home/user/documents/file.txt')).toBe(true);
  });
});
