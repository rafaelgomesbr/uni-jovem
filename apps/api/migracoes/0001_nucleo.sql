-- 0001: núcleo de contas, comunidades, vínculos, convites, sessões e auditoria.
--
-- PAPÉIS DO BANCO (criados por infra/banco/papeis.sql, fora das migrações):
--   uj_dono  dono do esquema; só aplica migrações; o aplicativo nunca conecta com ele.
--   uj_api   rotas do aplicativo; sempre sob RLS; nunca é dono nem tem BYPASSRLS.
--   uj_auth  autenticação e aceite de convite; só enxerga tabelas de identidade.
--
-- POR QUE NÃO "FORCE ROW LEVEL SECURITY": as funções auxiliares das políticas
-- (papel_na, nivel_na...) são SECURITY DEFINER do dono e precisam ler `vinculos`
-- sem recursão. Como o dono só migra, RLS habilitada já vale para os dois papéis
-- do aplicativo. O teste `rls-papeis` garante que uj_api e uj_auth não são donos
-- e não têm BYPASSRLS.
--
-- CONTEXTO: toda transação do aplicativo faz
--   select set_config('app.conta_id', $1, true), set_config('app.comunidade_id', $2, true)
-- e as políticas comparam com isso. Sem contexto, nada aparece.

create schema uj;
revoke all on schema uj from public;
grant usage on schema uj to uj_api, uj_auth;

-- ---------------------------------------------------------------- contexto

create function uj.conta_atual() returns uuid
  language sql stable
  as $$ select nullif(current_setting('app.conta_id', true), '')::uuid $$;

create function uj.comunidade_atual() returns uuid
  language sql stable
  as $$ select nullif(current_setting('app.comunidade_id', true), '')::uuid $$;

create function uj.tocar_atualizado_em() returns trigger
  language plpgsql
  as $$
begin
  new.atualizado_em := now();
  return new;
end
$$;

-- ---------------------------------------------------------------- contas (globais)

create table uj.contas (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (length(btrim(nome)) between 1 and 120),
  email text not null check (email = lower(email) and email like '%_@_%'),
  email_verificado_em timestamptz,
  whatsapp text check (whatsapp ~ '^\+[1-9][0-9]{7,14}$'),
  senha_hash text,
  plataforma_proprietario boolean not null default false,
  totp_segredo_cifrado bytea,
  totp_ativado_em timestamptz,
  estado text not null default 'ativa' check (estado in ('ativa', 'desativada', 'anonimizada')),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  anonimizada_em timestamptz,
  check ((estado = 'anonimizada') = (anonimizada_em is not null))
);
create unique index contas_email_unico on uj.contas (email);
-- Um único proprietário da plataforma, no máximo.
create unique index contas_um_proprietario on uj.contas (plataforma_proprietario)
  where plataforma_proprietario;
create trigger contas_atualizado before update on uj.contas
  for each row execute function uj.tocar_atualizado_em();

create table uj.codigos_recuperacao (
  conta_id uuid not null references uj.contas (id),
  codigo_hash bytea not null,
  usado_em timestamptz,
  criado_em timestamptz not null default now(),
  primary key (conta_id, codigo_hash)
);

create table uj.sessoes (
  id uuid primary key default gen_random_uuid(),
  conta_id uuid not null references uj.contas (id),
  familia uuid not null,
  refresh_hash bytea not null unique,
  aparelho text check (length(aparelho) <= 80),
  plataforma text check (plataforma in ('ios', 'android', 'web')),
  criado_em timestamptz not null default now(),
  ultimo_uso_em timestamptz not null default now(),
  expira_em timestamptz not null,
  substituida_em timestamptz,
  revogada_em timestamptz,
  motivo_revogacao text check (length(motivo_revogacao) <= 60)
);
create index sessoes_conta on uj.sessoes (conta_id) where revogada_em is null;
create index sessoes_familia on uj.sessoes (familia);

create table uj.recuperacoes_senha (
  id uuid primary key default gen_random_uuid(),
  conta_id uuid not null references uj.contas (id),
  token_hash bytea not null unique,
  expira_em timestamptz not null,
  usado_em timestamptz,
  criado_em timestamptz not null default now()
);

-- ---------------------------------------------------------------- comunidades

create table uj.comunidades (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (length(btrim(nome)) between 2 and 80),
  cor text not null default '#5B4BDB' check (cor ~ '^#[0-9A-Fa-f]{6}$'),
  fuso text not null default 'America/Sao_Paulo',
  -- Ponto de extensão: v1 só aceita 'convite' (gatilho abaixo). Os outros
  -- valores existem para que habilitá-los depois não exija mudar o esquema.
  modo_entrada text not null default 'convite'
    check (modo_entrada in ('convite', 'solicitacao', 'livre')),
  estado text not null default 'ativa'
    check (estado in ('ativa', 'suspensa', 'arquivada', 'exclusao_agendada')),
  exclusao_agendada_para timestamptz,
  validade_offline_dias int not null default 14 check (validade_offline_dias between 3 and 30),
  retencao_inscricoes_dias int not null default 90
    check (retencao_inscricoes_dias between 30 and 365),
  criado_por uuid references uj.contas (id),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  versao int not null default 1,
  check ((estado = 'exclusao_agendada') = (exclusao_agendada_para is not null))
);
create trigger comunidades_atualizado before update on uj.comunidades
  for each row execute function uj.tocar_atualizado_em();

-- ---------------------------------------------------------------- vínculos

create table uj.vinculos (
  id uuid primary key default gen_random_uuid(),
  conta_id uuid not null references uj.contas (id),
  comunidade_id uuid not null references uj.comunidades (id),
  papel text not null check (papel in ('admin', 'organizador', 'membro')),
  estado text not null default 'ativo' check (estado in ('ativo', 'desativado', 'removido')),
  designacoes text[] not null default '{}'
    check (designacoes <@ array['equipe_oracao']::text[]),
  convite_id uuid,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (conta_id, comunidade_id)
);
create index vinculos_comunidade_ativos on uj.vinculos (comunidade_id) where estado = 'ativo';
create trigger vinculos_atualizado before update on uj.vinculos
  for each row execute function uj.tocar_atualizado_em();

-- ---------------------------------------------------------------- convites

create table uj.convites (
  id uuid primary key default gen_random_uuid(),
  comunidade_id uuid not null references uj.comunidades (id),
  papel text not null check (papel in ('admin', 'organizador', 'membro')),
  email_destino text check (email_destino = lower(email_destino)),
  -- Só o HMAC do token é guardado; o token aparece uma vez, no link.
  token_hmac bytea not null unique,
  expira_em timestamptz not null,
  usos_maximos int not null default 1 check (usos_maximos between 1 and 50),
  usos int not null default 0,
  revogado_em timestamptz,
  revogado_por uuid references uj.contas (id),
  criado_por uuid not null references uj.contas (id),
  criado_em timestamptz not null default now(),
  ultimo_uso_em timestamptz,
  check (usos between 0 and usos_maximos)
);
create index convites_comunidade on uj.convites (comunidade_id, criado_em desc);
alter table uj.vinculos
  add constraint vinculos_convite_fk foreign key (convite_id) references uj.convites (id);

create table uj.verificacoes_email (
  id uuid primary key default gen_random_uuid(),
  email text not null check (email = lower(email)),
  codigo_hash bytea not null,
  finalidade text not null check (finalidade in ('convite')),
  convite_id uuid references uj.convites (id),
  tentativas int not null default 0 check (tentativas between 0 and 10),
  expira_em timestamptz not null,
  consumido_em timestamptz,
  criado_em timestamptz not null default now()
);
create index verificacoes_email_email on uj.verificacoes_email (email, criado_em desc);

create table uj.transferencias_propriedade (
  id uuid primary key default gen_random_uuid(),
  de_conta uuid not null references uj.contas (id),
  para_conta uuid not null references uj.contas (id),
  criado_em timestamptz not null default now(),
  efetiva_apos timestamptz not null,
  aceita_em timestamptz,
  cancelada_em timestamptz,
  concluida_em timestamptz,
  check (de_conta <> para_conta)
);
-- No máximo uma transferência em aberto.
create unique index transferencias_uma_aberta on uj.transferencias_propriedade ((true))
  where cancelada_em is null and concluida_em is null;

-- ---------------------------------------------------------------- auditoria (só inserção)

create table uj.auditoria (
  id bigint generated always as identity primary key,
  momento timestamptz not null default now(),
  conta_id uuid,
  comunidade_id uuid,
  acao text not null check (acao ~ '^[a-z_]+\.[a-z_]+$'),
  recurso_tipo text,
  recurso_id text,
  -- Nunca conteúdo sensível: só identificadores e campos alterados.
  detalhes jsonb not null default '{}'::jsonb,
  ip_truncado text check (length(ip_truncado) <= 45)
);
create index auditoria_comunidade on uj.auditoria (comunidade_id, momento desc);
create index auditoria_conta on uj.auditoria (conta_id, momento desc);

create function uj.auditoria_imutavel() returns trigger
  language plpgsql
  as $$
begin
  raise exception 'auditoria é só-inserção' using errcode = '42501';
end
$$;
create trigger auditoria_sem_alteracao before update or delete on uj.auditoria
  for each row execute function uj.auditoria_imutavel();
create trigger auditoria_sem_truncate before truncate on uj.auditoria
  for each statement execute function uj.auditoria_imutavel();

-- ---------------------------------------------------------------- log de mudanças (sincronização)

-- Cursor de sincronização por comunidade. `xid` permite ao leitor ignorar
-- linhas de transações ainda em andamento (ver ADR 0005).
create table uj.mudancas (
  id bigint generated always as identity primary key,
  comunidade_id uuid not null,
  tabela text not null,
  registro_id uuid not null,
  operacao char(1) not null check (operacao in ('I', 'U', 'D')),
  xid xid8 not null default pg_current_xact_id(),
  momento timestamptz not null default now()
);
create index mudancas_comunidade on uj.mudancas (comunidade_id, id);

-- ---------------------------------------------------------------- funções das políticas

create function uj.eh_proprietario() returns boolean
  language sql stable security definer
  set search_path = pg_catalog, uj
  as $$
    select coalesce(
      (select plataforma_proprietario from uj.contas
        where id = uj.conta_atual() and estado = 'ativa'),
      false)
  $$;

create function uj.papel_na(c uuid) returns text
  language sql stable security definer
  set search_path = pg_catalog, uj
  as $$
    select v.papel
      from uj.vinculos v
      join uj.contas a on a.id = v.conta_id
     where v.comunidade_id = c
       and v.conta_id = uj.conta_atual()
       and v.estado = 'ativo'
       and a.estado = 'ativa'
  $$;

create function uj.nivel_na(c uuid) returns int
  language sql stable
  set search_path = pg_catalog, uj
  as $$
    select case uj.papel_na(c)
      when 'admin' then 30
      when 'organizador' then 20
      when 'membro' then 10
      else 0
    end
  $$;

create function uj.estado_da_comunidade(c uuid) returns text
  language sql stable security definer
  set search_path = pg_catalog, uj
  as $$ select estado from uj.comunidades where id = c $$;

-- Leitura de dado de comunidade: só na comunidade ATIVA do contexto, com vínculo
-- ativo, e com a comunidade ativa ou suspensa (suspensa = somente leitura).
create function uj.pode_ler(c uuid) returns boolean
  language sql stable
  set search_path = pg_catalog, uj
  as $$
    select c = uj.comunidade_atual()
       and uj.nivel_na(c) >= 10
       and uj.estado_da_comunidade(c) in ('ativa', 'suspensa')
  $$;

-- Escrita: além disso, nível mínimo e comunidade no estado 'ativa'.
create function uj.pode_gravar(c uuid, nivel_minimo int) returns boolean
  language sql stable
  set search_path = pg_catalog, uj
  as $$
    select c = uj.comunidade_atual()
       and uj.nivel_na(c) >= nivel_minimo
       and uj.estado_da_comunidade(c) = 'ativa'
  $$;

-- ---------------------------------------------------------------- regras de vínculo

create function uj.guardar_vinculo() returns trigger
  language plpgsql security definer
  set search_path = pg_catalog, uj
  as $$
declare
  ator uuid := uj.conta_atual();
  proprietario boolean := uj.eh_proprietario();
  alvo_protegido boolean;
begin
  select plataforma_proprietario into alvo_protegido from uj.contas where id = new.conta_id;

  -- A conta do Criador não é alterada por mais ninguém.
  if alvo_protegido and not proprietario and ator is distinct from new.conta_id then
    raise exception 'vinculo da conta proprietaria e protegido' using errcode = '42501';
  end if;

  if tg_op = 'UPDATE' and not proprietario then
    -- Ninguém altera o próprio papel ou as próprias designações.
    if ator = new.conta_id
       and (new.papel <> old.papel or new.designacoes <> old.designacoes) then
      raise exception 'nao e permitido alterar o proprio papel' using errcode = '42501';
    end if;
    -- Sobre si mesmo, só é possível sair (estado 'removido').
    if ator = new.conta_id and new.estado <> old.estado and new.estado <> 'removido' then
      raise exception 'so e permitido sair da comunidade' using errcode = '42501';
    end if;
  end if;

  return new;
end
$$;
create trigger vinculos_guardar before insert or update on uj.vinculos
  for each row execute function uj.guardar_vinculo();

-- A comunidade não fica sem admin ativo, exceto por intervenção do Criador.
create function uj.manter_um_admin() returns trigger
  language plpgsql security definer
  set search_path = pg_catalog, uj
  as $$
begin
  if old.papel = 'admin' and old.estado = 'ativo'
     and not (new.papel = 'admin' and new.estado = 'ativo')
     and not uj.eh_proprietario()
     and not exists (
       select 1 from uj.vinculos v join uj.contas a on a.id = v.conta_id
        where v.comunidade_id = old.comunidade_id and v.id <> old.id
          and v.papel = 'admin' and v.estado = 'ativo' and a.estado = 'ativa')
  then
    raise exception 'a comunidade ficaria sem administrador' using errcode = '23514';
  end if;
  return new;
end
$$;
create trigger vinculos_um_admin after update on uj.vinculos
  for each row execute function uj.manter_um_admin();

-- ---------------------------------------------------------------- regras de comunidade

create function uj.guardar_comunidade() returns trigger
  language plpgsql security definer
  set search_path = pg_catalog, uj
  as $$
begin
  -- Fuso precisa existir (erro do Postgres se não existir).
  perform now() at time zone new.fuso;

  if new.modo_entrada <> 'convite' then
    raise exception 'modo de entrada nao habilitado nesta versao' using errcode = '0A000';
  end if;

  if tg_op = 'UPDATE' and not uj.eh_proprietario() and (
       new.estado is distinct from old.estado
       or new.exclusao_agendada_para is distinct from old.exclusao_agendada_para) then
    raise exception 'ciclo de vida da comunidade e exclusivo do proprietario' using errcode = '42501';
  end if;

  if tg_op = 'UPDATE' then
    new.versao := old.versao + 1;
  end if;
  return new;
end
$$;
create trigger comunidades_guardar before insert or update on uj.comunidades
  for each row execute function uj.guardar_comunidade();

-- ---------------------------------------------------------------- log de mudanças

create function uj.registrar_mudanca() returns trigger
  language plpgsql security definer
  set search_path = pg_catalog, uj
  as $$
declare
  linha record := coalesce(new, old);
  c uuid;
begin
  if tg_table_name = 'comunidades' then
    c := linha.id;
  else
    c := linha.comunidade_id;
  end if;
  insert into uj.mudancas (comunidade_id, tabela, registro_id, operacao)
    values (c, tg_table_name, linha.id, left(tg_op, 1));
  return null;
end
$$;
create trigger comunidades_mudanca after insert or update or delete on uj.comunidades
  for each row execute function uj.registrar_mudanca();
create trigger vinculos_mudanca after insert or update or delete on uj.vinculos
  for each row execute function uj.registrar_mudanca();

-- ---------------------------------------------------------------- RLS e políticas

alter table uj.contas enable row level security;
alter table uj.codigos_recuperacao enable row level security;
alter table uj.sessoes enable row level security;
alter table uj.recuperacoes_senha enable row level security;
alter table uj.comunidades enable row level security;
alter table uj.vinculos enable row level security;
alter table uj.convites enable row level security;
alter table uj.verificacoes_email enable row level security;
alter table uj.transferencias_propriedade enable row level security;
alter table uj.auditoria enable row level security;
alter table uj.mudancas enable row level security;

-- uj_api: a própria conta. Nome de outras pessoas sai por função de projeção (F4).
create policy contas_api_propria on uj.contas for select to uj_api
  using (id = uj.conta_atual());
create policy contas_api_editar on uj.contas for update to uj_api
  using (id = uj.conta_atual()) with check (id = uj.conta_atual());

create policy sessoes_api_proprias on uj.sessoes for select to uj_api
  using (conta_id = uj.conta_atual());
create policy sessoes_api_revogar on uj.sessoes for update to uj_api
  using (conta_id = uj.conta_atual()) with check (conta_id = uj.conta_atual());

create policy comunidades_api_ler on uj.comunidades for select to uj_api
  using (
    uj.eh_proprietario()
    or (uj.nivel_na(id) >= 10 and estado in ('ativa', 'suspensa'))
    or (uj.nivel_na(id) >= 30 and estado = 'arquivada'));
create policy comunidades_api_criar on uj.comunidades for insert to uj_api
  with check (uj.eh_proprietario() and criado_por = uj.conta_atual());
create policy comunidades_api_editar on uj.comunidades for update to uj_api
  using (uj.eh_proprietario() or uj.pode_gravar(id, 30))
  with check (uj.eh_proprietario() or uj.pode_gravar(id, 30));

create policy vinculos_api_ler on uj.vinculos for select to uj_api
  using (conta_id = uj.conta_atual() or uj.pode_ler(comunidade_id) or uj.eh_proprietario());
create policy vinculos_api_nomear on uj.vinculos for insert to uj_api
  with check (uj.eh_proprietario());
create policy vinculos_api_editar on uj.vinculos for update to uj_api
  using (uj.eh_proprietario() or uj.pode_gravar(comunidade_id, 30) or conta_id = uj.conta_atual())
  with check (
    uj.eh_proprietario() or uj.pode_gravar(comunidade_id, 30) or conta_id = uj.conta_atual());

create policy convites_api_ler on uj.convites for select to uj_api
  using (uj.eh_proprietario() or uj.pode_gravar(comunidade_id, 30));
create policy convites_api_criar on uj.convites for insert to uj_api
  with check (
    (uj.eh_proprietario() or uj.pode_gravar(comunidade_id, 30))
    and criado_por = uj.conta_atual());
create policy convites_api_revogar on uj.convites for update to uj_api
  using (uj.eh_proprietario() or uj.pode_gravar(comunidade_id, 30))
  with check (uj.eh_proprietario() or uj.pode_gravar(comunidade_id, 30));

create policy auditoria_api_ler on uj.auditoria for select to uj_api
  using (
    uj.eh_proprietario()
    or (comunidade_id = uj.comunidade_atual() and uj.nivel_na(comunidade_id) >= 30));
create policy auditoria_api_inserir on uj.auditoria for insert to uj_api
  with check (conta_id is not distinct from uj.conta_atual());

create policy mudancas_api_ler on uj.mudancas for select to uj_api
  using (uj.pode_ler(comunidade_id));

-- uj_auth: identidade e aceite de convite. Sem acesso a conteúdo de comunidade.
create policy contas_auth on uj.contas to uj_auth using (true) with check (true);
create policy codigos_auth on uj.codigos_recuperacao to uj_auth using (true) with check (true);
create policy sessoes_auth on uj.sessoes to uj_auth using (true) with check (true);
create policy recuperacoes_auth on uj.recuperacoes_senha to uj_auth using (true) with check (true);
create policy verificacoes_auth on uj.verificacoes_email to uj_auth using (true) with check (true);
create policy transferencias_auth on uj.transferencias_propriedade to uj_auth
  using (true) with check (true);
create policy comunidades_auth_ler on uj.comunidades for select to uj_auth using (true);
create policy convites_auth on uj.convites to uj_auth using (true) with check (true);
create policy vinculos_auth on uj.vinculos to uj_auth using (true) with check (true);
create policy auditoria_auth_inserir on uj.auditoria for insert to uj_auth with check (true);

-- ---------------------------------------------------------------- privilégios (coluna a coluna)

grant execute on all functions in schema uj to uj_api, uj_auth;

grant select on uj.contas to uj_api;
grant update (nome, whatsapp) on uj.contas to uj_api;
grant select on uj.sessoes to uj_api;
grant update (revogada_em, motivo_revogacao) on uj.sessoes to uj_api;
grant select, insert on uj.comunidades to uj_api;
grant update (nome, cor, fuso, validade_offline_dias, retencao_inscricoes_dias, estado,
  exclusao_agendada_para) on uj.comunidades to uj_api;
grant select, insert on uj.vinculos to uj_api;
grant update (papel, estado, designacoes) on uj.vinculos to uj_api;
grant select, insert on uj.convites to uj_api;
grant update (revogado_em, revogado_por) on uj.convites to uj_api;
grant select, insert on uj.auditoria to uj_api;
grant select on uj.mudancas to uj_api;

grant select, insert, update on uj.contas, uj.codigos_recuperacao, uj.sessoes,
  uj.recuperacoes_senha, uj.verificacoes_email, uj.transferencias_propriedade to uj_auth;
grant select on uj.comunidades to uj_auth;
grant select, update (usos, ultimo_uso_em) on uj.convites to uj_auth;
grant select, insert, update (papel, estado, convite_id) on uj.vinculos to uj_auth;
grant insert on uj.auditoria to uj_auth;
