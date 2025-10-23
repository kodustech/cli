#!/usr/bin/env node
import { Command } from 'commander';
import { runReview } from './commands/review.js';

const program = new Command();

program
  .name('kodus')
  .description('Kodus CLI para gerar reviews automaticos com Claude Code ou Codex')
  .version('0.1.0');

program
  .command('review')
  .description('Gera pedido de review a partir do diff atual')
  .option('-b, --base <branch>', 'Branch base para comparacao (padrao: upstream ou origin/main)')
  .option('-p, --provider <provider>', 'Destino do review (claude|codex)', 'claude')
  .option('--no-open', 'Nao abre o resultado automaticamente')
  .option('--output <path>', 'Arquivo para salvar o payload gerado (json)')
  .option('--max-files <number>', 'Limite de arquivos relacionados a carregar', '15')
  .option('--follow-depth <number>', 'Profundidade maxima para seguir imports relativos', '1')
  .option(
    '--send [mode]',
    'Envia automaticamente o prompt para o provider configurado (use true/false).'
  )
  .action(async (options) => {
    try {
      await runReview(options);
    } catch (error) {
      console.error('Erro ao executar review:', error instanceof Error ? error.message : error);
      process.exitCode = 1;
    }
  });

program
  .parseAsync(process.argv)
  .catch((error) => {
    console.error('Erro inesperado:', error instanceof Error ? error.message : error);
    process.exit(1);
  });
