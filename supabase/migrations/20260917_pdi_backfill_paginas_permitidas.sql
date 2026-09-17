-- Backfill: libera a aba "PDI" (/pdi) para todas as contas já existentes.
--
-- A migração 20260915_pdi_momentos_desenvolvimento.sql criou o módulo PDI e
-- '/pdi' foi adicionado ao `defaultMemberPages` (src/lib/admin-actions.ts)
-- só para CONTAS NOVAS — nenhuma conta já cadastrada teve seu
-- `paginas_permitidas` atualizado. Como toda conta ativa neste ambiente já
-- tem essa lista restrita (nenhuma está com o valor null = "sem
-- restrição"), a aba não aparecia pra ninguém que não fosse admin. Este
-- backfill corrige isso adicionando '/pdi' a quem ainda não tem.
--
-- Aplicado diretamente no projeto Supabase em 2026-09-17; este arquivo
-- só documenta a mudança (idempotente — não faz nada se já aplicado).
update colaboradores
set paginas_permitidas = array_append(paginas_permitidas, '/pdi')
where paginas_permitidas is not null
  and not (paginas_permitidas @> array['/pdi']);
