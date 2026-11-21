-- 0027: repertório do encontro e cifra em ChordPro (D61, fatia 1 do modo músico).
-- Segue o padrão do cabeçalho de 0001 (comunidade_id, índice por comunidade,
-- RLS por contexto com InitPlan, log de mudanças).
--
--   * `uj.musicas` ganha andamento, duração e o registro de que a comunidade
--     confirmou ter direito de usar a letra e a cifra. O tom original (`tom`)
--     e a cifra em texto já existiam (0009): a cifra passa a poder ser
--     ChordPro, sem coluna de formato (o formato se deduz do texto, em
--     `packages/dominio`). Cifra antiga em texto livre continua abrindo.
--   * DIREITOS AUTORAIS: gravar ou mudar uma cifra exige a confirmação do
--     aviso de direitos (`direito_confirmado_em` renovado na mesma gravação). A
--     rota pede a confirmação com mensagem clara; este gatilho é a segunda
--     camada, para que nem uma rota esquecida grave cifra sem o aceite.
--   * `uj.repertorio_itens`: uma linha por música num encontro (ordem, tom do
--     dia, observação curta). Leitura acompanha a visibilidade do encontro
--     (rascunho só para organizadores, como `etapas`); escrita só de
--     organizador para cima. A mesma música não entra duas vezes no mesmo
--     encontro. Etapa (a do Louvor) e música são conferidas como da MESMA
--     comunidade por gatilho, mesmo com a API contornada.
--   * O log de mudanças leva só o id: nunca o texto da cifra nem o título.
--   * "AVISAR A BANDA": função atômica que enfileira, pela fila de 0011 (e
--     portanto respeitando a preferência "Escalas" de cada pessoa, o vínculo
--     ativo e a deduplicação de 1 h), uma notificação genérica, SEM nome de
--     música, para as pessoas convocadas (a lista de convocações de louvor vem
--     da API, que usa a regra do domínio; aqui cada uma é conferida como do
--     encontro e da comunidade). Quem avisa não se avisa.
--
-- Códigos de erro: UJ100 cifra sem confirmação de direitos; UJ101 encontro não
-- encontrado (404); UJ102 encontro que não está publicado ou já terminou.

-- ---------------------------------------------------------------- músicas

alter table uj.musicas
  add column andamento_bpm int check (andamento_bpm between 30 and 300),
  add column duracao_seg int check (duracao_seg between 10 and 3600),
  add column direito_confirmado_em timestamptz;

create function uj.guardar_musica() returns trigger
  language plpgsql
  set search_path = pg_catalog, uj
  as $$
begin
  if current_user = 'uj_dono' then
    return new;
  end if;
  if nullif(btrim(new.cifra), '') is not null
     and (tg_op = 'INSERT' or new.cifra is distinct from old.cifra)
     and (new.direito_confirmado_em is null
          or (tg_op = 'UPDATE'
              and new.direito_confirmado_em is not distinct from old.direito_confirmado_em)) then
    raise exception 'confirme o direito de uso da letra e da cifra' using errcode = 'UJ100';
  end if;
  return new;
end
$$;
create trigger musicas_guardar before insert or update on uj.musicas
  for each row execute function uj.guardar_musica();

-- ---------------------------------------------------------------- repertório do encontro

create table uj.repertorio_itens (
  id uuid primary key default gen_random_uuid(),
  comunidade_id uuid not null references uj.comunidades (id),
  evento_id uuid not null references uj.eventos (id) on delete cascade,
  -- Normalmente a etapa Louvor; sem etapa, o repertório é do encontro todo.
  etapa_id uuid references uj.etapas (id) on delete set null,
  musica_id uuid not null references uj.musicas (id) on delete cascade,
  ordem int not null check (ordem >= 0),
  -- Tom do dia: só o nome do tom (G, Am, F#m, Bb), sem mexer na música da biblioteca.
  tom_do_dia text check (tom_do_dia ~ '^[A-G][#b]?m?$'),
  nota text check (length(nota) <= 300),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  versao int not null default 1,
  -- A ordem é trocada em várias linhas numa transação: a conferência é adiada.
  unique (evento_id, ordem) deferrable initially deferred,
  unique (evento_id, musica_id)
);
create index repertorio_itens_comunidade on uj.repertorio_itens (comunidade_id, evento_id, ordem);
create index repertorio_itens_musica on uj.repertorio_itens (musica_id);
create index repertorio_itens_etapa on uj.repertorio_itens (etapa_id);

create trigger repertorio_itens_atualizado before update on uj.repertorio_itens
  for each row execute function uj.tocar_atualizado_em();
create trigger repertorio_itens_versao before update on uj.repertorio_itens
  for each row execute function uj.subir_versao();

-- Evento, etapa e música são sempre da MESMA comunidade do item (e a etapa, do mesmo evento).
create function uj.guardar_repertorio_item() returns trigger
  language plpgsql security definer
  set search_path = pg_catalog, uj
  as $$
begin
  if not exists (select 1 from uj.eventos where id = new.evento_id and comunidade_id = new.comunidade_id)
     or not exists (select 1 from uj.musicas where id = new.musica_id and comunidade_id = new.comunidade_id) then
    raise exception 'repertorio com recurso de outra comunidade' using errcode = '23503';
  end if;
  if new.etapa_id is not null and not exists (
       select 1 from uj.etapas where id = new.etapa_id and evento_id = new.evento_id) then
    raise exception 'etapa de outro evento' using errcode = '23503';
  end if;
  return new;
end
$$;
create trigger repertorio_itens_guardar before insert or update on uj.repertorio_itens
  for each row execute function uj.guardar_repertorio_item();

-- Log de mudanças: só o id. Item de encontro em rascunho só é anunciado a organizadores.
create function uj.registrar_mudanca_de_repertorio() returns trigger
  language plpgsql security definer
  set search_path = pg_catalog, uj
  as $$
declare
  linha record;
  rascunho boolean;
begin
  if tg_op = 'DELETE' then linha := old; else linha := new; end if;
  select (status = 'rascunho') into rascunho from uj.eventos where id = linha.evento_id;
  insert into uj.mudancas (comunidade_id, tabela, registro_id, operacao, nivel_minimo)
    values (linha.comunidade_id, 'repertorio_itens', linha.id, left(tg_op, 1),
            case when coalesce(rascunho, false) then 20 else 10 end);
  return null;
end
$$;
create trigger repertorio_itens_mudanca after insert or update or delete on uj.repertorio_itens
  for each row execute function uj.registrar_mudanca_de_repertorio();

alter table uj.repertorio_itens enable row level security;

create policy repertorio_itens_ler on uj.repertorio_itens for select to uj_api
  using (comunidade_id = (select uj.comunidade_atual())
         and ((select uj.nivel_no_contexto()) >= 20
              or ((select uj.nivel_no_contexto()) >= 10 and uj.evento_visivel_para_membro(evento_id))));
create policy repertorio_itens_gravar on uj.repertorio_itens for all to uj_api
  using (comunidade_id = (select uj.comunidade_atual()) and (select uj.nivel_gravavel_no_contexto()) >= 20)
  with check (comunidade_id = (select uj.comunidade_atual()) and (select uj.nivel_gravavel_no_contexto()) >= 20);

-- ---------------------------------------------------------------- avisar a banda

create function uj.avisar_banda(p_evento uuid, p_atribuicoes uuid[]) returns int
  language plpgsql security definer
  set search_path = pg_catalog, uj
  as $$
declare
  ev uj.eventos;
  r record;
  enviadas int;
begin
  if uj.nivel_gravavel_no_contexto() < 20 then
    raise exception 'sem permissao' using errcode = '42501';
  end if;
  select * into ev from uj.eventos where id = p_evento and comunidade_id = uj.comunidade_atual();
  if not found then
    raise exception 'encontro nao encontrado' using errcode = 'UJ101';
  end if;
  if ev.status <> 'publicado' or ev.inicio + make_interval(mins => ev.duracao_min) <= now() then
    raise exception 'encontro nao publicado ou ja terminou' using errcode = 'UJ102';
  end if;
  -- Só quem ainda pode tocar (não recusou) e só convocações deste encontro e desta comunidade.
  for r in select v.conta_id from uj.atribuicoes a join uj.vinculos v on v.id = a.vinculo_id
            where a.evento_id = ev.id and a.comunidade_id = ev.comunidade_id
              and a.id = any (p_atribuicoes) and a.estado <> 'recusada'
            group by v.conta_id loop
    perform uj.enfileirar_notificacao(ev.comunidade_id, r.conta_id, 'escalas', 'evento', ev.id,
      'Repertório atualizado', 'O repertório do louvor foi atualizado. Abra o app para ver.');
  end loop;
  -- As criadas nesta transação têm o instante dela: é quem de fato vai receber.
  select count(*) into enviadas from uj.notificacoes
   where recurso_id = ev.id and tipo = 'escalas' and titulo = 'Repertório atualizado'
     and criado_em = now();
  return enviadas;
end
$$;

-- ---------------------------------------------------------------- privilégios

revoke execute on all functions in schema uj from public;
grant execute on function uj.avisar_banda(uuid, uuid[]) to uj_api;

grant insert (andamento_bpm, duracao_seg, direito_confirmado_em),
  update (andamento_bpm, duracao_seg, direito_confirmado_em) on uj.musicas to uj_api;

grant select, delete on uj.repertorio_itens to uj_api;
grant insert (comunidade_id, evento_id, etapa_id, musica_id, ordem, tom_do_dia, nota),
  update (etapa_id, ordem, tom_do_dia, nota) on uj.repertorio_itens to uj_api;
