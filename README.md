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
- `--send [true|false]`: envia o prompt para o provider configurado (por padrao segue a configuracao ou nao envia).

O comando imprime o prompt final no terminal e, quando possivel, copia o texto para a area de transferencia. Caso algum arquivo invalido seja detectado ou o diff nao possa ser gerado, uma mensagem amigavel e exibida com orientacoes para ajustar a base ou as opcoes.

## Configuracao

O CLI aceita um arquivo `kodus.config.json` ou `kodus.config.yaml` no repositorio (ou ainda um bloco `kodus` dentro do `package.json`). Exemplo em YAML:

```yaml
review:
  base: origin/main
  provider: claude
  maxFiles: 20
  followDepth: 2
  send: true
providers:
  claude:
    model: claude-3-5-sonnet-20241022
  codex:
    model: gpt-4o-mini
```

Variaveis de ambiente podem sobrescrever essas configuracoes. As principais sao:

| Variavel | Descricao |
| --- | --- |
| `KODUS_REVIEW_BASE` | Ref padrao da base de comparacao. |
| `KODUS_REVIEW_PROVIDER` | Provider padrao (`claude` ou `codex`). |
| `KODUS_REVIEW_MAX_FILES` | Limite padrao de arquivos em contexto. |
| `KODUS_REVIEW_FOLLOW_DEPTH` | Profundidade padrao de follow-up de imports. |
| `KODUS_REVIEW_SEND` | Define se o envio automatico deve ocorrer (true/false). |
| `KODUS_CLAUDE_API_KEY` / `ANTHROPIC_API_KEY` | Token do Claude. |
| `KODUS_CLAUDE_MODEL` | Modelo padrao do Claude. |
| `KODUS_CODEX_API_KEY` / `OPENAI_API_KEY` | Token do Codex (OpenAI). |
| `KODUS_CODEX_MODEL` | Modelo padrao do Codex. |
| `KODUS_CODEX_BASE_URL` | Endpoint alternativo do Codex. |
| `KODUS_CODEX_ORG` / `OPENAI_ORG` | Organizacao OpenAI, se necessario. |

## Envio automatico

Quando `--send` (ou `KODUS_REVIEW_SEND=true`) e um token valido estiver disponivel, o CLI envia o prompt diretamente ao provider selecionado:

- **Claude**: usa `https://api.anthropic.com/v1/messages` com modelo configuravel (padrao `claude-3-5-sonnet-20241022`).
- **Codex**: usa o endpoint `https://api.openai.com/v1/chat/completions` (modelo padrao `gpt-4o-mini`).

As respostas sao exibidas no terminal e adicionadas ao payload salvo via `--output`.

## Estrutura do payload

O arquivo JSON gerado (via `--output`) contem:

- Metadados sobre branch, base e commit atual.
- Diff completo produzido pelo Git.
- Lista de arquivos alterados e dos arquivos relacionados encontrados pelos imports relativos.
- Prompt consolidado pronto para ser enviado ao provider.

## Proximos passos

- Ajustar heuristicas de descoberta de dependencias para outras linguagens alem de JS/TS.
- Refinar o template do prompt para cenarios especificos (por exemplo, mobile, backend, dados).
- Adicionar testes automatizados para os fluxos principais do CLI.
