-- 0025: um nome só para o encontro (D57). Segue o padrão do cabeçalho de 0001.
--
--   * Na interface, "evento" e "programação" passam a ser "encontro". Tabelas,
--     funções, rotas e tipos de recurso continuam com os nomes de antes; aqui
--     só mudam os textos das notificações (as funções de 0023 e de 0011 são
--     recriadas iguais, com o texto novo).
--   * Notificações já enfileiradas ficam com o texto antigo: são histórico.

-- Igual à de 0023, com "encontro" no lugar de "evento".
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
        case new.status when 'cancelado' then 'Encontro cancelado' else 'Encontro adiado' end,
        case new.status
          when 'cancelado' then 'Um encontro de que você participa foi cancelado. Abra o app para ver o motivo.'
          else 'Um encontro de que você participa foi adiado. Abra o app para ver os detalhes.' end);
    end loop;
  elsif new.status = 'publicado' and old.status = 'rascunho' and new.inicio > now() then
    -- Convocações feitas no rascunho só são anunciadas quando o encontro é publicado.
    for r in select a.id, v.conta_id from uj.atribuicoes a join uj.vinculos v on v.id = a.vinculo_id
              where a.evento_id = new.id loop
      perform uj.enfileirar_notificacao(new.comunidade_id, r.conta_id, 'escalas', 'atribuicao', r.id,
        'Nova convocação', 'Você foi convocado para servir. Abra o app para responder.');
    end loop;
  end if;
  return null;
end
$$;

-- Igual à de 0011, com "encontro" no lugar de "evento".
create or replace function uj.notificar_inscricao() returns trigger
  language plpgsql security definer
  set search_path = pg_catalog, uj
  as $$
begin
  if new.origem = 'membro' and old.promovida_em is null and new.promovida_em is not null
     and new.estado = 'confirmada' then
    perform uj.enfileirar_notificacao(new.comunidade_id,
      (select conta_id from uj.vinculos where id = new.vinculo_id), 'inscricoes', 'inscricao', new.id,
      'Vaga confirmada', 'Abriu uma vaga e sua inscrição num encontro foi confirmada.');
  end if;
  return null;
end
$$;
