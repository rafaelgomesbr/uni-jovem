-- 0012: privacidade em código (F18). Especificação em docs/privacidade/
-- (exclusao-de-conta.md, textos-de-consentimento.md, mapa-de-dados.md).
--
--   * Faixa de idade declarada (sem data de nascimento) e registro versionado
--     de consentimentos (conta, vínculo e inscrição pública).
--   * Denúncia de conteúdo (oração visível à comunidade, sugestão, aviso), com
--     fila para administradores. Quem denunciou não aparece para eles.
--   * Efeito do art. 16 ao sair ou ser removido: `uj.desligar_vinculo`.
--   * Exclusão de conta atômica: `uj.excluir_conta` (chamada por uj_auth depois
--     da reautenticação, como aceitar_convite).
--   * Exportação dos dados do titular: `uj.exportar_meus_dados`.
--   * Inscrição pública: consentimento TC-04 com versão e "cancelar e apagar agora".
--   * Validade offline padrão de 7 dias (D23).

-- ---------------------------------------------------------------- idade e consentimentos

alter table uj.contas add column faixa_etaria text check (faixa_etaria in ('16_17', '18_mais'));

create table uj.consentimentos (
  id uuid primary key default gen_random_uuid(),
  -- Conta (TC-01, TC-02, TC-03) ou inscrição pública (TC-04).
  conta_id uuid references uj.contas (id),
  inscricao_id uuid references uj.inscricoes (id) on delete set null,
  -- Nula para os consentimentos da conta (idade, termos), que não são de uma comunidade.
  comunidade_id uuid references uj.comunidades (id),
  vinculo_id uuid references uj.vinculos (id),
  texto_id text not null check (texto_id ~ '^TC-[0-9]{2}$'),
  versao int not null check (versao between 1 and 999),
  forma text not null check (forma in ('ios', 'android', 'web', 'pagina_publica')),
  -- TC-01: faixa declarada; TC-03 (16 e 17 anos): ciência do responsável;
  -- TC-04: confirmação de idade ou de responsável.
  faixa_etaria text check (faixa_etaria in ('16_17', '18_mais')),
  confirmacao_adicional boolean,
  concedido_em timestamptz not null default now(),
  revogado_em timestamptz,
  check (conta_id is not null or inscricao_id is not null or texto_id = 'TC-04'),
  check (texto_id <> 'TC-03' or (comunidade_id is not null and vinculo_id is not null))
);
create index consentimentos_comunidade on uj.consentimentos (comunidade_id, conta_id);
create index consentimentos_conta on uj.consentimentos (conta_id);
create index consentimentos_inscricao on uj.consentimentos (inscricao_id);
create index consentimentos_vinculo on uj.consentimentos (vinculo_id);

create function uj.registrar_mudanca_de_consentimento() returns trigger
  language plpgsql security definer
  set search_path = pg_catalog, uj
  as $$
declare
  linha record;
begin
  if tg_op = 'DELETE' then linha := old; else linha := new; end if;
  if linha.comunidade_id is not null and linha.conta_id is not null then
    insert into uj.mudancas (comunidade_id, tabela, registro_id, operacao, conta_alvo)
      values (linha.comunidade_id, 'consentimentos', linha.id, left(tg_op, 1), linha.conta_id);
  end if;
  return null;
end
$$;
create trigger consentimentos_mudanca after insert or update or delete on uj.consentimentos
  for each row execute function uj.registrar_mudanca_de_consentimento();

-- Chamada por uj_auth no cadastro e no aceite de convite (a API confere antes).
create function uj.registrar_consentimento(p_conta uuid, p_comunidade uuid, p_vinculo uuid,
                                           p_texto text, p_versao int, p_forma text,
                                           p_faixa text, p_confirmacao boolean) returns uuid
  language plpgsql security definer
  set search_path = pg_catalog, uj
  as $$
declare
  novo uuid;
  c uuid := p_comunidade;
begin
  -- A comunidade sai do vínculo (que precisa ser da própria conta).
  if p_vinculo is not null then
    select comunidade_id into c from uj.vinculos where id = p_vinculo and conta_id = p_conta;
    if c is null or (p_comunidade is not null and c <> p_comunidade) then
      raise exception 'vinculo de outra conta' using errcode = '23503';
    end if;
  end if;
  insert into uj.consentimentos (conta_id, comunidade_id, vinculo_id, texto_id, versao, forma,
                                 faixa_etaria, confirmacao_adicional)
    values (p_conta, c, p_vinculo, p_texto, p_versao, p_forma, p_faixa, p_confirmacao)
  returning id into novo;
  return novo;
end
$$;

-- Declaração de idade (TC-01). Menor de 16 nunca chega aqui: a API recusa antes.
create function uj.declarar_faixa_etaria(p_conta uuid, p_faixa text, p_versao int, p_forma text)
  returns void
  language plpgsql security definer
  set search_path = pg_catalog, uj
  as $$
begin
  if p_faixa not in ('16_17', '18_mais') then
    raise exception 'faixa invalida' using errcode = '22023';
  end if;
  update uj.contas set faixa_etaria = p_faixa where id = p_conta and estado = 'ativa';
  if not found then
    raise exception 'conta invalida' using errcode = 'UJ004';
  end if;
  insert into uj.consentimentos (conta_id, texto_id, versao, forma, faixa_etaria)
    values (p_conta, 'TC-01', p_versao, p_forma, p_faixa);
end
$$;

alter table uj.consentimentos enable row level security;
create policy consentimentos_proprios on uj.consentimentos for select to uj_api
  using (conta_id = (select uj.conta_atual())
         and (comunidade_id is null or comunidade_id = (select uj.comunidade_atual())
              or (select uj.comunidade_atual()) is null));

-- ---------------------------------------------------------------- inscrição pública (TC-04)

-- Igual à de 0008, mais o prazo de retenção (o texto do consentimento cita os dias).
drop function uj.evento_publico(text);
create function uj.evento_publico(p_id_publico text)
  returns table (titulo text, descricao text, categoria text, inicio timestamptz, duracao_min int,
                 fuso text, status text, motivo_status text, informacoes_uteis text,
                 local_nome text, local_tipo text, local_endereco text, local_latitude double precision,
                 local_longitude double precision, comunidade_nome text, comunidade_cor text,
                 capacidade int, vagas_restantes int, lista_de_espera boolean,
                 inscricoes_abertas boolean, retencao_dias int)
  language sql stable security definer
  set search_path = pg_catalog, uj
  as $$
    select e.titulo, e.descricao, e.categoria, e.inicio, e.duracao_min, e.fuso, e.status,
           case when e.status in ('cancelado', 'adiado') then e.motivo_status end,
           e.informacoes_uteis, l.nome, l.tipo,
           case when l.tipo = 'externo' then l.endereco end,
           case when l.tipo = 'externo' then l.latitude end,
           case when l.tipo = 'externo' then l.longitude end,
           c.nome, c.cor, e.capacidade,
           case when e.capacidade is null then null
                else greatest(0, e.capacidade - (select count(*) from uj.inscricoes i
                                                  where i.evento_id = e.id and i.estado = 'confirmada'))::int end,
           e.lista_de_espera,
           e.status = 'publicado' and e.inicio > now()
             and (e.inscricao_ate is null or e.inscricao_ate > now()),
           c.retencao_inscricoes_dias
      from uj.eventos e
      join uj.comunidades c on c.id = e.comunidade_id
      left join uj.locais l on l.id = e.local_id
     where e.id_publico = p_id_publico and e.visibilidade = 'publica'
       and e.status in ('publicado', 'adiado', 'cancelado', 'encerrado')
       and c.estado = 'ativa'
  $$;

-- Igual à de 0008, mais o registro versionado do consentimento e a
-- confirmação de idade (ou de responsável). UJ035: idade não confirmada.
drop function uj.inscrever_publico(text, text, text, text, bytea);
create function uj.inscrever_publico(p_id_publico text, p_nome text, p_telefone text, p_email text,
                                     p_token_hash bytea, p_texto text, p_versao int,
                                     p_idade_confirmada boolean)
  returns table (inscricao_id uuid, estado text, codigo_checkin text, ja_existia boolean)
  language plpgsql security definer
  set search_path = pg_catalog, uj
  as $$
#variable_conflict use_column
declare
  e uj.eventos;
  existente uj.inscricoes;
  novo_estado text;
  nova uj.inscricoes;
begin
  if p_idade_confirmada is not true or p_texto <> 'TC-04' then
    raise exception 'idade nao confirmada' using errcode = 'UJ035';
  end if;
  select ev.* into e from uj.eventos ev join uj.comunidades c on c.id = ev.comunidade_id
   where ev.id_publico = p_id_publico and ev.visibilidade = 'publica' and ev.status = 'publicado'
     and ev.inicio > now() and (ev.inscricao_ate is null or ev.inscricao_ate > now())
     and c.estado = 'ativa'
   for update of ev;
  if not found then
    raise exception 'inscricoes indisponiveis' using errcode = 'UJ030';
  end if;
  select * into existente from uj.inscricoes
   where evento_id = e.id and telefone = p_telefone and estado <> 'cancelada';
  if found then
    return query select existente.id, existente.estado, existente.codigo_checkin, true;
    return;
  end if;
  novo_estado := uj.estado_para_nova_inscricao(e.id);
  if novo_estado is null then
    raise exception 'evento lotado' using errcode = 'UJ031';
  end if;
  insert into uj.inscricoes (comunidade_id, evento_id, origem, nome, telefone, email, estado,
                             token_cancelamento_hash, consentimento_em)
    values (e.comunidade_id, e.id, 'publica', btrim(p_nome), p_telefone, lower(p_email), novo_estado,
            p_token_hash, now())
  returning * into nova;
  insert into uj.consentimentos (inscricao_id, comunidade_id, texto_id, versao, forma,
                                 confirmacao_adicional)
    values (nova.id, e.comunidade_id, p_texto, p_versao, 'pagina_publica', true);
  return query select nova.id, nova.estado, nova.codigo_checkin, false;
end
$$;

-- "Cancelar e apagar agora" pelo link (token). Cancela se ainda não estava,
-- promove a espera e anonimiza na hora; o link deixa de valer. A presença já
-- registrada fica, sem nome (a contagem não muda).
create function uj.apagar_inscricao_publica(p_id_publico text, p_token_hash bytea) returns boolean
  language plpgsql security definer
  set search_path = pg_catalog, uj
  as $$
declare
  i uj.inscricoes;
begin
  select ins.* into i from uj.inscricoes ins join uj.eventos e on e.id = ins.evento_id
   where e.id_publico = p_id_publico and ins.token_cancelamento_hash = p_token_hash
     and ins.origem = 'publica' and ins.anonimizada_em is null
   for update of ins;
  if not found then
    return false;
  end if;
  perform 1 from uj.eventos where id = i.evento_id for update;
  update uj.inscricoes
     set estado = 'cancelada', cancelada_em = coalesce(cancelada_em, now()),
         nome = 'Participante', telefone = null, email = null, token_cancelamento_hash = null,
         anonimizada_em = now()
   where id = i.id;
  update uj.consentimentos set revogado_em = now()
   where inscricao_id = i.id and revogado_em is null;
  if i.estado = 'confirmada' then
    perform uj.promover_da_espera(i.evento_id);
  end if;
  return true;
end
$$;

-- ---------------------------------------------------------------- denúncias (Apple 1.2)

create table uj.denuncias (
  id uuid primary key default gen_random_uuid(),
  comunidade_id uuid not null references uj.comunidades (id),
  recurso_tipo text not null check (recurso_tipo in ('pedido_oracao', 'sugestao', 'aviso')),
  recurso_id uuid not null,
  -- Guardado para o operador investigar abuso de denúncia; sem SELECT para uj_api.
  denunciante_conta_id uuid not null references uj.contas (id),
  motivo text not null check (motivo in ('ofensivo', 'dados_de_terceiros', 'spam', 'risco', 'outro')),
  detalhe text check (length(detalhe) <= 500),
  estado text not null default 'aberta' check (estado in ('aberta', 'procedente', 'improcedente')),
  resolucao text check (length(resolucao) <= 500),
  conteudo_retirado boolean not null default false,
  resolvida_por uuid references uj.contas (id),
  resolvida_em timestamptz,
  criado_em timestamptz not null default now(),
  check ((estado = 'aberta') = (resolvida_em is null))
);
create index denuncias_comunidade on uj.denuncias (comunidade_id, estado, criado_em desc);
create index denuncias_denunciante on uj.denuncias (denunciante_conta_id);
create index denuncias_resolvida_por on uj.denuncias (resolvida_por);
-- A mesma pessoa não abre duas denúncias do mesmo conteúdo.
create unique index denuncias_uma_aberta on uj.denuncias (recurso_id, denunciante_conta_id)
  where estado = 'aberta';

create function uj.registrar_mudanca_de_denuncia() returns trigger
  language plpgsql security definer
  set search_path = pg_catalog, uj
  as $$
declare
  linha record;
begin
  if tg_op = 'DELETE' then linha := old; else linha := new; end if;
  insert into uj.mudancas (comunidade_id, tabela, registro_id, operacao, nivel_minimo)
    values (linha.comunidade_id, 'denuncias', linha.id, left(tg_op, 1), 30);
  return null;
end
$$;
create trigger denuncias_mudanca after insert or update or delete on uj.denuncias
  for each row execute function uj.registrar_mudanca_de_denuncia();

-- Denunciar. Só conteúdo que a pessoa VÊ (pedido de oração: só o visível à
-- comunidade, de outra pessoa). UJ050: conteúdo não encontrado.
-- A auditoria não leva quem denunciou (administradores leem a auditoria).
create function uj.denunciar(p_tipo text, p_recurso uuid, p_motivo text, p_detalhe text)
  returns uuid
  language plpgsql security definer
  set search_path = pg_catalog, uj
  as $$
declare
  c uuid := uj.comunidade_atual();
  eu uuid := uj.conta_atual();
  nivel int := uj.nivel_gravavel_no_contexto();
  visivel boolean;
  existente uuid;
  nova uuid;
begin
  if nivel < 10 then
    raise exception 'sem permissao' using errcode = '42501';
  end if;
  if p_tipo = 'pedido_oracao' then
    visivel := exists (select 1 from uj.pedidos_oracao p
                        where p.id = p_recurso and p.comunidade_id = c
                          and p.visibilidade = 'comunidade' and p.autor_conta_id <> eu
                          and uj.conta_ativa_no_contexto(p.autor_conta_id));
  elsif p_tipo = 'sugestao' then
    visivel := exists (select 1 from uj.sugestoes s
                        where s.id = p_recurso and s.comunidade_id = c
                          and (nivel >= 20 or s.autor_conta_id = eu));
  elsif p_tipo = 'aviso' then
    visivel := exists (select 1 from uj.avisos a
                        where a.id = p_recurso and a.comunidade_id = c
                          and (nivel >= 20 or (a.estado = 'publicado'
                               and (a.visivel_ate is null or a.visivel_ate > now()))));
  else
    visivel := false;
  end if;
  if not visivel then
    raise exception 'conteudo nao encontrado' using errcode = 'UJ050';
  end if;
  select id into existente from uj.denuncias
   where recurso_id = p_recurso and denunciante_conta_id = eu and estado = 'aberta';
  if existente is not null then
    return existente;
  end if;
  insert into uj.denuncias (comunidade_id, recurso_tipo, recurso_id, denunciante_conta_id,
                            motivo, detalhe)
    values (c, p_tipo, p_recurso, eu, p_motivo, nullif(btrim(p_detalhe), ''))
  returning id into nova;
  insert into uj.auditoria (conta_id, comunidade_id, acao, recurso_tipo, recurso_id, detalhes)
    values (null, c, 'denuncia.criada', p_tipo, p_recurso::text,
            jsonb_build_object('denuncia', nova, 'motivo', p_motivo));
  return nova;
end
$$;

-- Resolver (administrador). Retirar o conteúdo procedente: pedido de oração
-- volta a "Somente eu" (some da comunidade, a autora continua com ele), aviso
-- é despublicado, sugestão é apagada. UJ051: denúncia não encontrada ou já resolvida.
create function uj.resolver_denuncia(p_denuncia uuid, p_estado text, p_resolucao text,
                                     p_retirar boolean) returns void
  language plpgsql security definer
  set search_path = pg_catalog, uj
  as $$
declare
  d uj.denuncias;
  retirar boolean := coalesce(p_retirar, false) and p_estado = 'procedente';
begin
  if uj.nivel_gravavel_no_contexto() < 30 then
    raise exception 'sem permissao' using errcode = '42501';
  end if;
  if p_estado not in ('procedente', 'improcedente') then
    raise exception 'estado invalido' using errcode = '22023';
  end if;
  select * into d from uj.denuncias
   where id = p_denuncia and comunidade_id = uj.comunidade_atual() and estado = 'aberta'
   for update;
  if not found then
    raise exception 'denuncia nao encontrada' using errcode = 'UJ051';
  end if;
  if retirar then
    if d.recurso_tipo = 'pedido_oracao' then
      update uj.pedidos_oracao set visibilidade = 'somente_eu'
       where id = d.recurso_id and comunidade_id = d.comunidade_id;
    elsif d.recurso_tipo = 'aviso' then
      update uj.avisos set estado = 'despublicado'
       where id = d.recurso_id and comunidade_id = d.comunidade_id and estado = 'publicado';
    elsif d.recurso_tipo = 'sugestao' then
      delete from uj.sugestoes where id = d.recurso_id and comunidade_id = d.comunidade_id;
    end if;
  end if;
  -- Todas as denúncias abertas do mesmo conteúdo saem da fila juntas.
  update uj.denuncias
     set estado = p_estado, resolucao = nullif(btrim(p_resolucao), ''), conteudo_retirado = retirar,
         resolvida_por = uj.conta_atual(), resolvida_em = now()
   where recurso_id = d.recurso_id and comunidade_id = d.comunidade_id and estado = 'aberta';
  insert into uj.auditoria (conta_id, comunidade_id, acao, recurso_tipo, recurso_id, detalhes)
    values (uj.conta_atual(), d.comunidade_id, 'denuncia.resolvida', d.recurso_tipo,
            d.recurso_id::text,
            jsonb_build_object('denuncia', d.id, 'estado', p_estado, 'retirado', retirar));
end
$$;

alter table uj.denuncias enable row level security;
create policy denuncias_ler on uj.denuncias for select to uj_api
  using (comunidade_id = (select uj.comunidade_atual()) and (select uj.nivel_no_contexto()) >= 30);

-- ---------------------------------------------------------------- desligar vínculo (art. 16)

alter table uj.vinculos add column removido_em timestamptz;
alter table uj.vinculos add column anonimizado_em timestamptz;
update uj.vinculos set removido_em = atualizado_em where estado = 'removido';

-- Data da remoção: começa a contar o prazo de 30 dias da remoção pelo admin.
create function uj.marcar_remocao() returns trigger
  language plpgsql
  set search_path = pg_catalog, uj
  as $$
begin
  if new.estado = 'removido' and (tg_op = 'INSERT' or old.estado <> 'removido') then
    new.removido_em := now();
  elsif new.estado <> 'removido' then
    new.removido_em := null;
  end if;
  return new;
end
$$;
create trigger vinculos_remocao before insert or update of estado on uj.vinculos
  for each row execute function uj.marcar_remocao();

-- Efeito do fim do tratamento numa comunidade (exclusao-de-conta.md, casos 1 a 3):
-- oração e intercessões apagadas; disponibilidade e escalas futuras retiradas;
-- substituições abertas canceladas e motivos apagados; inscrições futuras
-- canceladas; nome nas inscrições, músicos e palestrantes trocado; exportações,
-- notificações e preferências daquela comunidade apagadas; TC-03 revogado.
--
-- Com `p_trocar_autoria`, o histórico também é desligado da conta: vínculo e
-- autorias passam para uma conta-fantasma anonimizada criada para isso. A
-- pessoa continua existindo, mas o passado dela ali é de "Pessoa removida", e
-- um convite futuro cria um vínculo novo ("como pessoa nova"). A auditoria
-- (só inserção) continua com o identificador original, sem nome.
create function uj.desligar_vinculo(p_vinculo uuid, p_trocar_autoria boolean) returns void
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

-- Sair da comunidade (a rota já marcou o PRÓPRIO vínculo como removido nesta
-- transação): aplica o efeito na hora, inclusive desligar o histórico.
create function uj.efeitos_da_saida() returns void
  language plpgsql security definer
  set search_path = pg_catalog, uj
  as $$
declare
  v uuid;
begin
  select id into v from uj.vinculos
   where conta_id = uj.conta_atual() and comunidade_id = uj.comunidade_atual()
     and estado = 'removido' and anonimizado_em is null;
  if v is not null then
    perform uj.desligar_vinculo(v, true);
  end if;
end
$$;

-- ---------------------------------------------------------------- exclusão de conta

-- Lista mínima para não ressuscitar contas ao restaurar backup (seção 6).
create table uj.exclusoes_de_conta (
  conta_id uuid primary key,
  momento timestamptz not null default now()
);
alter table uj.exclusoes_de_conta enable row level security;

-- Marca de "esta transação está excluindo esta conta". Só o dono grava (pela
-- função): nenhum papel do app consegue forjar a marca, ao contrário de um GUC.
create table uj.exclusoes_em_andamento (
  conta_id uuid not null,
  xact xid8 not null default pg_current_xact_id(),
  primary key (conta_id, xact)
);
alter table uj.exclusoes_em_andamento enable row level security;

create function uj.em_exclusao_de_conta(p_conta uuid) returns boolean
  language sql stable security definer
  set search_path = pg_catalog, uj
  as $$
    select exists (select 1 from uj.exclusoes_em_andamento
                    where conta_id = p_conta and xact = pg_current_xact_id())
  $$;

-- Comunidades em que a conta é a única admin ativa E há outras pessoas ativas
-- (quem pode ser nomeado). Só aí a exclusão espera a nomeação.
create function uj.comunidades_em_que_e_unico_admin(p_conta uuid)
  returns table (id uuid, nome text)
  language sql stable security definer
  set search_path = pg_catalog, uj
  as $$
    select c.id, c.nome
      from uj.vinculos v join uj.comunidades c on c.id = v.comunidade_id
     where v.conta_id = p_conta and v.papel = 'admin' and v.estado = 'ativo'
       and not uj.comunidade_tem_outro_admin(c.id, v.id, p_conta)
       and exists (select 1 from uj.vinculos o join uj.contas a on a.id = o.conta_id
                    where o.comunidade_id = c.id and o.conta_id <> p_conta
                      and o.estado = 'ativo' and a.estado = 'ativa')
     order by c.nome
  $$;

-- As travas de "último admin" de 0001 ganham uma exceção: a exclusão da conta
-- de quem é a ÚNICA pessoa ativa da comunidade (não há a quem nomear). Com
-- outras pessoas, a trava continua.
create or replace function uj.manter_um_admin() returns trigger
  language plpgsql security definer
  set search_path = pg_catalog, uj
  as $$
begin
  if old.papel = 'admin' and old.estado = 'ativo'
     and not (new.papel = 'admin' and new.estado = 'ativo') then
    perform 1 from uj.comunidades where id = old.comunidade_id for no key update;
    if not uj.comunidade_tem_outro_admin(old.comunidade_id, old.id, null)
       and not uj.eh_proprietario()
       and not (uj.em_exclusao_de_conta(old.conta_id)
                and not exists (select 1 from uj.vinculos o join uj.contas a on a.id = o.conta_id
                                 where o.comunidade_id = old.comunidade_id and o.id <> old.id
                                   and o.estado = 'ativo' and a.estado = 'ativa')) then
      raise exception 'a comunidade ficaria sem administrador' using errcode = '23514';
    end if;
  end if;
  return new;
end
$$;

-- Exclusão de conta (caso 1). Devolve o e-mail antigo, só para o aviso de
-- confirmação (a API guarda em memória até enviar). Erros: UJ040 é o Criador,
-- UJ041 única admin de comunidade com outras pessoas, UJ004 conta inválida.
create function uj.excluir_conta(p_conta uuid) returns text
  language plpgsql security definer
  set search_path = pg_catalog, uj
  as $$
declare
  a uj.contas;
  v record;
begin
  select * into a from uj.contas where id = p_conta for update;
  if not found or a.estado <> 'ativa' then
    raise exception 'conta invalida' using errcode = 'UJ004';
  end if;
  if a.plataforma_proprietario then
    raise exception 'conta do criador' using errcode = 'UJ040';
  end if;
  if exists (select 1 from uj.comunidades_em_que_e_unico_admin(p_conta)) then
    raise exception 'unica administradora' using errcode = 'UJ041';
  end if;

  insert into uj.exclusoes_em_andamento (conta_id) values (p_conta);

  for v in select id from uj.vinculos where conta_id = p_conta loop
    perform uj.desligar_vinculo(v.id, false);
  end loop;
  update uj.vinculos set estado = 'removido', designacoes = '{}'
   where conta_id = p_conta and estado <> 'removido';
  -- A conta inteira é anonimizada abaixo: o prazo de 30 dias da remoção não se aplica.
  update uj.vinculos set anonimizado_em = now() where conta_id = p_conta;

  -- Pedidos e intercessões em comunidades onde o vínculo já não existia.
  delete from uj.pedidos_oracao where autor_conta_id = p_conta;
  delete from uj.intercessoes where conta_id = p_conta;
  delete from uj.exportacoes where dono_conta_id = p_conta;
  update uj.convites set email_destino = null where email_destino = a.email;

  delete from uj.aparelhos_push where conta_id = p_conta;
  delete from uj.notificacoes where conta_id = p_conta;
  delete from uj.preferencias_notificacao where conta_id = p_conta;
  delete from uj.preferencias_conta where conta_id = p_conta;
  delete from uj.sessoes where conta_id = p_conta;
  delete from uj.codigos_recuperacao where conta_id = p_conta;
  delete from uj.provas_de_plataforma where conta_id = p_conta;
  delete from uj.recuperacoes_senha where conta_id = p_conta;
  delete from uj.verificacoes_email where email = a.email;
  update uj.consentimentos set revogado_em = now()
   where conta_id = p_conta and revogado_em is null;

  update uj.contas
     set nome = 'Pessoa removida', email = 'removida-' || p_conta || '@anonimizada.invalid',
         whatsapp = null, email_verificado_em = null, senha_hash = null,
         totp_segredo_cifrado = null, totp_ativado_em = null, totp_ultimo_contador = null,
         falhas_2fa = 0, bloqueio_2fa_ate = null, faixa_etaria = null,
         estado = 'anonimizada', anonimizada_em = now()
   where id = p_conta;

  insert into uj.auditoria (conta_id, acao, recurso_tipo, recurso_id)
    values (p_conta, 'conta.excluida', 'conta', p_conta::text);
  insert into uj.exclusoes_de_conta (conta_id) values (p_conta) on conflict do nothing;
  delete from uj.exclusoes_em_andamento where conta_id = p_conta;
  return a.email;
end
$$;

-- A trava da conta (0001) também respeita a exceção da exclusão.
create or replace function uj.manter_um_admin_ao_encerrar_conta() returns trigger
  language plpgsql security definer
  set search_path = pg_catalog, uj
  as $$
declare
  c uuid;
begin
  if old.estado = 'ativa' and new.estado <> 'ativa' then
    for c in
      select v.comunidade_id from uj.vinculos v
       where v.conta_id = new.id and v.papel = 'admin' and v.estado = 'ativo'
    loop
      perform 1 from uj.comunidades where id = c for no key update;
      if not uj.comunidade_tem_outro_admin(c, null, new.id) and not uj.eh_proprietario()
         and not (uj.em_exclusao_de_conta(new.id)
                  and not exists (select 1 from uj.vinculos o join uj.contas x on x.id = o.conta_id
                                   where o.comunidade_id = c and o.conta_id <> new.id
                                     and o.estado = 'ativo' and x.estado = 'ativa')) then
        raise exception 'a comunidade ficaria sem administrador' using errcode = '23514';
      end if;
    end loop;
  end if;
  return new;
end
$$;

-- ---------------------------------------------------------------- exportar meus dados

-- Tudo o que é do titular (conta atual), em todas as comunidades, sem dado de
-- terceiros: de pedidos de oração alheios nada; de quem orou pelo pedido dele,
-- só a contagem. O texto dos pedidos sai cifrado: a API decifra (a chave não
-- está no banco).
create function uj.exportar_meus_dados() returns jsonb
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
                'criador', a.plataforma_proprietario, 'criadoEm', a.criado_em)
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
                         'visibilidade', p.visibilidade, 'respondidoEm', p.respondido_em,
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

-- ---------------------------------------------------------------- offline (D23)

alter table uj.comunidades alter column validade_offline_dias set default 7;

-- ---------------------------------------------------------------- privilégios

revoke execute on all functions in schema uj from public;
grant execute on function uj.registrar_consentimento(uuid, uuid, uuid, text, int, text, text, boolean),
  uj.declarar_faixa_etaria(uuid, text, int, text), uj.comunidades_em_que_e_unico_admin(uuid),
  uj.excluir_conta(uuid)
  to uj_auth;
grant execute on function uj.evento_publico(text),
  uj.inscrever_publico(text, text, text, text, bytea, text, int, boolean),
  uj.apagar_inscricao_publica(text, bytea), uj.denunciar(text, uuid, text, text),
  uj.resolver_denuncia(uuid, text, text, boolean), uj.efeitos_da_saida(),
  uj.exportar_meus_dados()
  to uj_api;

grant select on uj.consentimentos to uj_api;
grant select (id, comunidade_id, recurso_tipo, recurso_id, motivo, detalhe, estado, resolucao,
  conteudo_retirado, resolvida_em, criado_em) on uj.denuncias to uj_api;
