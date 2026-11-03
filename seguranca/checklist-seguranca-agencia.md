# Checklist de segurança da agência

Este checklist vale para todos os projetos. Ele é reaproveitado e cresce com as lições de cada projeto (instrução permanente 4 do OTTO). Copie para o projeto novo e marque cada item no escopo e de novo antes do parecer.

## Escopo (antes de começar o desenvolvimento)
- [ ] Criticidade definida pelo tipo de dado (financeiro, pessoal, sensível). O rigor da revisão acompanha essa criticidade.
- [ ] Modelagem STRIDE feita e requisitos enviados a Produto e Engenharia.
- [ ] Inventário LGPD: cada campo pessoal tem finalidade, base legal e prazo de retenção.

## Supabase / BaaS
- [ ] Nenhuma policy `USING (true)` para `anon` em tabela interna. *(Lição do areadomembro, T1)*
- [ ] O servidor usa a service role key, só em código de servidor. O cliente usa anon, com RLS por `auth.uid()`.
- [ ] Toda tabela criada tem RLS ativado na própria migração. *(areadomembro, T5)*
- [ ] Bucket com dado pessoal ou financeiro é privado e usa URL assinada. *(areadomembro, T7)*
- [ ] A tabela de auditoria só aceita inserção. Ninguém altera nem apaga registros. *(areadomembro, T8)*

## Autenticação e autorização
- [ ] O middleware não é a única barreira. Toda rota `/api` e toda server action chama `auth()` e checa a permissão. *(areadomembro, T3/T4)*
- [ ] Guarda de página só no cliente (RouteGuard) não conta como controle de acesso.
- [ ] Senha nunca é gravada em texto puro, nem "temporariamente" em tabela de solicitação. *(areadomembro, T5)*
- [ ] O login tem limite de tentativas, e o log não traz e-mail nem resultado da comparação de senha.
- [ ] Mudar role ou desligar um usuário invalida a sessão ou é revalidado no servidor.
- [ ] O usuário não escolhe o próprio cargo ou papel no autocadastro.
- [ ] Server Action nunca recebe do cliente o ID de quem está agindo. O ID vem da sessão. *(areadomembro, C2)*
- [ ] Trocar a senha exige a senha atual. A recuperação usa um link de uso único por e-mail, nunca CPF e nascimento, e nunca mostra a senha na tela. *(areadomembro, A1)*
- [ ] Toda rota de API está no matcher do middleware. Exceções têm justificativa, como webhook com HMAC. *(areadomembro, A2)*

## Segredos e repositório
- [ ] Nenhuma credencial no código, nem como valor padrão de `process.env.X || '...'`. *(areadomembro, T2)*
- [ ] Rodar gitleaks no histórico antes de cada parecer.
- [ ] Scripts de manutenção (`scripts/`, raiz) também passam pela revisão.
- [ ] Nenhum script cria admin com senha fixa.

## Aplicação
- [ ] HTML de usuário passa por sanitização no servidor antes de `dangerouslySetInnerHTML`.
- [ ] Headers configurados: CSP, HSTS, X-Frame-Options/frame-ancestors, Referrer-Policy.
- [ ] Rotas de IA montam o histórico no servidor, limitam uso por usuário e minimizam os dados pessoais enviados.
- [ ] Toda operação financeira é idempotente, tem trava de período e grava o autor na auditoria.
- [ ] `npm audit` sem nada alto ou crítico em produção.
- [ ] Débito de saldo é feito numa função do banco com `FOR UPDATE` e checagem de saldo. O webhook só dispara depois do commit. *(areadomembro, A4)*
- [ ] Nenhuma trava de negócio é removida "para teste" sem um ticket para voltar. *(areadomembro, C4)*
- [ ] Update recebe só os campos de uma allowlist, nunca `...rest` do corpo. A auditoria é montada no servidor. *(areadomembro, M1/M2)*
- [ ] Filtros PostgREST `.or()` nunca levam texto interpolado. *(areadomembro, M3)*
- [ ] Webhooks de saída (n8n etc.) são chamados só pelo servidor e levam assinatura HMAC. *(areadomembro, M4)*
- [ ] Logs sem PII: chave PIX, telefone e e-mail aparecem mascarados. *(areadomembro, M5)*
- [ ] `poweredByHeader: false` no Next.js. *(areadomembro, B3)*

## LGPD
- [ ] O cadastro tem aviso de privacidade, finalidade, base legal e registro de consentimento (data, hora e versão). *(areadomembro, A9)*
- [ ] Política de privacidade pública, acessível sem login. *(areadomembro, A10)*
- [ ] Canal do titular e encarregado identificados (art. 18). *(areadomembro, M11)*
- [ ] Envio de dados pessoais a LLM estrangeiro tem registro de transferência internacional (art. 33). *(areadomembro, M6)*
- [ ] Achado crítico de exposição de dados abre investigação de incidente. Se houver indício de acesso, comunicar ANPD e titulares (art. 48). *(areadomembro, e4)*

## Infraestrutura (auto-hospedado)
- [ ] SSH restrito a VPN ou a IPs de administração, só com chave. *(areadomembro, M10)*
- [ ] Backup automático cifrado, com teste de restauração documentado.

## Parecer
- [ ] Deduplicar os achados entre as etapas e manter a coluna de origem.
- [ ] Nota de risco = Impacto × Probabilidade (escala de 0 a 10). Índice ponderado: C=10, A=5, M=2, B=0,5.
- [ ] Antes do parecer, conferir no código e no `git diff` que cada correção crítica e alta existe de fato.

## Projetos estáticos (landing pages)
- [ ] Sem formulário: só links. Com formulário: backend validado, anti-spam e aviso LGPD.
- [ ] Headers de segurança configurados também no host estático.
