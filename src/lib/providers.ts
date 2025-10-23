import { fetch } from 'undici';
import type { Response } from 'undici';
import { KodusConfig } from './config.js';

export interface SendReviewArgs {
  provider: 'claude' | 'codex';
  prompt: string;
  config: KodusConfig;
}

export interface SendReviewResult {
  provider: 'claude' | 'codex';
  ok: boolean;
  model?: string;
  responseText?: string;
  requestId?: string;
  raw?: unknown;
}

export async function sendReview(args: SendReviewArgs): Promise<SendReviewResult> {
  switch (args.provider) {
    case 'claude':
      return sendToClaude(args);
    case 'codex':
      return sendToCodex(args);
    default:
      throw new Error(`Provider "${args.provider}" nao suportado.`);
  }
}

async function sendToClaude(args: SendReviewArgs): Promise<SendReviewResult> {
  const baseUrl = args.config.providers?.claude?.baseUrl ?? 'https://api.anthropic.com';
  const apiKey =
    args.config.providers?.claude?.apiKey ??
    process.env.ANTHROPIC_API_KEY ??
    process.env.CLAUDE_API_KEY;

  if (!apiKey) {
    throw new Error('Configure a variavel KODUS_CLAUDE_API_KEY ou ANTHROPIC_API_KEY para enviar ao Claude.');
  }

  const model = args.config.providers?.claude?.model ?? 'claude-3-5-sonnet-20241022';

  const response = await fetch(`${baseUrl}/v1/messages`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 1024,
      system: 'Voce e um revisor de codigo. Responda com achados priorizados e objetivos.',
      messages: [
        {
          role: 'user',
          content: args.prompt,
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorBody = await safeReadBody(response);
    throw new Error(`Claude retornou status ${response.status}: ${errorBody}`);
  }

  const body = (await response.json()) as ClaudeResponse;
  const text = extractClaudeText(body);

  return {
    provider: 'claude',
    ok: true,
    model: body.model,
    responseText: text,
    requestId: response.headers.get('x-request-id') ?? undefined,
    raw: body,
  };
}

async function sendToCodex(args: SendReviewArgs): Promise<SendReviewResult> {
  const baseUrl = args.config.providers?.codex?.baseUrl ?? 'https://api.openai.com';
  const apiKey =
    args.config.providers?.codex?.apiKey ??
    process.env.OPENAI_API_KEY ??
    process.env.CODEX_API_KEY;

  if (!apiKey) {
    throw new Error('Configure a variavel KODUS_CODEX_API_KEY ou OPENAI_API_KEY para enviar ao Codex.');
  }

  const model = args.config.providers?.codex?.model ?? 'gpt-4o-mini';

  const response = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${apiKey}`,
      ...(args.config.providers?.codex?.organization
        ? { 'OpenAI-Organization': args.config.providers.codex.organization }
        : {}),
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: 'system',
          content:
            'Voce e um revisor de codigo. Analise o prompt fornecido e responda apenas com problemas e sugestoes objetivas.',
        },
        {
          role: 'user',
          content: args.prompt,
        },
      ],
      temperature: 0.2,
    }),
  });

  if (!response.ok) {
    const errorBody = await safeReadBody(response);
    throw new Error(`Codex retornou status ${response.status}: ${errorBody}`);
  }

  const body = (await response.json()) as OpenAIResponse;
  const choice = body.choices?.[0];
  const text = choice?.message?.content ?? '';

  return {
    provider: 'codex',
    ok: true,
    model: body.model ?? model,
    responseText: text,
    requestId: body.id,
    raw: body,
  };
}

async function safeReadBody(response: Response): Promise<string> {
  try {
    const text = await response.text();
    return text.slice(0, 2000);
  } catch {
    return '<sem corpo>';
  }
}

interface ClaudeResponse {
  id: string;
  model: string;
  content: Array<{ type: string; text?: string }>;
}

interface OpenAIResponse {
  id: string;
  model?: string;
  choices?: Array<{ message?: { role?: string; content?: string } }>;
}

function extractClaudeText(body: ClaudeResponse): string {
  if (!Array.isArray(body.content)) {
    return '';
  }
  return body.content
    .map((entry) => (entry.type === 'text' ? entry.text ?? '' : ''))
    .join('\n')
    .trim();
}
