# Kodus CLI

Ferramenta de linha de comando para gerar pacotes de review para Claude Code ou Codex a partir do diff do repositorio. O comando agrega os arquivos alterados, segue imports relativos e monta um prompt pronto para colar no provider escolhido.

## Requisitos

- Node.js 18 ou superior
- Git instalado (o projeto deve estar dentro de um repositorio Git)

## Instalacao

```bash
npm install
npm run build
```

Use `npm link` se desejar instalar o binario `kodus` globalmente durante o desenvolvimento.

## Uso

```bash
npx kodus review [opcoes]
```

Principais opcoes:

- `--base <ref>`: ref base para o diff. Padrao: branch upstream ou `origin/main`.
- `--provider <claude|codex>`: destino do review. Padrao: `claude`.
- `--max-files <n>`: limite total de arquivos (alterados + dependencias). Padrao: 15.
- `--follow-depth <n>`: profundidade de imports relativos. Padrao: 1.
- `--output <arquivo>`: salva o payload completo (JSON) no caminho indicado.
- `--no-open`: evita copiar o prompt para a area de transferencia.

O comando imprime o prompt final no terminal e, quando possivel, copia o texto para a area de transferencia. Caso algum arquivo invalido seja detectado ou o diff nao possa ser gerado, uma mensagem amigavel e exibida com orientacoes para ajustar a base ou as opcoes.

## Estrutura do payload

O arquivo JSON gerado (via `--output`) contem:

- Metadados sobre branch, base e commit atual.
- Diff completo produzido pelo Git.
- Lista de arquivos alterados e dos arquivos relacionados encontrados pelos imports relativos.
- Prompt consolidado pronto para ser enviado ao provider.

## Proximos passos

- Implementar integracao direta com as APIs dos providers.
- Ajustar heuristicas de descoberta de dependencias para outras linguagens alem de JS/TS.
- Adicionar testes automatizados para os casos principais.
