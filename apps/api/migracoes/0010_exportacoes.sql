-- 0010: exportações CSV dos relatórios (F16).
--
-- Os relatórios em si não têm tabela: são consultas agregadas feitas como
-- `uj_api`, sob a RLS da comunidade do contexto. A exportação é o resultado de
-- uma dessas consultas, guardado como arquivo:
--   * com DONO (só quem gerou lê e baixa) e validade de 24 h (P7);
--   * baixado com um token aleatório de 256 bits, do qual só o SHA-256 fica aqui;
--   * com contatos (e-mail, telefone) só se gerada por admin, e só baixada
--     enquanto a pessoa continua admin (a política confere o nível a cada leitura).
-- Vencida, a linha some da leitura (a API responde 404) e o job de retenção
-- apaga o conteúdo (`uj.expurgar_exportacoes_vencidas`).

create table uj.exportacoes (
  id uuid primary key default gen_random_uuid(),
  comunidade_id uuid not null references uj.comunidades (id),
  dono_conta_id uuid not null default uj.conta_atual() references uj.contas (id),
  tipo text not null check (tipo in ('presenca', 'inscricoes', 'escalas', 'membros')),
  com_contatos boolean not null default false,
  -- Período e filtros usados (sem dado pessoal), para a lista "minhas exportações".
  filtros jsonb not null default '{}'::jsonb check (jsonb_typeof(filtros) = 'object'),
  token_hash bytea not null unique check (octet_length(token_hash) = 32),
  nome_arquivo text not null check (nome_arquivo ~ '^[a-z0-9_.-]{1,120}$'),
  conteudo text not null check (octet_length(conteudo) <= 20971520),
  linhas int not null check (linhas >= 0),
  criado_em timestamptz not null default now(),
  expira_em timestamptz not null default now() + interval '24 hours',
  baixada_em timestamptz,
  downloads int not null default 0 check (downloads >= 0),
  check (expira_em > criado_em and expira_em <= criado_em + interval '24 hours')
);
create index exportacoes_comunidade on uj.exportacoes (comunidade_id, dono_conta_id, criado_em desc);
create index exportacoes_dono on uj.exportacoes (dono_conta_id);
create index exportacoes_expira on uj.exportacoes (expira_em);

-- Só a dona sabe que a exportação existe.
create function uj.registrar_mudanca_de_exportacao() returns trigger
  language plpgsql security definer
  set search_path = pg_catalog, uj
  as $$
declare
  linha record;
begin
  if tg_op = 'DELETE' then linha := old; else linha := new; end if;
  insert into uj.mudancas (comunidade_id, tabela, registro_id, operacao, nivel_minimo, conta_alvo)
    values (linha.comunidade_id, 'exportacoes', linha.id, left(tg_op, 1), 20, linha.dono_conta_id);
  return null;
end
$$;
create trigger exportacoes_mudanca after insert or update or delete on uj.exportacoes
  for each row execute function uj.registrar_mudanca_de_exportacao();

alter table uj.exportacoes enable row level security;

-- Vencida = invisível já na política (a API responde 404 sem depender de filtro).
create policy exportacoes_ler on uj.exportacoes for select to uj_api
  using (comunidade_id = (select uj.comunidade_atual())
         and dono_conta_id = (select uj.conta_atual())
         and expira_em > now()
         and (select uj.nivel_no_contexto()) >= 20
         and (not com_contatos or (select uj.nivel_no_contexto()) >= 30));
create policy exportacoes_criar on uj.exportacoes for insert to uj_api
  with check (comunidade_id = (select uj.comunidade_atual())
              and dono_conta_id = (select uj.conta_atual())
              and (select uj.nivel_gravavel_no_contexto()) >= 20
              and (not com_contatos or (select uj.nivel_gravavel_no_contexto()) >= 30));
create policy exportacoes_baixar on uj.exportacoes for update to uj_api
  using (comunidade_id = (select uj.comunidade_atual())
         and dono_conta_id = (select uj.conta_atual())
         and (select uj.nivel_gravavel_no_contexto()) >= 20
         and (not com_contatos or (select uj.nivel_gravavel_no_contexto()) >= 30))
  with check (comunidade_id = (select uj.comunidade_atual())
              and dono_conta_id = (select uj.conta_atual()));
create policy exportacoes_excluir on uj.exportacoes for delete to uj_api
  using (comunidade_id = (select uj.comunidade_atual())
         and dono_conta_id = (select uj.conta_atual())
         and (select uj.nivel_gravavel_no_contexto()) >= 20);

-- Retenção: roda como job do servidor (conexão do dono). Sem EXECUTE para o app.
create function uj.expurgar_exportacoes_vencidas() returns int
  language plpgsql security definer
  set search_path = pg_catalog, uj
  as $$
declare
  n int;
begin
  delete from uj.exportacoes where expira_em <= now();
  get diagnostics n = row_count;
  return n;
end
$$;

-- A API apaga as exportações vencidas DA PRÓPRIA conta a cada uso (a política de
-- leitura já as esconde, então um DELETE comum não as alcançaria).
create function uj.expurgar_minhas_exportacoes_vencidas() returns int
  language plpgsql security definer
  set search_path = pg_catalog, uj
  as $$
declare
  n int;
begin
  delete from uj.exportacoes where dono_conta_id = uj.conta_atual() and expira_em <= now();
  get diagnostics n = row_count;
  return n;
end
$$;

revoke execute on all functions in schema uj from public;
grant execute on function uj.expurgar_minhas_exportacoes_vencidas() to uj_api;
grant select, delete on uj.exportacoes to uj_api;
grant insert (comunidade_id, tipo, com_contatos, filtros, token_hash, nome_arquivo, conteudo, linhas),
  update (baixada_em, downloads) on uj.exportacoes to uj_api;
