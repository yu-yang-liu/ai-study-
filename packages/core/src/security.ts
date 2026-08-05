import { createHash } from 'node:crypto';

const BASE_ALLOWED_HOSTS: ReadonlySet<string> = new Set([
  'dashscope.aliyuncs.com',
  'api.deepseek.com',
]);

function extraHosts(): string[] {
  const raw = process.env.ALLOWED_HOSTS_EXTRA ?? '';
  return raw.split(',').map((s) => s.trim()).filter(Boolean);
}

function buildAllowedHosts(): Set<string> {
  const hosts = new Set(BASE_ALLOWED_HOSTS);
  for (const h of extraHosts()) {
    hosts.add(h);
  }
  // Also allow common Ollama hosts
  const ollamaHost = process.env.OLLAMA_HOST;
  if (ollamaHost) {
    try {
      const parsed = new URL(ollamaHost);
      hosts.add(parsed.hostname);
    } catch {
      // Not a valid URL, skip
    }
  }
  return hosts;
}

function parseHost(urlStr: string): string {
  try {
    return new URL(urlStr).hostname;
  } catch {
    throw new Error(`Invalid URL: ${urlStr}`);
  }
}

export async function safeFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;

  // Allow relative URLs
  if (url.startsWith('/')) {
    return fetch(input, init);
  }

  const host = parseHost(url);

  // Allow the configured S3 endpoint and optional public CDN base
  const s3Endpoint = process.env.S3_ENDPOINT;
  if (s3Endpoint && host === parseHost(s3Endpoint)) {
    return fetch(input, init);
  }
  const s3Public = process.env.S3_PUBLIC_BASE_URL;
  if (s3Public && host === parseHost(s3Public)) {
    return fetch(input, init);
  }

  // Allow Supabase host
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (supabaseUrl && host === parseHost(supabaseUrl)) {
    return fetch(input, init);
  }

  const allowedHosts = buildAllowedHosts();
  if (!allowedHosts.has(host)) {
    throw new Error(`SSRF blocked: ${host} is not in the allowed hosts list. Use ALLOWED_HOSTS_EXTRA env var to extend.`);
  }

  return fetch(input, init);
}

export function assertUserOwnsFile(userId: string, s3Key: string): void {
  const prefix = `users/${userId}/`;
  if (!s3Key.startsWith(prefix)) {
    throw new Error(`S3 key "${s3Key}" does not belong to user ${userId}`);
  }
}

export function sha256Hash(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}
