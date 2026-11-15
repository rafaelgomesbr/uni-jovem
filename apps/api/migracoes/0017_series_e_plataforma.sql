-- 0017: encerramento de série, painel de saúde e auditoria da plataforma, e a
-- lista de vínculos da intervenção com o nome da pessoa. Segue o padrão do
-- cabeçalho de 0001.

-- ================================================================ séries encerradas

-- Encerrar a série a partir do primeiro dia (ou antes) não cabe em `fim_em`
-- (o CHECK exige fim_em >= inicio_em): a série ganha estado próprio. Encerrada,
-- ela não volta a ficar ativa e não recebe ocorrência nova; o histórico fica.
alter table uj.series
  add column estado text not null default 'ativa' check (estado in ('ativa', 'encerrada')),
  add column encerrada_em timestamptz,
  add constraint series_estado_coerente check ((estado = 'encerrada') = (encerrada_em is not null));

-- UJ070: série encerrada. Outras colunas continuam alteráveis (a troca de
-- autoria ao sair da comunidade, em 0012, mexe em criado_por).
create function uj.guardar_serie_encerrada() returns trigger
  language plpgsql
  as $$
begin
  if old.estado = 'encerrada'
     and (new.estado is distinct from old.estado or new.encerrada_em is distinct from old.encerrada_em) then
    raise exception 'serie encerrada' using errcode = 'UJ070';
  end if;
  return new;
end
$$;
create trigger series_encerrada before update on uj.series
  for each row execute function uj.guardar_serie_encerrada();

-- Nenhuma ocorrência nova (nem ocorrência movida) para uma série encerrada,
-- venha da rota, do job de materialização ou de quem for.
create function uj.exigir_serie_ativa() returns trigger
  language plpgsql security definer
  set search_path = pg_catalog, uj
  as $$
begin
  if exists (select 1 from uj.series where id = new.serie_id and estado = 'encerrada') then
    raise exception 'serie encerrada' using errcode = 'UJ070';
  end if;
  return new;
end
$$;
create trigger eventos_serie_ativa before insert or update of serie_id on uj.eventos
  for each row when (new.serie_id is not null) execute function uj.exigir_serie_ativa();

-- ================================================================ saúde da plataforma

-- Números agregados para o Criador acompanhar a operação, sem nenhum conteúdo
-- nem identificador de pessoa: comunidades por estado, contas ativas, eventos
-- do mês, cotas do dia por finalidade e a fila de push. Sem a prova de 2FA
-- (eh_proprietario), devolve nulo.
--
-- Cotas: cada finalidade com o seu limite (os mesmos de 0015 e 0011). Quando a
-- cota é por pessoa, comunidade ou convite, vem o maior uso do dia e quantas
-- chaves passaram de 80% do limite (o aviso do painel).
create function uj.saude_da_plataforma() returns jsonb
  language plpgsql stable security definer
  set search_path = pg_catalog, uj
  as $$
declare
  local_agora timestamp := now() at time zone 'America/Sao_Paulo';
  hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  inicio_do_mes timestamptz := date_trunc('month', local_agora) at time zone 'America/Sao_Paulo';
  fim_do_mes timestamptz :=
    (date_trunc('month', local_agora) + interval '1 month') at time zone 'America/Sao_Paulo';
begin
  if not uj.eh_proprietario() then
    return null;
  end if;
  return jsonb_build_object(
    'geradoEm', now(),
    'comunidadesPorEstado', (
      select coalesce(jsonb_object_agg(estado, n), '{}'::jsonb)
        from (select estado, count(*)::int as n from uj.comunidades group by estado) x),
    'contasAtivas', (select count(*)::int from uj.contas where estado = 'ativa'),
    'eventosDoMes', (
      select jsonb_build_object(
               'total', coalesce(sum(n), 0)::int,
               'porStatus', coalesce(jsonb_object_agg(status, n), '{}'::jsonb))
        from (select status, count(*)::int as n from uj.eventos
               where inicio >= inicio_do_mes and inicio < fim_do_mes group by status) x),
    'cotas', (
      with limites (familia, global, limite) as (
        values ('email:convite', true, 60),
               ('email:recuperacao', true, 30),
               ('email:convite_por_convite', false, 15),
               ('push_por_pessoa', false, uj.limite_diario_de_push()),
               ('push_critico_por_pessoa', false, uj.limite_diario_de_push_critico()),
               ('avisos_por_hora', false, uj.limite_de_avisos_por_hora()),
               ('exportacoes_por_conta', false, 20),
               ('exportacao_bytes_por_comunidade', false, 50000000)),
      usos as (
        select case
                 when chave in ('email:convite', 'email:recuperacao') then chave
                 when chave like 'email:convite:%' then 'email:convite_por_convite'
                 when chave like 'push-critico:%' then 'push_critico_por_pessoa'
                 when chave like 'push:%' then 'push_por_pessoa'
                 when chave like 'avisos:%' then 'avisos_por_hora'
                 when chave like 'exportacao:conta:%' then 'exportacoes_por_conta'
                 when chave like 'exportacao:bytes:%' then 'exportacao_bytes_por_comunidade'
               end as familia,
               quantidade
          from uj.cotas_diarias where dia = hoje),
      por_familia as (
        select l.familia, l.global, l.limite,
               coalesce(max(u.quantidade), 0) as maior_uso,
               count(u.quantidade)::int as chaves,
               -- 80% do limite, sem arredondamento: uso * 5 >= limite * 4.
               (count(u.quantidade) filter (where u.quantidade::bigint * 5 >= l.limite::bigint * 4))::int
                 as chaves_acima_de_80
          from limites l left join usos u on u.familia = l.familia
         group by l.familia, l.global, l.limite)
      select jsonb_agg(jsonb_build_object(
               'cota', familia,
               'global', global,
               'limite', limite,
               'maiorUso', maior_uso,
               'chaves', chaves,
               'chavesAcimaDe80', chaves_acima_de_80)
             order by familia)
        from por_familia),
    'filaDePush', (
      select jsonb_build_object(
               'pendentes', count(*) filter (where e.estado in ('pendente', 'enviando')),
               'pendenteMaisAntigoEm', min(n.criado_em) filter (where e.estado in ('pendente', 'enviando')),
               'enviados24h', count(*) filter (where e.estado = 'enviado'
                                                 and e.enviado_em > now() - interval '24 hours'),
               'falhas24h', count(*) filter (where e.estado = 'falhou'
                                               and n.criado_em > now() - interval '24 hours'),
               'descartados24h', count(*) filter (where e.estado = 'descartado'
                                                    and n.criado_em > now() - interval '24 hours'))
        from uj.envios_push e join uj.notificacoes n on n.id = e.notificacao_id
       where e.estado in ('pendente', 'enviando') or n.criado_em > now() - interval '24 hours'));
end
$$;

-- ================================================================ auditoria da plataforma

-- Só os eventos de plataforma (ações do Criador e da transferência de
-- propriedade), de todas as comunidades. Nada de 'conta.*', 'sessao.*' nem
-- 'oracao.*': ações de pessoas não são assunto do painel da plataforma.
create index auditoria_plataforma on uj.auditoria (id desc)
  where acao like 'plataforma.%' or acao like 'criador.%';

create function uj.auditoria_da_plataforma(p_antes bigint, p_limite int)
  returns table (id bigint, momento timestamptz, conta_id uuid, comunidade_id uuid,
                 comunidade_nome text, acao text, recurso_tipo text, recurso_id text,
                 detalhes jsonb)
  language sql stable security definer
  set search_path = pg_catalog, uj
  as $$
    select a.id, a.momento, a.conta_id, a.comunidade_id, m.nome, a.acao, a.recurso_tipo,
           a.recurso_id, a.detalhes
      from uj.auditoria a
      left join uj.comunidades m on m.id = a.comunidade_id
     where uj.eh_proprietario()
       and (a.acao like 'plataforma.%' or a.acao like 'criador.%')
       and (p_antes is null or a.id < p_antes)
     order by a.id desc
     limit least(greatest(coalesce(p_limite, 50), 1), 100)
  $$;

-- ================================================================ intervenção: quem é quem

-- O Criador não tem vínculo na comunidade em que intervém, então
-- `pessoas_da_comunidade()` não lhe responde. Aqui ele vê o NOME, o papel e o
-- estado de cada vínculo (para escolher quem nomear), nunca e-mail ou WhatsApp.
create function uj.vinculos_para_intervencao(p_comunidade uuid)
  returns table (vinculo_id uuid, nome text, papel text, estado text, desde timestamptz)
  language sql stable security definer
  set search_path = pg_catalog, uj
  as $$
    select v.id,
           case when a.estado = 'anonimizada' then 'Pessoa removida' else a.nome end,
           v.papel, v.estado, v.criado_em
      from uj.vinculos v
      join uj.contas a on a.id = v.conta_id
     where v.comunidade_id = p_comunidade
       and uj.eh_proprietario()
     order by v.papel, v.criado_em
  $$;

-- ================================================================ privilégios

revoke execute on all functions in schema uj from public;
grant update (estado, encerrada_em) on uj.series to uj_api;
grant execute on function uj.saude_da_plataforma(), uj.auditoria_da_plataforma(bigint, int),
  uj.vinculos_para_intervencao(uuid)
  to uj_api;
