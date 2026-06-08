import { describe, it, expect, beforeAll } from 'vitest';

// The shared module constructs a Supabase client at load, so set dummy env first.
let shared;
beforeAll(async () => {
  process.env.SUPABASE_URL = 'http://localhost:54321';
  process.env.SUPABASE_SERVICE_KEY = 'test-service-key';
  process.env.URL = 'https://app.example.com';
  process.env.INTERNAL_SECRET = 'top-secret';
  shared = await import('../netlify/functions/lib/shared.js');
});

describe('corsHeaders', () => {
  it('echoes an allowed origin', () => {
    const h = shared.corsHeaders({ headers: { origin: 'https://app.example.com' } });
    expect(h['Access-Control-Allow-Origin']).toBe('https://app.example.com');
  });
  it('does not echo a disallowed origin', () => {
    const h = shared.corsHeaders({ headers: { origin: 'https://evil.example.com' } });
    expect(h['Access-Control-Allow-Origin']).not.toBe('https://evil.example.com');
  });
});

describe('getToken', () => {
  it('extracts a bearer token', () => {
    expect(shared.getToken({ headers: { authorization: 'Bearer abc.def' } })).toBe('abc.def');
  });
  it('returns null when absent', () => {
    expect(shared.getToken({ headers: {} })).toBeNull();
  });
});

describe('internalSecretOk', () => {
  it('accepts the matching internal secret', () => {
    expect(shared.internalSecretOk({ headers: { 'x-internal-secret': 'top-secret' } })).toBe(true);
  });
  it('rejects a wrong or missing secret', () => {
    expect(shared.internalSecretOk({ headers: { 'x-internal-secret': 'nope' } })).toBe(false);
    expect(shared.internalSecretOk({ headers: {} })).toBe(false);
  });
});

describe('clientIp', () => {
  it('reads the first x-forwarded-for entry', () => {
    expect(shared.clientIp({ headers: { 'x-forwarded-for': '1.2.3.4, 5.6.7.8' } })).toBe('1.2.3.4');
  });
});

describe('config', () => {
  it('exposes a numeric free-tier and a model id', () => {
    expect(typeof shared.FREE_DAILY_CREDITS).toBe('number');
    expect(typeof shared.CLAUDE_MODEL).toBe('string');
    expect(shared.CLAUDE_MODEL.length).toBeGreaterThan(0);
  });
});
