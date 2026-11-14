-- 0004: eventos e programação (F7). Segue o padrão do cabeçalho de 0001:
-- comunidade_id em toda tabela, índice começando por comunidade_id, RLS por
-- comunidade do contexto (InitPlan) e registro no log de mudanças.
--
-- Leitura: membro vê evento que não é rascunho; organizador vê tudo.
-- Escrita: organizador ou acima, com a comunidade 'ativa'. Exceções para
-- ações pessoais (concluir a própria tarefa, marcar item de que é responsável)
-- ficam em políticas próprias + gatilho que limita as colunas.

-- ---------------------------------------------------------------- utilitários

create function uj.vinculo_da_conta_no_contexto() returns uuid
  language sql stable security definer
  set search_path = pg_catalog, uj
  as $$
    select id from uj.vinculos
     where comunidade_id = uj.comunidade_atual() and conta_id = uj.conta_atual() and estado = 'ativo'
  $$;

-- Garante que o vínculo citado (responsável, integrante) é da MESMA comunidade.
create function uj.exigir_vinculo_da_comunidade(p_vinculo uuid, p_comunidade uuid) returns void
  language plpgsql stable security definer
  set search_path = pg_catalog, uj
  as $$
begin
  if p_vinculo is not null and not exists (
       select 1 from uj.vinculos where id = p_vinculo and comunidade_id = p_comunidade) then
    raise exception 'vinculo de outra comunidade' using errcode = '23503';
  end if;
end
$$;

-- ---------------------------------------------------------------- locais

create table uj.locais (
  id uuid primary key default gen_random_uuid(),
  comunidade_id uuid not null references uj.comunidades (id),
  nome text not null check (length(btrim(nome)) between 2 and 120),
  tipo text not null check (tipo in ('interno', 'externo')),
  endereco text check (length(endereco) <= 300),
  latitude double precision check (latitude between -90 and 90),
  longitude double precision check (longitude between -180 and 180),
  referencia text check (length(referencia) <= 300),
  arquivado boolean not null default false,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  versao int not null default 1,
  check ((latitude is null) = (longitude is null)),
  check (tipo = 'interno' or endereco is not null)
);
create index locais_comunidade on uj.locais (comunidade_id, nome);

-- ---------------------------------------------------------------- eventos

create table uj.eventos (
  id uuid primary key default gen_random_uuid(),
  comunidade_id uuid not null references uj.comunidades (id),
  -- Recorrência (F8): a série e a ocorrência original de que este evento veio.
  serie_id uuid,
  ocorrencia_original timestamptz,
  titulo text not null check (length(btrim(titulo)) between 2 and 120),
  descricao text check (length(descricao) <= 5000),
  categoria text not null check (length(categoria) between 2 and 60),
  inicio timestamptz not null,
  duracao_min int not null check (duracao_min between 5 and 1440),
  fuso text not null,
  status text not null default 'rascunho'
    check (status in ('rascunho', 'publicado', 'cancelado', 'adiado', 'encerrado')),
  motivo_status text check (length(motivo_status) <= 500),
  visibilidade text not null default 'interna' check (visibilidade in ('interna', 'publica')),
  local_id uuid references uj.locais (id),
  capacidade int check (capacidade between 1 and 100000),
  inscricao_ate timestamptz,
  lista_de_espera boolean not null default false,
  informacoes_uteis text check (length(informacoes_uteis) <= 5000),
  -- Identificador dos links públicos (F12): aleatório, nunca sequencial.
  id_publico text not null unique default replace(gen_random_uuid()::text, '-', ''),
  -- Autoria vem do contexto, nunca do pedido (sem privilégio de coluna para gravá-la).
  criado_por uuid not null default uj.conta_atual() references uj.contas (id),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  versao int not null default 1
);
create index eventos_comunidade_inicio on uj.eventos (comunidade_id, inicio);
create index eventos_serie on uj.eventos (serie_id) where serie_id is not null;
create index eventos_local on uj.eventos (local_id);
create index eventos_criado_por on uj.eventos (criado_por);

-- ---------------------------------------------------------------- etapas e atribuições

create table uj.etapas (
  id uuid primary key default gen_random_uuid(),
  comunidade_id uuid not null references uj.comunidades (id),
  evento_id uuid not null references uj.eventos (id) on delete cascade,
  ordem int not null check (ordem >= 0),
  titulo text not null check (length(btrim(titulo)) between 1 and 120),
  descricao text check (length(descricao) <= 2000),
  duracao_min int not null check (duracao_min between 1 and 600),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  versao int not null default 1,
  unique (evento_id, ordem) deferrable initially deferred
);
create index etapas_comunidade on uj.etapas (comunidade_id, evento_id, ordem);

-- Quem faz o quê: responsável do evento (etapa_id nulo) ou integrante de uma
-- etapa. A F9 usa `estado` para confirmação e substituição.
create table uj.atribuicoes (
  id uuid primary key default gen_random_uuid(),
  comunidade_id uuid not null references uj.comunidades (id),
  evento_id uuid not null references uj.eventos (id) on delete cascade,
  etapa_id uuid references uj.etapas (id) on delete cascade,
  vinculo_id uuid not null references uj.vinculos (id),
  funcao text not null default 'integrante' check (length(funcao) between 2 and 60),
  estado text not null default 'pendente'
    check (estado in ('pendente', 'confirmada', 'recusada', 'substituicao_pedida')),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index atribuicoes_comunidade on uj.atribuicoes (comunidade_id, evento_id);
create index atribuicoes_vinculo on uj.atribuicoes (vinculo_id);
create index atribuicoes_etapa on uj.atribuicoes (etapa_id);
create unique index atribuicoes_unica on uj.atribuicoes
  (evento_id, coalesce(etapa_id, '00000000-0000-0000-0000-000000000000'::uuid), vinculo_id, funcao);

-- ---------------------------------------------------------------- tarefas, materiais, checklists

create table uj.tarefas (
  id uuid primary key default gen_random_uuid(),
  comunidade_id uuid not null references uj.comunidades (id),
  evento_id uuid not null references uj.eventos (id) on delete cascade,
  titulo text not null check (length(btrim(titulo)) between 2 and 200),
  descricao text check (length(descricao) <= 2000),
  responsavel_vinculo_id uuid references uj.vinculos (id),
  prazo timestamptz,
  concluida_em timestamptz,
  concluida_por uuid references uj.contas (id),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  versao int not null default 1
);
create index tarefas_comunidade on uj.tarefas (comunidade_id, evento_id);
create index tarefas_responsavel on uj.tarefas (responsavel_vinculo_id);
create index tarefas_concluida_por on uj.tarefas (concluida_por);

create table uj.materiais (
  id uuid primary key default gen_random_uuid(),
  comunidade_id uuid not null references uj.comunidades (id),
  evento_id uuid not null references uj.eventos (id) on delete cascade,
  nome text not null check (length(btrim(nome)) between 1 and 200),
  quantidade text check (length(quantidade) <= 60),
  responsavel_vinculo_id uuid references uj.vinculos (id),
  providenciado_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  versao int not null default 1
);
create index materiais_comunidade on uj.materiais (comunidade_id, evento_id);
create index materiais_responsavel on uj.materiais (responsavel_vinculo_id);

create table uj.checklist_itens (
  id uuid primary key default gen_random_uuid(),
  comunidade_id uuid not null references uj.comunidades (id),
  evento_id uuid not null references uj.eventos (id) on delete cascade,
  tipo text not null check (tipo in ('preparacao', 'encerramento')),
  texto text not null check (length(btrim(texto)) between 1 and 300),
  ordem int not null default 0,
  responsavel_vinculo_id uuid references uj.vinculos (id),
  marcado_em timestamptz,
  marcado_por uuid references uj.contas (id),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  versao int not null default 1
);
create index checklist_comunidade on uj.checklist_itens (comunidade_id, evento_id, tipo, ordem);
create index checklist_responsavel on uj.checklist_itens (responsavel_vinculo_id);
create index checklist_marcado_por on uj.checklist_itens (marcado_por);

-- ---------------------------------------------------------------- notas internas e anexos

create table uj.notas_internas (
  id uuid primary key default gen_random_uuid(),
  comunidade_id uuid not null references uj.comunidades (id),
  evento_id uuid not null references uj.eventos (id) on delete cascade,
  texto text not null check (length(btrim(texto)) between 1 and 5000),
  autor_conta_id uuid not null default uj.conta_atual() references uj.contas (id),
  criado_em timestamptz not null default now()
);
create index notas_comunidade on uj.notas_internas (comunidade_id, evento_id, criado_em);
create index notas_autor on uj.notas_internas (autor_conta_id);

-- Anexos por LINK (https). Upload de arquivo depende do armazenamento (Garage)
-- da F6; a coluna `tipo` já prevê 'arquivo'.
create table uj.anexos (
  id uuid primary key default gen_random_uuid(),
  comunidade_id uuid not null references uj.comunidades (id),
  evento_id uuid not null references uj.eventos (id) on delete cascade,
  tipo text not null default 'link' check (tipo in ('link', 'arquivo')),
  titulo text not null check (length(btrim(titulo)) between 1 and 120),
  -- (Regex do Postgres aceita repetição até 255: o tamanho vai num check à parte.)
  url text check (url ~ '^https://\S+$' and length(url) <= 2000),
  arquivo_chave text check (length(arquivo_chave) <= 300),
  criado_por uuid not null default uj.conta_atual() references uj.contas (id),
  criado_em timestamptz not null default now(),
  check ((tipo = 'link') = (url is not null)),
  check ((tipo = 'arquivo') = (arquivo_chave is not null))
);
create index anexos_comunidade on uj.anexos (comunidade_id, evento_id);
create index anexos_criado_por on uj.anexos (criado_por);

-- ---------------------------------------------------------------- modelos

create table uj.modelos (
  id uuid primary key default gen_random_uuid(),
  comunidade_id uuid not null references uj.comunidades (id),
  nome text not null check (length(btrim(nome)) between 2 and 80),
  categoria text not null check (length(categoria) between 2 and 60),
  descricao text check (length(descricao) <= 2000),
  -- [{titulo, duracaoMin, descricao?}] e [{tipo, texto}]: validados pela API (Zod).
  etapas jsonb not null default '[]'::jsonb check (jsonb_typeof(etapas) = 'array'),
  checklist jsonb not null default '[]'::jsonb check (jsonb_typeof(checklist) = 'array'),
  criado_por uuid not null default uj.conta_atual() references uj.contas (id),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index modelos_comunidade on uj.modelos (comunidade_id, nome);
create index modelos_criado_por on uj.modelos (criado_por);

-- ---------------------------------------------------------------- gatilhos

create trigger locais_atualizado before update on uj.locais
  for each row execute function uj.tocar_atualizado_em();
create trigger eventos_atualizado before update on uj.eventos
  for each row execute function uj.tocar_atualizado_em();
create trigger etapas_atualizado before update on uj.etapas
  for each row execute function uj.tocar_atualizado_em();
create trigger atribuicoes_atualizado before update on uj.atribuicoes
  for each row execute function uj.tocar_atualizado_em();
create trigger tarefas_atualizado before update on uj.tarefas
  for each row execute function uj.tocar_atualizado_em();
create trigger materiais_atualizado before update on uj.materiais
  for each row execute function uj.tocar_atualizado_em();
create trigger checklist_atualizado before update on uj.checklist_itens
  for each row execute function uj.tocar_atualizado_em();
create trigger modelos_atualizado before update on uj.modelos
  for each row execute function uj.tocar_atualizado_em();

-- Versão para concorrência otimista (a API usa `where versao = $esperada`).
create function uj.subir_versao() returns trigger
  language plpgsql
  as $$
begin
  new.versao := old.versao + 1;
  return new;
end
$$;
create trigger locais_versao before update on uj.locais for each row execute function uj.subir_versao();
create trigger eventos_versao before update on uj.eventos for each row execute function uj.subir_versao();
create trigger etapas_versao before update on uj.etapas for each row execute function uj.subir_versao();
create trigger tarefas_versao before update on uj.tarefas for each row execute function uj.subir_versao();
create trigger materiais_versao before update on uj.materiais for each row execute function uj.subir_versao();
create trigger checklist_versao before update on uj.checklist_itens for each row execute function uj.subir_versao();

-- Filhos sempre da mesma comunidade do evento; vínculos citados também.
create function uj.guardar_filho_de_evento() returns trigger
  language plpgsql security definer
  set search_path = pg_catalog, uj
  as $$
begin
  if not exists (select 1 from uj.eventos where id = new.evento_id and comunidade_id = new.comunidade_id) then
    raise exception 'evento de outra comunidade' using errcode = '23503';
  end if;
  if tg_table_name = 'atribuicoes' then
    perform uj.exigir_vinculo_da_comunidade(new.vinculo_id, new.comunidade_id);
    if new.etapa_id is not null and not exists (
         select 1 from uj.etapas where id = new.etapa_id and evento_id = new.evento_id) then
      raise exception 'etapa de outro evento' using errcode = '23503';
    end if;
  elsif tg_table_name in ('tarefas', 'materiais', 'checklist_itens') then
    perform uj.exigir_vinculo_da_comunidade(new.responsavel_vinculo_id, new.comunidade_id);
  end if;
  return new;
end
$$;
create trigger etapas_guardar before insert or update on uj.etapas
  for each row execute function uj.guardar_filho_de_evento();
create trigger atribuicoes_guardar before insert or update on uj.atribuicoes
  for each row execute function uj.guardar_filho_de_evento();
create trigger tarefas_guardar before insert or update on uj.tarefas
  for each row execute function uj.guardar_filho_de_evento();
create trigger materiais_guardar before insert or update on uj.materiais
  for each row execute function uj.guardar_filho_de_evento();
create trigger checklist_guardar before insert or update on uj.checklist_itens
  for each row execute function uj.guardar_filho_de_evento();
create trigger notas_guardar before insert or update on uj.notas_internas
  for each row execute function uj.guardar_filho_de_evento();
create trigger anexos_guardar before insert or update on uj.anexos
  for each row execute function uj.guardar_filho_de_evento();

create function uj.guardar_evento() returns trigger
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
create trigger eventos_guardar before insert or update on uj.eventos
  for each row execute function uj.guardar_evento();

-- Ações pessoais de quem não organiza: só as colunas de conclusão/marcação.
create function uj.limitar_acao_pessoal() returns trigger
  language plpgsql
  set search_path = pg_catalog, uj
  as $$
begin
  if current_user = 'uj_dono' then
    return new;
  end if;
  -- Quem concluiu/marcou é sempre a conta do contexto, para qualquer papel.
  if tg_table_name = 'tarefas' then
    new.concluida_por := case when new.concluida_em is null then null else uj.conta_atual() end;
  elsif tg_table_name = 'checklist_itens' then
    new.marcado_por := case when new.marcado_em is null then null else uj.conta_atual() end;
  end if;
  if (select uj.nivel_gravavel_no_contexto()) >= 20 then
    return new;
  end if;
  if tg_table_name = 'tarefas' then
    if (new.titulo, new.descricao, new.responsavel_vinculo_id, new.prazo)
       is distinct from (old.titulo, old.descricao, old.responsavel_vinculo_id, old.prazo) then
      raise exception 'so organizadores editam a tarefa' using errcode = '42501';
    end if;
    new.concluida_por := case when new.concluida_em is null then null else uj.conta_atual() end;
  elsif tg_table_name = 'checklist_itens' then
    if (new.tipo, new.texto, new.ordem, new.responsavel_vinculo_id)
       is distinct from (old.tipo, old.texto, old.ordem, old.responsavel_vinculo_id) then
      raise exception 'so organizadores editam o item' using errcode = '42501';
    end if;
    new.marcado_por := case when new.marcado_em is null then null else uj.conta_atual() end;
  elsif tg_table_name = 'materiais' then
    if (new.nome, new.quantidade, new.responsavel_vinculo_id)
       is distinct from (old.nome, old.quantidade, old.responsavel_vinculo_id) then
      raise exception 'so organizadores editam o material' using errcode = '42501';
    end if;
  end if;
  return new;
end
$$;
create trigger tarefas_pessoal before update on uj.tarefas
  for each row execute function uj.limitar_acao_pessoal();
create trigger checklist_pessoal before update on uj.checklist_itens
  for each row execute function uj.limitar_acao_pessoal();
create trigger materiais_pessoal before update on uj.materiais
  for each row execute function uj.limitar_acao_pessoal();

-- Log de mudanças. Evento em rascunho só é anunciado a organizadores.
create function uj.registrar_mudanca_de_evento() returns trigger
  language plpgsql security definer
  set search_path = pg_catalog, uj
  as $$
declare
  linha record;
begin
  if tg_op = 'DELETE' then linha := old; else linha := new; end if;
  insert into uj.mudancas (comunidade_id, tabela, registro_id, operacao, nivel_minimo)
    values (linha.comunidade_id, 'eventos', linha.id, left(tg_op, 1),
            case when linha.status = 'rascunho' then 20 else 10 end);
  return null;
end
$$;
create trigger eventos_mudanca after insert or update or delete on uj.eventos
  for each row execute function uj.registrar_mudanca_de_evento();
create trigger locais_mudanca after insert or update or delete on uj.locais
  for each row execute function uj.registrar_mudanca('10');
create trigger etapas_mudanca after insert or update or delete on uj.etapas
  for each row execute function uj.registrar_mudanca('10');
create trigger atribuicoes_mudanca after insert or update or delete on uj.atribuicoes
  for each row execute function uj.registrar_mudanca('10');
create trigger tarefas_mudanca after insert or update or delete on uj.tarefas
  for each row execute function uj.registrar_mudanca('10');
create trigger materiais_mudanca after insert or update or delete on uj.materiais
  for each row execute function uj.registrar_mudanca('10');
create trigger checklist_mudanca after insert or update or delete on uj.checklist_itens
  for each row execute function uj.registrar_mudanca('10');
create trigger notas_mudanca after insert or update or delete on uj.notas_internas
  for each row execute function uj.registrar_mudanca('20');
create trigger anexos_mudanca after insert or update or delete on uj.anexos
  for each row execute function uj.registrar_mudanca('10');
create trigger modelos_mudanca after insert or update or delete on uj.modelos
  for each row execute function uj.registrar_mudanca('20');

-- ---------------------------------------------------------------- RLS

alter table uj.locais enable row level security;
alter table uj.eventos enable row level security;
alter table uj.etapas enable row level security;
alter table uj.atribuicoes enable row level security;
alter table uj.tarefas enable row level security;
alter table uj.materiais enable row level security;
alter table uj.checklist_itens enable row level security;
alter table uj.notas_internas enable row level security;
alter table uj.anexos enable row level security;
alter table uj.modelos enable row level security;

-- Locais e modelos.
create policy locais_ler on uj.locais for select to uj_api
  using (comunidade_id = (select uj.comunidade_atual()) and (select uj.nivel_no_contexto()) >= 10);
create policy locais_gravar on uj.locais for all to uj_api
  using (comunidade_id = (select uj.comunidade_atual()) and (select uj.nivel_gravavel_no_contexto()) >= 20)
  with check (comunidade_id = (select uj.comunidade_atual()) and (select uj.nivel_gravavel_no_contexto()) >= 20);
create policy modelos_ler on uj.modelos for select to uj_api
  using (comunidade_id = (select uj.comunidade_atual()) and (select uj.nivel_no_contexto()) >= 20);
create policy modelos_gravar on uj.modelos for all to uj_api
  using (comunidade_id = (select uj.comunidade_atual()) and (select uj.nivel_gravavel_no_contexto()) >= 20)
  with check (comunidade_id = (select uj.comunidade_atual()) and (select uj.nivel_gravavel_no_contexto()) >= 20);

-- Eventos: rascunho só para organizadores.
create policy eventos_ler on uj.eventos for select to uj_api
  using (comunidade_id = (select uj.comunidade_atual())
         and ((select uj.nivel_no_contexto()) >= 20
              or ((select uj.nivel_no_contexto()) >= 10 and status <> 'rascunho')));
create policy eventos_gravar on uj.eventos for all to uj_api
  using (comunidade_id = (select uj.comunidade_atual()) and (select uj.nivel_gravavel_no_contexto()) >= 20)
  with check (comunidade_id = (select uj.comunidade_atual()) and (select uj.nivel_gravavel_no_contexto()) >= 20);

-- Filhos de evento: leitura acompanha a visibilidade do evento (rascunho = organizadores).
create function uj.evento_visivel_para_membro(p_evento uuid) returns boolean
  language sql stable security definer
  set search_path = pg_catalog, uj
  as $$ select exists (select 1 from uj.eventos where id = p_evento and status <> 'rascunho') $$;

create policy etapas_ler on uj.etapas for select to uj_api
  using (comunidade_id = (select uj.comunidade_atual())
         and ((select uj.nivel_no_contexto()) >= 20
              or ((select uj.nivel_no_contexto()) >= 10 and uj.evento_visivel_para_membro(evento_id))));
create policy etapas_gravar on uj.etapas for all to uj_api
  using (comunidade_id = (select uj.comunidade_atual()) and (select uj.nivel_gravavel_no_contexto()) >= 20)
  with check (comunidade_id = (select uj.comunidade_atual()) and (select uj.nivel_gravavel_no_contexto()) >= 20);

create policy atribuicoes_ler on uj.atribuicoes for select to uj_api
  using (comunidade_id = (select uj.comunidade_atual())
         and ((select uj.nivel_no_contexto()) >= 20
              or ((select uj.nivel_no_contexto()) >= 10 and uj.evento_visivel_para_membro(evento_id))));
create policy atribuicoes_gravar on uj.atribuicoes for all to uj_api
  using (comunidade_id = (select uj.comunidade_atual()) and (select uj.nivel_gravavel_no_contexto()) >= 20)
  with check (comunidade_id = (select uj.comunidade_atual()) and (select uj.nivel_gravavel_no_contexto()) >= 20);

create policy tarefas_ler on uj.tarefas for select to uj_api
  using (comunidade_id = (select uj.comunidade_atual())
         and ((select uj.nivel_no_contexto()) >= 20
              or ((select uj.nivel_no_contexto()) >= 10 and uj.evento_visivel_para_membro(evento_id))));
create policy tarefas_gravar on uj.tarefas for all to uj_api
  using (comunidade_id = (select uj.comunidade_atual()) and (select uj.nivel_gravavel_no_contexto()) >= 20)
  with check (comunidade_id = (select uj.comunidade_atual()) and (select uj.nivel_gravavel_no_contexto()) >= 20);
-- Membro conclui a PRÓPRIA tarefa (o gatilho limita as colunas).
create policy tarefas_concluir_propria on uj.tarefas for update to uj_api
  using (comunidade_id = (select uj.comunidade_atual()) and (select uj.nivel_gravavel_no_contexto()) >= 10
         and responsavel_vinculo_id = (select uj.vinculo_da_conta_no_contexto()))
  with check (comunidade_id = (select uj.comunidade_atual())
         and responsavel_vinculo_id = (select uj.vinculo_da_conta_no_contexto()));

create policy materiais_ler on uj.materiais for select to uj_api
  using (comunidade_id = (select uj.comunidade_atual())
         and ((select uj.nivel_no_contexto()) >= 20
              or ((select uj.nivel_no_contexto()) >= 10 and uj.evento_visivel_para_membro(evento_id))));
create policy materiais_gravar on uj.materiais for all to uj_api
  using (comunidade_id = (select uj.comunidade_atual()) and (select uj.nivel_gravavel_no_contexto()) >= 20)
  with check (comunidade_id = (select uj.comunidade_atual()) and (select uj.nivel_gravavel_no_contexto()) >= 20);
create policy materiais_providenciar_proprio on uj.materiais for update to uj_api
  using (comunidade_id = (select uj.comunidade_atual()) and (select uj.nivel_gravavel_no_contexto()) >= 10
         and responsavel_vinculo_id = (select uj.vinculo_da_conta_no_contexto()))
  with check (comunidade_id = (select uj.comunidade_atual())
         and responsavel_vinculo_id = (select uj.vinculo_da_conta_no_contexto()));

create policy checklist_ler on uj.checklist_itens for select to uj_api
  using (comunidade_id = (select uj.comunidade_atual())
         and ((select uj.nivel_no_contexto()) >= 20
              or ((select uj.nivel_no_contexto()) >= 10 and uj.evento_visivel_para_membro(evento_id))));
create policy checklist_gravar on uj.checklist_itens for all to uj_api
  using (comunidade_id = (select uj.comunidade_atual()) and (select uj.nivel_gravavel_no_contexto()) >= 20)
  with check (comunidade_id = (select uj.comunidade_atual()) and (select uj.nivel_gravavel_no_contexto()) >= 20);
create policy checklist_marcar_proprio on uj.checklist_itens for update to uj_api
  using (comunidade_id = (select uj.comunidade_atual()) and (select uj.nivel_gravavel_no_contexto()) >= 10
         and responsavel_vinculo_id = (select uj.vinculo_da_conta_no_contexto()))
  with check (comunidade_id = (select uj.comunidade_atual())
         and responsavel_vinculo_id = (select uj.vinculo_da_conta_no_contexto()));

-- Notas internas: só organizadores leem e escrevem.
create policy notas_ler on uj.notas_internas for select to uj_api
  using (comunidade_id = (select uj.comunidade_atual()) and (select uj.nivel_no_contexto()) >= 20);
create policy notas_gravar on uj.notas_internas for all to uj_api
  using (comunidade_id = (select uj.comunidade_atual()) and (select uj.nivel_gravavel_no_contexto()) >= 20)
  with check (comunidade_id = (select uj.comunidade_atual()) and (select uj.nivel_gravavel_no_contexto()) >= 20
              and autor_conta_id = (select uj.conta_atual()));

create policy anexos_ler on uj.anexos for select to uj_api
  using (comunidade_id = (select uj.comunidade_atual())
         and ((select uj.nivel_no_contexto()) >= 20
              or ((select uj.nivel_no_contexto()) >= 10 and uj.evento_visivel_para_membro(evento_id))));
create policy anexos_gravar on uj.anexos for all to uj_api
  using (comunidade_id = (select uj.comunidade_atual()) and (select uj.nivel_gravavel_no_contexto()) >= 20)
  with check (comunidade_id = (select uj.comunidade_atual()) and (select uj.nivel_gravavel_no_contexto()) >= 20
              and criado_por = (select uj.conta_atual()));

-- ---------------------------------------------------------------- privilégios

revoke execute on all functions in schema uj from public;
grant execute on function uj.vinculo_da_conta_no_contexto(), uj.evento_visivel_para_membro(uuid)
  to uj_api;

-- Privilégio por coluna: autoria, versão, identificadores e datas de sistema
-- nunca vêm do pedido.
grant select, delete on uj.locais, uj.eventos, uj.etapas, uj.atribuicoes, uj.tarefas,
  uj.materiais, uj.checklist_itens, uj.notas_internas, uj.anexos, uj.modelos to uj_api;

grant insert (comunidade_id, nome, tipo, endereco, latitude, longitude, referencia),
  update (nome, tipo, endereco, latitude, longitude, referencia, arquivado) on uj.locais to uj_api;
grant insert (comunidade_id, serie_id, ocorrencia_original, titulo, descricao, categoria, inicio,
  duracao_min, fuso, status, motivo_status, visibilidade, local_id, capacidade, inscricao_ate,
  lista_de_espera, informacoes_uteis),
  update (serie_id, titulo, descricao, categoria, inicio, duracao_min, status, motivo_status,
  visibilidade, local_id, capacidade, inscricao_ate, lista_de_espera, informacoes_uteis)
  on uj.eventos to uj_api;
grant insert (comunidade_id, evento_id, ordem, titulo, descricao, duracao_min),
  update (ordem, titulo, descricao, duracao_min) on uj.etapas to uj_api;
grant insert (comunidade_id, evento_id, etapa_id, vinculo_id, funcao),
  update (funcao, estado) on uj.atribuicoes to uj_api;
grant insert (comunidade_id, evento_id, titulo, descricao, responsavel_vinculo_id, prazo),
  update (titulo, descricao, responsavel_vinculo_id, prazo, concluida_em) on uj.tarefas to uj_api;
grant insert (comunidade_id, evento_id, nome, quantidade, responsavel_vinculo_id),
  update (nome, quantidade, responsavel_vinculo_id, providenciado_em) on uj.materiais to uj_api;
grant insert (comunidade_id, evento_id, tipo, texto, ordem, responsavel_vinculo_id),
  update (tipo, texto, ordem, responsavel_vinculo_id, marcado_em) on uj.checklist_itens to uj_api;
grant insert (comunidade_id, evento_id, texto) on uj.notas_internas to uj_api;
grant insert (comunidade_id, evento_id, tipo, titulo, url) on uj.anexos to uj_api;
grant insert (comunidade_id, nome, categoria, descricao, etapas, checklist),
  update (nome, categoria, descricao, etapas, checklist) on uj.modelos to uj_api;
