-- 0024: pedido de oração anônimo (D55). Mesma regra das sugestões anônimas
-- (0009): anônimo para os demais, nunca para o sistema.
--
--   * `anonimo` (padrão falso) é escolha de quem escreve, na criação ou depois,
--     e só a autora muda (política de alteração de 0009, sem mudança).
--   * A AUTORIA SAI DO ALCANCE DA API: `uj_api` perde o SELECT em
--     `autor_conta_id`. O que a API lê é `autor_publico`, coluna gerada que
--     repete a autoria só quando o pedido NÃO é anônimo. "É meu?" sai de
--     `uj.meus_pedidos_de_oracao()`, que só devolve pedidos da própria conta.
--     Assim nenhuma consulta da API, nem por engano, descobre quem escreveu
--     um pedido anônimo: nem membro, nem equipe de oração, nem organizador,
--     nem administrador, nem o Criador. As políticas continuam usando
--     `autor_conta_id` (política não exige privilégio de coluna).
--   * BLOQUEIO: pedido anônimo nunca é escondido por bloqueio (sumir da tela
--     de quem bloqueou desfaria o anonimato, como na sugestão anônima) e não
--     serve de origem para bloquear (UJ081).
--   * Notificações, log de mudanças, denúncias e auditoria já não levam a
--     autoria de pedido de oração a terceiros: nada muda neles.
--   * Exportação dos dados do titular: o pedido continua saindo para a própria
--     autora, agora com `anonimo`.

-- ================================================================ coluna

alter table uj.pedidos_oracao add column anonimo boolean not null default false;

-- A autoria que a API pode ler: nula quando o pedido é anônimo.
alter table uj.pedidos_oracao add column autor_publico uuid
  generated always as (case when anonimo then null else autor_conta_id end) stored;

-- Quem deixou de ver o nome (ou passou a ver) é avisado pelo log de mudanças,
-- como em qualquer outra alteração: o gatilho de 0009 já anuncia todo UPDATE.

-- ================================================================ "é meu?"

-- Ids dos pedidos da própria conta na comunidade do contexto. Não diz nada
-- sobre pedidos de outras pessoas.
create function uj.meus_pedidos_de_oracao() returns setof uuid
  language sql stable security definer
  set search_path = pg_catalog, uj
  as $$
    select p.id from uj.pedidos_oracao p
     where p.comunidade_id = uj.comunidade_atual()
       and p.autor_conta_id = uj.conta_atual()
       and uj.nivel_no_contexto() >= 10
  $$;

-- ================================================================ bloqueio

-- Igual à de 0019, mais: pedido anônimo continua visível para quem bloqueou a
-- autora (escondê-lo revelaria a autoria).
drop policy pedidos_oracao_ler on uj.pedidos_oracao;
create policy pedidos_oracao_ler on uj.pedidos_oracao for select to uj_api
  using (comunidade_id = (select uj.comunidade_atual())
         and (select uj.nivel_no_contexto()) >= 10
         and (autor_conta_id = (select uj.conta_atual())
              or ((visibilidade = 'comunidade'
                   or (visibilidade = 'equipe_oracao'
                       and array['equipe_oracao'] <@ (select uj.designacoes_no_contexto())))
                  and uj.conta_ativa_no_contexto(autor_conta_id)
                  and (anonimo
                       or not (autor_conta_id = any ((select uj.contas_bloqueadas_no_contexto())::uuid[]))))));

-- Igual à de 0019, mais: pedido de oração anônimo não serve de origem (UJ081),
-- como a sugestão anônima.
create or replace function uj.bloquear(p_tipo text, p_recurso uuid, out id uuid, out novo boolean)
  language plpgsql security definer
  set search_path = pg_catalog, uj
  as $$
declare
  c uuid := uj.comunidade_atual();
  eu uuid := uj.conta_atual();
  nivel int := uj.nivel_gravavel_no_contexto();
  alvo uuid;
  anonima boolean := false;
begin
  if nivel < 10 then
    raise exception 'sem permissao' using errcode = '42501';
  end if;
  if p_tipo = 'pedido_oracao' then
    select p.autor_conta_id, p.anonimo into alvo, anonima from uj.pedidos_oracao p
     where p.id = p_recurso and p.comunidade_id = c
       and (p.autor_conta_id = eu
            or ((p.visibilidade = 'comunidade'
                 or (p.visibilidade = 'equipe_oracao'
                     and array['equipe_oracao'] <@ uj.designacoes_no_contexto()))
                and uj.conta_ativa_no_contexto(p.autor_conta_id)));
  elsif p_tipo = 'sugestao' then
    select s.autor_conta_id, s.anonima into alvo, anonima from uj.sugestoes s
     where s.id = p_recurso and s.comunidade_id = c
       and (nivel >= 20 or s.autor_conta_id = eu);
  elsif p_tipo = 'aviso' then
    select a.criado_por into alvo from uj.avisos a
     where a.id = p_recurso and a.comunidade_id = c
       and (nivel >= 20 or (a.estado = 'publicado'
            and (a.visivel_ate is null or a.visivel_ate > now())));
  elsif p_tipo = 'vinculo' then
    -- Membros só conhecem vínculos ativos (pessoas_da_comunidade); admin, todos.
    select v.conta_id into alvo from uj.vinculos v
     where v.id = p_recurso and v.comunidade_id = c
       and (v.estado = 'ativo' or nivel >= 30);
  end if;
  if alvo is null then
    raise exception 'conteudo nao encontrado' using errcode = 'UJ080';
  end if;
  if alvo = eu then
    raise exception 'nao e possivel bloquear a si mesmo' using errcode = 'UJ082';
  end if;
  if anonima then
    raise exception 'autoria anonima' using errcode = 'UJ081';
  end if;
  if exists (select 1 from uj.contas x where x.id = alvo and x.estado = 'anonimizada') then
    raise exception 'pessoa removida' using errcode = 'UJ083';
  end if;
  insert into uj.bloqueios as b (comunidade_id, conta_id, bloqueada_conta_id)
    values (c, eu, alvo)
    on conflict (comunidade_id, conta_id, bloqueada_conta_id) do nothing
  returning b.id into id;
  novo := id is not null;
  if not novo then
    select b.id into id from uj.bloqueios b
     where b.comunidade_id = c and b.conta_id = eu and b.bloqueada_conta_id = alvo;
  end if;
end
$$;

-- ================================================================ exportar meus dados

-- Igual à de 0018, com `anonimo` em cada pedido de oração.
create or replace function uj.exportar_meus_dados() returns jsonb
  language plpgsql stable security definer
  set search_path = pg_catalog, uj
  as $$
declare
  eu uuid := uj.conta_atual();
  vs uuid[];
  r jsonb;
begin
  if eu is null or not exists (select 1 from uj.contas where id = eu and estado = 'ativa') then
    raise exception 'conta invalida' using errcode = 'UJ004';
  end if;
  select coalesce(array_agg(id), '{}') into vs from uj.vinculos where conta_id = eu;
  select jsonb_build_object(
    'conta', (select jsonb_build_object('id', a.id, 'nome', a.nome, 'email', a.email,
                'whatsapp', a.whatsapp, 'faixaEtaria', a.faixa_etaria,
                'emailVerificadoEm', a.email_verificado_em, 'doisFatores', a.totp_ativado_em is not null,
                'criador', a.plataforma_proprietario, 'criadoEm', a.criado_em,
                'foto', (select jsonb_build_object('tipo', f.tipo, 'bytes', octet_length(f.conteudo),
                           'atualizadaEm', f.atualizado_em)
                           from uj.fotos_contas f where f.conta_id = a.id))
                from uj.contas a where a.id = eu),
    'preferencias', jsonb_build_object(
      'conta', (select to_jsonb(p) - 'conta_id' from uj.preferencias_conta p where p.conta_id = eu),
      'notificacoes', coalesce((select jsonb_agg(jsonb_build_object('comunidadeId', p.comunidade_id,
                         'tipo', p.tipo, 'ativo', p.ativo)) from uj.preferencias_notificacao p
                         where p.conta_id = eu), '[]')),
    'consentimentos', coalesce((select jsonb_agg(jsonb_build_object('texto', c.texto_id,
                         'versao', c.versao, 'comunidadeId', c.comunidade_id, 'forma', c.forma,
                         'faixaEtaria', c.faixa_etaria, 'confirmacaoAdicional', c.confirmacao_adicional,
                         'concedidoEm', c.concedido_em, 'revogadoEm', c.revogado_em)
                         order by c.concedido_em) from uj.consentimentos c where c.conta_id = eu), '[]'),
    'comunidades', coalesce((select jsonb_agg(jsonb_build_object('vinculoId', v.id,
                         'comunidadeId', v.comunidade_id, 'comunidade', m.nome, 'papel', v.papel,
                         'estado', v.estado, 'designacoes', v.designacoes, 'desde', v.criado_em,
                         'removidoEm', v.removido_em) order by m.nome)
                         from uj.vinculos v join uj.comunidades m on m.id = v.comunidade_id
                        where v.conta_id = eu), '[]'),
    'escalas', coalesce((select jsonb_agg(jsonb_build_object('comunidadeId', a.comunidade_id,
                         'evento', e.titulo, 'inicio', e.inicio, 'etapa', t.titulo, 'funcao', a.funcao,
                         'estado', a.estado) order by e.inicio)
                         from uj.atribuicoes a join uj.eventos e on e.id = a.evento_id
                         left join uj.etapas t on t.id = a.etapa_id
                        where a.vinculo_id = any (vs)), '[]'),
    'substituicoes', coalesce((select jsonb_agg(jsonb_build_object('comunidadeId', s.comunidade_id,
                         'pedidaPorMim', s.pedida_por = any (vs), 'assumidaPorMim', s.assumida_por = any (vs),
                         'motivo', case when s.pedida_por = any (vs) then s.motivo end,
                         'estado', s.estado, 'criadoEm', s.criado_em, 'resolvidaEm', s.resolvida_em)
                         order by s.criado_em) from uj.substituicoes s
                        where s.pedida_por = any (vs) or s.assumida_por = any (vs)), '[]'),
    'disponibilidades', coalesce((select jsonb_agg(jsonb_build_object('comunidadeId', d.comunidade_id,
                         'data', d.data, 'disponivel', d.disponivel, 'observacao', d.observacao)
                         order by d.data) from uj.disponibilidades d where d.vinculo_id = any (vs)), '[]'),
    'inscricoes', coalesce((select jsonb_agg(jsonb_build_object('comunidadeId', i.comunidade_id,
                         'evento', e.titulo, 'inicio', e.inicio, 'estado', i.estado,
                         'criadoEm', i.criado_em, 'canceladaEm', i.cancelada_em)
                         order by i.criado_em) from uj.inscricoes i join uj.eventos e on e.id = i.evento_id
                        where i.vinculo_id = any (vs)), '[]'),
    'presencas', coalesce((select jsonb_agg(jsonb_build_object('comunidadeId', p.comunidade_id,
                         'evento', e.titulo, 'ocorridaEm', p.ocorrida_em, 'origem', p.origem)
                         order by p.ocorrida_em) from uj.presencas p join uj.eventos e on e.id = p.evento_id
                        where p.vinculo_id = any (vs)
                           or p.inscricao_id in (select id from uj.inscricoes where vinculo_id = any (vs))), '[]'),
    'pedidosDeOracao', coalesce((select jsonb_agg(jsonb_build_object('id', p.id,
                         'comunidadeId', p.comunidade_id, 'textoCifrado', encode(p.texto_cifrado, 'base64'),
                         'visibilidade', p.visibilidade, 'anonimo', p.anonimo, 'respondidoEm', p.respondido_em,
                         'criadoEm', p.criado_em,
                         'pessoasOrando', (select count(*) from uj.intercessoes i where i.pedido_id = p.id))
                         order by p.criado_em) from uj.pedidos_oracao p where p.autor_conta_id = eu), '[]'),
    'intercessoes', coalesce((select jsonb_agg(jsonb_build_object('comunidadeId', i.comunidade_id,
                         'pedidoId', i.pedido_id, 'criadoEm', i.criado_em) order by i.criado_em)
                         from uj.intercessoes i where i.conta_id = eu), '[]'),
    'sugestoes', coalesce((select jsonb_agg(jsonb_build_object('comunidadeId', s.comunidade_id,
                         'titulo', s.titulo, 'texto', s.texto, 'anonima', s.anonima, 'status', s.status,
                         'resposta', s.resposta, 'criadoEm', s.criado_em) order by s.criado_em)
                         from uj.sugestoes s where s.autor_conta_id = eu), '[]'),
    'avisos', coalesce((select jsonb_agg(jsonb_build_object('comunidadeId', x.comunidade_id,
                         'titulo', x.titulo, 'texto', x.texto, 'estado', x.estado, 'criadoEm', x.criado_em)
                         order by x.criado_em) from uj.avisos x where x.criado_por = eu), '[]'),
    'notasInternas', coalesce((select jsonb_agg(jsonb_build_object('comunidadeId', n.comunidade_id,
                         'evento', e.titulo, 'texto', n.texto, 'criadoEm', n.criado_em) order by n.criado_em)
                         from uj.notas_internas n join uj.eventos e on e.id = n.evento_id
                        where n.autor_conta_id = eu), '[]'),
    'denuncias', coalesce((select jsonb_agg(jsonb_build_object('comunidadeId', d.comunidade_id,
                         'tipo', d.recurso_tipo, 'motivo', d.motivo, 'detalhe', d.detalhe,
                         'estado', d.estado, 'criadoEm', d.criado_em) order by d.criado_em)
                         from uj.denuncias d where d.denunciante_conta_id = eu), '[]'),
    'sessoes', coalesce((select jsonb_agg(jsonb_build_object('aparelho', s.aparelho,
                         'plataforma', s.plataforma, 'criadoEm', s.criado_em, 'ultimoUso', s.ultimo_uso_em,
                         'revogadaEm', s.revogada_em) order by s.criado_em)
                         from uj.sessoes s where s.conta_id = eu and s.substituida_em is null), '[]'),
    'aparelhosDeNotificacao', coalesce((select jsonb_agg(jsonb_build_object('plataforma', p.plataforma,
                         'criadoEm', p.criado_em)) from uj.aparelhos_push p where p.conta_id = eu), '[]'),
    'auditoria', coalesce((select jsonb_agg(jsonb_build_object('momento', x.momento,
                         'comunidadeId', x.comunidade_id, 'acao', x.acao, 'recursoTipo', x.recurso_tipo)
                         order by x.momento) from uj.auditoria x where x.conta_id = eu), '[]')
  ) into r;
  return r;
end
$$;

-- ================================================================ privilégios

-- Sem `autor_conta_id`: a autoria só sai por `autor_publico` (pedido não
-- anônimo) e por `uj.meus_pedidos_de_oracao()` (a própria conta).
revoke select on uj.pedidos_oracao from uj_api;
grant select (id, comunidade_id, texto_cifrado, visibilidade, anonimo, autor_publico,
  respondido_em, criado_em, atualizado_em, versao) on uj.pedidos_oracao to uj_api;
grant insert (anonimo), update (anonimo) on uj.pedidos_oracao to uj_api;

revoke execute on function uj.meus_pedidos_de_oracao() from public;
grant execute on function uj.meus_pedidos_de_oracao() to uj_api;
