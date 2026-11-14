-- 0001: núcleo de contas, comunidades, vínculos, convites, sessões e auditoria.
-- (Revisada em 14/11/2026 após revisão independente, antes de qualquer
-- aplicação fora de bancos de teste; ver docs/DECISOES.md D11.)
--
-- PAPÉIS DO BANCO (criados por infra/banco/papeis.sql, fora das migrações):
--   uj_dono  dono do esquema; só aplica migrações; o aplicativo nunca conecta com ele.
--   uj_api   rotas do aplicativo; sempre sob RLS; nunca é dono nem tem BYPASSRLS.
--   uj_auth  autenticação; lê identidade; vínculos e convites SÓ por funções
--            atômicas (consultar_convite, aceitar_convite, criar_conta_por_convite).
--
-- RLS HABILITADA, NÃO "FORCE": as funções das políticas são SECURITY DEFINER do
-- dono e leem vínculos sem recursão. O dono só migra; o teste `rls-nucleo`
-- garante que uj_api e uj_auth não são donos nem têm BYPASSRLS.
--
-- CONTEXTO por transação (set_config(..., true)):
--   app.conta_id, app.comunidade_id  quem age e em qual comunidade
--   app.prova                        prova de 2FA recente do Criador (opcional)
-- Um GUC pode ser definido por quem executa SQL; por isso os poderes de
-- plataforma não confiam em app.conta_id sozinho: exigem `app.prova`, cujo hash
-- está numa tabela que nem uj_api nem uj_auth conseguem ler.
--
-- PADRÃO PARA TABELAS DE CONTEÚDO (migrações seguintes):
--   comunidade_id uuid not null, índice começando por comunidade_id,
--   gatilho registrar_mudanca('<nivel_minimo>'), e políticas no formato
--     using (comunidade_id = (select uj.comunidade_atual())
--            and (select uj.nivel_no_contexto()) >= 10)
--   O "(select ...)" vira InitPlan: a função roda uma vez por consulta, não por linha.
--   O teste `meta-esquema` reprova tabela com comunidade_id fora do padrão.

-- Nenhuma função criada pelo dono nasce executável por PUBLIC; EXECUTE é
-- concedido uma a uma. (Precisa ser global: privilégio padrão por esquema só
-- acrescenta, não remove o padrão do Postgres.)
alter default privileges revoke execute on functions from public;

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
  totp_ultimo_contador bigint,
  -- Falhas de segundo fator por CONTA (não por IP nem por desafio): a força
  -- bruta do código de 6 dígitos esbarra aqui, venha de onde vier.
  falhas_2fa int not null default 0 check (falhas_2fa >= 0),
  bloqueio_2fa_ate timestamptz,
  estado text not null default 'ativa' check (estado in ('ativa', 'desativada', 'anonimizada')),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  anonimizada_em timestamptz,
  check ((estado = 'anonimizada') = (anonimizada_em is not null)),
  check (not plataforma_proprietario or totp_ativado_em is not null or senha_hash is null)
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

-- Prova de 2FA recente do Criador. Ninguém do aplicativo lê esta tabela:
-- uj_auth só insere (depois de conferir o TOTP); eh_proprietario() confere.
create table uj.provas_de_plataforma (
  prova_hash bytea primary key,
  conta_id uuid not null references uj.contas (id),
  expira_em timestamptz not null,
  criado_em timestamptz not null default now(),
  check (expira_em <= criado_em + interval '15 minutes')
);
create index provas_conta on uj.provas_de_plataforma (conta_id);

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
  motivo_revogacao text check (length(motivo_revogacao) <= 60),
  -- Início da família (o aparelho). A renovação recusa famílias com mais de
  -- 365 dias: a sessão persistente tem fim, mesmo usada todo dia.
  familia_criada_em timestamptz not null default now()
);
create index sessoes_conta on uj.sessoes (conta_id);
create index sessoes_familia on uj.sessoes (familia);

create table uj.recuperacoes_senha (
  id uuid primary key default gen_random_uuid(),
  conta_id uuid not null references uj.contas (id),
  -- O link de primeiro acesso do Criador não serve para redefinir senha, e vice-versa.
  finalidade text not null default 'senha' check (finalidade in ('senha', 'primeiro_acesso')),
  token_hash bytea not null unique,
  expira_em timestamptz not null,
  usado_em timestamptz,
  criado_em timestamptz not null default now()
);
create index recuperacoes_conta on uj.recuperacoes_senha (conta_id);

-- ---------------------------------------------------------------- comunidades

create table uj.comunidades (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (length(btrim(nome)) between 2 and 80),
  cor text not null default '#5B4BDB' check (cor ~ '^#[0-9A-Fa-f]{6}$'),
  fuso text not null default 'America/Sao_Paulo',
  -- Ponto de extensão: v1 só aceita 'convite' (gatilho abaixo).
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
create index comunidades_criado_por on uj.comunidades (criado_por);
create trigger comunidades_atualizado before update on uj.comunidades
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
  check (usos between 0 and usos_maximos),
  check (expira_em > criado_em and expira_em <= criado_em + interval '7 days')
);
create index convites_comunidade on uj.convites (comunidade_id, criado_em desc);
create index convites_criado_por on uj.convites (criado_por);
create index convites_revogado_por on uj.convites (revogado_por);

-- ---------------------------------------------------------------- vínculos

create table uj.vinculos (
  id uuid primary key default gen_random_uuid(),
  conta_id uuid not null references uj.contas (id),
  comunidade_id uuid not null references uj.comunidades (id),
  papel text not null check (papel in ('admin', 'organizador', 'membro')),
  estado text not null default 'ativo' check (estado in ('ativo', 'desativado', 'removido')),
  designacoes text[] not null default '{}'
    check (designacoes <@ array['equipe_oracao']::text[]),
  convite_id uuid references uj.convites (id),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (conta_id, comunidade_id)
);
create index vinculos_comunidade on uj.vinculos (comunidade_id, estado);
create index vinculos_convite on uj.vinculos (convite_id);
create trigger vinculos_atualizado before update on uj.vinculos
  for each row execute function uj.tocar_atualizado_em();

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
create index verificacoes_email_convite on uj.verificacoes_email (convite_id);

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
create unique index transferencias_uma_aberta on uj.transferencias_propriedade ((true))
  where cancelada_em is null and concluida_em is null;
create index transferencias_de on uj.transferencias_propriedade (de_conta);
create index transferencias_para on uj.transferencias_propriedade (para_conta);

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

-- Leitura (ADR 0005): cursor = (xact, id); só entram linhas com
-- xact < pg_snapshot_xmin(pg_current_snapshot()), ou seja, de transações que já
-- terminaram. Assim uma transação que confirma depois de outra mais nova nunca
-- fica para trás do cursor.
create table uj.mudancas (
  id bigint generated always as identity primary key,
  comunidade_id uuid not null,
  tabela text not null,
  registro_id uuid not null,
  operacao char(1) not null check (operacao in ('I', 'U', 'D')),
  xact xid8 not null default pg_current_xact_id(),
  -- Quem pode saber que a mudança existe (espelha a leitura do registro).
  nivel_minimo int not null default 10 check (nivel_minimo in (10, 20, 30)),
  conta_alvo uuid,
  designacao text check (designacao in ('equipe_oracao')),
  momento timestamptz not null default now()
);
create index mudancas_sync on uj.mudancas (comunidade_id, xact, id);

-- ---------------------------------------------------------------- funções das políticas

create function uj.eh_proprietario() returns boolean
  language sql stable security definer
  set search_path = pg_catalog, uj
  as $$
    select exists (
      select 1
        from uj.contas a
        join uj.provas_de_plataforma p on p.conta_id = a.id
       where a.id = uj.conta_atual()
         and a.plataforma_proprietario
         and a.estado = 'ativa'
         and p.expira_em > now()
         and p.prova_hash = sha256(convert_to(coalesce(current_setting('app.prova', true), ''), 'UTF8')))
  $$;

create function uj.conta_eh_proprietaria(c uuid) returns boolean
  language sql stable security definer
  set search_path = pg_catalog, uj
  as $$ select coalesce((select plataforma_proprietario from uj.contas where id = c), false) $$;

-- Papel ativo da conta atual numa comunidade (lista de comunidades, tabela pequena).
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
      when 'admin' then 30 when 'organizador' then 20 when 'membro' then 10 else 0 end
  $$;

-- Nível na comunidade do CONTEXTO, que precisa estar ativa ou suspensa. 0 sem vínculo.
create function uj.nivel_no_contexto() returns int
  language sql stable security definer
  set search_path = pg_catalog, uj
  as $$
    select coalesce((
      select case v.papel when 'admin' then 30 when 'organizador' then 20 else 10 end
        from uj.vinculos v
        join uj.contas a on a.id = v.conta_id
        join uj.comunidades c on c.id = v.comunidade_id
       where v.comunidade_id = uj.comunidade_atual()
         and v.conta_id = uj.conta_atual()
         and v.estado = 'ativo' and a.estado = 'ativa'
         and c.estado in ('ativa', 'suspensa')), 0)
  $$;

-- Igual, mas só conta para escrita: a comunidade precisa estar 'ativa'.
create function uj.nivel_gravavel_no_contexto() returns int
  language sql stable security definer
  set search_path = pg_catalog, uj
  as $$
    select coalesce((
      select case v.papel when 'admin' then 30 when 'organizador' then 20 else 10 end
        from uj.vinculos v
        join uj.contas a on a.id = v.conta_id
        join uj.comunidades c on c.id = v.comunidade_id
       where v.comunidade_id = uj.comunidade_atual()
         and v.conta_id = uj.conta_atual()
         and v.estado = 'ativo' and a.estado = 'ativa'
         and c.estado = 'ativa'), 0)
  $$;

create function uj.designacoes_no_contexto() returns text[]
  language sql stable security definer
  set search_path = pg_catalog, uj
  as $$
    select coalesce((
      select v.designacoes from uj.vinculos v
       where v.comunidade_id = uj.comunidade_atual()
         and v.conta_id = uj.conta_atual()
         and v.estado = 'ativo'), '{}'::text[])
  $$;

-- ---------------------------------------------------------------- regras de vínculo

-- SECURITY INVOKER de propósito: dentro das funções atômicas (donas: uj_dono)
-- `current_user` é o dono, e a regra de "não mexer em si mesmo" não se aplica
-- ao aceite de convite feito pela função. Em DML direto, current_user é o papel
-- do aplicativo, e a regra vale. Um GUC não muda current_user.
create function uj.guardar_vinculo() returns trigger
  language plpgsql
  set search_path = pg_catalog, uj
  as $$
declare
  ator uuid := uj.conta_atual();
  proprietario boolean := uj.eh_proprietario();
begin
  if current_user = 'uj_dono' then
    return new;
  end if;

  -- Ninguém, nem o Criador, concede papel ou designação a si mesmo.
  if ator = new.conta_id and (
       tg_op = 'INSERT'
       or new.papel <> old.papel
       or new.designacoes <> old.designacoes) then
    raise exception 'nao e permitido alterar o proprio papel' using errcode = '42501';
  end if;

  -- Sobre si mesmo, só é possível sair (estado 'removido').
  if tg_op = 'UPDATE' and ator = new.conta_id
     and new.estado <> old.estado and new.estado <> 'removido' then
    raise exception 'so e permitido sair da comunidade' using errcode = '42501';
  end if;

  -- O vínculo da conta do Criador não é rebaixado nem removido por terceiros.
  -- (Designações podem ser ajustadas por um admin; papel e estado, não.)
  if tg_op = 'UPDATE' and ator is distinct from new.conta_id and not proprietario
     and uj.conta_eh_proprietaria(new.conta_id)
     and (new.papel <> old.papel or new.estado <> old.estado) then
    raise exception 'vinculo da conta proprietaria e protegido' using errcode = '42501';
  end if;

  return new;
end
$$;
create trigger vinculos_guardar before insert or update on uj.vinculos
  for each row execute function uj.guardar_vinculo();

-- A comunidade não fica sem admin ativo, exceto por intervenção do Criador.
-- A trava na linha da comunidade serializa dois rebaixamentos simultâneos.
create function uj.comunidade_tem_outro_admin(c uuid, exceto_vinculo uuid, exceto_conta uuid)
  returns boolean
  language sql stable security definer
  set search_path = pg_catalog, uj
  as $$
    select exists (
      select 1 from uj.vinculos v join uj.contas a on a.id = v.conta_id
       where v.comunidade_id = c
         and v.id is distinct from exceto_vinculo
         and v.conta_id is distinct from exceto_conta
         and v.papel = 'admin' and v.estado = 'ativo' and a.estado = 'ativa')
  $$;

create function uj.manter_um_admin() returns trigger
  language plpgsql security definer
  set search_path = pg_catalog, uj
  as $$
begin
  if old.papel = 'admin' and old.estado = 'ativo'
     and not (new.papel = 'admin' and new.estado = 'ativo') then
    perform 1 from uj.comunidades where id = old.comunidade_id for no key update;
    if not uj.comunidade_tem_outro_admin(old.comunidade_id, old.id, null)
       and not uj.eh_proprietario() then
      raise exception 'a comunidade ficaria sem administrador' using errcode = '23514';
    end if;
  end if;
  return new;
end
$$;
create trigger vinculos_um_admin after update on uj.vinculos
  for each row execute function uj.manter_um_admin();

-- Desativar ou anonimizar a conta do único admin também deixaria a comunidade sem admin.
create function uj.manter_um_admin_ao_encerrar_conta() returns trigger
  language plpgsql security definer
  set search_path = pg_catalog, uj
  as $$
declare
  c uuid;
begin
  if old.estado = 'ativa' and new.estado <> 'ativa' then
    for c in
      select v.comunidade_id from uj.vinculos v
       where v.conta_id = new.id and v.papel = 'admin' and v.estado = 'ativo'
    loop
      perform 1 from uj.comunidades where id = c for no key update;
      if not uj.comunidade_tem_outro_admin(c, null, new.id) and not uj.eh_proprietario() then
        raise exception 'a comunidade ficaria sem administrador' using errcode = '23514';
      end if;
    end loop;
  end if;
  return new;
end
$$;
create trigger contas_um_admin after update of estado on uj.contas
  for each row execute function uj.manter_um_admin_ao_encerrar_conta();

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

  -- Exceção: sessões conectadas como o dono do banco (jobs do servidor, como a
  -- exclusão agendada, e o operador). O aplicativo nunca conecta como dono.
  if tg_op = 'UPDATE' and session_user <> 'uj_dono' and not uj.eh_proprietario() and (
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

-- ---------------------------------------------------------------- revogação irreversível

create function uj.revogacao_irreversivel() returns trigger
  language plpgsql
  set search_path = pg_catalog, uj
  as $$
begin
  if tg_table_name = 'sessoes' then
    if old.revogada_em is not null and new.revogada_em is distinct from old.revogada_em then
      raise exception 'revogacao e irreversivel' using errcode = '42501';
    end if;
  elsif tg_table_name = 'convites' then
    if old.revogado_em is not null and (
         new.revogado_em is distinct from old.revogado_em
         or new.revogado_por is distinct from old.revogado_por) then
      raise exception 'revogacao e irreversivel' using errcode = '42501';
    end if;
    if old.revogado_em is null and new.revogado_em is not null and current_user <> 'uj_dono' then
      new.revogado_em := now();
      new.revogado_por := uj.conta_atual();
    end if;
  end if;
  return new;
end
$$;
create trigger sessoes_revogacao before update on uj.sessoes
  for each row execute function uj.revogacao_irreversivel();
create trigger convites_revogacao before update on uj.convites
  for each row execute function uj.revogacao_irreversivel();

-- ---------------------------------------------------------------- log de mudanças

-- Argumento do gatilho: nível mínimo para saber da mudança ('10', '20' ou '30').
create function uj.registrar_mudanca() returns trigger
  language plpgsql security definer
  set search_path = pg_catalog, uj
  as $$
declare
  linha record;
  c uuid;
begin
  if tg_op = 'DELETE' then linha := old; else linha := new; end if;
  if tg_table_name = 'comunidades' then
    c := linha.id;
  else
    c := linha.comunidade_id;
  end if;
  insert into uj.mudancas (comunidade_id, tabela, registro_id, operacao, nivel_minimo)
    values (c, tg_table_name, linha.id, left(tg_op, 1), tg_argv[0]::int);
  return null;
end
$$;
create trigger comunidades_mudanca after insert or update or delete on uj.comunidades
  for each row execute function uj.registrar_mudanca('10');
create trigger vinculos_mudanca after insert or update or delete on uj.vinculos
  for each row execute function uj.registrar_mudanca('10');
create trigger convites_mudanca after insert or update or delete on uj.convites
  for each row execute function uj.registrar_mudanca('30');

-- Renomear a conta muda o nome mostrado em todas as comunidades da pessoa.
create function uj.registrar_mudanca_de_conta() returns trigger
  language plpgsql security definer
  set search_path = pg_catalog, uj
  as $$
begin
  insert into uj.mudancas (comunidade_id, tabela, registro_id, operacao)
    select v.comunidade_id, 'contas', new.id, 'U'
      from uj.vinculos v where v.conta_id = new.id and v.estado = 'ativo';
  return null;
end
$$;
create trigger contas_mudanca after update of nome, whatsapp, estado on uj.contas
  for each row execute function uj.registrar_mudanca_de_conta();

-- ---------------------------------------------------------------- funções atômicas de convite

-- Situação de um convite, para a tela de aceite (quem chama tem o token).
create function uj.consultar_convite(p_token_hmac bytea)
  returns table (convite_id uuid, comunidade_nome text, comunidade_cor text, papel text,
                 email_destino text, situacao text)
  language sql stable security definer
  set search_path = pg_catalog, uj
  as $$
    select c.id, m.nome, m.cor, c.papel, c.email_destino,
           case
             when c.revogado_em is not null then 'revogado'
             when c.expira_em <= now() then 'expirado'
             when c.usos >= c.usos_maximos then 'usado'
             when m.estado <> 'ativa' then 'indisponivel'
             else 'valido'
           end
      from uj.convites c join uj.comunidades m on m.id = c.comunidade_id
     where c.token_hmac = p_token_hmac
  $$;

-- Aceite por conta existente. Trava o convite (FOR UPDATE): dois aceites
-- simultâneos do mesmo convite de uso único não geram dois vínculos.
-- Erros: UJ001 convite indisponível, UJ002 e-mail diferente, UJ003 já participa,
-- UJ004 conta inválida.
create function uj.aceitar_convite(p_token_hmac bytea, p_conta uuid) returns uuid
  language plpgsql security definer
  set search_path = pg_catalog, uj
  as $$
declare
  c uj.convites;
  email_da_conta text;
  existente uj.vinculos;
  v_id uuid;
begin
  select email into email_da_conta from uj.contas where id = p_conta and estado = 'ativa';
  if not found then
    raise exception 'conta invalida' using errcode = 'UJ004';
  end if;

  select * into c from uj.convites where token_hmac = p_token_hmac for update;
  if not found or c.revogado_em is not null or c.expira_em <= now()
     or c.usos >= c.usos_maximos
     or (select estado from uj.comunidades where id = c.comunidade_id) <> 'ativa' then
    raise exception 'convite indisponivel' using errcode = 'UJ001';
  end if;
  if c.email_destino is not null and c.email_destino <> email_da_conta then
    raise exception 'convite destinado a outro e-mail' using errcode = 'UJ002';
  end if;

  select * into existente from uj.vinculos
   where conta_id = p_conta and comunidade_id = c.comunidade_id for update;
  if found and existente.estado = 'ativo' then
    raise exception 'ja participa da comunidade' using errcode = 'UJ003';
  end if;
  -- Vínculo DESATIVADO por um admin não volta por qualquer link de convite:
  -- só por convite dirigido ao e-mail da pessoa (decisão consciente de quem convidou).
  if found and existente.estado = 'desativado' and c.email_destino is null then
    raise exception 'convite indisponivel' using errcode = 'UJ001';
  end if;

  update uj.convites set usos = usos + 1, ultimo_uso_em = now() where id = c.id;

  if existente.id is not null then
    update uj.vinculos
       set papel = c.papel, estado = 'ativo', designacoes = '{}', convite_id = c.id
     where id = existente.id
    returning id into v_id;
  else
    insert into uj.vinculos (conta_id, comunidade_id, papel, convite_id)
      values (p_conta, c.comunidade_id, c.papel, c.id)
    returning id into v_id;
  end if;

  insert into uj.auditoria (conta_id, comunidade_id, acao, recurso_tipo, recurso_id, detalhes)
    values (p_conta, c.comunidade_id, 'convite.aceito', 'convite', c.id::text,
            jsonb_build_object('papel', c.papel, 'vinculo', v_id));
  return v_id;
end
$$;

-- Conta nova a partir de convite: cria a conta (e-mail já verificado pela API)
-- e aceita o convite na mesma transação. UJ005: e-mail já tem conta.
create function uj.criar_conta_por_convite(p_token_hmac bytea, p_nome text, p_email text,
                                           p_whatsapp text, p_senha_hash text)
  returns table (conta_id uuid, vinculo_id uuid)
  language plpgsql security definer
  set search_path = pg_catalog, uj
  as $$
declare
  nova uuid;
begin
  if exists (select 1 from uj.contas where email = lower(p_email)) then
    raise exception 'e-mail ja possui conta' using errcode = 'UJ005';
  end if;
  insert into uj.contas (nome, email, email_verificado_em, whatsapp, senha_hash)
    values (btrim(p_nome), lower(p_email), now(), p_whatsapp, p_senha_hash)
  returning id into nova;
  return query select nova, uj.aceitar_convite(p_token_hmac, nova);
end
$$;

-- Descarta as provas de 2FA de uma conta (sair, redefinir senha, reuso de refresh).
-- uj_auth não lê a tabela de provas; por isso o descarte é por função.
create function uj.descartar_provas(p_conta uuid) returns void
  language sql security definer
  set search_path = pg_catalog, uj
  as $$ delete from uj.provas_de_plataforma where conta_id = p_conta $$;

-- ---------------------------------------------------------------- RLS e políticas

alter table uj.contas enable row level security;
alter table uj.codigos_recuperacao enable row level security;
alter table uj.provas_de_plataforma enable row level security;
alter table uj.sessoes enable row level security;
alter table uj.recuperacoes_senha enable row level security;
alter table uj.comunidades enable row level security;
alter table uj.vinculos enable row level security;
alter table uj.convites enable row level security;
alter table uj.verificacoes_email enable row level security;
alter table uj.transferencias_propriedade enable row level security;
alter table uj.auditoria enable row level security;
alter table uj.mudancas enable row level security;

-- uj_api ----------------------------------------------------------------

create policy contas_api_propria on uj.contas for select to uj_api
  using (id = (select uj.conta_atual()));
create policy contas_api_editar on uj.contas for update to uj_api
  using (id = (select uj.conta_atual())) with check (id = (select uj.conta_atual()));

create policy sessoes_api_proprias on uj.sessoes for select to uj_api
  using (conta_id = (select uj.conta_atual()));
create policy sessoes_api_revogar on uj.sessoes for update to uj_api
  using (conta_id = (select uj.conta_atual())) with check (conta_id = (select uj.conta_atual()));

create policy comunidades_api_ler on uj.comunidades for select to uj_api
  using (
    (select uj.eh_proprietario())
    or (uj.nivel_na(id) >= 10 and estado in ('ativa', 'suspensa'))
    or (uj.nivel_na(id) >= 30 and estado = 'arquivada'));
create policy comunidades_api_criar on uj.comunidades for insert to uj_api
  with check ((select uj.eh_proprietario()) and criado_por = (select uj.conta_atual()));
create policy comunidades_api_editar on uj.comunidades for update to uj_api
  using ((select uj.eh_proprietario())
         or (id = (select uj.comunidade_atual()) and (select uj.nivel_gravavel_no_contexto()) >= 30))
  with check ((select uj.eh_proprietario())
         or (id = (select uj.comunidade_atual()) and (select uj.nivel_gravavel_no_contexto()) >= 30));

-- O Criador só enxerga vínculos de outra comunidade em modo de intervenção,
-- isto é, com aquela comunidade no contexto e a prova de 2FA.
create policy vinculos_api_ler on uj.vinculos for select to uj_api
  using (
    conta_id = (select uj.conta_atual())
    or (comunidade_id = (select uj.comunidade_atual())
        and ((select uj.nivel_no_contexto()) >= 10 or (select uj.eh_proprietario()))));
create policy vinculos_api_nomear on uj.vinculos for insert to uj_api
  with check (comunidade_id = (select uj.comunidade_atual()) and (select uj.eh_proprietario()));
create policy vinculos_api_editar on uj.vinculos for update to uj_api
  using (
    conta_id = (select uj.conta_atual())
    or (comunidade_id = (select uj.comunidade_atual())
        and ((select uj.nivel_gravavel_no_contexto()) >= 30 or (select uj.eh_proprietario()))))
  with check (
    conta_id = (select uj.conta_atual())
    or (comunidade_id = (select uj.comunidade_atual())
        and ((select uj.nivel_gravavel_no_contexto()) >= 30 or (select uj.eh_proprietario()))));

create policy convites_api_ler on uj.convites for select to uj_api
  using (comunidade_id = (select uj.comunidade_atual())
         and ((select uj.nivel_no_contexto()) >= 30 or (select uj.eh_proprietario())));
create policy convites_api_criar on uj.convites for insert to uj_api
  with check (
    comunidade_id = (select uj.comunidade_atual())
    and ((select uj.nivel_gravavel_no_contexto()) >= 30 or (select uj.eh_proprietario()))
    and criado_por = (select uj.conta_atual()));
create policy convites_api_revogar on uj.convites for update to uj_api
  using (comunidade_id = (select uj.comunidade_atual())
         and ((select uj.nivel_gravavel_no_contexto()) >= 30 or (select uj.eh_proprietario())))
  with check (comunidade_id = (select uj.comunidade_atual())
         and ((select uj.nivel_gravavel_no_contexto()) >= 30 or (select uj.eh_proprietario())));

create policy auditoria_api_ler on uj.auditoria for select to uj_api
  using (
    (comunidade_id is null and (select uj.eh_proprietario()))
    or (comunidade_id = (select uj.comunidade_atual())
        and ((select uj.nivel_no_contexto()) >= 30 or (select uj.eh_proprietario()))));
create policy auditoria_api_inserir on uj.auditoria for insert to uj_api
  with check (
    conta_id is not distinct from (select uj.conta_atual())
    and (comunidade_id is null or comunidade_id = (select uj.comunidade_atual())));

create policy mudancas_api_ler on uj.mudancas for select to uj_api
  using (
    comunidade_id = (select uj.comunidade_atual())
    and (select uj.nivel_no_contexto()) >= nivel_minimo
    and (conta_alvo is null or conta_alvo = (select uj.conta_atual()))
    and (designacao is null or array[designacao] <@ (select uj.designacoes_no_contexto())));

-- uj_auth ---------------------------------------------------------------
-- Só identidade. Nenhuma política em comunidades, vínculos, convites,
-- transferências, provas (só insere) ou mudanças.

create policy contas_auth_ler on uj.contas for select to uj_auth using (true);
create policy contas_auth_editar on uj.contas for update to uj_auth using (true) with check (true);
create policy codigos_auth on uj.codigos_recuperacao to uj_auth using (true) with check (true);
create policy provas_auth_inserir on uj.provas_de_plataforma for insert to uj_auth
  with check (expira_em <= now() + interval '15 minutes');
create policy sessoes_auth on uj.sessoes to uj_auth using (true) with check (true);
create policy recuperacoes_auth on uj.recuperacoes_senha to uj_auth using (true) with check (true);
create policy verificacoes_auth on uj.verificacoes_email to uj_auth using (true) with check (true);
create policy auditoria_auth_inserir on uj.auditoria for insert to uj_auth
  with check (comunidade_id is null);

-- ---------------------------------------------------------------- privilégios

revoke execute on all functions in schema uj from public;

grant execute on function
  uj.conta_atual(), uj.comunidade_atual(), uj.eh_proprietario(), uj.conta_eh_proprietaria(uuid),
  uj.papel_na(uuid), uj.nivel_na(uuid), uj.nivel_no_contexto(), uj.nivel_gravavel_no_contexto(),
  uj.designacoes_no_contexto()
  to uj_api;
grant execute on function uj.conta_atual(), uj.comunidade_atual(), uj.eh_proprietario(),
  uj.conta_eh_proprietaria(uuid),
  uj.consultar_convite(bytea), uj.aceitar_convite(bytea, uuid), uj.descartar_provas(uuid),
  uj.criar_conta_por_convite(bytea, text, text, text, text)
  to uj_auth;

grant select on uj.contas to uj_api;
grant update (nome, whatsapp) on uj.contas to uj_api;
grant select on uj.sessoes to uj_api;
grant update (revogada_em, motivo_revogacao) on uj.sessoes to uj_api;
grant select on uj.comunidades to uj_api;
grant insert (nome, cor, fuso, validade_offline_dias, retencao_inscricoes_dias, criado_por)
  on uj.comunidades to uj_api;
grant update (nome, cor, fuso, validade_offline_dias, retencao_inscricoes_dias, estado,
  exclusao_agendada_para) on uj.comunidades to uj_api;
grant select on uj.vinculos to uj_api;
grant insert (conta_id, comunidade_id, papel) on uj.vinculos to uj_api;
grant update (papel, estado, designacoes) on uj.vinculos to uj_api;
grant select on uj.convites to uj_api;
grant insert (comunidade_id, papel, email_destino, token_hmac, expira_em, criado_por)
  on uj.convites to uj_api;
grant update (revogado_em) on uj.convites to uj_api;
grant select on uj.auditoria to uj_api;
grant insert (conta_id, comunidade_id, acao, recurso_tipo, recurso_id, detalhes, ip_truncado)
  on uj.auditoria to uj_api;
grant select on uj.mudancas to uj_api;

grant select on uj.contas to uj_auth;
grant update (senha_hash, email_verificado_em, totp_segredo_cifrado, totp_ativado_em,
  totp_ultimo_contador, falhas_2fa, bloqueio_2fa_ate) on uj.contas to uj_auth;
grant select, insert, delete on uj.codigos_recuperacao to uj_auth;
grant update (usado_em) on uj.codigos_recuperacao to uj_auth;
grant insert on uj.provas_de_plataforma to uj_auth;
grant select, insert on uj.sessoes to uj_auth;
grant update (ultimo_uso_em, substituida_em, revogada_em, motivo_revogacao) on uj.sessoes to uj_auth;
grant select, insert on uj.recuperacoes_senha to uj_auth;
grant update (usado_em) on uj.recuperacoes_senha to uj_auth;
grant select, insert on uj.verificacoes_email to uj_auth;
grant update (tentativas, consumido_em) on uj.verificacoes_email to uj_auth;
grant insert (conta_id, comunidade_id, acao, recurso_tipo, recurso_id, detalhes, ip_truncado)
  on uj.auditoria to uj_auth;
