-- 0019: bloqueio individual (Apple 1.2, D35) e as rotinas que as páginas legais
-- prometem (D36 a D38). Especificação em docs/privacidade/ (mapa-de-dados.md,
-- seção 10; exclusao-de-conta.md, casos 4, 6, 8 e 9).
--
--   * `uj.bloqueios`: uma pessoa esconde, SÓ PARA SI e SÓ NAQUELA COMUNIDADE, os
--     pedidos de oração e as sugestões de outra (D35). Avisos e programação não
--     somem (D36). Quem foi bloqueado não fica sabendo: nada muda para ele, a
--     auditoria do bloqueio não tem comunidade (os administradores, que podem
--     ser a pessoa bloqueada, não a leem) e o log de mudanças só avisa quem
--     bloqueou. Sugestão anônima nunca é escondida por bloqueio: sumir da tela
--     de quem bloqueou desfaria o anonimato.
--   * Exclusão de comunidade ao fim da carência de 30 dias: apaga tudo que tem
--     o `comunidade_id` e deixa a auditoria só com ação, tipo, data e comunidade.
--   * Expurgo de 2 anos da auditoria e dos consentimentos revogados (P7).
--   * Vínculo desativado há 12 meses vira remoção (e, 30 dias depois, o job já
--     existente aplica o efeito da saída).
--   * A auditoria continua só-inserção para todos os papéis, inclusive o dono;
--     a única exceção são as duas rotinas acima, que marcam a própria transação
--     numa tabela que nenhum papel do aplicativo grava (como em 0012).

-- ================================================================ bloqueios

create table uj.bloqueios (
  id uuid primary key default gen_random_uuid(),
  comunidade_id uuid not null references uj.comunidades (id),
  -- Quem bloqueou.
  conta_id uuid not null references uj.contas (id),
  -- Quem foi bloqueado. Nunca é devolvido a ninguém além de `conta_id`.
  bloqueada_conta_id uuid not null references uj.contas (id),
  criado_em timestamptz not null default now(),
  unique (comunidade_id, conta_id, bloqueada_conta_id),
  check (conta_id <> bloqueada_conta_id)
);
create index bloqueios_conta on uj.bloqueios (conta_id);
create index bloqueios_bloqueada on uj.bloqueios (bloqueada_conta_id);

-- Só quem bloqueou sabe do bloqueio (conta_alvo), nunca a pessoa bloqueada.
create trigger bloqueios_mudanca after insert or delete on uj.bloqueios
  for each row execute function uj.registrar_mudanca_de_preferencia();

alter table uj.bloqueios enable row level security;
-- Os próprios bloqueios: na comunidade do contexto ou, sem comunidade (exportar
-- meus dados), em todas, como em `consentimentos_proprios`.
create policy bloqueios_proprios on uj.bloqueios for select to uj_api
  using (conta_id = (select uj.conta_atual())
         and ((select uj.comunidade_atual()) is null
              or (comunidade_id = (select uj.comunidade_atual())
                  and (select uj.nivel_no_contexto()) >= 10)));
create policy bloqueios_desfazer on uj.bloqueios for delete to uj_api
  using (conta_id = (select uj.conta_atual())
         and comunidade_id = (select uj.comunidade_atual())
         and (select uj.nivel_gravavel_no_contexto()) >= 10);

-- Quem a conta do contexto bloqueou na comunidade do contexto. Uma vez por
-- consulta nas políticas, pelo "(select ...)".
create function uj.contas_bloqueadas_no_contexto() returns uuid[]
  language sql stable security definer
  set search_path = pg_catalog, uj
  as $$
    select coalesce(array_agg(b.bloqueada_conta_id), '{}'::uuid[])
      from uj.bloqueios b
     where b.comunidade_id = uj.comunidade_atual()
       and b.conta_id = uj.conta_atual()
  $$;

-- Bloquear quem escreveu um conteúdo que a pessoa VÊ (mesmas regras de leitura
-- de `uj.denunciar`) ou o dono de um vínculo da comunidade. A autoria sai do
-- banco, nunca do pedido. Repetir devolve o mesmo bloqueio, com `novo` falso.
-- Erros: UJ080 não encontrado; UJ081 sugestão anônima; UJ082 a própria pessoa;
-- UJ083 conta anonimizada ("Pessoa removida").
create function uj.bloquear(p_tipo text, p_recurso uuid, out id uuid, out novo boolean)
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
    select p.autor_conta_id into alvo from uj.pedidos_oracao p
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

-- "Pessoas bloqueadas": nome e avatar de quem EU bloqueei nesta comunidade.
-- Mesmas regras de `pessoas_da_comunidade` para avatar e foto (só de conta
-- ativa; a foto, só de vínculo ativo, que é quando `foto_da_pessoa` a entrega).
create function uj.meus_bloqueios()
  returns table (id uuid, vinculo_id uuid, nome text, avatar_icone text, avatar_cor text,
                 foto_versao text, criado_em timestamptz)
  language sql stable security definer
  set search_path = pg_catalog, uj
  as $$
    select b.id, v.id,
           case when a.estado = 'anonimizada' then 'Pessoa removida' else a.nome end,
           case when a.estado = 'ativa' then a.avatar_icone end,
           case when a.estado = 'ativa' then a.avatar_cor end,
           case when a.estado = 'ativa' and v.estado = 'ativo'
                then left(encode(f.hash, 'hex'), 16) end,
           b.criado_em
      from uj.bloqueios b
      join uj.contas a on a.id = b.bloqueada_conta_id
      left join uj.vinculos v
        on v.comunidade_id = b.comunidade_id and v.conta_id = b.bloqueada_conta_id
      left join uj.fotos_contas f on f.conta_id = b.bloqueada_conta_id
     where b.comunidade_id = uj.comunidade_atual()
       and b.conta_id = uj.conta_atual()
       and uj.nivel_no_contexto() >= 10
     order by 3, b.criado_em
  $$;

-- ---------------------------------------------------------------- o que o bloqueio esconde

-- Igual à de 0009, mais: pedido de quem a pessoa bloqueou nesta comunidade não
-- aparece para ela (lista, detalhe, "estou orando" e denúncia pela rota).
drop policy pedidos_oracao_ler on uj.pedidos_oracao;
create policy pedidos_oracao_ler on uj.pedidos_oracao for select to uj_api
  using (comunidade_id = (select uj.comunidade_atual())
         and (select uj.nivel_no_contexto()) >= 10
         and (autor_conta_id = (select uj.conta_atual())
              or ((visibilidade = 'comunidade'
                   or (visibilidade = 'equipe_oracao'
                       and array['equipe_oracao'] <@ (select uj.designacoes_no_contexto())))
                  and uj.conta_ativa_no_contexto(autor_conta_id)
                  and not (autor_conta_id = any ((select uj.contas_bloqueadas_no_contexto())::uuid[])))));

-- Igual à de 0009, mais: sugestão NÃO anônima de quem a pessoa bloqueou não
-- aparece para ela. A anônima continua (escondê-la revelaria a autoria).
create or replace function uj.sugestoes_visiveis()
  returns table (id uuid, anonima boolean, titulo text, texto text, status text, resposta text,
                 respondida_em timestamptz, respondida_por_nome text, autor_nome text,
                 minha boolean, criado_em timestamptz, atualizado_em timestamptz, versao int)
  language sql stable security definer
  set search_path = pg_catalog, uj
  as $$
    with eu as (select uj.nivel_no_contexto() as nivel, uj.conta_atual() as conta,
                       uj.contas_bloqueadas_no_contexto() as bloqueadas)
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
       and (s.anonima or not (s.autor_conta_id = any (eu.bloqueadas)))
  $$;

-- ---------------------------------------------------------------- bloqueio e fim do vínculo

-- Igual à de 0012, mais: os bloqueios daquela comunidade em que a pessoa é
-- quem bloqueou ou quem foi bloqueada saem junto (a relação acabou com o
-- vínculo; o que fica no histórico já é de "Pessoa removida").
create or replace function uj.desligar_vinculo(p_vinculo uuid, p_trocar_autoria boolean) returns void
  language plpgsql security definer
  set search_path = pg_catalog, uj
  as $$
declare
  v uj.vinculos;
  i record;
  fantasma uuid;
begin
  select * into v from uj.vinculos where id = p_vinculo for update;
  if not found then
    return;
  end if;

  delete from uj.pedidos_oracao where comunidade_id = v.comunidade_id and autor_conta_id = v.conta_id;
  delete from uj.intercessoes where comunidade_id = v.comunidade_id and conta_id = v.conta_id;
  delete from uj.disponibilidades where vinculo_id = v.id;
  delete from uj.bloqueios
   where comunidade_id = v.comunidade_id
     and (conta_id = v.conta_id or bloqueada_conta_id = v.conta_id);

  update uj.substituicoes set estado = 'cancelada', resolvida_em = now()
   where pedida_por = v.id and estado = 'aberta';
  update uj.substituicoes set motivo = null where pedida_por = v.id and motivo is not null;
  update uj.substituicoes set para_vinculo_id = null
   where para_vinculo_id = v.id and estado = 'aberta';
  update uj.atribuicoes a set estado = 'pendente'
    from uj.substituicoes s
   where s.atribuicao_id = a.id and s.pedida_por = v.id and a.estado = 'substituicao_pedida';
  delete from uj.atribuicoes a using uj.eventos e
   where e.id = a.evento_id and a.vinculo_id = v.id and e.inicio > now();

  for i in select ins.id, ins.evento_id, ins.estado from uj.inscricoes ins
             join uj.eventos e on e.id = ins.evento_id
            where ins.vinculo_id = v.id and ins.estado <> 'cancelada' and e.inicio > now() loop
    perform 1 from uj.eventos where id = i.evento_id for update;
    update uj.inscricoes set estado = 'cancelada', cancelada_em = now() where id = i.id;
    if i.estado = 'confirmada' then
      perform uj.promover_da_espera(i.evento_id);
    end if;
  end loop;
  update uj.inscricoes set nome = 'Pessoa removida' where vinculo_id = v.id;

  update uj.musicos set nome = 'Pessoa removida', observacoes = null, vinculo_id = null
   where vinculo_id = v.id;
  update uj.palestrantes set nome = 'Pessoa removida', observacoes = null, vinculo_id = null
   where vinculo_id = v.id;

  delete from uj.exportacoes where comunidade_id = v.comunidade_id and dono_conta_id = v.conta_id;
  delete from uj.notificacoes where comunidade_id = v.comunidade_id and conta_id = v.conta_id;
  delete from uj.preferencias_notificacao
   where comunidade_id = v.comunidade_id and conta_id = v.conta_id;
  update uj.consentimentos set revogado_em = now()
   where comunidade_id = v.comunidade_id and conta_id = v.conta_id and revogado_em is null;

  if p_trocar_autoria then
    fantasma := gen_random_uuid();
    insert into uj.contas (id, nome, email, estado, anonimizada_em)
      values (fantasma, 'Pessoa removida', 'removida-' || fantasma || '@anonimizada.invalid',
              'anonimizada', now());
    update uj.eventos set criado_por = fantasma
     where comunidade_id = v.comunidade_id and criado_por = v.conta_id;
    update uj.series set criado_por = fantasma
     where comunidade_id = v.comunidade_id and criado_por = v.conta_id;
    update uj.modelos set criado_por = fantasma
     where comunidade_id = v.comunidade_id and criado_por = v.conta_id;
    update uj.tarefas set concluida_por = fantasma
     where comunidade_id = v.comunidade_id and concluida_por = v.conta_id;
    update uj.checklist_itens set marcado_por = fantasma
     where comunidade_id = v.comunidade_id and marcado_por = v.conta_id;
    update uj.notas_internas set autor_conta_id = fantasma
     where comunidade_id = v.comunidade_id and autor_conta_id = v.conta_id;
    update uj.anexos set criado_por = fantasma
     where comunidade_id = v.comunidade_id and criado_por = v.conta_id;
    update uj.sugestoes set autor_conta_id = fantasma
     where comunidade_id = v.comunidade_id and autor_conta_id = v.conta_id;
    update uj.sugestoes set respondida_por = fantasma
     where comunidade_id = v.comunidade_id and respondida_por = v.conta_id;
    update uj.avisos set criado_por = fantasma
     where comunidade_id = v.comunidade_id and criado_por = v.conta_id;
    update uj.musicas set criado_por = fantasma
     where comunidade_id = v.comunidade_id and criado_por = v.conta_id;
    update uj.musicos set criado_por = fantasma
     where comunidade_id = v.comunidade_id and criado_por = v.conta_id;
    update uj.palestrantes set criado_por = fantasma
     where comunidade_id = v.comunidade_id and criado_por = v.conta_id;
    update uj.dinamicas set criado_por = fantasma
     where comunidade_id = v.comunidade_id and criado_por = v.conta_id;
    update uj.denuncias set denunciante_conta_id = fantasma
     where comunidade_id = v.comunidade_id and denunciante_conta_id = v.conta_id;
    update uj.denuncias set resolvida_por = fantasma
     where comunidade_id = v.comunidade_id and resolvida_por = v.conta_id;
    update uj.vinculos set conta_id = fantasma, designacoes = '{}', anonimizado_em = now()
     where id = v.id;
  else
    update uj.vinculos set designacoes = '{}' where id = v.id and designacoes <> '{}';
  end if;
end
$$;

-- ================================================================ auditoria: só as rotinas do dono

-- Marca de "esta transação é uma rotina de retenção da auditoria". Só o dono
-- grava (pelas funções abaixo); nenhum papel do aplicativo tem acesso.
create table uj.manutencoes_da_auditoria (
  xact xid8 primary key default pg_current_xact_id()
);
alter table uj.manutencoes_da_auditoria enable row level security;

-- Igual à de 0001 (UPDATE, DELETE e TRUNCATE recusados para todos), com duas
-- exceções, e só dentro de uma transação marcada:
--   * DELETE de linha com mais de 2 anos (expurgo da P7);
--   * UPDATE que só APAGA identificação (conta, IP, detalhes e, fora o id da
--     própria comunidade, o recurso), sem mexer em ação, data e comunidade.
create or replace function uj.auditoria_imutavel() returns trigger
  language plpgsql
  set search_path = pg_catalog, uj
  as $$
begin
  if tg_op in ('UPDATE', 'DELETE')
     and exists (select 1 from uj.manutencoes_da_auditoria where xact = pg_current_xact_id()) then
    if tg_op = 'DELETE' then
      if old.momento < now() - interval '2 years' then
        return old;
      end if;
    elsif new.id = old.id and new.momento = old.momento and new.acao = old.acao
          and new.comunidade_id is not distinct from old.comunidade_id
          and new.recurso_tipo is not distinct from old.recurso_tipo
          and new.conta_id is null and new.ip_truncado is null
          and new.detalhes = '{}'::jsonb
          and (new.recurso_id is null or new.recurso_id = old.recurso_id) then
      return new;
    end if;
  end if;
  raise exception 'auditoria é só-inserção' using errcode = '42501';
end
$$;

create index auditoria_momento on uj.auditoria (momento);

-- ================================================================ exclusão de comunidade

-- Apaga a comunidade cuja carência acabou (exclusao-de-conta.md, caso 8): tudo
-- que tem o `comunidade_id` dela, mais os consentimentos das inscrições
-- públicas, os códigos de verificação dos convites e as cotas com o id dela.
-- As contas continuam (são da pessoa, não da comunidade), com a foto de perfil.
-- A auditoria fica até completar 2 anos, só com ação, tipo de recurso, data e
-- o id da comunidade: sem conta, IP nem detalhes (Política, seção 9).
create function uj.apagar_comunidade(p_comunidade uuid) returns void
  language plpgsql security definer
  set search_path = pg_catalog, uj
  as $$
declare
  c uj.comunidades;
begin
  select * into c from uj.comunidades where id = p_comunidade for update;
  if not found then
    return;
  end if;
  if c.estado <> 'exclusao_agendada' or c.exclusao_agendada_para > now() then
    raise exception 'comunidade fora da exclusao agendada vencida' using errcode = '55000';
  end if;

  delete from uj.consentimentos
   where comunidade_id = p_comunidade
      or inscricao_id in (select id from uj.inscricoes where comunidade_id = p_comunidade);
  delete from uj.denuncias where comunidade_id = p_comunidade;
  delete from uj.bloqueios where comunidade_id = p_comunidade;
  delete from uj.intercessoes where comunidade_id = p_comunidade;
  delete from uj.pedidos_oracao where comunidade_id = p_comunidade;
  delete from uj.sugestoes where comunidade_id = p_comunidade;
  delete from uj.avisos where comunidade_id = p_comunidade;
  delete from uj.musica_musicos where comunidade_id = p_comunidade;
  delete from uj.musicas where comunidade_id = p_comunidade;
  delete from uj.musicos where comunidade_id = p_comunidade;
  delete from uj.palestrantes where comunidade_id = p_comunidade;
  delete from uj.dinamicas where comunidade_id = p_comunidade;
  delete from uj.andamento_comandos where comunidade_id = p_comunidade;
  delete from uj.andamentos where comunidade_id = p_comunidade;
  delete from uj.presencas where comunidade_id = p_comunidade;
  delete from uj.inscricoes where comunidade_id = p_comunidade;
  delete from uj.substituicoes where comunidade_id = p_comunidade;
  delete from uj.disponibilidades where comunidade_id = p_comunidade;
  delete from uj.atribuicoes where comunidade_id = p_comunidade;
  delete from uj.tarefas where comunidade_id = p_comunidade;
  delete from uj.materiais where comunidade_id = p_comunidade;
  delete from uj.checklist_itens where comunidade_id = p_comunidade;
  delete from uj.notas_internas where comunidade_id = p_comunidade;
  delete from uj.anexos where comunidade_id = p_comunidade;
  delete from uj.etapas where comunidade_id = p_comunidade;
  delete from uj.eventos where comunidade_id = p_comunidade;
  delete from uj.series where comunidade_id = p_comunidade;
  delete from uj.modelos where comunidade_id = p_comunidade;
  delete from uj.locais where comunidade_id = p_comunidade;
  delete from uj.exportacoes where comunidade_id = p_comunidade;
  delete from uj.notificacoes where comunidade_id = p_comunidade;
  delete from uj.preferencias_notificacao where comunidade_id = p_comunidade;
  delete from uj.sync_operacoes where comunidade_id = p_comunidade;
  delete from uj.logos_comunidades where comunidade_id = p_comunidade;
  delete from uj.verificacoes_email
   where convite_id in (select id from uj.convites where comunidade_id = p_comunidade);
  delete from uj.cotas_diarias d
   where position(p_comunidade::text in d.chave) > 0
      or exists (select 1 from uj.convites x
                  where x.comunidade_id = p_comunidade and position(x.id::text in d.chave) > 0);
  delete from uj.vinculos where comunidade_id = p_comunidade;
  delete from uj.convites where comunidade_id = p_comunidade;
  delete from uj.comunidades where id = p_comunidade;
  -- Por último: as exclusões acima também anunciaram mudanças.
  delete from uj.mudancas where comunidade_id = p_comunidade;

  insert into uj.manutencoes_da_auditoria (xact) values (pg_current_xact_id())
    on conflict do nothing;
  update uj.auditoria
     set conta_id = null, ip_truncado = null, detalhes = '{}'::jsonb,
         recurso_id = case when recurso_tipo = 'comunidade' then recurso_id end
   where comunidade_id = p_comunidade
     and (conta_id is not null or ip_truncado is not null or detalhes <> '{}'::jsonb
          or (recurso_id is not null and recurso_tipo is distinct from 'comunidade'));
  delete from uj.manutencoes_da_auditoria where xact = pg_current_xact_id();

  insert into uj.auditoria (comunidade_id, acao, recurso_tipo, recurso_id)
    values (p_comunidade, 'comunidade.excluida', 'comunidade', p_comunidade::text);
end
$$;

create function uj.excluir_comunidades_vencidas() returns int
  language plpgsql security definer
  set search_path = pg_catalog, uj
  as $$
declare
  c uuid;
  n int := 0;
begin
  for c in select id from uj.comunidades
            where estado = 'exclusao_agendada' and exclusao_agendada_para <= now()
            order by exclusao_agendada_para loop
    perform uj.apagar_comunidade(c);
    n := n + 1;
  end loop;
  return n;
end
$$;

-- ================================================================ expurgo de 2 anos (P7)

-- Auditoria com mais de 2 anos e consentimentos revogados há mais de 2 anos.
-- Consentimento ainda valendo fica enquanto a conta ou a inscrição existir.
create function uj.expurgar_registros_de_2_anos() returns jsonb
  language plpgsql security definer
  set search_path = pg_catalog, uj
  as $$
declare
  n_auditoria int;
  n_consentimentos int;
begin
  insert into uj.manutencoes_da_auditoria (xact) values (pg_current_xact_id())
    on conflict do nothing;
  delete from uj.auditoria where momento < now() - interval '2 years';
  get diagnostics n_auditoria = row_count;
  delete from uj.manutencoes_da_auditoria where xact = pg_current_xact_id();

  delete from uj.consentimentos where revogado_em < now() - interval '2 years';
  get diagnostics n_consentimentos = row_count;
  return jsonb_build_object('auditoria_expurgada', n_auditoria,
                            'consentimentos_expurgados', n_consentimentos);
end
$$;

-- ================================================================ desativação vencida (12 meses)

alter table uj.vinculos add column desativado_em timestamptz;
-- Sem a data real, conta da última alteração do vínculo: nunca adianta o prazo.
update uj.vinculos set desativado_em = atualizado_em where estado = 'desativado';

-- Igual à de 0012, mais a data da desativação (começa a contar os 12 meses).
create or replace function uj.marcar_remocao() returns trigger
  language plpgsql
  set search_path = pg_catalog, uj
  as $$
begin
  if new.estado = 'removido' and (tg_op = 'INSERT' or old.estado <> 'removido') then
    new.removido_em := now();
  elsif new.estado <> 'removido' then
    new.removido_em := null;
  end if;
  if new.estado = 'desativado' and (tg_op = 'INSERT' or old.estado <> 'desativado') then
    new.desativado_em := now();
  elsif new.estado <> 'desativado' then
    new.desativado_em := null;
  end if;
  return new;
end
$$;

-- Vínculo desativado há 12 meses vira remoção (exclusao-de-conta.md, caso 4).
-- Daí correm os 30 dias da remoção, em que um convite dirigido ainda devolve
-- tudo; depois, `executar_retencao` aplica o efeito da saída. A mudança fica
-- na auditoria da comunidade, que a administração lê.
create function uj.remover_desativacoes_vencidas() returns int
  language plpgsql security definer
  set search_path = pg_catalog, uj
  as $$
declare
  v record;
  n int := 0;
begin
  for v in select id, comunidade_id, papel, designacoes from uj.vinculos
            where estado = 'desativado' and desativado_em < now() - interval '12 months'
            order by id for update loop
    update uj.vinculos set estado = 'removido', designacoes = '{}' where id = v.id;
    insert into uj.auditoria (conta_id, comunidade_id, acao, recurso_tipo, recurso_id, detalhes)
      values (null, v.comunidade_id, 'vinculo.alterado', 'vinculo', v.id::text,
              jsonb_build_object(
                'antes', jsonb_build_object('papel', v.papel, 'estado', 'desativado',
                                            'equipeDeOracao', cardinality(v.designacoes) > 0),
                'depois', jsonb_build_object('papel', v.papel, 'estado', 'removido',
                                             'equipeDeOracao', false),
                'motivo', 'desativacao_vencida'));
    n := n + 1;
  end loop;
  return n;
end
$$;

-- ================================================================ retenção diária

-- Igual à de 0015, mais (no começo, para não gastar trabalho com o que some):
-- comunidades com a carência vencida, desativações de 12 meses, expurgo de 2
-- anos e a varredura de bloqueios órfãos.
create or replace function uj.executar_retencao() returns jsonb
  language plpgsql security definer
  set search_path = pg_catalog, uj
  as $$
declare
  r jsonb := '{}'::jsonb;
  n int;
  v record;
begin
  r := r || jsonb_build_object('comunidades_excluidas', uj.excluir_comunidades_vencidas());
  r := r || jsonb_build_object('vinculos_desativados_vencidos', uj.remover_desativacoes_vencidas());
  r := r || uj.expurgar_registros_de_2_anos();

  r := r || jsonb_build_object('inscricoes_anonimizadas', uj.anonimizar_inscricoes_vencidas());
  r := r || jsonb_build_object('presencas_avulsas_anonimizadas', uj.anonimizar_presencas_avulsas_vencidas());
  r := r || jsonb_build_object('exportacoes_expurgadas', uj.expurgar_exportacoes_vencidas());

  delete from uj.sessoes
   where coalesce(revogada_em, expira_em) < now() - interval '30 days'
      or expira_em < now() - interval '30 days';
  get diagnostics n = row_count;
  r := r || jsonb_build_object('sessoes_apagadas', n);

  delete from uj.aparelhos_push a
   where not exists (select 1 from uj.sessoes s
                      where s.familia = a.familia and s.revogada_em is null and s.expira_em > now());
  get diagnostics n = row_count;
  r := r || jsonb_build_object('aparelhos_sem_sessao_apagados', n);

  delete from uj.recuperacoes_senha
   where expira_em < now() - interval '24 hours' or usado_em < now() - interval '24 hours';
  get diagnostics n = row_count;
  r := r || jsonb_build_object('links_de_senha_apagados', n);

  delete from uj.verificacoes_email
   where expira_em < now() - interval '24 hours' or consumido_em < now() - interval '24 hours';
  get diagnostics n = row_count;
  r := r || jsonb_build_object('codigos_de_verificacao_apagados', n);

  delete from uj.provas_de_plataforma where expira_em < now() - interval '24 hours';
  get diagnostics n = row_count;
  r := r || jsonb_build_object('provas_de_2fa_apagadas', n);

  delete from uj.provas_de_reautenticacao where expira_em < now() - interval '24 hours';
  get diagnostics n = row_count;
  r := r || jsonb_build_object('provas_de_reautenticacao_apagadas', n);

  update uj.convites set email_destino = null
   where email_destino is not null
     and (expira_em < now() - interval '30 days'
          or revogado_em < now() - interval '30 days'
          or (usos >= usos_maximos and ultimo_uso_em < now() - interval '30 days'));
  get diagnostics n = row_count;
  r := r || jsonb_build_object('convites_sem_email', n);

  delete from uj.cotas_diarias where dia < (now() at time zone 'America/Sao_Paulo')::date - 30;
  get diagnostics n = row_count;
  r := r || jsonb_build_object('cotas_apagadas', n);

  delete from uj.disponibilidades where data < current_date - interval '6 months';
  get diagnostics n = row_count;
  r := r || jsonb_build_object('disponibilidades_apagadas', n);

  delete from uj.notificacoes where criado_em < now() - interval '30 days';
  get diagnostics n = row_count;
  r := r || jsonb_build_object('notificacoes_apagadas', n);

  delete from uj.sync_operacoes where criado_em < now() - interval '45 days';
  get diagnostics n = row_count;
  r := r || jsonb_build_object('operacoes_offline_apagadas', n);

  n := 0;
  for v in select id from uj.vinculos
            where estado = 'removido' and anonimizado_em is null
              and removido_em < now() - interval '30 days' loop
    perform uj.desligar_vinculo(v.id, true);
    n := n + 1;
  end loop;
  r := r || jsonb_build_object('vinculos_removidos_desligados', n);

  delete from uj.intercessoes i
   where exists (select 1 from uj.contas a where a.id = i.conta_id and a.estado = 'anonimizada')
      or not exists (select 1 from uj.vinculos x
                      where x.conta_id = i.conta_id and x.comunidade_id = i.comunidade_id);
  get diagnostics n = row_count;
  r := r || jsonb_build_object('intercessoes_orfas_apagadas', n);

  delete from uj.pedidos_oracao p
   where exists (select 1 from uj.contas a where a.id = p.autor_conta_id and a.estado = 'anonimizada')
      or not exists (select 1 from uj.vinculos x
                      where x.conta_id = p.autor_conta_id and x.comunidade_id = p.comunidade_id);
  get diagnostics n = row_count;
  r := r || jsonb_build_object('pedidos_orfaos_apagados', n);

  -- Mesma varredura para bloqueios: uma das duas contas anonimizada ou sem
  -- vínculo seu na comunidade (desligar_vinculo já apaga; isto é a rede).
  delete from uj.bloqueios b
   where exists (select 1 from uj.contas a
                  where a.id in (b.conta_id, b.bloqueada_conta_id) and a.estado = 'anonimizada')
      or not exists (select 1 from uj.vinculos x
                      where x.conta_id = b.conta_id and x.comunidade_id = b.comunidade_id)
      or not exists (select 1 from uj.vinculos x
                      where x.conta_id = b.bloqueada_conta_id and x.comunidade_id = b.comunidade_id);
  get diagnostics n = row_count;
  r := r || jsonb_build_object('bloqueios_orfaos_apagados', n);

  return r;
end
$$;

-- ================================================================ privilégios

revoke execute on all functions in schema uj from public;
grant select, delete on uj.bloqueios to uj_api;
grant execute on function uj.contas_bloqueadas_no_contexto(), uj.bloquear(text, uuid),
  uj.meus_bloqueios()
  to uj_api;
