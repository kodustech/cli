# Boas Práticas de Autenticação para CLIs

## Objetivo

Orientar o desenvolvimento de fluxos de autenticação seguros para ferramentas de linha de comando, com foco em casos semelhantes ao Kodus CLI.

## Princípios gerais

- Operar no modelo menos privilegiado possível, requisitando apenas escopos estritamente necessários.
- Evitar armazenamento persistente de segredos sem criptografia ou proteções do sistema operacional.
- Sempre oferecer forma clara de revogar tokens ou encerrar sessões.
- Favorecer mecanismos padronizados (OAuth, PATs, contas de serviço) em vez de autenticação caseira.

## Fluxos recomendados

- **Device Code / OAuth out-of-band**: abrir etapa de login em navegador e trocar código de dispositivo; reduz risco de expor credenciais no terminal.
- **Tokens pessoais com validade limitada**: instruir usuários a gerar tokens com escopo mínimo e data de expiração.
- **Chaves de API por ambiente**: para integrações servidor-servidor ou automações, permitir configuração via variáveis de ambiente ou arquivos específicos por ambiente.

## Armazenamento seguro de credenciais

- Priorizar uso de keychain/credential manager nativo (macOS Keychain, Windows Credential Manager, Linux Secret Service).
- Quando não houver suporte nativo, armazenar tokens em arquivos com permissões restritas (`0600`) e documentar o local.
- Evitar logs que contenham tokens ou cabeçalhos de autorização; mascarar quando necessário.
- Validar permissões de arquivo antes de aceitar credenciais salvas (recusar se forem world-readable).

## Proteções em trânsito e uso

- Comunicar-se apenas via HTTPS/TLS com verificação de certificado.
- Implementar retry/backoff sem reimprimir segredos no terminal ou logs.
- Usar cabeçalhos de Authorization ou corpo de requisição conforme padrões; nunca incorporar segredos à URL.
- Regenerar tokens proativamente ao detectar revogação ou expiração, guiando o usuário pelo fluxo correto.

## Experiência do usuário

- Notificar claramente onde credenciais ficam armazenadas e como removê-las.
- Fornecer comandos para listar, atualizar e apagar tokens (`kodus auth status`, por exemplo).
- Exibir avisos quando utilizar tokens perto da expiração e orientar sobre renovação.
- Suportar modo não interativo (CI) via variáveis de ambiente dedicadas com nomes descritivos.

## Auditoria e monitoramento

- Registrar apenas metadados necessários (hora da autenticação, provider utilizado, mas nunca o token em si).
- Permitir que o usuário veja rapidamente com quais providers está autenticado.
- Documentar procedimentos de rotação de tokens e requisitos mínimos de segurança (escopos, expiração, MFA obrigatória se o provider suportar).

## O que evitar

- Gravar senhas em texto plano ou repassar senha de usuário final ao provider.
- Manter tokens válidos indefinidamente sem renovação controlada.
- Reutilizar a mesma credencial para múltiplos usuários ou ambientes.
- Exibir segredos em comandos com histórico (evitar que usuários passem tokens diretamente em linha de comando).

## Checklist rápido

- [ ] Login via fluxo seguro (OAuth, device code ou token configurável).
- [ ] Armazenamento protegido/localização documentada.
- [ ] Comandos para revogar, renovar e visualizar estado.
- [ ] Logs sanitizados e sem vazamento de segredos.
- [ ] Suporte a automação com credenciais isoladas.
- [ ] Instruções de segurança claras no README/docs.
