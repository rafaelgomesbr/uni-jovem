-- 0014: tarefas diárias de retenção (F18, mapa-de-dados.md seção 10, item 7).
-- Rodam com a conexão do DONO (apps/api/src/cli/tarefas-diarias.ts). Nenhuma
-- delas é executável pelos papéis do aplicativo. Cada função devolve só
-- contagens: o relatório do job nunca leva dado pessoal (PRIV-05).

-- Inscrições públicas e presenças avulsas vencidas (P3): nome genérico, sem contato.
create or replace function uj.anonimizar_inscricoes_vencidas() returns int
  language plpgsql security definer
  set search_path = pg_catalog, uj
  as $$
declare
  n int;
begin
  update uj.inscricoes i
     set nome = 'Participante', telefone = null, email = null, token_cancelamento_hash = null,
         anonimizada_em = now()
    from uj.eventos e, uj.comunidades c
   where e.id = i.evento_id and c.id = e.comunidade_id
     and i.origem = 'publica' and i.anonimizada_em is null
     and e.inicio + make_interval(days => c.retencao_inscricoes_dias) < now();
  get diagnostics n = row_count;
  return n;
end
$$;

create function uj.anonimizar_presencas_avulsas_vencidas() returns int
  language plpgsql security definer
  set search_path = pg_catalog, uj
  as $$
declare
  n int;
begin
  update uj.presencas p set nome_avulso = 'Participante'
    from uj.eventos e, uj.comunidades c
   where e.id = p.evento_id and c.id = e.comunidade_id
     and p.nome_avulso is not null and p.nome_avulso <> 'Participante'
     and e.inicio + make_interval(days => c.retencao_inscricoes_dias) < now();
  get diagnostics n = row_count;
  return n;
end
$$;

-- Todas as retenções de linha, numa transação. Prazos do mapa de dados.
create function uj.executar_retencao() returns jsonb
  language plpgsql security definer
  set search_path = pg_catalog, uj
  as $$
declare
  r jsonb := '{}'::jsonb;
  n int;
  v record;
begin
  r := r || jsonb_build_object('inscricoes_anonimizadas', uj.anonimizar_inscricoes_vencidas());
  r := r || jsonb_build_object('presencas_avulsas_anonimizadas', uj.anonimizar_presencas_avulsas_vencidas());
  r := r || jsonb_build_object('exportacoes_expurgadas', uj.expurgar_exportacoes_vencidas());

  -- Sessões revogadas ou vencidas há 30 dias. Linhas só substituídas ficam até
  -- vencer: são elas que denunciam o reuso de um refresh antigo.
  delete from uj.sessoes
   where coalesce(revogada_em, expira_em) < now() - interval '30 days'
      or expira_em < now() - interval '30 days';
  get diagnostics n = row_count;
  r := r || jsonb_build_object('sessoes_apagadas', n);

  -- Aparelho de notificação sem nenhuma sessão viva na família.
  delete from uj.aparelhos_push a
   where not exists (select 1 from uj.sessoes s
                      where s.familia = a.familia and s.revogada_em is null and s.expira_em > now());
  get diagnostics n = row_count;
  r := r || jsonb_build_object('aparelhos_sem_sessao_apagados', n);

  delete from uj.recuperacoes_senha
   where expira_em < now() - interval '24 hours' or usado_em < now() - interval '24 hours';
  get diagnostics n = row_count;
  r := r || jsonb_build_object('links_de_senha_apagados', n);

  delete from uj.verificacoes_email
   where expira_em < now() - interval '24 hours' or consumido_em < now() - interval '24 hours';
  get diagnostics n = row_count;
  r := r || jsonb_build_object('codigos_de_verificacao_apagados', n);

  delete from uj.provas_de_plataforma where expira_em < now() - interval '24 hours';
  get diagnostics n = row_count;
  r := r || jsonb_build_object('provas_de_2fa_apagadas', n);

  -- E-mail de destino de convite encerrado há 30 dias (vencido, esgotado ou revogado).
  update uj.convites set email_destino = null
   where email_destino is not null
     and (expira_em < now() - interval '30 days'
          or revogado_em < now() - interval '30 days'
          or (usos >= usos_maximos and ultimo_uso_em < now() - interval '30 days'));
  get diagnostics n = row_count;
  r := r || jsonb_build_object('convites_sem_email', n);

  delete from uj.cotas_diarias where dia < (now() at time zone 'America/Sao_Paulo')::date - 30;
  get diagnostics n = row_count;
  r := r || jsonb_build_object('cotas_apagadas', n);

  delete from uj.disponibilidades where data < current_date - interval '6 months';
  get diagnostics n = row_count;
  r := r || jsonb_build_object('disponibilidades_apagadas', n);

  delete from uj.notificacoes where criado_em < now() - interval '30 days';
  get diagnostics n = row_count;
  r := r || jsonb_build_object('notificacoes_apagadas', n);

  -- Idempotência offline: acima da validade offline máxima (30 dias).
  delete from uj.sync_operacoes where criado_em < now() - interval '45 days';
  get diagnostics n = row_count;
  r := r || jsonb_build_object('operacoes_offline_apagadas', n);

  -- Remoção pelo administrador não desfeita em 30 dias: efeito do caso 2.
  n := 0;
  for v in select id from uj.vinculos
            where estado = 'removido' and anonimizado_em is null
              and removido_em < now() - interval '30 days' loop
    perform uj.desligar_vinculo(v.id, true);
    n := n + 1;
  end loop;
  r := r || jsonb_build_object('vinculos_removidos_desligados', n);

  return r;
end
$$;

-- Poda do log de mudanças: mais de `p_dias` dias E só abaixo da marca d'água
-- (transações já terminadas), para nunca cortar o que um cursor ainda não viu.
-- O maior (xact, id) podado vira o marco: cursor anterior a ele recomeça.
create function uj.podar_mudancas(p_dias int) returns int
  language plpgsql security definer
  set search_path = pg_catalog, uj
  as $$
declare
  limite xid8 := pg_snapshot_xmin(pg_current_snapshot());
  ultimo record;
  n int;
begin
  if p_dias < 31 then
    raise exception 'prazo menor que a validade offline maxima' using errcode = '22023';
  end if;
  select xact, id into ultimo from uj.mudancas
   where momento < now() - make_interval(days => p_dias) and xact < limite
   order by xact desc, id desc limit 1;
  if not found then
    return 0;
  end if;
  delete from uj.mudancas
   where momento < now() - make_interval(days => p_dias) and xact < limite;
  get diagnostics n = row_count;
  insert into uj.marco_de_sincronizacao (id, podado_ate_xact, podado_ate_id)
    values (1, ultimo.xact, ultimo.id)
    on conflict (id) do update
      set podado_ate_xact = greatest(uj.marco_de_sincronizacao.podado_ate_xact, excluded.podado_ate_xact),
          podado_ate_id = case when excluded.podado_ate_xact >= uj.marco_de_sincronizacao.podado_ate_xact
                               then excluded.podado_ate_id else uj.marco_de_sincronizacao.podado_ate_id end,
          podado_em = now();
  return n;
end
$$;

revoke execute on all functions in schema uj from public;
