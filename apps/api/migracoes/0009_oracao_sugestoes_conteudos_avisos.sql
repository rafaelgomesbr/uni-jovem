-- 0009: pedidos de oração, sugestões, conteúdos e avisos (F15). Segue o padrão
-- do cabeçalho de 0001 (comunidade_id, índice por comunidade, RLS por contexto
-- com InitPlan, log de mudanças).
--
-- PEDIDOS DE ORAÇÃO
--   * O texto é cifrado NA APLICAÇÃO (AES-256-GCM, chave ORACAO_CHAVE fora do
--     banco, dado autenticado 'oracao:<id>'). O banco só vê bytes: dumps e
--     backups não mostram o texto.
--   * A visibilidade é aplicada AQUI, na política, e não só na rota:
--     'somente_eu' só a autora; 'equipe_oracao' a autora e quem tem a designação;
--     'comunidade' todo vínculo ativo. Papel (admin, organizador) e o Criador,
--     inclusive em intervenção com prova de 2FA, não abrem nada: a política não
--     tem cláusula de papel nem de proprietário.
--   * O log de mudanças leva só o id e a audiência (conta_alvo, designação),
--     nunca o texto. A auditoria de ações de oração só é legível pela própria
--     autora (política de auditoria refeita no fim deste arquivo).
--
-- SUGESTÕES
--   A autoria fica guardada (autor_conta_id), mas `uj_api` NÃO tem SELECT nessa
--   coluna: a leitura sai por `uj.sugestoes_visiveis()`, que só devolve o nome
--   da autora quando a sugestão não é anônima (ou para a própria autora).

-- ---------------------------------------------------------------- utilitários

-- A conta tem vínculo ativo (e conta ativa) na comunidade do contexto?
-- Pedido de quem saiu da comunidade deixa de aparecer para os outros.
create function uj.conta_ativa_no_contexto(p_conta uuid) returns boolean
  language sql stable security definer
  set search_path = pg_catalog, uj
  as $$
    select exists (
      select 1 from uj.vinculos v join uj.contas a on a.id = v.conta_id
       where v.comunidade_id = uj.comunidade_atual() and v.conta_id = p_conta
         and v.estado = 'ativo' and a.estado = 'ativa')
  $$;

-- ---------------------------------------------------------------- pedidos de oração

create table uj.pedidos_oracao (
  -- O id é gerado pela API antes de cifrar: ele entra no dado autenticado.
  id uuid primary key default gen_random_uuid(),
  comunidade_id uuid not null references uj.comunidades (id),
  autor_conta_id uuid not null default uj.conta_atual() references uj.contas (id),
  -- [versão 1 byte = 1][iv 12][tag 16][cifra]. O check barra texto claro gravado por engano.
  texto_cifrado bytea not null
    check (octet_length(texto_cifrado) between 30 and 16384 and get_byte(texto_cifrado, 0) = 1),
  visibilidade text not null default 'somente_eu'
    check (visibilidade in ('somente_eu', 'equipe_oracao', 'comunidade')),
  respondido_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  versao int not null default 1
);
create index pedidos_oracao_comunidade on uj.pedidos_oracao (comunidade_id, criado_em desc);
create index pedidos_oracao_autor on uj.pedidos_oracao (autor_conta_id);

-- "Estou orando": uma linha por pessoa e pedido.
create table uj.intercessoes (
  id uuid primary key default gen_random_uuid(),
  comunidade_id uuid not null references uj.comunidades (id),
  pedido_id uuid not null references uj.pedidos_oracao (id) on delete cascade,
  conta_id uuid not null default uj.conta_atual() references uj.contas (id),
  criado_em timestamptz not null default now(),
  unique (pedido_id, conta_id)
);
create index intercessoes_comunidade on uj.intercessoes (comunidade_id, pedido_id);
create index intercessoes_conta on uj.intercessoes (conta_id);

create trigger pedidos_oracao_atualizado before update on uj.pedidos_oracao
  for each row execute function uj.tocar_atualizado_em();
create trigger pedidos_oracao_versao before update on uj.pedidos_oracao
  for each row execute function uj.subir_versao();

create function uj.guardar_intercessao() returns trigger
  language plpgsql security definer
  set search_path = pg_catalog, uj
  as $$
begin
  if not exists (select 1 from uj.pedidos_oracao
                  where id = new.pedido_id and comunidade_id = new.comunidade_id) then
    raise exception 'pedido de outra comunidade' using errcode = '23503';
  end if;
  return new;
end
$$;
create trigger intercessoes_guardar before insert or update on uj.intercessoes
  for each row execute function uj.guardar_intercessao();

-- Audiência de um pedido no log de mudanças: a autora sempre; a equipe pela
-- designação; a comunidade inteira sem alvo. Nunca o texto.
create function uj.anunciar_pedido_de_oracao(p_comunidade uuid, p_pedido uuid, p_autor uuid,
                                             p_visibilidade text, p_operacao char,
                                             p_incluir_autor boolean) returns void
  language plpgsql security definer
  set search_path = pg_catalog, uj
  as $$
begin
  if p_incluir_autor then
    insert into uj.mudancas (comunidade_id, tabela, registro_id, operacao, conta_alvo)
      values (p_comunidade, 'pedidos_oracao', p_pedido, p_operacao, p_autor);
  end if;
  if p_visibilidade = 'equipe_oracao' then
    insert into uj.mudancas (comunidade_id, tabela, registro_id, operacao, designacao)
      values (p_comunidade, 'pedidos_oracao', p_pedido, p_operacao, 'equipe_oracao');
  elsif p_visibilidade = 'comunidade' then
    insert into uj.mudancas (comunidade_id, tabela, registro_id, operacao)
      values (p_comunidade, 'pedidos_oracao', p_pedido, p_operacao);
  end if;
end
$$;

create function uj.registrar_mudanca_de_oracao() returns trigger
  language plpgsql security definer
  set search_path = pg_catalog, uj
  as $$
begin
  if tg_op = 'DELETE' then
    perform uj.anunciar_pedido_de_oracao(old.comunidade_id, old.id, old.autor_conta_id,
                                         old.visibilidade, 'D', true);
    return null;
  end if;
  perform uj.anunciar_pedido_de_oracao(new.comunidade_id, new.id, new.autor_conta_id,
                                       new.visibilidade, left(tg_op, 1), true);
  -- Quem deixou de ver também é avisado (com 'U': ao buscar, não acha mais).
  if tg_op = 'UPDATE' and old.visibilidade <> new.visibilidade then
    perform uj.anunciar_pedido_de_oracao(old.comunidade_id, old.id, old.autor_conta_id,
                                         old.visibilidade, 'U', false);
  end if;
  return null;
end
$$;
create trigger pedidos_oracao_mudanca after insert or update or delete on uj.pedidos_oracao
  for each row execute function uj.registrar_mudanca_de_oracao();

-- "Estou orando" muda a contagem do pedido: anuncia o PEDIDO para a mesma audiência.
create function uj.registrar_mudanca_de_intercessao() returns trigger
  language plpgsql security definer
  set search_path = pg_catalog, uj
  as $$
declare
  linha record;
  p uj.pedidos_oracao;
begin
  if tg_op = 'DELETE' then linha := old; else linha := new; end if;
  select * into p from uj.pedidos_oracao where id = linha.pedido_id;
  -- Apagada em cascata com o pedido: a exclusão do pedido já foi anunciada.
  if found then
    perform uj.anunciar_pedido_de_oracao(p.comunidade_id, p.id, p.autor_conta_id,
                                         p.visibilidade, 'U', true);
  end if;
  return null;
end
$$;
create trigger intercessoes_mudanca after insert or delete on uj.intercessoes
  for each row execute function uj.registrar_mudanca_de_intercessao();

alter table uj.pedidos_oracao enable row level security;
alter table uj.intercessoes enable row level security;

-- Sem cláusula de papel nem de proprietário, de propósito (ver cabeçalho).
create policy pedidos_oracao_ler on uj.pedidos_oracao for select to uj_api
  using (comunidade_id = (select uj.comunidade_atual())
         and (select uj.nivel_no_contexto()) >= 10
         and (autor_conta_id = (select uj.conta_atual())
              or ((visibilidade = 'comunidade'
                   or (visibilidade = 'equipe_oracao'
                       and array['equipe_oracao'] <@ (select uj.designacoes_no_contexto())))
                  and uj.conta_ativa_no_contexto(autor_conta_id))));
create policy pedidos_oracao_criar on uj.pedidos_oracao for insert to uj_api
  with check (comunidade_id = (select uj.comunidade_atual())
              and (select uj.nivel_gravavel_no_contexto()) >= 10
              and autor_conta_id = (select uj.conta_atual()));
create policy pedidos_oracao_alterar on uj.pedidos_oracao for update to uj_api
  using (comunidade_id = (select uj.comunidade_atual())
         and (select uj.nivel_gravavel_no_contexto()) >= 10
         and autor_conta_id = (select uj.conta_atual()))
  with check (comunidade_id = (select uj.comunidade_atual())
              and autor_conta_id = (select uj.conta_atual()));
create policy pedidos_oracao_excluir on uj.pedidos_oracao for delete to uj_api
  using (comunidade_id = (select uj.comunidade_atual())
         and (select uj.nivel_gravavel_no_contexto()) >= 10
         and autor_conta_id = (select uj.conta_atual()));

-- SECURITY INVOKER de propósito: a consulta passa pela política de leitura de
-- pedidos_oracao, então "vê a intercessão" = "vê o pedido", uma regra só.
create function uj.pedido_de_oracao_visivel(p_pedido uuid) returns boolean
  language sql stable
  set search_path = pg_catalog, uj
  as $$ select exists (select 1 from uj.pedidos_oracao where id = p_pedido) $$;

create policy intercessoes_ler on uj.intercessoes for select to uj_api
  using (comunidade_id = (select uj.comunidade_atual())
         and (select uj.nivel_no_contexto()) >= 10
         and uj.pedido_de_oracao_visivel(pedido_id));
create policy intercessoes_inserir on uj.intercessoes for insert to uj_api
  with check (comunidade_id = (select uj.comunidade_atual())
              and (select uj.nivel_gravavel_no_contexto()) >= 10
              and conta_id = (select uj.conta_atual())
              and uj.pedido_de_oracao_visivel(pedido_id));
create policy intercessoes_excluir on uj.intercessoes for delete to uj_api
  using (comunidade_id = (select uj.comunidade_atual())
         and (select uj.nivel_gravavel_no_contexto()) >= 10
         and conta_id = (select uj.conta_atual()));

-- ---------------------------------------------------------------- sugestões

create table uj.sugestoes (
  id uuid primary key default gen_random_uuid(),
  comunidade_id uuid not null references uj.comunidades (id),
  -- Guardado sempre ("anônima para os demais, nunca para o sistema"); sem SELECT para uj_api.
  autor_conta_id uuid not null default uj.conta_atual() references uj.contas (id),
  anonima boolean not null default false,
  titulo text not null check (length(btrim(titulo)) between 2 and 120),
  texto text not null check (length(btrim(texto)) between 1 and 4000),
  status text not null default 'recebida'
    check (status in ('recebida', 'em_analise', 'aceita', 'recusada')),
  resposta text check (length(resposta) <= 2000),
  respondida_por uuid references uj.contas (id),
  respondida_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  versao int not null default 1
);
create index sugestoes_comunidade on uj.sugestoes (comunidade_id, status, criado_em desc);
create index sugestoes_autor on uj.sugestoes (autor_conta_id);
create index sugestoes_respondida_por on uj.sugestoes (respondida_por);

create trigger sugestoes_atualizado before update on uj.sugestoes
  for each row execute function uj.tocar_atualizado_em();
create trigger sugestoes_versao before update on uj.sugestoes
  for each row execute function uj.subir_versao();

-- Quem moderou é sempre a conta do contexto, nunca um valor do pedido.
create function uj.guardar_sugestao() returns trigger
  language plpgsql
  set search_path = pg_catalog, uj
  as $$
begin
  if current_user = 'uj_dono' then
    return new;
  end if;
  if (new.status, new.resposta) is distinct from (old.status, old.resposta) then
    new.respondida_por := uj.conta_atual();
    new.respondida_em := now();
  end if;
  return new;
end
$$;
create trigger sugestoes_guardar before update on uj.sugestoes
  for each row execute function uj.guardar_sugestao();

-- Organizadores sabem de toda sugestão; a autora, da sua. Sem autoria no log.
create function uj.registrar_mudanca_de_sugestao() returns trigger
  language plpgsql security definer
  set search_path = pg_catalog, uj
  as $$
declare
  linha record;
begin
  if tg_op = 'DELETE' then linha := old; else linha := new; end if;
  insert into uj.mudancas (comunidade_id, tabela, registro_id, operacao, nivel_minimo)
    values (linha.comunidade_id, 'sugestoes', linha.id, left(tg_op, 1), 20);
  insert into uj.mudancas (comunidade_id, tabela, registro_id, operacao, conta_alvo)
    values (linha.comunidade_id, 'sugestoes', linha.id, left(tg_op, 1), linha.autor_conta_id);
  return null;
end
$$;
create trigger sugestoes_mudanca after insert or update or delete on uj.sugestoes
  for each row execute function uj.registrar_mudanca_de_sugestao();

alter table uj.sugestoes enable row level security;

create policy sugestoes_ler on uj.sugestoes for select to uj_api
  using (comunidade_id = (select uj.comunidade_atual())
         and ((select uj.nivel_no_contexto()) >= 20
              or ((select uj.nivel_no_contexto()) >= 10
                  and autor_conta_id = (select uj.conta_atual()))));
create policy sugestoes_criar on uj.sugestoes for insert to uj_api
  with check (comunidade_id = (select uj.comunidade_atual())
              and (select uj.nivel_gravavel_no_contexto()) >= 10
              and autor_conta_id = (select uj.conta_atual()));
create policy sugestoes_moderar on uj.sugestoes for update to uj_api
  using (comunidade_id = (select uj.comunidade_atual()) and (select uj.nivel_gravavel_no_contexto()) >= 20)
  with check (comunidade_id = (select uj.comunidade_atual()) and (select uj.nivel_gravavel_no_contexto()) >= 20);
create policy sugestoes_excluir on uj.sugestoes for delete to uj_api
  using (comunidade_id = (select uj.comunidade_atual()) and (select uj.nivel_gravavel_no_contexto()) >= 20);

-- Leitura com a regra de anonimato. Mesmo filtro da política (comunidade do
-- contexto; organizadores veem todas, membro só as suas).
create function uj.sugestoes_visiveis()
  returns table (id uuid, anonima boolean, titulo text, texto text, status text, resposta text,
                 respondida_em timestamptz, respondida_por_nome text, autor_nome text,
                 minha boolean, criado_em timestamptz, atualizado_em timestamptz, versao int)
  language sql stable security definer
  set search_path = pg_catalog, uj
  as $$
    with eu as (select uj.nivel_no_contexto() as nivel, uj.conta_atual() as conta)
    select s.id, s.anonima, s.titulo, s.texto, s.status, s.resposta, s.respondida_em,
           case when r.estado = 'anonimizada' then 'Pessoa removida' else r.nome end,
           case
             when s.autor_conta_id = eu.conta or not s.anonima then
               case when a.estado = 'anonimizada' then 'Pessoa removida' else a.nome end
           end,
           s.autor_conta_id = eu.conta,
           s.criado_em, s.atualizado_em, s.versao
      from uj.sugestoes s
      join uj.contas a on a.id = s.autor_conta_id
      left join uj.contas r on r.id = s.respondida_por
      cross join eu
     where s.comunidade_id = uj.comunidade_atual()
       and eu.nivel >= 10
       and (eu.nivel >= 20 or s.autor_conta_id = eu.conta)
  $$;

-- ---------------------------------------------------------------- avisos

create table uj.avisos (
  id uuid primary key default gen_random_uuid(),
  comunidade_id uuid not null references uj.comunidades (id),
  titulo text not null check (length(btrim(titulo)) between 2 and 120),
  texto text not null check (length(btrim(texto)) between 1 and 5000),
  estado text not null default 'rascunho' check (estado in ('rascunho', 'publicado', 'despublicado')),
  fixado boolean not null default false,
  publicado_em timestamptz,
  -- Opcional: depois desta data o aviso some para os membros (continua para organizadores).
  visivel_ate timestamptz,
  criado_por uuid not null default uj.conta_atual() references uj.contas (id),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  versao int not null default 1,
  check (estado = 'rascunho' or publicado_em is not null)
);
create index avisos_comunidade on uj.avisos (comunidade_id, estado, fixado desc, publicado_em desc);
create index avisos_criado_por on uj.avisos (criado_por);

create trigger avisos_atualizado before update on uj.avisos
  for each row execute function uj.tocar_atualizado_em();
create trigger avisos_versao before update on uj.avisos
  for each row execute function uj.subir_versao();

-- A data de publicação é do servidor; um aviso publicado não volta a rascunho.
create function uj.guardar_aviso() returns trigger
  language plpgsql
  set search_path = pg_catalog, uj
  as $$
begin
  if new.estado = 'publicado' and (tg_op = 'INSERT' or old.estado <> 'publicado') then
    new.publicado_em := now();
  end if;
  if tg_op = 'UPDATE' and new.estado = 'rascunho' and old.estado <> 'rascunho' then
    raise exception 'aviso publicado nao volta a rascunho' using errcode = '23514';
  end if;
  if new.estado <> 'publicado' then
    new.fixado := false;
  end if;
  return new;
end
$$;
create trigger avisos_guardar before insert or update on uj.avisos
  for each row execute function uj.guardar_aviso();

-- Rascunho só interessa a organizadores; publicar ou despublicar avisa todos.
create function uj.registrar_mudanca_de_aviso() returns trigger
  language plpgsql security definer
  set search_path = pg_catalog, uj
  as $$
declare
  linha record;
  publico boolean;
begin
  if tg_op = 'DELETE' then linha := old; else linha := new; end if;
  publico := linha.estado = 'publicado' or (tg_op = 'UPDATE' and old.estado = 'publicado');
  insert into uj.mudancas (comunidade_id, tabela, registro_id, operacao, nivel_minimo)
    values (linha.comunidade_id, 'avisos', linha.id, left(tg_op, 1), case when publico then 10 else 20 end);
  return null;
end
$$;
create trigger avisos_mudanca after insert or update or delete on uj.avisos
  for each row execute function uj.registrar_mudanca_de_aviso();

alter table uj.avisos enable row level security;
create policy avisos_ler on uj.avisos for select to uj_api
  using (comunidade_id = (select uj.comunidade_atual())
         and ((select uj.nivel_no_contexto()) >= 20
              or ((select uj.nivel_no_contexto()) >= 10 and estado = 'publicado'
                  and (visivel_ate is null or visivel_ate > now()))));
create policy avisos_gravar on uj.avisos for all to uj_api
  using (comunidade_id = (select uj.comunidade_atual()) and (select uj.nivel_gravavel_no_contexto()) >= 20)
  with check (comunidade_id = (select uj.comunidade_atual()) and (select uj.nivel_gravavel_no_contexto()) >= 20);

-- ---------------------------------------------------------------- conteúdos

create table uj.musicas (
  id uuid primary key default gen_random_uuid(),
  comunidade_id uuid not null references uj.comunidades (id),
  titulo text not null check (length(btrim(titulo)) between 1 and 120),
  artista text check (length(artista) <= 120),
  tom text check (length(tom) <= 12),
  link text check (link ~ '^https://\S+$' and length(link) <= 2000),
  cifra text check (length(cifra) <= 20000),
  observacoes text check (length(observacoes) <= 2000),
  arquivada boolean not null default false,
  criado_por uuid not null default uj.conta_atual() references uj.contas (id),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  versao int not null default 1
);
create index musicas_comunidade on uj.musicas (comunidade_id, titulo);
create index musicas_criado_por on uj.musicas (criado_por);

create table uj.musicos (
  id uuid primary key default gen_random_uuid(),
  comunidade_id uuid not null references uj.comunidades (id),
  nome text not null check (length(btrim(nome)) between 2 and 120),
  instrumentos text[] not null default '{}' check (cardinality(instrumentos) <= 10),
  -- Opcional: quando o músico é alguém da comunidade (sem copiar contato).
  vinculo_id uuid references uj.vinculos (id),
  observacoes text check (length(observacoes) <= 2000),
  ativo boolean not null default true,
  criado_por uuid not null default uj.conta_atual() references uj.contas (id),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  versao int not null default 1
);
create index musicos_comunidade on uj.musicos (comunidade_id, nome);
create index musicos_vinculo on uj.musicos (vinculo_id);
create index musicos_criado_por on uj.musicos (criado_por);

-- Quem toca cada música.
create table uj.musica_musicos (
  id uuid primary key default gen_random_uuid(),
  comunidade_id uuid not null references uj.comunidades (id),
  musica_id uuid not null references uj.musicas (id) on delete cascade,
  musico_id uuid not null references uj.musicos (id) on delete cascade,
  unique (musica_id, musico_id)
);
create index musica_musicos_comunidade on uj.musica_musicos (comunidade_id, musica_id);
create index musica_musicos_musico on uj.musica_musicos (musico_id);

create table uj.palestrantes (
  id uuid primary key default gen_random_uuid(),
  comunidade_id uuid not null references uj.comunidades (id),
  nome text not null check (length(btrim(nome)) between 2 and 120),
  temas text check (length(temas) <= 500),
  origem text check (length(origem) <= 120),
  vinculo_id uuid references uj.vinculos (id),
  observacoes text check (length(observacoes) <= 2000),
  ativo boolean not null default true,
  criado_por uuid not null default uj.conta_atual() references uj.contas (id),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  versao int not null default 1
);
create index palestrantes_comunidade on uj.palestrantes (comunidade_id, nome);
create index palestrantes_vinculo on uj.palestrantes (vinculo_id);
create index palestrantes_criado_por on uj.palestrantes (criado_por);

create table uj.dinamicas (
  id uuid primary key default gen_random_uuid(),
  comunidade_id uuid not null references uj.comunidades (id),
  titulo text not null check (length(btrim(titulo)) between 2 and 120),
  objetivo text check (length(objetivo) <= 500),
  instrucoes text check (length(instrucoes) <= 10000),
  duracao_min int check (duracao_min between 1 and 600),
  materiais text check (length(materiais) <= 2000),
  arquivada boolean not null default false,
  criado_por uuid not null default uj.conta_atual() references uj.contas (id),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  versao int not null default 1
);
create index dinamicas_comunidade on uj.dinamicas (comunidade_id, titulo);
create index dinamicas_criado_por on uj.dinamicas (criado_por);

create trigger musicas_atualizado before update on uj.musicas
  for each row execute function uj.tocar_atualizado_em();
create trigger musicos_atualizado before update on uj.musicos
  for each row execute function uj.tocar_atualizado_em();
create trigger palestrantes_atualizado before update on uj.palestrantes
  for each row execute function uj.tocar_atualizado_em();
create trigger dinamicas_atualizado before update on uj.dinamicas
  for each row execute function uj.tocar_atualizado_em();
create trigger musicas_versao before update on uj.musicas
  for each row execute function uj.subir_versao();
create trigger musicos_versao before update on uj.musicos
  for each row execute function uj.subir_versao();
create trigger palestrantes_versao before update on uj.palestrantes
  for each row execute function uj.subir_versao();
create trigger dinamicas_versao before update on uj.dinamicas
  for each row execute function uj.subir_versao();

-- Vínculo citado e músicas/músicos ligados são sempre da MESMA comunidade.
create function uj.guardar_conteudo() returns trigger
  language plpgsql security definer
  set search_path = pg_catalog, uj
  as $$
begin
  if tg_table_name in ('musicos', 'palestrantes') then
    perform uj.exigir_vinculo_da_comunidade(new.vinculo_id, new.comunidade_id);
  elsif tg_table_name = 'musica_musicos' then
    if not exists (select 1 from uj.musicas where id = new.musica_id and comunidade_id = new.comunidade_id)
       or not exists (select 1 from uj.musicos where id = new.musico_id and comunidade_id = new.comunidade_id) then
      raise exception 'conteudo de outra comunidade' using errcode = '23503';
    end if;
  end if;
  return new;
end
$$;
create trigger musicos_guardar before insert or update on uj.musicos
  for each row execute function uj.guardar_conteudo();
create trigger palestrantes_guardar before insert or update on uj.palestrantes
  for each row execute function uj.guardar_conteudo();
create trigger musica_musicos_guardar before insert or update on uj.musica_musicos
  for each row execute function uj.guardar_conteudo();

create trigger musicas_mudanca after insert or update or delete on uj.musicas
  for each row execute function uj.registrar_mudanca('10');
create trigger musicos_mudanca after insert or update or delete on uj.musicos
  for each row execute function uj.registrar_mudanca('10');
create trigger musica_musicos_mudanca after insert or update or delete on uj.musica_musicos
  for each row execute function uj.registrar_mudanca('10');
create trigger palestrantes_mudanca after insert or update or delete on uj.palestrantes
  for each row execute function uj.registrar_mudanca('10');
create trigger dinamicas_mudanca after insert or update or delete on uj.dinamicas
  for each row execute function uj.registrar_mudanca('10');

alter table uj.musicas enable row level security;
alter table uj.musicos enable row level security;
alter table uj.musica_musicos enable row level security;
alter table uj.palestrantes enable row level security;
alter table uj.dinamicas enable row level security;

create policy musicas_ler on uj.musicas for select to uj_api
  using (comunidade_id = (select uj.comunidade_atual()) and (select uj.nivel_no_contexto()) >= 10);
create policy musicas_gravar on uj.musicas for all to uj_api
  using (comunidade_id = (select uj.comunidade_atual()) and (select uj.nivel_gravavel_no_contexto()) >= 20)
  with check (comunidade_id = (select uj.comunidade_atual()) and (select uj.nivel_gravavel_no_contexto()) >= 20);
create policy musicos_ler on uj.musicos for select to uj_api
  using (comunidade_id = (select uj.comunidade_atual()) and (select uj.nivel_no_contexto()) >= 10);
create policy musicos_gravar on uj.musicos for all to uj_api
  using (comunidade_id = (select uj.comunidade_atual()) and (select uj.nivel_gravavel_no_contexto()) >= 20)
  with check (comunidade_id = (select uj.comunidade_atual()) and (select uj.nivel_gravavel_no_contexto()) >= 20);
create policy musica_musicos_ler on uj.musica_musicos for select to uj_api
  using (comunidade_id = (select uj.comunidade_atual()) and (select uj.nivel_no_contexto()) >= 10);
create policy musica_musicos_gravar on uj.musica_musicos for all to uj_api
  using (comunidade_id = (select uj.comunidade_atual()) and (select uj.nivel_gravavel_no_contexto()) >= 20)
  with check (comunidade_id = (select uj.comunidade_atual()) and (select uj.nivel_gravavel_no_contexto()) >= 20);
create policy palestrantes_ler on uj.palestrantes for select to uj_api
  using (comunidade_id = (select uj.comunidade_atual()) and (select uj.nivel_no_contexto()) >= 10);
create policy palestrantes_gravar on uj.palestrantes for all to uj_api
  using (comunidade_id = (select uj.comunidade_atual()) and (select uj.nivel_gravavel_no_contexto()) >= 20)
  with check (comunidade_id = (select uj.comunidade_atual()) and (select uj.nivel_gravavel_no_contexto()) >= 20);
create policy dinamicas_ler on uj.dinamicas for select to uj_api
  using (comunidade_id = (select uj.comunidade_atual()) and (select uj.nivel_no_contexto()) >= 10);
create policy dinamicas_gravar on uj.dinamicas for all to uj_api
  using (comunidade_id = (select uj.comunidade_atual()) and (select uj.nivel_gravavel_no_contexto()) >= 20)
  with check (comunidade_id = (select uj.comunidade_atual()) and (select uj.nivel_gravavel_no_contexto()) >= 20);

-- ---------------------------------------------------------------- auditoria de oração

-- Ação sobre pedido de oração ('oracao.*') revela que a pessoa tem um pedido,
-- mesmo sem o texto. Fica registrada, mas só a própria autora a lê pela API;
-- admin e Criador não (o operador do banco, sim: limite L02).
drop policy auditoria_api_ler on uj.auditoria;
create policy auditoria_api_ler on uj.auditoria for select to uj_api
  using (
    ((comunidade_id is null and (select uj.eh_proprietario()))
     or (comunidade_id = (select uj.comunidade_atual())
         and ((select uj.nivel_no_contexto()) >= 30 or (select uj.eh_proprietario()))))
    and (acao not like 'oracao.%' or conta_id = (select uj.conta_atual())));

-- ---------------------------------------------------------------- privilégios

revoke execute on all functions in schema uj from public;
grant execute on function uj.conta_ativa_no_contexto(uuid), uj.pedido_de_oracao_visivel(uuid),
  uj.sugestoes_visiveis() to uj_api;

grant select, delete on uj.pedidos_oracao to uj_api;
grant insert (id, comunidade_id, texto_cifrado, visibilidade),
  update (texto_cifrado, visibilidade, respondido_em) on uj.pedidos_oracao to uj_api;
grant select, delete on uj.intercessoes to uj_api;
grant insert (comunidade_id, pedido_id) on uj.intercessoes to uj_api;

-- Sem `autor_conta_id`: a autoria só sai por uj.sugestoes_visiveis().
grant select (id, comunidade_id, anonima, titulo, texto, status, resposta, respondida_por,
  respondida_em, criado_em, atualizado_em, versao) on uj.sugestoes to uj_api;
grant delete on uj.sugestoes to uj_api;
grant insert (comunidade_id, anonima, titulo, texto),
  update (status, resposta) on uj.sugestoes to uj_api;

grant select, delete on uj.avisos to uj_api;
grant insert (comunidade_id, titulo, texto, estado, fixado, visivel_ate),
  update (titulo, texto, estado, fixado, visivel_ate) on uj.avisos to uj_api;

grant select, delete on uj.musicas, uj.musicos, uj.musica_musicos, uj.palestrantes, uj.dinamicas
  to uj_api;
grant insert (comunidade_id, titulo, artista, tom, link, cifra, observacoes),
  update (titulo, artista, tom, link, cifra, observacoes, arquivada) on uj.musicas to uj_api;
grant insert (comunidade_id, nome, instrumentos, vinculo_id, observacoes),
  update (nome, instrumentos, vinculo_id, observacoes, ativo) on uj.musicos to uj_api;
grant insert (comunidade_id, musica_id, musico_id) on uj.musica_musicos to uj_api;
grant insert (comunidade_id, nome, temas, origem, vinculo_id, observacoes),
  update (nome, temas, origem, vinculo_id, observacoes, ativo) on uj.palestrantes to uj_api;
grant insert (comunidade_id, titulo, objetivo, instrucoes, duracao_min, materiais),
  update (titulo, objetivo, instrucoes, duracao_min, materiais, arquivada) on uj.dinamicas to uj_api;
