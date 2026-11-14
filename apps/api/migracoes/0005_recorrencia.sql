-- 0005: séries recorrentes (F8). Cada ocorrência é um EVENTO de verdade
-- (eventos.serie_id + ocorrencia_original), criado com antecedência pela
-- materialização. Editar uma ocorrência marca `editado_individualmente`, e
-- mudanças "em toda a série" não a sobrescrevem.

create table uj.series (
  id uuid primary key default gen_random_uuid(),
  comunidade_id uuid not null references uj.comunidades (id),
  -- RegraDeRecorrencia de packages/dominio (validada pela API).
  regra jsonb not null check (jsonb_typeof(regra) = 'object'),
  hora_local text not null check (hora_local ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  fuso text not null,
  duracao_min int not null check (duracao_min between 5 and 1440),
  inicio_em date not null,
  fim_em date,
  materializado_ate date,
  titulo text not null check (length(btrim(titulo)) between 2 and 120),
  descricao text check (length(descricao) <= 5000),
  categoria text not null check (length(categoria) between 2 and 60),
  local_id uuid references uj.locais (id),
  visibilidade text not null default 'interna' check (visibilidade in ('interna', 'publica')),
  capacidade int check (capacidade between 1 and 100000),
  informacoes_uteis text check (length(informacoes_uteis) <= 5000),
  status_das_ocorrencias text not null default 'rascunho'
    check (status_das_ocorrencias in ('rascunho', 'publicado')),
  etapas jsonb not null default '[]'::jsonb check (jsonb_typeof(etapas) = 'array'),
  checklist jsonb not null default '[]'::jsonb check (jsonb_typeof(checklist) = 'array'),
  criado_por uuid not null default uj.conta_atual() references uj.contas (id),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  versao int not null default 1,
  check (fim_em is null or fim_em >= inicio_em)
);
create index series_comunidade on uj.series (comunidade_id);
create index series_local on uj.series (local_id);
create index series_criado_por on uj.series (criado_por);

create trigger series_atualizado before update on uj.series
  for each row execute function uj.tocar_atualizado_em();
create trigger series_versao before update on uj.series
  for each row execute function uj.subir_versao();

create function uj.guardar_serie() returns trigger
  language plpgsql security definer
  set search_path = pg_catalog, uj
  as $$
begin
  perform now() at time zone new.fuso;
  if new.local_id is not null and not exists (
       select 1 from uj.locais where id = new.local_id and comunidade_id = new.comunidade_id) then
    raise exception 'local de outra comunidade' using errcode = '23503';
  end if;
  return new;
end
$$;
create trigger series_guardar before insert or update on uj.series
  for each row execute function uj.guardar_serie();
create trigger series_mudanca after insert or update or delete on uj.series
  for each row execute function uj.registrar_mudanca('20');

alter table uj.eventos add column editado_individualmente boolean not null default false;
alter table uj.eventos
  add constraint eventos_serie_fk foreign key (serie_id) references uj.series (id);
-- Uma ocorrência por data original: a materialização nunca duplica.
create unique index eventos_ocorrencia_unica on uj.eventos (serie_id, ocorrencia_original)
  where serie_id is not null;

-- Evento só aponta para série da MESMA comunidade.
create or replace function uj.guardar_evento() returns trigger
  language plpgsql security definer
  set search_path = pg_catalog, uj
  as $$
begin
  perform now() at time zone new.fuso;
  if new.local_id is not null and not exists (
       select 1 from uj.locais where id = new.local_id and comunidade_id = new.comunidade_id) then
    raise exception 'local de outra comunidade' using errcode = '23503';
  end if;
  if new.serie_id is not null and not exists (
       select 1 from uj.series where id = new.serie_id and comunidade_id = new.comunidade_id) then
    raise exception 'serie de outra comunidade' using errcode = '23503';
  end if;
  return new;
end
$$;

alter table uj.series enable row level security;
create policy series_ler on uj.series for select to uj_api
  using (comunidade_id = (select uj.comunidade_atual()) and (select uj.nivel_no_contexto()) >= 20);
create policy series_gravar on uj.series for all to uj_api
  using (comunidade_id = (select uj.comunidade_atual()) and (select uj.nivel_gravavel_no_contexto()) >= 20)
  with check (comunidade_id = (select uj.comunidade_atual()) and (select uj.nivel_gravavel_no_contexto()) >= 20);

revoke execute on all functions in schema uj from public;
grant select, delete on uj.series to uj_api;
grant insert (comunidade_id, regra, hora_local, fuso, duracao_min, inicio_em, fim_em,
  materializado_ate, titulo, descricao, categoria, local_id, visibilidade, capacidade,
  informacoes_uteis, status_das_ocorrencias, etapas, checklist),
  update (regra, hora_local, duracao_min, fim_em, materializado_ate, titulo, descricao, categoria,
  local_id, visibilidade, capacidade, informacoes_uteis, status_das_ocorrencias, etapas, checklist)
  on uj.series to uj_api;
grant update (editado_individualmente) on uj.eventos to uj_api;
