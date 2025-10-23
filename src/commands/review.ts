import fs from 'node:fs/promises';
import path from 'node:path';
import chalk from 'chalk';
import { execa } from 'execa';
import { collectContextFiles } from '../lib/context.js';
import { loadConfig, resolveReviewDefaults } from '../lib/config.js';
import { buildPrompt } from '../lib/prompt.js';
import {
  getChangedFiles,
  getCurrentBranch,
  getDiff,
  getHeadSha,
  resolveGitRoot,
} from '../lib/git.js';
import { sendReview, type ReviewPayload, type SendReviewResult } from '../lib/providers.js';

export interface ReviewCommandOptions {
  base?: string;
  provider?: string;
  open?: boolean;
  output?: string;
  maxFiles?: string;
  followDepth?: string;
  send?: string | boolean;
}

export async function runReview(options: ReviewCommandOptions): Promise<void> {
  const root = await resolveGitRoot();
  const config = await loadConfig(root);
  const defaults = resolveReviewDefaults(config);

  const provider = normalizeProvider(options.provider ?? defaults.provider);
  const maxFiles = parseIntegerOption(
    options.maxFiles,
    defaults.maxFiles ?? 15,
    'max-files',
    1
  );
  const followDepth = parseIntegerOption(
    options.followDepth,
    defaults.followDepth ?? 1,
    'follow-depth',
    0
  );
  const shouldSend = resolveSendFlag(options.send, defaults.send);
  const shouldCopy = options.open !== false;
  const baseRef = await resolveBaseRef(options.base ?? defaults.base, root);
  const branch = await getCurrentBranch(root);
  const headSha = await getHeadSha(root);

  console.log(chalk.cyan('[kodus] Gerando payload de review'));
  console.log(chalk.gray(`- Repositorio: ${root}`));
  console.log(chalk.gray(`- Branch atual: ${branch ?? 'desconhecida'}`));
  console.log(chalk.gray(`- Comparando com: ${baseRef}`));
  console.log('');

  let diff: string;
  let changes;
  try {
    diff = await getDiff(baseRef, root);
    changes = await getChangedFiles(baseRef, root);
  } catch (error) {
    throw new Error(`Nao foi possivel coletar o diff usando a base "${baseRef}". Verifique se o ref existe. ${(error as Error).message}`);
  }

  if (!diff.trim()) {
    console.log(chalk.yellow('Nenhuma diferenca encontrada entre HEAD e a base informada.'));
  }

  const changedPaths = Array.from(
    new Set(changes.map((change) => change.path).filter((p): p is string => Boolean(p)))
  );

  if (changedPaths.length === 0) {
    console.log(chalk.yellow('Nenhum arquivo modificado. Nada a revisar.'));
    return;
  }

  const contextResult = await collectContextFiles({
    root,
    changedFiles: changedPaths,
    followDepth,
    maxFiles,
  });

  const prompt = buildPrompt({
    provider,
    baseRef,
    branch,
    headSha,
    diff,
    files: contextResult.files,
    changes,
  });

  const payload: ReviewPayload = {
    provider,
    generatedAt: new Date().toISOString(),
    baseRef,
    branch,
    headSha,
    diff,
    changedFiles: changes,
    contextFiles: contextResult.files,
    prompt,
    stats: {
      changedFiles: changedPaths.length,
      contextFiles: contextResult.files.length,
      followDepth,
      maxFiles,
      skipped: Array.from(contextResult.skipped),
    },
  };

  console.log('');
  console.log(chalk.bold('Prompt sugerido:'));
  console.log('');
  console.log(prompt);
  console.log('');

  if (shouldCopy) {
    const copied = await copyToClipboard(prompt);
    if (copied) {
      console.log(chalk.green('Prompt copiado para a area de transferencia.'));
    } else {
      console.log(chalk.yellow('Nao foi possivel copiar automaticamente. Copie manualmente o texto acima.'));
    }
  } else {
    console.log(chalk.gray('Copie o prompt acima manualmente para o provider escolhido.'));
  }

  let providerResult: SendReviewResult | null = null;
  if (shouldSend) {
    console.log('');
    console.log(chalk.cyan('[kodus] Enviando prompt para a API Kodus...'));
    try {
      providerResult = await sendReview({ config, payload });
      payload.providerResponse = providerResult;

      console.log(
        chalk.green(`[kodus] Review enviada (status ${providerResult.status}).`)
      );
      if (providerResult.requestId) {
        console.log(chalk.gray(`request-id: ${providerResult.requestId}`));
      }

      const responseText = extractResponseText(providerResult);
      if (responseText) {
        console.log('');
        console.log(chalk.bold('Resposta da Kodus:'));
        console.log('');
        console.log(responseText);
        console.log('');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      providerResult = {
        ok: false,
        status: 0,
        message,
      };
      payload.providerResponse = providerResult;
      console.log(chalk.red(`[kodus] Falha ao enviar para a API: ${message}`));
    }
  }

  if (options.output) {
    const outputPath = resolveOutputPath(options.output);
    await fs.writeFile(outputPath, JSON.stringify(payload, null, 2), 'utf8');
    console.log(chalk.green(`Payload completo salvo em ${outputPath}`));
  }
}

function normalizeProvider(provider?: string): 'claude' | 'codex' {
  if (!provider) {
    return 'claude';
  }
  const normalized = provider.trim().toLowerCase();
  if (normalized !== 'claude' && normalized !== 'codex') {
    throw new Error(`Provider invalido "${provider}". Use \"claude\" ou \"codex\".`);
  }
  return normalized;
}

function parseIntegerOption(
  value: string | undefined,
  fallback: number,
  flag: string,
  min: number
): number {
  if (value === undefined) {
    return fallback;
  }
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed < min) {
    const comparator = min === 0 ? 'inteiro maior ou igual a zero' : `inteiro maior ou igual a ${min}`;
    throw new Error(`Valor invalido para --${flag}: "${value}". Informe um ${comparator}.`);
  }
  return parsed;
}

function resolveSendFlag(
  value: string | boolean | undefined,
  defaultValue: boolean | undefined
): boolean {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'y'].includes(normalized)) {
      return true;
    }
    if (['false', '0', 'no', 'n'].includes(normalized)) {
      return false;
    }
    throw new Error(`Valor invalido para --send: \"${value}\". Utilize true/false ou 1/0.`);
  }
  return defaultValue ?? false;
}

function extractResponseText(result: SendReviewResult | null): string | null {
  if (!result) {
    return null;
  }
  if (result.message && result.message.trim().length > 0) {
    return result.message;
  }
  const data = result.data;
  if (data === undefined || data === null) {
    return null;
  }
  if (typeof data === 'string') {
    return data;
  }
  try {
    return JSON.stringify(data, null, 2);
  } catch {
    return String(data);
  }
}

async function resolveBaseRef(baseOption: string | undefined, root: string): Promise<string> {
  if (baseOption) {
    const trimmed = baseOption.trim();
    if (!(await refExists(trimmed, root))) {
      throw new Error(
        `A ref base informada \"${trimmed}\" nao foi encontrada. Verifique o nome ou busque com git fetch.`
      );
    }
    return trimmed;
  }

  const candidates: string[] = [];

  try {
    const { stdout } = await execa(
      'git',
      ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{upstream}'],
      { cwd: root }
    );
    const upstream = stdout.trim();
    if (upstream && (await refExists(upstream, root))) {
      return upstream;
    }
  } catch {
    // ignore fallback attempts
  }

  candidates.push('origin/main', 'origin/master', 'main', 'master');

  for (const candidate of candidates) {
    if (await refExists(candidate, root)) {
      return candidate;
    }
  }

  throw new Error(
    'Nao foi possivel determinar uma base padrao. Informe manualmente usando --base <ref>.'
  );
}

async function refExists(ref: string, root: string): Promise<boolean> {
  try {
    await execa('git', ['rev-parse', '--verify', '--quiet', ref], { cwd: root });
    return true;
  } catch {
    return false;
  }
}

function resolveOutputPath(output: string): string {
  if (path.isAbsolute(output)) {
    return output;
  }
  return path.resolve(process.cwd(), output);
}

async function copyToClipboard(text: string): Promise<boolean> {
  const platform = process.platform;
  const copyCommands: Array<{ command: string; args: string[] }> = [];

  if (platform === 'darwin') {
    copyCommands.push({ command: 'pbcopy', args: [] });
  } else if (platform === 'win32') {
    copyCommands.push({ command: 'clip', args: [] });
  } else {
    copyCommands.push({ command: 'wl-copy', args: [] });
    copyCommands.push({ command: 'xclip', args: ['-selection', 'clipboard'] });
  }

  for (const entry of copyCommands) {
    try {
      await execa(entry.command, entry.args, { input: text });
      return true;
    } catch {
      continue;
    }
  }

  return false;
}
