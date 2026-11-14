-- 0006: escalas, substituições e disponibilidade (F9).
-- As ações pessoais (confirmar, recusar, pedir e assumir substituição) são
-- FUNÇÕES atômicas que conferem, no banco, que a escala é de quem age.

create table uj.substituicoes (
  id uuid primary key default gen_random_uuid(),
  comunidade_id uuid not null references uj.comunidades (id),
  atribuicao_id uuid not null references uj.atribuicoes (id) on delete cascade,
  pedida_por uuid not null references uj.vinculos (id),
  -- Nulo: aberta a qualquer pessoa da equipe; preenchido: só essa pessoa pode assumir.
  para_vinculo_id uuid references uj.vinculos (id),
  motivo text check (length(motivo) <= 500),
  estado text not null default 'aberta' check (estado in ('aberta', 'assumida', 'cancelada')),
  assumida_por uuid references uj.vinculos (id),
  criado_em timestamptz not null default now(),
  resolvida_em timestamptz,
  check ((estado = 'assumida') = (assumida_por is not null))
);
create index substituicoes_comunidade on uj.substituicoes (comunidade_id, estado, criado_em desc);
create index substituicoes_atribuicao on uj.substituicoes (atribuicao_id);
create index substituicoes_pedida_por on uj.substituicoes (pedida_por);
create index substituicoes_para on uj.substituicoes (para_vinculo_id);
create index substituicoes_assumida_por on uj.substituicoes (assumida_por);
create unique index substituicoes_uma_aberta on uj.substituicoes (atribuicao_id) where estado = 'aberta';

create table uj.disponibilidades (
  id uuid primary key default gen_random_uuid(),
  comunidade_id uuid not null references uj.comunidades (id),
  vinculo_id uuid not null references uj.vinculos (id),
  data date not null,
  disponivel boolean not null,
  observacao text check (length(observacao) <= 300),
  atualizado_em timestamptz not null default now(),
  unique (vinculo_id, data)
);
create index disponibilidades_comunidade on uj.disponibilidades (comunidade_id, data);

create trigger disponibilidades_atualizado before update on uj.disponibilidades
  for each row execute function uj.tocar_atualizado_em();

create trigger substituicoes_mudanca after insert or update or delete on uj.substituicoes
  for each row execute function uj.registrar_mudanca('10');
create trigger disponibilidades_mudanca after insert or update or delete on uj.disponibilidades
  for each row execute function uj.registrar_mudanca('20');

alter table uj.substituicoes enable row level security;
alter table uj.disponibilidades enable row level security;

-- Substituições: a equipe vê os pedidos (é o que permite alguém assumir).
create policy substituicoes_ler on uj.substituicoes for select to uj_api
  using (comunidade_id = (select uj.comunidade_atual()) and (select uj.nivel_no_contexto()) >= 10);

-- Disponibilidade: a pessoa vê e grava a sua; organizadores veem a de todos.
create policy disponibilidades_ler on uj.disponibilidades for select to uj_api
  using (comunidade_id = (select uj.comunidade_atual())
         and ((select uj.nivel_no_contexto()) >= 20
              or vinculo_id = (select uj.vinculo_da_conta_no_contexto())));
create policy disponibilidades_gravar on uj.disponibilidades for all to uj_api
  using (comunidade_id = (select uj.comunidade_atual()) and (select uj.nivel_gravavel_no_contexto()) >= 10
         and vinculo_id = (select uj.vinculo_da_conta_no_contexto()))
  with check (comunidade_id = (select uj.comunidade_atual()) and (select uj.nivel_gravavel_no_contexto()) >= 10
         and vinculo_id = (select uj.vinculo_da_conta_no_contexto()));

-- ---------------------------------------------------------------- funções das ações pessoais
-- Erros: UJ020 escala não é sua, UJ021 estado não permite, UJ022 substituição indisponível,
-- UJ023 não pode assumir a própria, UJ024 substituição não encontrada (404).

create function uj.atribuicao_propria(p_atribuicao uuid) returns uj.atribuicoes
  language plpgsql security definer
  set search_path = pg_catalog, uj
  as $$
declare
  a uj.atribuicoes;
begin
  if uj.nivel_gravavel_no_contexto() < 10 then
    raise exception 'sem permissao' using errcode = '42501';
  end if;
  select * into a from uj.atribuicoes
   where id = p_atribuicao and comunidade_id = uj.comunidade_atual()
     and vinculo_id = uj.vinculo_da_conta_no_contexto()
   for update;
  if not found then
    raise exception 'escala nao e sua' using errcode = 'UJ020';
  end if;
  return a;
end
$$;

create function uj.responder_atribuicao(p_atribuicao uuid, p_resposta text) returns text
  language plpgsql security definer
  set search_path = pg_catalog, uj
  as $$
declare
  a uj.atribuicoes := uj.atribuicao_propria(p_atribuicao);
begin
  if p_resposta not in ('confirmada', 'recusada') then
    raise exception 'resposta invalida' using errcode = '22023';
  end if;
  if a.estado = 'substituicao_pedida' then
    raise exception 'ha substituicao em aberto' using errcode = 'UJ021';
  end if;
  update uj.atribuicoes set estado = p_resposta where id = a.id;
  insert into uj.auditoria (conta_id, comunidade_id, acao, recurso_tipo, recurso_id, detalhes)
    values (uj.conta_atual(), a.comunidade_id, 'escala.' || left(p_resposta, -1) || 'o', 'atribuicao', a.id::text, '{}');
  return p_resposta;
end
$$;

create function uj.pedir_substituicao(p_atribuicao uuid, p_motivo text, p_para uuid) returns uuid
  language plpgsql security definer
  set search_path = pg_catalog, uj
  as $$
declare
  a uj.atribuicoes := uj.atribuicao_propria(p_atribuicao);
  s uuid;
begin
  if p_para is not null then
    if p_para = a.vinculo_id then
      raise exception 'nao pode assumir a propria' using errcode = 'UJ023';
    end if;
    perform uj.exigir_vinculo_da_comunidade(p_para, a.comunidade_id);
  end if;
  insert into uj.substituicoes (comunidade_id, atribuicao_id, pedida_por, para_vinculo_id, motivo)
    values (a.comunidade_id, a.id, a.vinculo_id, p_para, p_motivo)
  returning id into s;
  update uj.atribuicoes set estado = 'substituicao_pedida' where id = a.id;
  insert into uj.auditoria (conta_id, comunidade_id, acao, recurso_tipo, recurso_id, detalhes)
    values (uj.conta_atual(), a.comunidade_id, 'escala.substituicao_pedida', 'substituicao', s::text,
            jsonb_build_object('atribuicao', a.id, 'dirigida', p_para is not null));
  return s;
end
$$;

-- Assumir: troca a pessoa da escala de forma atômica e registra quem substituiu quem.
create function uj.assumir_substituicao(p_substituicao uuid) returns uuid
  language plpgsql security definer
  set search_path = pg_catalog, uj
  as $$
declare
  s uj.substituicoes;
  eu uuid := uj.vinculo_da_conta_no_contexto();
begin
  if uj.nivel_gravavel_no_contexto() < 10 or eu is null then
    raise exception 'sem permissao' using errcode = '42501';
  end if;
  select * into s from uj.substituicoes
   where id = p_substituicao and comunidade_id = uj.comunidade_atual() for update;
  if not found then
    raise exception 'substituicao nao encontrada' using errcode = 'UJ024';
  end if;
  if s.estado <> 'aberta' or (s.para_vinculo_id is not null and s.para_vinculo_id <> eu) then
    raise exception 'substituicao indisponivel' using errcode = 'UJ022';
  end if;
  if s.pedida_por = eu then
    raise exception 'nao pode assumir a propria' using errcode = 'UJ023';
  end if;
  update uj.atribuicoes set vinculo_id = eu, estado = 'confirmada' where id = s.atribuicao_id;
  update uj.substituicoes set estado = 'assumida', assumida_por = eu, resolvida_em = now() where id = s.id;
  insert into uj.auditoria (conta_id, comunidade_id, acao, recurso_tipo, recurso_id, detalhes)
    values (uj.conta_atual(), s.comunidade_id, 'escala.substituicao_assumida', 'substituicao', s.id::text,
            jsonb_build_object('de', s.pedida_por, 'para', eu));
  return s.atribuicao_id;
end
$$;

-- Cancelar: quem pediu, ou organizador.
create function uj.cancelar_substituicao(p_substituicao uuid) returns void
  language plpgsql security definer
  set search_path = pg_catalog, uj
  as $$
declare
  s uj.substituicoes;
begin
  select * into s from uj.substituicoes
   where id = p_substituicao and comunidade_id = uj.comunidade_atual() for update;
  if not found then
    raise exception 'substituicao nao encontrada' using errcode = 'UJ024';
  end if;
  if s.estado <> 'aberta'
     or not (s.pedida_por = uj.vinculo_da_conta_no_contexto() or uj.nivel_gravavel_no_contexto() >= 20) then
    raise exception 'substituicao indisponivel' using errcode = 'UJ022';
  end if;
  update uj.substituicoes set estado = 'cancelada', resolvida_em = now() where id = s.id;
  update uj.atribuicoes set estado = 'pendente' where id = s.atribuicao_id and estado = 'substituicao_pedida';
end
$$;

revoke execute on all functions in schema uj from public;
grant execute on function uj.atribuicao_propria(uuid), uj.responder_atribuicao(uuid, text),
  uj.pedir_substituicao(uuid, text, uuid), uj.assumir_substituicao(uuid),
  uj.cancelar_substituicao(uuid) to uj_api;
grant select on uj.substituicoes to uj_api;
grant select, delete on uj.disponibilidades to uj_api;
grant insert (comunidade_id, vinculo_id, data, disponivel, observacao),
  update (disponivel, observacao) on uj.disponibilidades to uj_api;
