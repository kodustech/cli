import fs from 'node:fs/promises';
import path from 'node:path';

const TEXT_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json']);
const IMPORTABLE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json'];
const INDEX_FILES = IMPORTABLE_EXTENSIONS.map((ext) => `index${ext}`);
const MAX_FILE_BYTES = 200 * 1024;

export type ContextFileReason = 'changed' | 'dependency';

export interface ContextFile {
  path: string;
  depth: number;
  reason: ContextFileReason;
  truncated: boolean;
  content?: string;
  note?: string;
}

export interface CollectContextOptions {
  root: string;
  changedFiles: string[];
  followDepth: number;
  maxFiles: number;
}

export interface CollectContextResult {
  files: ContextFile[];
  visited: Set<string>;
  skipped: string[];
}

export async function collectContextFiles(options: CollectContextOptions): Promise<CollectContextResult> {
  const { root, changedFiles, followDepth, maxFiles } = options;
  const queue: Array<{ path: string; depth: number; reason: ContextFileReason }> = [];
  const visited = new Set<string>();
  const skipped: string[] = [];
  const files: ContextFile[] = [];

  for (const file of changedFiles) {
    queue.push({ path: file, depth: 0, reason: 'changed' });
  }

  while (queue.length > 0 && files.length < maxFiles) {
    const current = queue.shift();
    if (!current) break;

    const normalizedPath = normalizeRelativePath(current.path);
    if (visited.has(normalizedPath)) {
      continue;
    }
    visited.add(normalizedPath);

    const absolutePath = path.resolve(root, normalizedPath);
    const relativeWithinRoot = path.relative(root, absolutePath);
    if (relativeWithinRoot.startsWith('..')) {
      skipped.push(`${normalizedPath} (fora do repositorio)`);
      continue;
    }

    const contextEntry: ContextFile = {
      path: normalizedPath,
      depth: current.depth,
      reason: current.reason,
      truncated: false,
    };

    const readResult = await safelyReadTextFile(absolutePath);
    if (readResult.kind === 'missing') {
      contextEntry.note = 'Arquivo inexistente no working tree';
      files.push(contextEntry);
      continue;
    }

    if (readResult.kind === 'binary') {
      contextEntry.note = 'Conteudo binario omitido';
      files.push(contextEntry);
      continue;
    }

    const { content, truncated } = readResult;
    contextEntry.content = content;
    contextEntry.truncated = truncated;
    files.push(contextEntry);

    if (current.depth >= followDepth) {
      continue;
    }

    if (!isImportableFile(absolutePath)) {
      continue;
    }

    const dependencies = await extractRelativeDependencies({ root, fromFile: absolutePath, content });
    for (const dependency of dependencies) {
      if (files.length + queue.length >= maxFiles) {
        break;
      }
      queue.push({ path: dependency, depth: current.depth + 1, reason: 'dependency' });
    }
  }

  return { files, visited, skipped };
}

function normalizeRelativePath(filePath: string): string {
  return filePath.replace(/\\/g, '/');
}

async function safelyReadTextFile(filePath: string): Promise<
  | { kind: 'missing' }
  | { kind: 'binary' }
  | { kind: 'text'; content: string; truncated: boolean }
> {
  try {
    const data = await fs.readFile(filePath);
    if (data.includes(0)) {
      return { kind: 'binary' };
    }
    let content = data.toString('utf8');
    let truncated = false;
    if (data.byteLength > MAX_FILE_BYTES) {
      content = content.slice(0, MAX_FILE_BYTES);
      truncated = true;
    }
    return { kind: 'text', content, truncated };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return { kind: 'missing' };
    }
    throw error;
  }
}

async function extractRelativeDependencies(args: {
  root: string;
  fromFile: string;
  content: string;
}): Promise<string[]> {
  const { root, fromFile, content } = args;
  const directory = path.dirname(fromFile);
  const specifiers = new Set<string>();

  const importRegex = /import\s+(?:[^'"\n]+\s+from\s+)?["']([^"']+)["']/g;
  const exportFromRegex = /export\s+[^'"\n]+\s+from\s+["']([^"']+)["']/g;
  const requireRegex = /require\(\s*["']([^"']+)["']\s*\)/g;
  const dynamicImportRegex = /import\(\s*["']([^"']+)["']\s*\)/g;

  const regexes = [importRegex, exportFromRegex, requireRegex, dynamicImportRegex];

  for (const regex of regexes) {
    let match: RegExpExecArray | null;
    while ((match = regex.exec(content)) !== null) {
      const specifier = match[1];
      if (specifier?.startsWith('.')) {
        specifiers.add(specifier);
      }
    }
  }

  const resolved: string[] = [];
  for (const specifier of specifiers) {
    const candidate = await resolveImportPath(directory, specifier, root);
    if (candidate) {
      resolved.push(candidate);
    }
  }
  return resolved;
}

async function resolveImportPath(fromDirectory: string, specifier: string, root: string): Promise<string | null> {
  const normalizedSpecifier = specifier.replace(/\\/g, '/');
  const resolvedBase = path.resolve(fromDirectory, normalizedSpecifier);
  const candidates = buildCandidatePaths(resolvedBase);

  for (const candidate of candidates) {
    try {
      const stat = await fs.stat(candidate);
      if (stat.isDirectory()) {
        for (const indexFile of INDEX_FILES) {
          const nested = path.join(candidate, indexFile);
          if (await fileExists(nested)) {
            const rel = path.relative(root, nested);
            return rel.replace(/\\/g, '/');
          }
        }
        continue;
      }
      const rel = path.relative(root, candidate);
      if (!rel.startsWith('..')) {
        return rel.replace(/\\/g, '/');
      }
    } catch {
      continue;
    }
  }

  return null;
}

function buildCandidatePaths(resolvedBase: string): string[] {
  const candidates = [resolvedBase];
  for (const extension of IMPORTABLE_EXTENSIONS) {
    candidates.push(`${resolvedBase}${extension}`);
  }
  return candidates;
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function isImportableFile(filePath: string): boolean {
  const extension = path.extname(filePath);
  return TEXT_EXTENSIONS.has(extension);
}
