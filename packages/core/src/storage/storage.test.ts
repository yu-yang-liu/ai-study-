import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getS3Config } from './index';

describe('getS3Config', () => {
  const env = process.env;

  beforeEach(() => {
    process.env = { ...env };
    process.env.S3_ENDPOINT = 'https://s3.example.com';
    process.env.S3_ACCESS_KEY = 'key';
    process.env.S3_SECRET_KEY = 'secret';
    process.env.S3_BUCKET = 'bucket';
    process.env.S3_REGION = 'auto';
  });

  afterEach(() => {
    process.env = env;
  });

  it('parses required fields and defaults forcePathStyle', () => {
    const cfg = getS3Config();
    expect(cfg.endpoint).toBe('https://s3.example.com');
    expect(cfg.bucket).toBe('bucket');
    expect(cfg.forcePathStyle).toBe(true);
    expect(cfg.publicBaseUrl).toBeUndefined();
  });

  it('strips trailing slash from endpoint and public base', () => {
    process.env.S3_ENDPOINT = 'https://s3.example.com/';
    process.env.S3_PUBLIC_BASE_URL = 'https://cdn.example.com/';
    const cfg = getS3Config();
    expect(cfg.endpoint).toBe('https://s3.example.com');
    expect(cfg.publicBaseUrl).toBe('https://cdn.example.com');
  });

  it('allows disabling path-style URLs', () => {
    process.env.S3_FORCE_PATH_STYLE = 'false';
    expect(getS3Config().forcePathStyle).toBe(false);
  });

  it('throws when config is incomplete', () => {
    delete process.env.S3_BUCKET;
    expect(() => getS3Config()).toThrow(/Missing S3 configuration/);
  });
});
