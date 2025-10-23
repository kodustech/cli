import path from 'node:path';
import { execa } from 'execa';

export interface GitFileChange {
  path: string;
  status: 'A' | 'M' | 'D' | 'R' | 'C' | 'U' | '?';
  originalPath?: string;
}

export async function resolveGitRoot(cwd: string = process.cwd()): Promise<string> {
  try {
    const { stdout } = await execa('git', ['rev-parse', '--show-toplevel'], { cwd });
    return stdout.trim();
  } catch {
    throw new Error(
      'Nao foi possivel localizar o repositorio Git. Execute o comando dentro de um projeto versionado.'
    );
  }
}

export async function getCurrentBranch(root: string): Promise<string | null> {
  try {
    const { stdout } = await execa('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: root });
    return stdout.trim();
  } catch {
    return null;
  }
}

export async function getHeadSha(root: string): Promise<string | null> {
  try {
    const { stdout } = await execa('git', ['rev-parse', 'HEAD'], { cwd: root });
    return stdout.trim();
  } catch {
    return null;
  }
}

export async function getDiff(baseRef: string, root: string): Promise<string> {
  const { stdout } = await execa(
    'git',
    ['diff', '--no-color', '--ignore-cr-at-eol', `${baseRef}...HEAD`],
    { cwd: root }
  );
  return stdout;
}

export async function getChangedFiles(baseRef: string, root: string): Promise<GitFileChange[]> {
  const { stdout } = await execa('git', ['diff', '--name-status', `${baseRef}...HEAD`], { cwd: root });
  return stdout
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => parseStatusLine(line));
}

function parseStatusLine(line: string): GitFileChange {
  const [statusToken, ...paths] = line.split('\t');
  const status = statusToken.charAt(0) as GitFileChange['status'];
  if (status === 'R' || status === 'C') {
    const [originalPath, newPath] = paths;
    return {
      status,
      originalPath,
      path: newPath ?? originalPath,
    };
  }
  return {
    status,
    path: paths[0] ?? '',
  };
}

export async function readFileAtRevision(root: string, ref: string, filePath: string): Promise<string | null> {
  try {
    const { stdout } = await execa('git', ['show', `${ref}:${filePath}`], { cwd: root });
    return stdout;
  } catch {
    return null;
  }
}

export function resolveAbsolutePath(root: string, filePath: string): string {
  return path.resolve(root, filePath);
}
