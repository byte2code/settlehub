import { describe, expect, it } from 'vitest';
import { isAllowedServerUrl } from './serverUrl';

describe('isAllowedServerUrl', () => {
  it('accepts https and local development hosts', () => {
    expect(isAllowedServerUrl('https://api.example.com/api/v1')).toBe(true);
    expect(isAllowedServerUrl('http://localhost:8080/api/v1')).toBe(true);
    expect(isAllowedServerUrl('http://10.0.2.2:8080/api/v1')).toBe(true);
  });
  it('rejects plain http to the internet and other schemes', () => {
    expect(isAllowedServerUrl('http://evil.example.com/api/v1')).toBe(false);
    expect(isAllowedServerUrl('javascript:alert(1)')).toBe(false);
    expect(isAllowedServerUrl('ftp://example.com')).toBe(false);
  });
});
