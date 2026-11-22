-- 0030: limpar os próximos encontros e excluir a comunidade (D77, ADR 0009).
--
-- LIMPAR OS PRÓXIMOS ENCONTROS
--   * Só uma função de leitura: `resumo_dos_proximos_encontros` conta, para a tela
--     de confirmação, quantos encontros futuros há (por situação), quantas pessoas
--     seriam avisadas e quantas repetições seguem ativas. As escritas (apagar ou
--     cancelar) são feitas pela rota com os mesmos comandos de sempre (`delete` e
--     `update` em `eventos`, sob a RLS do organizador); o aviso continua sendo o do
--     gatilho `eventos_notificar` (0011/0025), que só dispara na MUDANÇA de status:
--     apagar o encontro nunca avisa ninguém.
--
-- EXCLUIR A COMUNIDADE (carência de 30 dias)
--   * Reaproveita o ciclo de vida que já existe (`exclusao_agendada`, 0001 e 0019):
--     a comunidade em `exclusao_agendada` já some das listas (RLS de `comunidades`),
--     já não vale como contexto (`nivel_no_contexto` exige `ativa` ou `suspensa`) e
--     já é apagada de vez por `excluir_comunidades_vencidas` (tarefas diárias) via
--     `apagar_comunidade`. Faltava um caminho para o ADMINISTRADOR da comunidade
--     (até hoje só o Criador alterava o estado, gatilho `guardar_comunidade`).
--   * O caminho são duas funções com `security definer`, as ÚNICAS que o aplicativo
--     chama para isso: `agendar_exclusao_da_comunidade` e
--     `desfazer_exclusao_da_comunidade`. O gatilho continua recusando qualquer
--     UPDATE direto de `estado` pelo aplicativo; a exceção vale só dentro da
--     transação que a própria função marcou em `ciclos_de_vida_autorizados`
--     (o mesmo padrão de `manutencoes_da_auditoria`, 0019), para a comunidade dela.
--   * `exclusoes_de_comunidade` guarda QUEM pediu (a administração da própria
--     comunidade) para separar do agendamento feito pelo Criador ou pela exclusão
--     da conta de quem criou (órfã): só o primeiro caso pode ser desfeito pelo
--     administrador. Qualquer mudança de estado apaga o registro (gatilho).
--   * Quem aparece na lista "em exclusão" é só o administrador ativo, e só o que ele
--     mesmo pode desfazer (`minhas_comunidades_em_exclusao`).
--   * Os demais vínculos recebem um aviso genérico (sem nome, sem conteúdo) na hora,
--     enfileirado ANTES da mudança de estado porque `notificacao_permitida` exige
--     comunidade ativa; o aviso de "exclusão desfeita" sai depois de a comunidade
--     voltar a `ativa`.
--   * As contas das pessoas NÃO são apagadas: só os vínculos e os dados da comunidade,
--     como já faz `apagar_comunidade` (0019).

-- ================================================================ quem pediu a exclusão

create table uj.exclusoes_de_comunidade (
  comunidade_id uuid primary key references uj.comunidades (id) on delete cascade,
  pedida_por uuid references uj.contas (id) on delete set null,
  pedida_em timestamptz not null default now()
);
alter table uj.exclusoes_de_comunidade enable row level security;

-- A pessoa que pediu lê só o próprio pedido (a lista "em exclusão" usa a função).
create policy exclusoes_proprias on uj.exclusoes_de_comunidade for select to uj_api
  using (pedida_por = (select uj.conta_atual()));
grant select on uj.exclusoes_de_comunidade to uj_api;

-- Transação em que o ciclo de vida de UMA comunidade pode mudar pelas funções
-- abaixo. Sem política e sem privilégio: só as funções (dono) leem e gravam.
create table uj.ciclos_de_vida_autorizados (
  xact xid8 primary key default pg_current_xact_id(),
  comunidade_alvo uuid not null
);
alter table uj.ciclos_de_vida_autorizados enable row level security;

-- Igual à de 0022, com a exceção da transação autorizada e o registro de quem pediu.
create or replace function uj.guardar_comunidade() returns trigger
  language plpgsql security definer
  set search_path = pg_catalog, uj
  as $$
begin
  -- Fuso precisa existir (erro do Postgres se não existir).
  perform now() at time zone new.fuso;

  if new.modo_entrada not in ('convite', 'codigo_com_aprovacao', 'codigo_direto') then
    raise exception 'modo de entrada nao habilitado nesta versao' using errcode = '0A000';
  end if;

  -- Exceção: sessões conectadas como o dono do banco (jobs do servidor, como a
  -- exclusão agendada, e o operador). O aplicativo nunca conecta como dono.
  -- Outras exceções: a comunidade órfã (gatilho aninhado, 0022) e a transação que
  -- uma das funções de exclusão da comunidade marcou para esta mesma comunidade.
  if tg_op = 'UPDATE' and session_user <> 'uj_dono' and not uj.eh_proprietario()
     and not (pg_trigger_depth() > 1 and new.estado = 'exclusao_agendada')
     and not exists (select 1 from uj.ciclos_de_vida_autorizados a
                      where a.xact = pg_current_xact_id() and a.comunidade_alvo = new.id)
     and (new.estado is distinct from old.estado
          or new.exclusao_agendada_para is distinct from old.exclusao_agendada_para) then
    raise exception 'ciclo de vida da comunidade e exclusivo do proprietario' using errcode = '42501';
  end if;

  -- Verificar e desverificar: só o Criador (sem a prova, ADR 0007) ou o operador.
  if tg_op = 'UPDATE' and new.verificacao is distinct from old.verificacao then
    if session_user <> 'uj_dono' and not uj.eh_criador() then
      raise exception 'verificacao e exclusiva do proprietario' using errcode = '42501';
    end if;
    new.verificacao_alterada_em := now();
  end if;

  if tg_op = 'UPDATE' then
    new.versao := old.versao + 1;
    -- Qualquer mudança de estado encerra o pedido de exclusão da administração
    -- (quem agenda registra o novo pedido DEPOIS do update, na própria função).
    if new.estado is distinct from old.estado then
      delete from uj.exclusoes_de_comunidade where comunidade_id = new.id;
    end if;
  end if;
  return new;
end
$$;

-- ================================================================ pedir e desfazer

-- A conta do contexto é administradora ativa da comunidade do contexto, que
-- precisa estar `ativa`. O nome digitado é conferido pela rota (a mensagem de
-- erro é dela); aqui ficam o papel, o estado e a gravação.
-- Devolve o fim da carência, ou null se a pessoa não pode (a rota responde 404).
create function uj.agendar_exclusao_da_comunidade() returns timestamptz
  language plpgsql security definer
  set search_path = pg_catalog, uj
  as $$
declare
  c uj.comunidades;
  r record;
  fim timestamptz;
begin
  if uj.nivel_gravavel_no_contexto() < 30 then
    return null;
  end if;
  select * into c from uj.comunidades where id = uj.comunidade_atual() for update;
  if not found or c.estado <> 'ativa' then
    return null;
  end if;

  -- Aviso genérico aos demais vínculos ativos: sem nome, sem conteúdo.
  for r in select v.conta_id from uj.vinculos v join uj.contas a on a.id = v.conta_id
            where v.comunidade_id = c.id and v.estado = 'ativo' and a.estado = 'ativa'
              and v.conta_id <> uj.conta_atual() loop
    perform uj.enfileirar_notificacao(c.id, r.conta_id, 'alteracoes_importantes', 'comunidade',
      c.id, 'Uma comunidade foi marcada para exclusão',
      'A administração de uma comunidade de que você participa pediu a exclusão. O acesso a ela terminou e os dados serão apagados em 30 dias.');
  end loop;

  insert into uj.ciclos_de_vida_autorizados (comunidade_alvo) values (c.id);
  update uj.comunidades
     set estado = 'exclusao_agendada', exclusao_agendada_para = now() + interval '30 days'
   where id = c.id
  returning exclusao_agendada_para into fim;
  insert into uj.exclusoes_de_comunidade (comunidade_id, pedida_por)
    values (c.id, uj.conta_atual());
  delete from uj.ciclos_de_vida_autorizados where xact = pg_current_xact_id();
  return fim;
end
$$;

-- Volta a comunidade a `ativa` dentro da carência. Só a administradora ativa, e só
-- se o pedido foi da própria administração (não o do Criador nem o de uma
-- comunidade órfã). A rota não tem como saber o estado de uma comunidade em
-- exclusão (não há contexto dela): quem responde é esta função, com `false`.
create function uj.desfazer_exclusao_da_comunidade(p_comunidade uuid) returns boolean
  language plpgsql security definer
  set search_path = pg_catalog, uj
  as $$
declare
  c uj.comunidades;
  r record;
begin
  select * into c from uj.comunidades where id = p_comunidade for update;
  if not found or c.estado <> 'exclusao_agendada' or c.exclusao_agendada_para <= now() then
    return false;
  end if;
  if not exists (select 1 from uj.exclusoes_de_comunidade x where x.comunidade_id = c.id)
     or not exists (select 1 from uj.vinculos v join uj.contas a on a.id = v.conta_id
                     where v.comunidade_id = c.id and v.conta_id = uj.conta_atual()
                       and v.estado = 'ativo' and v.papel = 'admin' and a.estado = 'ativa') then
    return false;
  end if;

  insert into uj.ciclos_de_vida_autorizados (comunidade_alvo) values (c.id);
  update uj.comunidades set estado = 'ativa', exclusao_agendada_para = null where id = c.id;
  delete from uj.ciclos_de_vida_autorizados where xact = pg_current_xact_id();

  for r in select v.conta_id from uj.vinculos v join uj.contas a on a.id = v.conta_id
            where v.comunidade_id = c.id and v.estado = 'ativo' and a.estado = 'ativa'
              and v.conta_id <> uj.conta_atual() loop
    perform uj.enfileirar_notificacao(c.id, r.conta_id, 'alteracoes_importantes', 'comunidade',
      c.id, 'A exclusão foi desfeita',
      'A comunidade que seria excluída continua aberta. Você já pode voltar a usá-la.');
  end loop;
  return true;
end
$$;

-- As comunidades em carência que a conta do contexto (sem comunidade) pode desfazer.
create function uj.minhas_comunidades_em_exclusao()
  returns table (id uuid, nome text, exclusao_agendada_para timestamptz, pedida_em timestamptz)
  language sql stable security definer
  set search_path = pg_catalog, uj
  as $$
    select c.id, c.nome, c.exclusao_agendada_para, x.pedida_em
      from uj.exclusoes_de_comunidade x
      join uj.comunidades c on c.id = x.comunidade_id
     where c.estado = 'exclusao_agendada' and c.exclusao_agendada_para > now()
       and exists (select 1 from uj.vinculos v join uj.contas a on a.id = v.conta_id
                    where v.comunidade_id = c.id and v.conta_id = uj.conta_atual()
                      and v.estado = 'ativo' and v.papel = 'admin' and a.estado = 'ativa')
     order by c.exclusao_agendada_para
  $$;

-- ================================================================ limpar os próximos encontros

-- Números da tela de confirmação, para a comunidade do contexto. Organização
-- (nível 20) ou mais, na comunidade ativa; sem isso, nenhuma linha. "Pessoas" são
-- as que receberiam o aviso de cancelamento DE FATO (vínculo e conta ativos, sem
-- ter desligado esse tipo de aviso), sem contar quem está limpando.
create function uj.resumo_dos_proximos_encontros()
  returns table (rascunhos int, publicados int, adiados int, cancelados int, encerrados int,
                 pessoas_a_avisar int, repeticoes_ativas int)
  language sql stable security definer
  set search_path = pg_catalog, uj
  as $$
    select (count(*) filter (where e.status = 'rascunho'))::int,
           (count(*) filter (where e.status = 'publicado'))::int,
           (count(*) filter (where e.status = 'adiado'))::int,
           (count(*) filter (where e.status = 'cancelado'))::int,
           (count(*) filter (where e.status = 'encerrado'))::int,
           (select count(distinct p.conta_id)::int
              from uj.eventos x
              cross join lateral uj.contas_do_evento(x.id) p
             where uj.nivel_gravavel_no_contexto() >= 20
               and x.comunidade_id = uj.comunidade_atual() and x.inicio > now()
               and x.status in ('publicado', 'adiado')
               and p.conta_id <> uj.conta_atual()
               and uj.notificacao_permitida(p.conta_id, x.comunidade_id, 'alteracoes_importantes')),
           (select count(*)::int from uj.series s
             where uj.nivel_gravavel_no_contexto() >= 20
               and s.comunidade_id = uj.comunidade_atual() and s.estado = 'ativa')
      from uj.eventos e
     where uj.nivel_gravavel_no_contexto() >= 20
       and e.comunidade_id = uj.comunidade_atual() and e.inicio > now()
  $$;

grant execute on function
  uj.agendar_exclusao_da_comunidade(),
  uj.desfazer_exclusao_da_comunidade(uuid),
  uj.minhas_comunidades_em_exclusao(),
  uj.resumo_dos_proximos_encontros()
  to uj_api;
