-- 0020: caixa de entrada das notificações (o sino do app, D42).
--
--   * A fila de 0011 já é o registro do que aconteceu com cada pessoa (texto
--     genérico, 30 dias, apagado ao sair da comunidade). A caixa só acrescenta
--     `lida_em` e uma leitura DA CONTA, sem comunidade no contexto, para listar
--     todas as comunidades de uma vez.
--   * A pessoa só vê as próprias notificações e só das comunidades em que tem
--     vínculo ativo, com a conta ativa e a comunidade ativa ou suspensa. Saiu,
--     foi removida ou desativada: as daquela comunidade somem na hora, mesmo
--     antes do expurgo.
--   * O papel do aplicativo só grava `lida_em`; título, texto e destinatário
--     continuam só dos gatilhos.
--   * O destino (a tela que a notificação abre) é resolvido por uma função que
--     confere de novo que a notificação é da conta: com um id qualquer, ela não
--     revela nada.

alter table uj.notificacoes add column lida_em timestamptz;

-- Página da caixa: (conta, criado_em desc, id desc), na ordem do cursor.
create index notificacoes_caixa on uj.notificacoes (conta_id, criado_em desc, id desc);
-- Contador do sino: só as não lidas.
create index notificacoes_nao_lidas on uj.notificacoes (conta_id) where lida_em is null;

-- Comunidades cujas notificações a conta do contexto pode ver. Avaliada uma
-- vez por consulta nas políticas, pelo "(select ...)".
create function uj.comunidades_da_caixa() returns uuid[]
  language sql stable security definer
  set search_path = pg_catalog, uj
  as $$
    select coalesce(array_agg(v.comunidade_id), '{}'::uuid[])
      from uj.vinculos v
      join uj.contas a on a.id = v.conta_id
      join uj.comunidades c on c.id = v.comunidade_id
     where v.conta_id = uj.conta_atual()
       and v.estado = 'ativo' and a.estado = 'ativa'
       and c.estado in ('ativa', 'suspensa')
  $$;

create policy notificacoes_caixa on uj.notificacoes for select to uj_api
  using (conta_id = (select uj.conta_atual())
         and comunidade_id = any ((select uj.comunidades_da_caixa())::uuid[]));
create policy notificacoes_marcar_lida on uj.notificacoes for update to uj_api
  using (conta_id = (select uj.conta_atual())
         and comunidade_id = any ((select uj.comunidades_da_caixa())::uuid[]))
  with check (conta_id = (select uj.conta_atual())
              and comunidade_id = any ((select uj.comunidades_da_caixa())::uuid[]));

-- O que a notificação abre. Aviso: só se ainda estiver publicado. Evento e
-- inscrição: o evento, se ainda existir na mesma comunidade. Escala e
-- substituição abrem a tela de escalas e não precisam de id. Nulo quando a
-- notificação não é da conta (ou sumiu) ou o alvo não existe mais.
create function uj.alvo_da_notificacao(p_notificacao uuid) returns uuid
  language sql stable security definer
  set search_path = pg_catalog, uj
  as $$
    select case n.recurso_tipo
             when 'aviso' then
               (select a.id from uj.avisos a
                 where a.id = n.recurso_id and a.comunidade_id = n.comunidade_id
                   and a.estado = 'publicado')
             when 'evento' then
               (select e.id from uj.eventos e
                 where e.id = n.recurso_id and e.comunidade_id = n.comunidade_id
                   and e.status <> 'rascunho')
             when 'inscricao' then
               (select e.id from uj.inscricoes i join uj.eventos e on e.id = i.evento_id
                 where i.id = n.recurso_id and e.comunidade_id = n.comunidade_id
                   and e.status <> 'rascunho')
           end
      from uj.notificacoes n
     where n.id = p_notificacao
       and n.conta_id = uj.conta_atual()
       and n.comunidade_id = any (uj.comunidades_da_caixa())
  $$;

grant execute on function uj.comunidades_da_caixa(), uj.alvo_da_notificacao(uuid) to uj_api;
grant select (lida_em), update (lida_em) on uj.notificacoes to uj_api;
