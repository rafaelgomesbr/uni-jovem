-- 0028: apoio às APIs do app v3 (D66). Só funções: nenhuma tabela nova, nenhuma
-- coluna nova. Segue o padrão do cabeçalho de 0001.
--
--   * LEMBRAR QUEM NÃO RESPONDEU (`uj.lembrar_pendentes`): uma notificação
--     genérica ("Falta responder", sem nome, sem título de encontro, sem
--     função, sem data), pela fila de 0011, às pessoas com convocação
--     pendente num encontro publicado que ainda não terminou. Regras no banco,
--     para que nem uma rota esquecida as quebre:
--       - só organizador ou administrador da comunidade do contexto (42501);
--       - no máximo UM lembrete por pessoa e por encontro a cada 24 h;
--       - preferência "Escalas" (por comunidade), vínculo ativo, cota diária e
--         "quem age não é avisado" continuam sendo as de `enfileirar_notificacao`;
--       - `p_simular` conta sem enfileirar nada, para o cartão do Início dizer
--         "Lembrar os 2" com o mesmo número que o envio usará.
--     Códigos de erro: UJ101 encontro não encontrado (404), UJ102 encontro que
--     não está no ar ou já terminou (409), os mesmos de `avisar_banda`.
--   * ASSUNTO DA NOTIFICAÇÃO (`uj.assunto_da_notificacao`): o título real do
--     aviso ou do encontro a que a notificação se refere, SÓ para a tela do
--     sino (dentro do app, para quem já vê esse aviso ou encontro). O texto
--     que sai para a tela bloqueada continua genérico (NOT-02). Devolve nulo
--     quando o alvo saiu do ar, é rascunho, está vencido, foi escrito por
--     alguém que a pessoa bloqueou naquela comunidade, ou a notificação não é
--     da conta. Nunca devolve pedido de oração, nome de música nem de pessoa.
--     Devolve também o encontro ligado (para o toque abrir "Sua parte").
--   * PRÉVIA DO CÓDIGO (`uj.previa_do_codigo`): o que quem tem o código vê
--     antes de entrar. Só o estritamente necessário e só do que o próprio
--     `entrar_por_codigo` já revelaria: nome, cor, se tem logotipo, quantas
--     pessoas ativas, o modo de entrada e o título e o horário do próximo
--     encontro PÚBLICO (os mesmos da página pública do encontro). Nada de
--     cidade, nome de pessoa, contato, administrador ou identificador. Código
--     desconhecido, trocado ou de comunidade que não recebe por código: zero
--     linhas (a rota responde 404 igual para todos os casos).

-- ---------------------------------------------------------------- lembrar quem não respondeu

create function uj.lembrar_pendentes(p_evento uuid, p_simular boolean default false)
  returns table (pendentes int, lembraveis int, lembradas int)
  language plpgsql security definer
  set search_path = pg_catalog, uj
  as $$
declare
  ev uj.eventos;
  r record;
  n_pendentes int := 0;
  n_lembraveis int := 0;
begin
  if uj.nivel_gravavel_no_contexto() < 20 then
    raise exception 'sem permissao' using errcode = '42501';
  end if;
  select * into ev from uj.eventos where id = p_evento and comunidade_id = uj.comunidade_atual();
  if not found then
    raise exception 'encontro nao encontrado' using errcode = 'UJ101';
  end if;
  if ev.status not in ('publicado', 'adiado')
     or ev.inicio + make_interval(mins => ev.duracao_min) <= now() then
    raise exception 'encontro nao publicado ou ja terminou' using errcode = 'UJ102';
  end if;
  -- Uma linha por PESSOA (quem tem duas convocações pendentes recebe um lembrete só).
  for r in select distinct v.conta_id
             from uj.atribuicoes a join uj.vinculos v on v.id = a.vinculo_id
            where a.evento_id = ev.id and a.comunidade_id = ev.comunidade_id
              and a.estado = 'pendente' and v.estado = 'ativo' loop
    -- Quem pede o lembrete não conta (nem é avisado) mesmo que também esteja pendente.
    if r.conta_id is not distinct from uj.conta_atual() then
      continue;
    end if;
    n_pendentes := n_pendentes + 1;
    -- Quem já foi lembrado nas últimas 24 h espera.
    if exists (select 1 from uj.notificacoes n
                where n.conta_id = r.conta_id and n.recurso_id = ev.id
                  and n.titulo = 'Falta responder' and n.criado_em > now() - interval '24 hours') then
      continue;
    end if;
    n_lembraveis := n_lembraveis + 1;
    if not p_simular then
      perform uj.enfileirar_notificacao(ev.comunidade_id, r.conta_id, 'escalas', 'evento', ev.id,
        'Falta responder', 'Você ainda não respondeu a uma convocação. Abra o app para responder.');
    end if;
  end loop;
  if p_simular then
    return query select n_pendentes, n_lembraveis, 0;
    return;
  end if;
  -- As criadas nesta transação têm o instante dela: é quem de fato vai receber
  -- (preferência desligada, cota do dia e deduplicação de 1 h ficam de fora).
  return query select n_pendentes, n_lembraveis,
    (select count(*)::int from uj.notificacoes n
      where n.recurso_id = ev.id and n.titulo = 'Falta responder' and n.criado_em = now());
end
$$;

-- ---------------------------------------------------------------- assunto da notificação (o sino)

create function uj.assunto_da_notificacao(p_notificacao uuid)
  returns table (assunto text, evento_id uuid)
  language sql stable security definer
  set search_path = pg_catalog, uj
  as $$
    with n as (
      select n.* from uj.notificacoes n
       where n.id = p_notificacao
         and n.conta_id = uj.conta_atual()
         and n.comunidade_id = any (uj.comunidades_da_caixa())
    ),
    ev as (
      select e.id, e.titulo
        from n join uj.eventos e on e.comunidade_id = n.comunidade_id and e.status <> 'rascunho'
       where (n.recurso_tipo = 'evento' and e.id = n.recurso_id)
          or (n.recurso_tipo = 'atribuicao' and e.id = (
                select a.evento_id from uj.atribuicoes a
                 where a.id = n.recurso_id and a.comunidade_id = n.comunidade_id))
          or (n.recurso_tipo = 'inscricao' and e.id = (
                select i.evento_id from uj.inscricoes i
                 where i.id = n.recurso_id and i.comunidade_id = n.comunidade_id))
          or (n.recurso_tipo = 'substituicao' and e.id = (
                select a.evento_id from uj.substituicoes s
                  join uj.atribuicoes a on a.id = s.atribuicao_id
                 where s.id = n.recurso_id and s.comunidade_id = n.comunidade_id))
    ),
    av as (
      select a.titulo
        from n join uj.avisos a on a.id = n.recurso_id and a.comunidade_id = n.comunidade_id
       where n.recurso_tipo = 'aviso'
         and a.estado = 'publicado'
         and (a.visivel_ate is null or a.visivel_ate > now())
         and not exists (select 1 from uj.bloqueios b
                          where b.comunidade_id = n.comunidade_id and b.conta_id = n.conta_id
                            and b.bloqueada_conta_id = a.criado_por)
    )
    select coalesce((select titulo from av), (select titulo from ev)), (select id from ev)
  $$;

-- ---------------------------------------------------------------- prévia do código da comunidade

create function uj.previa_do_codigo(p_codigo_hmac bytea)
  returns table (nome text, cor text, tem_logo boolean, pessoas int, modo_entrada text,
                 proximo_titulo text, proximo_inicio timestamptz, proximo_fuso text)
  language sql stable security definer
  set search_path = pg_catalog, uj
  as $$
    select c.nome, c.cor,
           exists (select 1 from uj.logos_comunidades l where l.comunidade_id = c.id),
           (select count(*)::int from uj.vinculos v join uj.contas a on a.id = v.conta_id
             where v.comunidade_id = c.id and v.estado = 'ativo' and a.estado = 'ativa'),
           c.modo_entrada, p.titulo, p.inicio, p.fuso
      from uj.comunidades c
      left join lateral (
        select e.titulo, e.inicio, e.fuso from uj.eventos e
         where e.comunidade_id = c.id and c.verificacao = 'verificada'
           and e.visibilidade = 'publica' and e.status = 'publicado' and e.inicio > now()
         order by e.inicio limit 1) p on true
     where c.codigo_hmac = p_codigo_hmac and c.estado = 'ativa'
       and c.modo_entrada in ('codigo_com_aprovacao', 'codigo_direto')
  $$;

-- ---------------------------------------------------------------- privilégios

revoke execute on all functions in schema uj from public;
grant execute on function uj.lembrar_pendentes(uuid, boolean), uj.assunto_da_notificacao(uuid),
  uj.previa_do_codigo(bytea) to uj_api;
