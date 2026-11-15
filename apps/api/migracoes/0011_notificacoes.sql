-- 0011: notificações push (F14). Segue o padrão do cabeçalho de 0001.
--
-- DESENHO
--   * Enfileiramento NO BANCO, na mesma transação do fato (gatilhos abaixo):
--     aviso publicado, evento cancelado ou adiado, escala atribuída, pedido e
--     aceite de substituição, inscrição promovida da lista de espera. Nada se
--     perde se o processo cair entre o commit e o envio, e o papel do
--     aplicativo não tem como enfileirar nada por conta própria (sem INSERT).
--   * Destinatários saem SEMPRE da própria comunidade do fato, e a função de
--     enfileirar confere vínculo ativo, conta ativa, comunidade ativa e
--     preferência (por tipo e por comunidade). Quem agiu não é avisado.
--   * Texto seguro para a tela bloqueada: genérico, sem nome de comunidade,
--     sem título de evento ou aviso e nunca com pedido de oração (não há
--     gatilho de oração). Nome de pessoa só no pedido de substituição dirigido,
--     em que ele é necessário para a ação (plano, seção 8).
--   * Deduplicação por (destinatário, tipo, recurso, janela de 1 h) e limite
--     diário por pessoa (uj.cotas_diarias, chave 'push:<conta>').
--   * Um envio por aparelho (envios_push), apagado em cascata com o aparelho:
--     sair da conta ou revogar a sessão apaga o aparelho, e o que estava na fila
--     para ele some junto.
--   * O trabalhador (processo da API, papel uj_auth) só usa push_reservar e
--     push_concluir, que revalidam vínculo, preferência e sessão no envio.

-- ---------------------------------------------------------------- aparelhos

-- Um token por família de sessões (o aparelho). Sem comunidade: é identidade.
create table uj.aparelhos_push (
  id uuid primary key default gen_random_uuid(),
  conta_id uuid not null references uj.contas (id),
  familia uuid not null unique,
  plataforma text not null check (plataforma in ('ios', 'android')),
  token text not null unique check (length(token) between 16 and 4096 and token ~ '^[A-Za-z0-9:_.-]+$'),
  ambiente_apns text check (ambiente_apns in ('producao', 'sandbox')),
  criado_em timestamptz not null default now(),
  check ((plataforma = 'ios') = (ambiente_apns is not null))
);
create index aparelhos_push_conta on uj.aparelhos_push (conta_id);

-- ---------------------------------------------------------------- preferências

-- Ausência de linha = ligado. 'todos' desliga a comunidade inteira.
create table uj.preferencias_notificacao (
  id uuid primary key default gen_random_uuid(),
  comunidade_id uuid not null references uj.comunidades (id),
  conta_id uuid not null references uj.contas (id),
  tipo text not null check (tipo in ('todos', 'eventos', 'escalas', 'inscricoes', 'tarefas',
                                     'substituicoes', 'alteracoes_importantes', 'avisos')),
  ativo boolean not null,
  atualizado_em timestamptz not null default now(),
  unique (comunidade_id, conta_id, tipo)
);
create index preferencias_notificacao_conta on uj.preferencias_notificacao (conta_id);

-- Preferências da CONTA (valem em todas as comunidades e aparelhos). O
-- versículo é agendado no aparelho; aqui só fica a escolha, para que ela
-- acompanhe a pessoa entre aparelhos e nunca duplique com duas comunidades.
create table uj.preferencias_conta (
  conta_id uuid primary key references uj.contas (id),
  versiculo_ativo boolean not null default true,
  versiculo_hora text not null default '07:00' check (versiculo_hora ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  atualizado_em timestamptz not null default now()
);

-- ---------------------------------------------------------------- fila

create table uj.notificacoes (
  id uuid primary key default gen_random_uuid(),
  comunidade_id uuid not null references uj.comunidades (id),
  conta_id uuid not null references uj.contas (id),
  tipo text not null check (tipo in ('eventos', 'escalas', 'inscricoes', 'tarefas',
                                     'substituicoes', 'alteracoes_importantes', 'avisos')),
  recurso_tipo text not null check (recurso_tipo ~ '^[a-z_]{1,40}$'),
  recurso_id uuid not null,
  titulo text not null check (length(titulo) between 1 and 80),
  corpo text not null check (length(corpo) between 1 and 200),
  chave_dedup text not null unique,
  criado_em timestamptz not null default now()
);
create index notificacoes_comunidade on uj.notificacoes (comunidade_id, conta_id, criado_em desc);
create index notificacoes_conta on uj.notificacoes (conta_id, tipo, recurso_id, criado_em desc);

create table uj.envios_push (
  id bigint generated always as identity primary key,
  notificacao_id uuid not null references uj.notificacoes (id) on delete cascade,
  aparelho_id uuid not null references uj.aparelhos_push (id) on delete cascade,
  estado text not null default 'pendente'
    check (estado in ('pendente', 'enviando', 'enviado', 'falhou', 'descartado')),
  tentativas int not null default 0 check (tentativas >= 0),
  proxima_em timestamptz not null default now(),
  reservado_ate timestamptz,
  enviado_em timestamptz,
  erro text check (length(erro) <= 120)
);
create index envios_push_pendentes on uj.envios_push (proxima_em) where estado in ('pendente', 'enviando');
create index envios_push_notificacao on uj.envios_push (notificacao_id);
create index envios_push_aparelho on uj.envios_push (aparelho_id);

-- ---------------------------------------------------------------- log de mudanças

-- Preferências e notificações só interessam à própria pessoa.
create function uj.registrar_mudanca_de_preferencia() returns trigger
  language plpgsql security definer
  set search_path = pg_catalog, uj
  as $$
declare
  linha record;
begin
  if tg_op = 'DELETE' then linha := old; else linha := new; end if;
  insert into uj.mudancas (comunidade_id, tabela, registro_id, operacao, conta_alvo)
    values (linha.comunidade_id, tg_table_name, linha.id, left(tg_op, 1), linha.conta_id);
  return null;
end
$$;
create trigger preferencias_notificacao_mudanca after insert or update or delete
  on uj.preferencias_notificacao
  for each row execute function uj.registrar_mudanca_de_preferencia();
create trigger notificacoes_mudanca after insert or delete on uj.notificacoes
  for each row execute function uj.registrar_mudanca_de_preferencia();

-- ---------------------------------------------------------------- regras de envio

-- A conta pode receber notificação deste tipo nesta comunidade agora?
create function uj.notificacao_permitida(p_conta uuid, p_comunidade uuid, p_tipo text)
  returns boolean
  language sql stable security definer
  set search_path = pg_catalog, uj
  as $$
    select exists (
             select 1 from uj.vinculos v
               join uj.contas a on a.id = v.conta_id
               join uj.comunidades c on c.id = v.comunidade_id
              where v.conta_id = p_conta and v.comunidade_id = p_comunidade
                and v.estado = 'ativo' and a.estado = 'ativa' and c.estado = 'ativa')
       and not exists (
             select 1 from uj.preferencias_notificacao p
              where p.conta_id = p_conta and p.comunidade_id = p_comunidade
                and p.tipo in ('todos', p_tipo) and not p.ativo)
  $$;

-- Limite diário de notificações por pessoa (todas as comunidades somadas).
create function uj.limite_diario_de_push() returns int
  language sql immutable
  as $$ select 30 $$;

-- Enfileira para UMA conta. Só chamada pelos gatilhos (sem EXECUTE para o app).
create function uj.enfileirar_notificacao(p_comunidade uuid, p_conta uuid, p_tipo text,
                                          p_recurso_tipo text, p_recurso uuid,
                                          p_titulo text, p_corpo text) returns void
  language plpgsql security definer
  set search_path = pg_catalog, uj
  as $$
declare
  chave text;
  nova uuid;
begin
  if p_conta is null or p_conta is not distinct from uj.conta_atual() then
    return;
  end if;
  if not uj.notificacao_permitida(p_conta, p_comunidade, p_tipo) then
    return;
  end if;
  -- Janela deslizante de 1 h para o mesmo recurso; a chave única segura a corrida.
  if exists (select 1 from uj.notificacoes n
              where n.conta_id = p_conta and n.tipo = p_tipo and n.recurso_id = p_recurso
                and n.criado_em > now() - interval '1 hour') then
    return;
  end if;
  chave := p_conta::text || ':' || p_tipo || ':' || p_recurso::text || ':'
           || floor(extract(epoch from now()) / 3600)::bigint::text;
  if not uj.consumir_cota('push:' || p_conta::text, uj.limite_diario_de_push()) then
    return;
  end if;
  insert into uj.notificacoes (comunidade_id, conta_id, tipo, recurso_tipo, recurso_id, titulo,
                               corpo, chave_dedup)
    values (p_comunidade, p_conta, p_tipo, p_recurso_tipo, p_recurso, p_titulo, p_corpo, chave)
    on conflict (chave_dedup) do nothing
  returning id into nova;
  if nova is null then
    return;
  end if;
  insert into uj.envios_push (notificacao_id, aparelho_id)
    select nova, a.id from uj.aparelhos_push a where a.conta_id = p_conta;
end
$$;

-- ---------------------------------------------------------------- gatilhos (os "ganchos")

create function uj.notificar_aviso() returns trigger
  language plpgsql security definer
  set search_path = pg_catalog, uj
  as $$
declare
  r record;
begin
  if new.estado = 'publicado' and (tg_op = 'INSERT' or old.estado <> 'publicado') then
    for r in select v.conta_id from uj.vinculos v
              where v.comunidade_id = new.comunidade_id and v.estado = 'ativo' loop
      perform uj.enfileirar_notificacao(new.comunidade_id, r.conta_id, 'avisos', 'aviso', new.id,
        'Novo aviso', 'Há um aviso novo na sua comunidade. Abra o app para ler.');
    end loop;
  end if;
  return null;
end
$$;
create trigger avisos_notificar after insert or update of estado on uj.avisos
  for each row execute function uj.notificar_aviso();

-- Quem participa de um evento: escalados e membros inscritos (não cancelados).
create function uj.contas_do_evento(p_evento uuid) returns table (conta_id uuid)
  language sql stable security definer
  set search_path = pg_catalog, uj
  as $$
    select distinct v.conta_id from uj.atribuicoes a join uj.vinculos v on v.id = a.vinculo_id
     where a.evento_id = p_evento
    union
    select distinct v.conta_id from uj.inscricoes i join uj.vinculos v on v.id = i.vinculo_id
     where i.evento_id = p_evento and i.origem = 'membro' and i.estado <> 'cancelada'
  $$;

create function uj.notificar_evento() returns trigger
  language plpgsql security definer
  set search_path = pg_catalog, uj
  as $$
declare
  r record;
begin
  if new.status is not distinct from old.status then
    return null;
  end if;
  if new.status in ('cancelado', 'adiado') and old.status <> 'rascunho' then
    for r in select conta_id from uj.contas_do_evento(new.id) loop
      perform uj.enfileirar_notificacao(new.comunidade_id, r.conta_id, 'alteracoes_importantes',
        'evento', new.id,
        case new.status when 'cancelado' then 'Evento cancelado' else 'Evento adiado' end,
        case new.status
          when 'cancelado' then 'Um evento de que você participa foi cancelado. Abra o app para ver o motivo.'
          else 'Um evento de que você participa foi adiado. Abra o app para ver os detalhes.' end);
    end loop;
  elsif new.status = 'publicado' and old.status = 'rascunho' and new.inicio > now() then
    -- Escalas feitas no rascunho só são anunciadas quando o evento é publicado.
    for r in select a.id, v.conta_id from uj.atribuicoes a join uj.vinculos v on v.id = a.vinculo_id
              where a.evento_id = new.id loop
      perform uj.enfileirar_notificacao(new.comunidade_id, r.conta_id, 'escalas', 'atribuicao', r.id,
        'Nova escala', 'Você foi escalado para um evento. Abra o app para confirmar.');
    end loop;
  end if;
  return null;
end
$$;
create trigger eventos_notificar after update of status on uj.eventos
  for each row execute function uj.notificar_evento();

create function uj.notificar_atribuicao() returns trigger
  language plpgsql security definer
  set search_path = pg_catalog, uj
  as $$
begin
  if (tg_op = 'INSERT' or new.vinculo_id <> old.vinculo_id)
     and exists (select 1 from uj.eventos e
                  where e.id = new.evento_id and e.status = 'publicado' and e.inicio > now()) then
    perform uj.enfileirar_notificacao(new.comunidade_id,
      (select conta_id from uj.vinculos where id = new.vinculo_id), 'escalas', 'atribuicao', new.id,
      'Nova escala', 'Você foi escalado para um evento. Abra o app para confirmar.');
  end if;
  return null;
end
$$;
create trigger atribuicoes_notificar after insert or update of vinculo_id on uj.atribuicoes
  for each row execute function uj.notificar_atribuicao();

create function uj.primeiro_nome_do_vinculo(p_vinculo uuid) returns text
  language sql stable security definer
  set search_path = pg_catalog, uj
  as $$
    select case when a.estado = 'anonimizada' then 'Alguém'
                else left(split_part(btrim(a.nome), ' ', 1), 30) end
      from uj.vinculos v join uj.contas a on a.id = v.conta_id where v.id = p_vinculo
  $$;

create function uj.notificar_substituicao() returns trigger
  language plpgsql security definer
  set search_path = pg_catalog, uj
  as $$
declare
  r record;
  ev uuid;
  avisados int := 0;
begin
  if tg_op = 'INSERT' then
    if new.para_vinculo_id is not null then
      -- Dirigido: o nome de quem pede é necessário para a pessoa decidir.
      perform uj.enfileirar_notificacao(new.comunidade_id,
        (select conta_id from uj.vinculos where id = new.para_vinculo_id), 'substituicoes',
        'substituicao', new.id, 'Pedido de substituição',
        coalesce(uj.primeiro_nome_do_vinculo(new.pedida_por), 'Alguém')
          || ' pediu para você assumir uma escala. Abra o app para responder.');
    else
      select evento_id into ev from uj.atribuicoes where id = new.atribuicao_id;
      for r in select distinct v.conta_id from uj.atribuicoes a join uj.vinculos v on v.id = a.vinculo_id
                where a.evento_id = ev and a.vinculo_id <> new.pedida_por and v.estado = 'ativo' loop
        perform uj.enfileirar_notificacao(new.comunidade_id, r.conta_id, 'substituicoes',
          'substituicao', new.id, 'Pedido de substituição',
          'Alguém da equipe pediu substituição numa escala. Veja se você pode assumir.');
        avisados := avisados + 1;
      end loop;
      -- Equipe vazia: avisa quem organiza.
      if avisados = 0 then
        for r in select v.conta_id from uj.vinculos v
                  where v.comunidade_id = new.comunidade_id and v.estado = 'ativo'
                    and v.papel in ('organizador', 'admin') and v.id <> new.pedida_por loop
          perform uj.enfileirar_notificacao(new.comunidade_id, r.conta_id, 'substituicoes',
            'substituicao', new.id, 'Pedido de substituição',
            'Há um pedido de substituição numa escala sem ninguém para assumir.');
        end loop;
      end if;
    end if;
  elsif new.estado = 'assumida' and old.estado <> 'assumida' then
    perform uj.enfileirar_notificacao(new.comunidade_id,
      (select conta_id from uj.vinculos where id = new.pedida_por), 'substituicoes',
      'substituicao', new.id, 'Substituição aceita',
      'Alguém assumiu a escala que você pediu para trocar.');
  end if;
  return null;
end
$$;
create trigger substituicoes_notificar after insert or update of estado on uj.substituicoes
  for each row execute function uj.notificar_substituicao();

create function uj.notificar_inscricao() returns trigger
  language plpgsql security definer
  set search_path = pg_catalog, uj
  as $$
begin
  if new.origem = 'membro' and old.promovida_em is null and new.promovida_em is not null
     and new.estado = 'confirmada' then
    perform uj.enfileirar_notificacao(new.comunidade_id,
      (select conta_id from uj.vinculos where id = new.vinculo_id), 'inscricoes', 'inscricao', new.id,
      'Vaga confirmada', 'Abriu uma vaga e sua inscrição num evento foi confirmada.');
  end if;
  return null;
end
$$;
create trigger inscricoes_notificar after update of promovida_em on uj.inscricoes
  for each row execute function uj.notificar_inscricao();

-- ---------------------------------------------------------------- aparelhos: registro e silêncio

-- Registra o token do aparelho da sessão atual. O mesmo token em outra conta
-- (aparelho que trocou de dono) é removido de lá: notificação de uma conta
-- nunca chega ao aparelho de outra.
create function uj.registrar_aparelho_push(p_sessao uuid, p_token text, p_plataforma text,
                                           p_ambiente text) returns uuid
  language plpgsql security definer
  set search_path = pg_catalog, uj
  as $$
declare
  f uuid;
  novo uuid;
begin
  select s.familia into f from uj.sessoes s
   where s.id = p_sessao and s.conta_id = uj.conta_atual()
     and s.revogada_em is null and s.expira_em > now();
  if f is null then
    raise exception 'sessao invalida' using errcode = '42501';
  end if;
  delete from uj.aparelhos_push where token = p_token or familia = f;
  insert into uj.aparelhos_push (conta_id, familia, plataforma, token, ambiente_apns)
    values (uj.conta_atual(), f, p_plataforma, p_token,
            case when p_plataforma = 'ios' then coalesce(p_ambiente, 'producao') end)
  returning id into novo;
  return novo;
end
$$;

-- Sessão revogada (sair, revogar aparelho, senha redefinida, reuso de refresh):
-- o aparelho daquela família deixa de receber na hora.
create function uj.silenciar_aparelho() returns trigger
  language plpgsql security definer
  set search_path = pg_catalog, uj
  as $$
begin
  if new.revogada_em is not null and old.revogada_em is null then
    delete from uj.aparelhos_push where familia = new.familia;
  end if;
  return null;
end
$$;
create trigger sessoes_silenciar after update of revogada_em on uj.sessoes
  for each row execute function uj.silenciar_aparelho();

-- ---------------------------------------------------------------- trabalhador (uj_auth)

create function uj.push_reservar(p_lote int, p_reserva_s int)
  returns table (envio_id bigint, para_token text, para_plataforma text, para_ambiente text,
                 texto_titulo text, texto_corpo text, dados jsonb)
  language plpgsql security definer
  set search_path = pg_catalog, uj
  as $$
begin
  -- Revalida no envio: aparelho sem sessão viva, vínculo encerrado, preferência
  -- desligada depois do enfileiramento ou notificação velha não saem mais.
  update uj.envios_push e set estado = 'descartado', reservado_ate = null
    from uj.notificacoes n, uj.aparelhos_push a
   where n.id = e.notificacao_id and a.id = e.aparelho_id
     and e.estado = 'pendente' and e.proxima_em <= now()
     and (a.conta_id <> n.conta_id
          or n.criado_em < now() - interval '24 hours'
          or not uj.notificacao_permitida(n.conta_id, n.comunidade_id, n.tipo)
          or not exists (select 1 from uj.sessoes s
                          where s.familia = a.familia and s.conta_id = a.conta_id
                            and s.revogada_em is null and s.expira_em > now()));
  return query
    with escolhidos as (
      select x.id from uj.envios_push x
       where (x.estado = 'pendente' and x.proxima_em <= now())
          or (x.estado = 'enviando' and x.reservado_ate < now())
       order by x.id
       limit greatest(1, least(p_lote, 500))
       for update skip locked)
    update uj.envios_push e
       set estado = 'enviando', tentativas = e.tentativas + 1,
           reservado_ate = now() + make_interval(secs => greatest(10, p_reserva_s))
      from escolhidos s, uj.notificacoes n, uj.aparelhos_push a
     where e.id = s.id and n.id = e.notificacao_id and a.id = e.aparelho_id
    returning e.id, a.token, a.plataforma, a.ambiente_apns, n.titulo, n.corpo,
              jsonb_build_object('comunidadeId', n.comunidade_id, 'tipo', n.tipo,
                                 'recursoTipo', n.recurso_tipo, 'recursoId', n.recurso_id,
                                 'notificacaoId', n.id);
end
$$;

-- Resultado do envio. Token recusado pelo APNs/FCM: o aparelho é expurgado.
create function uj.push_concluir(p_envio bigint, p_resultado text, p_erro text) returns void
  language plpgsql security definer
  set search_path = pg_catalog, uj
  as $$
begin
  if p_resultado = 'enviado' then
    update uj.envios_push set estado = 'enviado', enviado_em = now(), erro = null,
           reservado_ate = null
     where id = p_envio;
  elsif p_resultado = 'token_invalido' then
    delete from uj.aparelhos_push
     where id = (select aparelho_id from uj.envios_push where id = p_envio);
  elsif p_resultado = 'tentar_de_novo' then
    update uj.envios_push
       set estado = case when tentativas >= 5 then 'falhou' else 'pendente' end,
           proxima_em = now() + make_interval(secs => 30 * power(2, least(tentativas, 8))::int),
           erro = left(p_erro, 120), reservado_ate = null
     where id = p_envio;
  else
    update uj.envios_push set estado = 'falhou', erro = left(p_erro, 120), reservado_ate = null
     where id = p_envio;
  end if;
end
$$;

-- ---------------------------------------------------------------- RLS

alter table uj.aparelhos_push enable row level security;
alter table uj.preferencias_notificacao enable row level security;
alter table uj.preferencias_conta enable row level security;
alter table uj.notificacoes enable row level security;
alter table uj.envios_push enable row level security;

create policy aparelhos_push_proprios on uj.aparelhos_push for select to uj_api
  using (conta_id = (select uj.conta_atual()));
create policy aparelhos_push_remover on uj.aparelhos_push for delete to uj_api
  using (conta_id = (select uj.conta_atual()));

create policy preferencias_notificacao_proprias on uj.preferencias_notificacao for all to uj_api
  using (comunidade_id = (select uj.comunidade_atual()) and conta_id = (select uj.conta_atual())
         and (select uj.nivel_no_contexto()) >= 10)
  with check (comunidade_id = (select uj.comunidade_atual()) and conta_id = (select uj.conta_atual())
              and (select uj.nivel_no_contexto()) >= 10);

create policy preferencias_conta_proprias on uj.preferencias_conta for all to uj_api
  using (conta_id = (select uj.conta_atual()))
  with check (conta_id = (select uj.conta_atual()));

create policy notificacoes_proprias on uj.notificacoes for select to uj_api
  using (comunidade_id = (select uj.comunidade_atual()) and conta_id = (select uj.conta_atual())
         and (select uj.nivel_no_contexto()) >= 10);

-- ---------------------------------------------------------------- privilégios

revoke execute on all functions in schema uj from public;
grant execute on function uj.registrar_aparelho_push(uuid, text, text, text) to uj_api;
grant execute on function uj.push_reservar(int, int), uj.push_concluir(bigint, text, text)
  to uj_auth;

grant select (id, plataforma, ambiente_apns, criado_em, familia), delete on uj.aparelhos_push
  to uj_api;
grant select, delete on uj.preferencias_notificacao to uj_api;
grant insert (comunidade_id, conta_id, tipo, ativo), update (ativo, atualizado_em)
  on uj.preferencias_notificacao to uj_api;
grant select on uj.preferencias_conta to uj_api;
grant insert (conta_id, versiculo_ativo, versiculo_hora),
  update (versiculo_ativo, versiculo_hora, atualizado_em) on uj.preferencias_conta to uj_api;
grant select (id, comunidade_id, tipo, recurso_tipo, recurso_id, titulo, corpo, criado_em)
  on uj.notificacoes to uj_api;
