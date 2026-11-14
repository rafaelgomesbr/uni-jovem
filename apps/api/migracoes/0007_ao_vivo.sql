-- 0007: acompanhamento ao vivo (F11).
-- Estado compartilhado do andamento de um evento + registro dos comandos.
-- Um condutor por vez (concessão renovável); cada comando leva a versão
-- esperada e a API recusa versão antiga (409), sem corromper o estado.

create table uj.andamentos (
  evento_id uuid primary key references uj.eventos (id) on delete cascade,
  comunidade_id uuid not null references uj.comunidades (id),
  situacao text not null default 'nao_iniciado'
    check (situacao in ('nao_iniciado', 'em_andamento', 'pausado', 'encerrado')),
  etapa_atual_id uuid references uj.etapas (id) on delete set null,
  etapa_iniciada_em timestamptz,
  iniciado_em timestamptz,
  pausado_em timestamptz,
  encerrado_em timestamptz,
  condutor_vinculo_id uuid references uj.vinculos (id),
  condutor_ate timestamptz,
  versao int not null default 0,
  atualizado_em timestamptz not null default now()
);
create index andamentos_comunidade on uj.andamentos (comunidade_id);
create index andamentos_etapa on uj.andamentos (etapa_atual_id);
create index andamentos_condutor on uj.andamentos (condutor_vinculo_id);

create table uj.andamento_comandos (
  id bigint generated always as identity primary key,
  comunidade_id uuid not null references uj.comunidades (id),
  evento_id uuid not null references uj.eventos (id) on delete cascade,
  comando text not null check (comando in ('assumir', 'liberar', 'iniciar', 'avancar', 'voltar',
    'ir_para', 'pausar', 'retomar', 'encerrar')),
  etapa_id uuid references uj.etapas (id) on delete set null,
  vinculo_id uuid not null references uj.vinculos (id),
  ocorrido_em timestamptz not null,
  registrado_em timestamptz not null default now(),
  origem text not null default 'online' check (origem in ('online', 'offline')),
  versao_resultante int not null
);
create index andamento_comandos_comunidade on uj.andamento_comandos (comunidade_id, evento_id, id);
create index andamento_comandos_etapa on uj.andamento_comandos (etapa_id);
create index andamento_comandos_vinculo on uj.andamento_comandos (vinculo_id);

create trigger andamentos_atualizado before update on uj.andamentos
  for each row execute function uj.tocar_atualizado_em();
create trigger andamentos_guardar before insert or update on uj.andamentos
  for each row execute function uj.guardar_filho_de_evento();
create trigger andamento_comandos_guardar before insert on uj.andamento_comandos
  for each row execute function uj.guardar_filho_de_evento();

-- A tabela de andamentos não tem `id`: o log de mudanças usa o evento.
create function uj.registrar_mudanca_de_andamento() returns trigger
  language plpgsql security definer
  set search_path = pg_catalog, uj
  as $$
declare
  linha record;
begin
  if tg_op = 'DELETE' then linha := old; else linha := new; end if;
  insert into uj.mudancas (comunidade_id, tabela, registro_id, operacao)
    values (linha.comunidade_id, 'andamentos', linha.evento_id, left(tg_op, 1));
  return null;
end
$$;
create trigger andamentos_mudanca after insert or update or delete on uj.andamentos
  for each row execute function uj.registrar_mudanca_de_andamento();
create trigger andamento_comandos_mudanca after insert on uj.andamento_comandos
  for each row execute function uj.registrar_mudanca_de_andamento();

alter table uj.andamentos enable row level security;
alter table uj.andamento_comandos enable row level security;

create policy andamentos_ler on uj.andamentos for select to uj_api
  using (comunidade_id = (select uj.comunidade_atual())
         and ((select uj.nivel_no_contexto()) >= 20
              or ((select uj.nivel_no_contexto()) >= 10 and uj.evento_visivel_para_membro(evento_id))));
create policy andamentos_gravar on uj.andamentos for all to uj_api
  using (comunidade_id = (select uj.comunidade_atual()) and (select uj.nivel_gravavel_no_contexto()) >= 20)
  with check (comunidade_id = (select uj.comunidade_atual()) and (select uj.nivel_gravavel_no_contexto()) >= 20);
create policy andamento_comandos_ler on uj.andamento_comandos for select to uj_api
  using (comunidade_id = (select uj.comunidade_atual())
         and ((select uj.nivel_no_contexto()) >= 20
              or ((select uj.nivel_no_contexto()) >= 10 and uj.evento_visivel_para_membro(evento_id))));
create policy andamento_comandos_inserir on uj.andamento_comandos for insert to uj_api
  with check (comunidade_id = (select uj.comunidade_atual()) and (select uj.nivel_gravavel_no_contexto()) >= 20
              and vinculo_id = (select uj.vinculo_da_conta_no_contexto()));

revoke execute on all functions in schema uj from public;
grant select on uj.andamentos, uj.andamento_comandos to uj_api;
grant insert (evento_id, comunidade_id, situacao, etapa_atual_id, etapa_iniciada_em, iniciado_em,
  pausado_em, encerrado_em, condutor_vinculo_id, condutor_ate, versao),
  update (situacao, etapa_atual_id, etapa_iniciada_em, iniciado_em, pausado_em, encerrado_em,
  condutor_vinculo_id, condutor_ate, versao) on uj.andamentos to uj_api;
grant insert (comunidade_id, evento_id, comando, etapa_id, vinculo_id, ocorrido_em, origem,
  versao_resultante) on uj.andamento_comandos to uj_api;
