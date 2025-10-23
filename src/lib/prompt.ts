import path from 'node:path';
import { ContextFile } from './context.js';
import { GitFileChange } from './git.js';

export interface BuildPromptArgs {
  provider: 'claude' | 'codex';
  baseRef: string;
  branch: string | null;
  headSha: string | null;
  diff: string;
  files: ContextFile[];
  changes: GitFileChange[];
}

export function buildPrompt(args: BuildPromptArgs): string {
  const { provider, baseRef, branch, headSha, diff, files, changes } = args;

  const headerLines = [
    'Voce e um revisor de codigo focado em detectar bugs, riscos e oportunidades de melhoria.',
    'Analise o diff e aponte apenas os problemas mais relevantes em ordem de severidade.'
  ];

  const metadataLines = [
    `Branch atual: ${branch ?? 'desconhecida'}`,
    `Base utilizada: ${baseRef}`,
    `Head SHA: ${headSha ?? 'desconhecido'}`,
    `Provider alvo: ${provider}`,
  ];

  const changeSummary = changes
    .map((change) => {
      const status = translateStatus(change.status);
      return `- ${status}: ${change.path}`;
    })
    .join('\n');

  const contextSections = files
    .map((file) => {
      const header = `${file.reason === 'changed' ? 'Arquivo principal' : 'Import relativo'}: ${file.path} (profundidade ${file.depth})`;
      if (file.note && !file.content) {
        return `${header}\nNota: ${file.note}`;
      }
      const truncatedNote = file.truncated ? '\nNota: conteudo truncado para caber no limite.' : '';
      const language = detectLanguage(file.path);
      const content = file.content ?? '';
      return `${header}${truncatedNote}\n\n\`\`\`${language}\n${content}\n\`\`\``;
    })
    .join('\n\n');

  const diffBlock = diff.trim().length === 0
    ? 'Diff vazio: nenhuma alteracao textual encontrada.'
    : `\`\`\`diff\n${diff.trim()}\n\`\`\``;

  const sections = [
    headerLines.join(' '),
    metadataLines.join('\n'),
    'Resumo das alteracoes:',
    changeSummary || '- Nenhum arquivo modificado detectado.',
    'Contexto relevante:',
    contextSections || 'Nenhum arquivo de contexto coletado.',
    'Diff completo:',
    diffBlock,
  ];

  return sections.join('\n\n');
}

function translateStatus(status: GitFileChange['status']): string {
  switch (status) {
    case 'A':
      return 'Adicionado';
    case 'M':
      return 'Modificado';
    case 'D':
      return 'Removido';
    case 'R':
      return 'Renomeado';
    case 'C':
      return 'Copiado';
    case 'U':
      return 'Conflito';
    default:
      return 'Outro';
  }
}

function detectLanguage(filePath: string): string {
  const extension = path.extname(filePath).toLowerCase();
  switch (extension) {
    case '.ts':
    case '.tsx':
      return 'ts';
    case '.js':
    case '.jsx':
    case '.mjs':
    case '.cjs':
      return 'javascript';
    case '.json':
      return 'json';
    case '.py':
      return 'python';
    case '.rb':
      return 'ruby';
    case '.go':
      return 'go';
    case '.rs':
      return 'rust';
    case '.java':
      return 'java';
    case '.kt':
    case '.kts':
      return 'kotlin';
    case '.swift':
      return 'swift';
    case '.php':
      return 'php';
    case '.css':
      return 'css';
    case '.scss':
    case '.sass':
      return 'scss';
    case '.yml':
    case '.yaml':
      return 'yaml';
    case '.md':
      return 'markdown';
    default:
      return '';
  }
}
