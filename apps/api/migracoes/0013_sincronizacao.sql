-- 0013: sincronização offline no servidor (F13, ADR 0005).
--
--   * `uj.sync_operacoes`: registro de idempotência das operações da fila
--     offline. A chave (UUID v7 do aparelho) vale por (comunidade, conta): a
--     mesma chave noutra comunidade não colide nem revela nada. Gravado na
--     MESMA transação do efeito, então "aplicada" e "registrada" andam juntas.
--   * `uj.marco_de_sincronizacao`: até onde o log de mudanças já foi podado.
--     Cursor anterior ao marco = o aparelho precisa recomeçar a sincronização.

create table uj.sync_operacoes (
  comunidade_id uuid not null references uj.comunidades (id),
  conta_id uuid not null references uj.contas (id),
  chave uuid not null,
  tipo text not null check (tipo ~ '^[a-z_]+\.[a-z_]+$'),
  conteudo_hash bytea not null check (octet_length(conteudo_hash) = 32),
  resultado jsonb not null default '{}'::jsonb,
  criado_em timestamptz not null default now(),
  primary key (comunidade_id, conta_id, chave)
);
create index sync_operacoes_conta on uj.sync_operacoes (conta_id);
create index sync_operacoes_criado on uj.sync_operacoes (criado_em);

alter table uj.sync_operacoes enable row level security;
create policy sync_operacoes_proprias on uj.sync_operacoes for select to uj_api
  using (comunidade_id = (select uj.comunidade_atual()) and conta_id = (select uj.conta_atual())
         and (select uj.nivel_no_contexto()) >= 10);
create policy sync_operacoes_registrar on uj.sync_operacoes for insert to uj_api
  with check (comunidade_id = (select uj.comunidade_atual()) and conta_id = (select uj.conta_atual())
              and (select uj.nivel_gravavel_no_contexto()) >= 10);

create table uj.marco_de_sincronizacao (
  id int primary key default 1 check (id = 1),
  podado_ate_xact xid8 not null,
  podado_ate_id bigint not null,
  podado_em timestamptz not null default now()
);
alter table uj.marco_de_sincronizacao enable row level security;
create policy marco_de_sincronizacao_ler on uj.marco_de_sincronizacao for select to uj_api
  using (true);

-- Leitura do pacote offline e da validade: o servidor é a fonte do prazo.
grant select on uj.sync_operacoes, uj.marco_de_sincronizacao to uj_api;
grant insert (comunidade_id, conta_id, chave, tipo, conteudo_hash, resultado)
  on uj.sync_operacoes to uj_api;
