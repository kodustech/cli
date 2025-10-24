import { fetch } from 'undici';
import type { ContextFile } from './context.js';
import type { KodusConfig } from './config.js';
import type { GitFileChange } from './git.js';

export interface SendReviewResult {
  ok: boolean;
  status: number;
  requestId?: string;
  data?: unknown;
  message?: string;
}

export interface ReviewPayload {
  provider: 'claude' | 'codex';
  generatedAt: string;
  baseRef: string;
  branch: string | null;
  headSha: string | null;
  diff: string;
  changedFiles: GitFileChange[];
  contextFiles: ContextFile[];
  prompt: string;
  stats: {
    changedFiles: number;
    contextFiles: number;
    followDepth: number;
    maxFiles: number;
    skipped: string[];
  };
  providerResponse?: SendReviewResult | null;
}

export interface SendReviewArgs {
  config: KodusConfig;
  payload: ReviewPayload;
}

export async function sendReview(args: SendReviewArgs): Promise<SendReviewResult> {
  const baseUrl =
    args.config.api?.baseUrl ?? process.env.KODUS_API_URL ?? 'https://api.kodus.dev/v1/';
  const reviewPath = args.config.api?.reviewPath ?? 'review';
  const endpoint = buildEndpoint(baseUrl, reviewPath);

  const token = args.config.api?.token ?? process.env.KODUS_API_TOKEN ?? process.env.KODUS_TOKEN;
  if (!token) {
    throw new Error(
      'Configure KODUS_API_TOKEN (ou api.token em kodus.config.*) para habilitar o envio automatico.'
    );
  }

  const rawPreferences = args.config.providers?.[args.payload.provider];
  const preferences = normalizePreferences(rawPreferences);

  const requestBody = buildRequestBody(args.payload, preferences);

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(requestBody),
  });

  const requestId = response.headers.get('x-request-id') ?? undefined;
  const raw = await response.text();

  if (!response.ok) {
    const message = raw || '<sem corpo>';
    throw new Error(`Kodus API respondeu ${response.status}: ${message}`);
  }

  let data: unknown;
  let message: string | undefined;
  if (raw) {
    try {
      data = JSON.parse(raw);
      message = extractMessage(data);
    } catch {
      data = raw;
      message = raw;
    }
  }

  return {
    ok: true,
    status: response.status,
    requestId,
    data,
    message,
  };
}

function buildRequestBody(
  payload: ReviewPayload,
  preferences: Record<string, unknown> | undefined,
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    provider: payload.provider,
    diff: payload.diff,
    meta: {
      generatedAt: payload.generatedAt,
      baseRef: payload.baseRef,
      branch: payload.branch,
      headSha: payload.headSha,
      stats: payload.stats,
    },
  };

  if (preferences && Object.keys(preferences).length > 0) {
    body.preferences = preferences;
  }

  return body;
}

function buildEndpoint(baseUrl: string, reviewPath: string): string {
  if (/^https?:\/\//i.test(reviewPath)) {
    return reviewPath;
  }
  const normalizedBase = ensureTrailingSlash(baseUrl);
  const relativePath = reviewPath.replace(/^\//, '');
  return new URL(relativePath, normalizedBase).toString();
}

function ensureTrailingSlash(value: string): string {
  return value.endsWith('/') ? value : `${value}/`;
}

function normalizePreferences(source: unknown): Record<string, unknown> | undefined {
  if (!source || typeof source !== 'object') {
    return undefined;
  }

  const entries = Object.entries(source as Record<string, unknown>).filter(
    ([, value]) => value !== undefined
  );

  if (entries.length === 0) {
    return undefined;
  }

  return Object.fromEntries(entries);
}

function extractMessage(payload: unknown): string | undefined {
  if (!payload || typeof payload !== 'object') {
    return undefined;
  }

  const candidate = payload as Record<string, unknown>;
  const fields = ['review', 'result', 'message', 'summary', 'content'];
  for (const field of fields) {
    const value = candidate[field];
    if (typeof value === 'string' && value.trim().length > 0) {
      return value;
    }
  }

  return undefined;
}
