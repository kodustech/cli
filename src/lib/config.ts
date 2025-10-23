import fs from 'node:fs/promises';
import path from 'node:path';
import yaml from 'js-yaml';

export interface ProviderConfig {
  model?: string;
}

export interface KodusApiConfig {
  baseUrl?: string;
  token?: string;
  reviewPath?: string;
}

export interface ReviewDefaultsConfig {
  base?: string;
  provider?: 'claude' | 'codex';
  maxFiles?: number;
  followDepth?: number;
  send?: boolean;
}

export interface KodusConfig {
  review?: ReviewDefaultsConfig;
  providers?: {
    claude?: ProviderConfig;
    codex?: ProviderConfig & { organization?: string };
  };
  api?: KodusApiConfig;
}

export async function loadConfig(root: string): Promise<KodusConfig> {
  const configPaths = [
    path.join(root, 'kodus.config.json'),
    path.join(root, 'kodus.config.yaml'),
    path.join(root, 'kodus.config.yml'),
  ];

  for (const configPath of configPaths) {
    const config = await readConfigFile(configPath);
    if (config) {
      return applyEnvironmentOverrides(config);
    }
  }

  const packageConfig = await readPackageConfig(root);
  if (packageConfig) {
    return applyEnvironmentOverrides(packageConfig);
  }

  return applyEnvironmentOverrides({});
}

async function readConfigFile(filePath: string): Promise<KodusConfig | null> {
  try {
    const file = await fs.readFile(filePath, 'utf8');
    if (filePath.endsWith('.json')) {
      return JSON.parse(file) as KodusConfig;
    }
    const parsed = yaml.load(file);
    if (typeof parsed === 'object' && parsed !== null) {
      return parsed as KodusConfig;
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error;
    }
  }
  return null;
}

async function readPackageConfig(root: string): Promise<KodusConfig | null> {
  try {
    const packageJsonPath = path.join(root, 'package.json');
    const packageJsonContent = await fs.readFile(packageJsonPath, 'utf8');
    const packageJson = JSON.parse(packageJsonContent) as { kodus?: KodusConfig };
    return packageJson.kodus ?? null;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error;
    }
    return null;
  }
}

function applyEnvironmentOverrides(config: KodusConfig): KodusConfig {
  const reviewEnv = extractReviewEnv();
  const providersEnv = extractProvidersEnv();
  const apiEnv = extractApiEnv();

  return {
    ...config,
    review: {
      ...config.review,
      ...reviewEnv,
    },
    providers: mergeProviderConfigs(config.providers, providersEnv),
    api: mergeApiConfig(config.api, apiEnv),
  };
}

function extractReviewEnv(): ReviewDefaultsConfig {
  const review: ReviewDefaultsConfig = {};

  if (process.env.KODUS_REVIEW_BASE) {
    review.base = process.env.KODUS_REVIEW_BASE;
  }
  if (process.env.KODUS_REVIEW_PROVIDER) {
    const provider = process.env.KODUS_REVIEW_PROVIDER.toLowerCase();
    if (provider === 'claude' || provider === 'codex') {
      review.provider = provider;
    }
  }
  if (process.env.KODUS_REVIEW_MAX_FILES) {
    const asNumber = Number.parseInt(process.env.KODUS_REVIEW_MAX_FILES, 10);
    if (!Number.isNaN(asNumber) && asNumber > 0) {
      review.maxFiles = asNumber;
    }
  }
  if (process.env.KODUS_REVIEW_FOLLOW_DEPTH) {
    const asNumber = Number.parseInt(process.env.KODUS_REVIEW_FOLLOW_DEPTH, 10);
    if (!Number.isNaN(asNumber) && asNumber >= 0) {
      review.followDepth = asNumber;
    }
  }
  if (process.env.KODUS_REVIEW_SEND) {
    const value = process.env.KODUS_REVIEW_SEND.trim().toLowerCase();
    if (value === 'true' || value === '1') {
      review.send = true;
    } else if (value === 'false' || value === '0') {
      review.send = false;
    }
  }

  return review;
}

function extractProvidersEnv(): KodusConfig['providers'] | undefined {
  const providers: KodusConfig['providers'] = {};

  if (process.env.KODUS_CLAUDE_MODEL) {
    providers.claude = {
      ...(providers.claude ?? {}),
      model: process.env.KODUS_CLAUDE_MODEL,
    };
  }

  const codexEnv: ProviderConfig & { organization?: string } = {};

  if (process.env.KODUS_CODEX_MODEL) {
    codexEnv.model = process.env.KODUS_CODEX_MODEL;
  }
  if (process.env.KODUS_CODEX_ORG ?? process.env.OPENAI_ORG) {
    codexEnv.organization = process.env.KODUS_CODEX_ORG ?? process.env.OPENAI_ORG;
  }
  if (Object.keys(codexEnv).length > 0) {
    providers.codex = {
      ...(providers.codex ?? {}),
      ...codexEnv,
    };
  }

  return Object.keys(providers).length > 0 ? providers : undefined;
}

function extractApiEnv(): KodusApiConfig | undefined {
  const api: KodusApiConfig = {};

  if (process.env.KODUS_API_URL) {
    api.baseUrl = process.env.KODUS_API_URL;
  }
  const token = process.env.KODUS_API_TOKEN ?? process.env.KODUS_TOKEN;
  if (token) {
    api.token = token;
  }
  if (process.env.KODUS_API_REVIEW_PATH) {
    api.reviewPath = process.env.KODUS_API_REVIEW_PATH;
  }

  return Object.keys(api).length > 0 ? api : undefined;
}

function mergeProviderConfigs(
  fromFile: KodusConfig['providers'],
  fromEnv: KodusConfig['providers'],
): KodusConfig['providers'] {
  if (!fromFile && !fromEnv) {
    return undefined;
  }
  return {
    ...fromFile,
    claude: {
      ...fromFile?.claude,
      ...fromEnv?.claude,
    },
    codex: {
      ...fromFile?.codex,
      ...fromEnv?.codex,
    },
  };
}

function mergeApiConfig(
  fromFile: KodusApiConfig | undefined,
  fromEnv: KodusApiConfig | undefined,
): KodusApiConfig | undefined {
  if (!fromFile && !fromEnv) {
    return undefined;
  }
  return {
    ...fromFile,
    ...fromEnv,
  };
}

export interface ResolvedReviewOptions {
  base: string | undefined;
  provider: 'claude' | 'codex' | undefined;
  maxFiles: number | undefined;
  followDepth: number | undefined;
  send: boolean | undefined;
}

export function resolveReviewDefaults(config: KodusConfig): ResolvedReviewOptions {
  const review = config.review ?? {};
  return {
    base: review.base,
    provider: review.provider,
    maxFiles: review.maxFiles,
    followDepth: review.followDepth,
    send: review.send,
  };
}
