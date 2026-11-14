-- 0008: inscrições (públicas e de membros) e presença (F12).
--
-- A página pública NÃO acessa tabelas: só três funções (evento_publico,
-- inscrever_publico, cancelar_inscricao_publica), que devolvem apenas campos
-- publicados. Inscrição pública não cria conta nem vínculo.
-- Capacidade sob concorrência: a inscrição trava a linha do evento.

create table uj.inscricoes (
  id uuid primary key default gen_random_uuid(),
  comunidade_id uuid not null references uj.comunidades (id),
  evento_id uuid not null references uj.eventos (id) on delete cascade,
  origem text not null check (origem in ('publica', 'membro')),
  vinculo_id uuid references uj.vinculos (id),
  nome text not null check (length(btrim(nome)) between 1 and 120),
  telefone text check (telefone ~ '^\+[1-9][0-9]{7,14}$'),
  email text check (email = lower(email) and length(email) <= 254),
  estado text not null check (estado in ('confirmada', 'espera', 'cancelada')),
  -- Código de check-in: aleatório, sem dado pessoal (vira QR na confirmação).
  codigo_checkin text not null unique default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)),
  token_cancelamento_hash bytea unique,
  consentimento_em timestamptz,
  criado_em timestamptz not null default now(),
  cancelada_em timestamptz,
  promovida_em timestamptz,
  anonimizada_em timestamptz,
  check ((origem = 'membro') = (vinculo_id is not null)),
  check (origem = 'membro' or consentimento_em is not null),
  check ((estado = 'cancelada') = (cancelada_em is not null))
);
create index inscricoes_comunidade on uj.inscricoes (comunidade_id, evento_id, estado, criado_em);
create index inscricoes_vinculo on uj.inscricoes (vinculo_id);
create unique index inscricoes_telefone_unico on uj.inscricoes (evento_id, telefone)
  where estado <> 'cancelada' and telefone is not null;
create unique index inscricoes_membro_unico on uj.inscricoes (evento_id, vinculo_id)
  where estado <> 'cancelada' and vinculo_id is not null;

create table uj.presencas (
  id uuid primary key default gen_random_uuid(),
  comunidade_id uuid not null references uj.comunidades (id),
  evento_id uuid not null references uj.eventos (id) on delete cascade,
  inscricao_id uuid references uj.inscricoes (id) on delete set null,
  vinculo_id uuid references uj.vinculos (id),
  -- Quem chegou sem inscrição e sem conta (registro manual).
  nome_avulso text check (length(btrim(nome_avulso)) between 1 and 120),
  origem text not null check (origem in ('qr', 'manual', 'offline')),
  registrada_por uuid not null references uj.vinculos (id),
  registrada_em timestamptz not null default now(),
  ocorrida_em timestamptz not null default now(),
  -- Repetir o mesmo envio (rede ruim, fila offline) não duplica.
  chave_idempotencia uuid not null unique,
  check (inscricao_id is not null or vinculo_id is not null or nome_avulso is not null)
);
create index presencas_comunidade on uj.presencas (comunidade_id, evento_id);
create index presencas_registrada_por on uj.presencas (registrada_por);
create index presencas_vinculo on uj.presencas (vinculo_id);
create unique index presencas_inscricao_unica on uj.presencas (evento_id, inscricao_id)
  where inscricao_id is not null;
create unique index presencas_vinculo_unica on uj.presencas (evento_id, vinculo_id)
  where vinculo_id is not null;

create trigger inscricoes_guardar before insert or update on uj.inscricoes
  for each row execute function uj.guardar_filho_de_evento();
create trigger presencas_guardar before insert or update on uj.presencas
  for each row execute function uj.guardar_filho_de_evento();
-- Inscrição e presença com nome e telefone: só organizadores sabem da mudança.
create trigger inscricoes_mudanca after insert or update or delete on uj.inscricoes
  for each row execute function uj.registrar_mudanca('20');
create trigger presencas_mudanca after insert or update or delete on uj.presencas
  for each row execute function uj.registrar_mudanca('20');

alter table uj.inscricoes enable row level security;
alter table uj.presencas enable row level security;

-- Organizadores veem todas; membro vê só a própria inscrição e presença.
create policy inscricoes_ler on uj.inscricoes for select to uj_api
  using (comunidade_id = (select uj.comunidade_atual())
         and ((select uj.nivel_no_contexto()) >= 20
              or vinculo_id = (select uj.vinculo_da_conta_no_contexto())));
create policy presencas_ler on uj.presencas for select to uj_api
  using (comunidade_id = (select uj.comunidade_atual())
         and ((select uj.nivel_no_contexto()) >= 20
              or vinculo_id = (select uj.vinculo_da_conta_no_contexto())));
create policy presencas_gravar on uj.presencas for all to uj_api
  using (comunidade_id = (select uj.comunidade_atual()) and (select uj.nivel_gravavel_no_contexto()) >= 20)
  with check (comunidade_id = (select uj.comunidade_atual()) and (select uj.nivel_gravavel_no_contexto()) >= 20
              and registrada_por = (select uj.vinculo_da_conta_no_contexto()));

-- ---------------------------------------------------------------- regras de vaga

-- Decide o estado de uma nova inscrição com o evento TRAVADO (chamar dentro de
-- transação, depois de `select ... for update` no evento).
create function uj.estado_para_nova_inscricao(p_evento uuid) returns text
  language sql stable security definer
  set search_path = pg_catalog, uj
  as $$
    select case
      when e.capacidade is null then 'confirmada'
      when (select count(*) from uj.inscricoes i where i.evento_id = e.id and i.estado = 'confirmada') < e.capacidade
        then 'confirmada'
      when e.lista_de_espera then 'espera'
      else null
    end
    from uj.eventos e where e.id = p_evento
  $$;

-- Vaga liberada: promove a primeira pessoa da lista de espera.
create function uj.promover_da_espera(p_evento uuid) returns uuid
  language plpgsql security definer
  set search_path = pg_catalog, uj
  as $$
declare
  promovida uuid;
begin
  if uj.estado_para_nova_inscricao(p_evento) is distinct from 'confirmada' then
    return null;
  end if;
  update uj.inscricoes set estado = 'confirmada', promovida_em = now()
   where id = (select id from uj.inscricoes where evento_id = p_evento and estado = 'espera'
                order by criado_em limit 1 for update skip locked)
  returning id into promovida;
  return promovida;
end
$$;

-- ---------------------------------------------------------------- superfície pública

-- Só os campos publicados de um evento PÚBLICO. Nada interno, nenhuma lista.
create function uj.evento_publico(p_id_publico text)
  returns table (titulo text, descricao text, categoria text, inicio timestamptz, duracao_min int,
                 fuso text, status text, motivo_status text, informacoes_uteis text,
                 local_nome text, local_tipo text, local_endereco text, local_latitude double precision,
                 local_longitude double precision, comunidade_nome text, comunidade_cor text,
                 capacidade int, vagas_restantes int, lista_de_espera boolean,
                 inscricoes_abertas boolean)
  language sql stable security definer
  set search_path = pg_catalog, uj
  as $$
    select e.titulo, e.descricao, e.categoria, e.inicio, e.duracao_min, e.fuso, e.status,
           case when e.status in ('cancelado', 'adiado') then e.motivo_status end,
           e.informacoes_uteis, l.nome, l.tipo,
           case when l.tipo = 'externo' then l.endereco end,
           case when l.tipo = 'externo' then l.latitude end,
           case when l.tipo = 'externo' then l.longitude end,
           c.nome, c.cor, e.capacidade,
           case when e.capacidade is null then null
                else greatest(0, e.capacidade - (select count(*) from uj.inscricoes i
                                                  where i.evento_id = e.id and i.estado = 'confirmada'))::int end,
           e.lista_de_espera,
           e.status = 'publicado' and e.inicio > now()
             and (e.inscricao_ate is null or e.inscricao_ate > now())
      from uj.eventos e
      join uj.comunidades c on c.id = e.comunidade_id
      left join uj.locais l on l.id = e.local_id
     where e.id_publico = p_id_publico and e.visibilidade = 'publica'
       and e.status in ('publicado', 'adiado', 'cancelado', 'encerrado')
       and c.estado = 'ativa'
  $$;

-- Inscrição pública. Erros: UJ030 indisponível, UJ031 lotado, UJ032 já inscrito
-- (devolve a mesma situação, sem duplicar).
create function uj.inscrever_publico(p_id_publico text, p_nome text, p_telefone text, p_email text,
                                     p_token_hash bytea)
  returns table (inscricao_id uuid, estado text, codigo_checkin text, ja_existia boolean)
  language plpgsql security definer
  set search_path = pg_catalog, uj
  as $$
#variable_conflict use_column
declare
  e uj.eventos;
  existente uj.inscricoes;
  novo_estado text;
begin
  select ev.* into e from uj.eventos ev join uj.comunidades c on c.id = ev.comunidade_id
   where ev.id_publico = p_id_publico and ev.visibilidade = 'publica' and ev.status = 'publicado'
     and ev.inicio > now() and (ev.inscricao_ate is null or ev.inscricao_ate > now())
     and c.estado = 'ativa'
   for update of ev;
  if not found then
    raise exception 'inscricoes indisponiveis' using errcode = 'UJ030';
  end if;
  select * into existente from uj.inscricoes
   where evento_id = e.id and telefone = p_telefone and estado <> 'cancelada';
  if found then
    return query select existente.id, existente.estado, existente.codigo_checkin, true;
    return;
  end if;
  novo_estado := uj.estado_para_nova_inscricao(e.id);
  if novo_estado is null then
    raise exception 'evento lotado' using errcode = 'UJ031';
  end if;
  return query
    insert into uj.inscricoes (comunidade_id, evento_id, origem, nome, telefone, email, estado,
                               token_cancelamento_hash, consentimento_em)
    values (e.comunidade_id, e.id, 'publica', btrim(p_nome), p_telefone, lower(p_email), novo_estado,
            p_token_hash, now())
    returning id, inscricoes.estado, inscricoes.codigo_checkin, false;
end
$$;

-- Cancelamento pelo link (token). Promove a espera na mesma transação.
create function uj.cancelar_inscricao_publica(p_id_publico text, p_token_hash bytea) returns boolean
  language plpgsql security definer
  set search_path = pg_catalog, uj
  as $$
declare
  i uj.inscricoes;
begin
  select ins.* into i from uj.inscricoes ins join uj.eventos e on e.id = ins.evento_id
   where e.id_publico = p_id_publico and ins.token_cancelamento_hash = p_token_hash
     and ins.estado <> 'cancelada'
   for update of ins;
  if not found then
    return false;
  end if;
  perform 1 from uj.eventos where id = i.evento_id for update;
  update uj.inscricoes set estado = 'cancelada', cancelada_em = now() where id = i.id;
  if i.estado = 'confirmada' then
    perform uj.promover_da_espera(i.evento_id);
  end if;
  return true;
end
$$;

-- Inscrição de membro (logado) e cancelamento da própria. UJ030/UJ031 iguais.
create function uj.inscrever_membro(p_evento uuid)
  returns table (inscricao_id uuid, estado text, codigo_checkin text)
  language plpgsql security definer
  set search_path = pg_catalog, uj
  as $$
#variable_conflict use_column
declare
  e uj.eventos;
  eu uuid := uj.vinculo_da_conta_no_contexto();
  existente uj.inscricoes;
  novo_estado text;
  nome_da_conta text;
begin
  if uj.nivel_gravavel_no_contexto() < 10 or eu is null then
    raise exception 'sem permissao' using errcode = '42501';
  end if;
  select * into e from uj.eventos
   where id = p_evento and comunidade_id = uj.comunidade_atual() and status <> 'rascunho'
   for update;
  if not found then
    raise exception 'evento nao encontrado' using errcode = 'UJ034';
  end if;
  if e.status <> 'publicado' or e.inicio <= now() or (e.inscricao_ate is not null and e.inscricao_ate <= now()) then
    raise exception 'inscricoes indisponiveis' using errcode = 'UJ030';
  end if;
  select * into existente from uj.inscricoes where evento_id = e.id and vinculo_id = eu and estado <> 'cancelada';
  if found then
    return query select existente.id, existente.estado, existente.codigo_checkin;
    return;
  end if;
  novo_estado := uj.estado_para_nova_inscricao(e.id);
  if novo_estado is null then
    raise exception 'evento lotado' using errcode = 'UJ031';
  end if;
  select nome into nome_da_conta from uj.contas where id = uj.conta_atual();
  return query
    insert into uj.inscricoes (comunidade_id, evento_id, origem, vinculo_id, nome, estado)
    values (e.comunidade_id, e.id, 'membro', eu, nome_da_conta, novo_estado)
    returning id, inscricoes.estado, inscricoes.codigo_checkin;
end
$$;

-- Cancelar: a própria (membro) ou qualquer uma (organizador). Promove a espera.
create function uj.cancelar_inscricao(p_inscricao uuid) returns void
  language plpgsql security definer
  set search_path = pg_catalog, uj
  as $$
declare
  i uj.inscricoes;
begin
  select * into i from uj.inscricoes
   where id = p_inscricao and comunidade_id = uj.comunidade_atual() and estado <> 'cancelada'
     and (vinculo_id = uj.vinculo_da_conta_no_contexto() or uj.nivel_gravavel_no_contexto() >= 20)
   for update;
  if not found then
    raise exception 'inscricao nao encontrada' using errcode = 'UJ033';
  end if;
  perform 1 from uj.eventos where id = i.evento_id for update;
  update uj.inscricoes set estado = 'cancelada', cancelada_em = now() where id = i.id;
  if i.estado = 'confirmada' then
    perform uj.promover_da_espera(i.evento_id);
  end if;
end
$$;

-- Retenção (P3): inscrições públicas viram anônimas N dias após o evento.
-- Roda como job do servidor (conexão do dono). Mantém contagens e presença.
create function uj.anonimizar_inscricoes_vencidas() returns int
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

revoke execute on all functions in schema uj from public;
grant execute on function uj.evento_publico(text), uj.inscrever_publico(text, text, text, text, bytea),
  uj.cancelar_inscricao_publica(text, bytea), uj.inscrever_membro(uuid), uj.cancelar_inscricao(uuid)
  to uj_api;
grant select on uj.inscricoes to uj_api;
grant select, delete on uj.presencas to uj_api;
grant insert (comunidade_id, evento_id, inscricao_id, vinculo_id, nome_avulso, origem, registrada_por,
  ocorrida_em, chave_idempotencia) on uj.presencas to uj_api;
