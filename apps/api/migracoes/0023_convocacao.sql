-- 0023: convocação (D54). Segue o padrão do cabeçalho de 0001.
--
--   * Na interface, "escala" passa a ser "convocação": a organização convoca,
--     a pessoa aceita ou avisa que não pode ir. Tabelas, funções e rotas
--     continuam com os nomes de antes; aqui só mudam os textos das
--     notificações (as funções de 0011 são recriadas iguais, com o texto novo).
--   * RECUSA AVISA A ORGANIZAÇÃO: quando a pessoa responde "Não posso ir"
--     (atribuição passa a `recusada`), organizadores e admins ativos da
--     comunidade do fato recebem uma notificação genérica, sem nome de pessoa
--     nem título de evento (NOT-02). Membros não recebem. Quem recusou não é
--     avisado (regra de `uj.enfileirar_notificacao`).
--   * O tipo é `escalas`: quem desligou "Escalas" naquela comunidade não
--     recebe (preferência por tipo e por comunidade, NOT-04). O recurso é o
--     EVENTO, para o toque abrir o encontro, onde fica "Convocar pessoa"; com
--     a deduplicação de 1 h por recurso, várias recusas no mesmo encontro
--     viram um aviso só.
--   * Só para encontro publicado ou adiado que ainda não terminou: rascunho
--     ninguém vê e encontro passado não tem mais quem convocar.

-- Igual à de 0011, com o texto da convocação.
create or replace function uj.notificar_evento() returns trigger
  language plpgsql security definer
  set search_path = pg_catalog, uj
  as $$
declare
  r record;
begin
  if new.status is not distinct from old.status then
    return null;
  end if;
  if new.status in ('cancelado', 'adiado') and old.status <> 'rascunho' then
    for r in select conta_id from uj.contas_do_evento(new.id) loop
      perform uj.enfileirar_notificacao(new.comunidade_id, r.conta_id, 'alteracoes_importantes',
        'evento', new.id,
        case new.status when 'cancelado' then 'Evento cancelado' else 'Evento adiado' end,
        case new.status
          when 'cancelado' then 'Um evento de que você participa foi cancelado. Abra o app para ver o motivo.'
          else 'Um evento de que você participa foi adiado. Abra o app para ver os detalhes.' end);
    end loop;
  elsif new.status = 'publicado' and old.status = 'rascunho' and new.inicio > now() then
    -- Convocações feitas no rascunho só são anunciadas quando o evento é publicado.
    for r in select a.id, v.conta_id from uj.atribuicoes a join uj.vinculos v on v.id = a.vinculo_id
              where a.evento_id = new.id loop
      perform uj.enfileirar_notificacao(new.comunidade_id, r.conta_id, 'escalas', 'atribuicao', r.id,
        'Nova convocação', 'Você foi convocado para servir. Abra o app para responder.');
    end loop;
  end if;
  return null;
end
$$;

-- Igual à de 0011, com o texto da convocação.
create or replace function uj.notificar_atribuicao() returns trigger
  language plpgsql security definer
  set search_path = pg_catalog, uj
  as $$
begin
  if (tg_op = 'INSERT' or new.vinculo_id <> old.vinculo_id)
     and exists (select 1 from uj.eventos e
                  where e.id = new.evento_id and e.status = 'publicado' and e.inicio > now()) then
    perform uj.enfileirar_notificacao(new.comunidade_id,
      (select conta_id from uj.vinculos where id = new.vinculo_id), 'escalas', 'atribuicao', new.id,
      'Nova convocação', 'Você foi convocado para servir. Abra o app para responder.');
  end if;
  return null;
end
$$;

-- "Não posso ir": avisa quem pode convocar outra pessoa. Destinatários só da
-- comunidade da própria atribuição.
create function uj.notificar_recusa_de_atribuicao() returns trigger
  language plpgsql security definer
  set search_path = pg_catalog, uj
  as $$
declare
  r record;
begin
  if new.estado <> 'recusada' or old.estado = 'recusada' then
    return null;
  end if;
  if not exists (select 1 from uj.eventos e
                  where e.id = new.evento_id and e.comunidade_id = new.comunidade_id
                    and e.status in ('publicado', 'adiado')
                    and e.inicio + make_interval(mins => e.duracao_min) > now()) then
    return null;
  end if;
  for r in select v.conta_id from uj.vinculos v
            where v.comunidade_id = new.comunidade_id and v.estado = 'ativo'
              and v.papel in ('organizador', 'admin') and v.id <> new.vinculo_id loop
    perform uj.enfileirar_notificacao(new.comunidade_id, r.conta_id, 'escalas', 'evento',
      new.evento_id, 'Convocação recusada',
      'Alguém não pode servir num encontro. Toque para convocar outra pessoa.');
  end loop;
  return null;
end
$$;
create trigger atribuicoes_avisar_recusa after update of estado on uj.atribuicoes
  for each row execute function uj.notificar_recusa_de_atribuicao();

revoke execute on function uj.notificar_recusa_de_atribuicao() from public;
