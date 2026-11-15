-- 0018: foto de perfil da conta e logotipo da comunidade (D33). Segue o padrão
-- do cabeçalho de 0001.
--
-- IMAGENS NO PRÓPRIO POSTGRES (bytea): pequenas (até 512 × 512 e 300 KB), sem
-- serviço externo e sem custo (D4); entram no backup do banco e ficam sob as
-- mesmas regras de acesso (RLS) que o resto dos dados. Se o volume crescer, o
-- caminho é o armazenamento de objetos (D33).
--
-- O BANCO SÓ RECEBE A IMAGEM JÁ REGRAVADA pela API (src/imagens/processar.ts):
-- tipo conferido pelos bytes, sem EXIF/GPS/XMP/ICC, no máximo 512 px. Aqui os
-- CHECKs conferem de novo o que dá para conferir sem decodificar: assinatura de
-- WebP ou JPEG, tamanho e o SHA-256 do conteúdo (que vira o ETag da resposta).
--
-- QUEM VÊ:
--   foto     a própria pessoa (política) e quem tem vínculo ativo na mesma
--            comunidade, só de vínculo ativo de conta ativa
--            (uj.foto_da_pessoa, SECURITY DEFINER como pessoas_da_comunidade);
--   logotipo quem tem vínculo ativo na comunidade (mesma regra de ler a
--            comunidade); troca e remoção só admin com a comunidade ativa.
-- uj_auth não tem acesso a nenhuma das duas tabelas.

-- ================================================================ foto da conta

create table uj.fotos_contas (
  conta_id uuid primary key references uj.contas (id) on delete cascade,
  conteudo bytea not null check (octet_length(conteudo) between 12 and 307200),
  tipo text not null check (tipo in ('image/webp', 'image/jpeg')),
  hash bytea not null check (hash = sha256(conteudo)),
  atualizado_em timestamptz not null default now(),
  check (
    (tipo = 'image/webp' and substring(conteudo from 1 for 4) = '\x52494646'::bytea
                         and substring(conteudo from 9 for 4) = '\x57454250'::bytea)
    or (tipo = 'image/jpeg' and substring(conteudo from 1 for 3) = '\xffd8ff'::bytea))
);
-- A imagem já vem comprimida: tentar comprimir de novo (pglz) só gasta CPU.
alter table uj.fotos_contas alter column conteudo set storage external;
create trigger fotos_contas_atualizado before update on uj.fotos_contas
  for each row execute function uj.tocar_atualizado_em();

-- Trocar a foto muda o que os outros membros veem (lista de pessoas, offline),
-- como o avatar de 0016: a mudança é anunciada como da conta, em cada
-- comunidade onde a pessoa tem vínculo ativo.
create function uj.registrar_mudanca_de_foto() returns trigger
  language plpgsql security definer
  set search_path = pg_catalog, uj
  as $$
declare
  c uuid;
begin
  if tg_op = 'DELETE' then c := old.conta_id; else c := new.conta_id; end if;
  insert into uj.mudancas (comunidade_id, tabela, registro_id, operacao)
    select v.comunidade_id, 'contas', c, 'U'
      from uj.vinculos v where v.conta_id = c and v.estado = 'ativo';
  return null;
end
$$;
create trigger fotos_contas_mudanca after insert or update or delete on uj.fotos_contas
  for each row execute function uj.registrar_mudanca_de_foto();

-- ================================================================ logotipo da comunidade

create table uj.logos_comunidades (
  comunidade_id uuid primary key references uj.comunidades (id) on delete cascade,
  conteudo bytea not null check (octet_length(conteudo) between 12 and 307200),
  tipo text not null check (tipo in ('image/webp', 'image/jpeg')),
  hash bytea not null check (hash = sha256(conteudo)),
  atualizado_em timestamptz not null default now(),
  check (
    (tipo = 'image/webp' and substring(conteudo from 1 for 4) = '\x52494646'::bytea
                         and substring(conteudo from 9 for 4) = '\x57454250'::bytea)
    or (tipo = 'image/jpeg' and substring(conteudo from 1 for 3) = '\xffd8ff'::bytea))
);
alter table uj.logos_comunidades alter column conteudo set storage external;
create trigger logos_comunidades_atualizado before update on uj.logos_comunidades
  for each row execute function uj.tocar_atualizado_em();

-- O logotipo faz parte dos dados da comunidade: a mudança sai como da própria
-- comunidade (o aparelho relê `GET /c/:id` e vê a nova `logoVersao`).
create function uj.registrar_mudanca_de_logo() returns trigger
  language plpgsql security definer
  set search_path = pg_catalog, uj
  as $$
declare
  c uuid;
begin
  if tg_op = 'DELETE' then c := old.comunidade_id; else c := new.comunidade_id; end if;
  insert into uj.mudancas (comunidade_id, tabela, registro_id, operacao, nivel_minimo)
    values (c, 'comunidades', c, 'U', 10);
  return null;
end
$$;
create trigger logos_comunidades_mudanca after insert or update or delete on uj.logos_comunidades
  for each row execute function uj.registrar_mudanca_de_logo();

-- ================================================================ RLS e políticas

alter table uj.fotos_contas enable row level security;
alter table uj.logos_comunidades enable row level security;

-- A própria foto: ler, enviar, trocar e remover. A de outra pessoa só por
-- uj.foto_da_pessoa (uj_api não lê linha de outra conta, como em uj.contas).
create policy fotos_contas_api_propria on uj.fotos_contas to uj_api
  using (conta_id = (select uj.conta_atual()))
  with check (conta_id = (select uj.conta_atual()));

-- Ler: quem lê a comunidade (vínculo ativo, inclusive na lista de /eu, que não
-- tem comunidade no contexto) e o Criador com a prova de 2FA.
create policy logos_comunidades_api_ler on uj.logos_comunidades for select to uj_api
  using ((select uj.eh_proprietario()) or uj.nivel_na(comunidade_id) >= 10);
-- Gravar: só na comunidade do contexto, ativa, por admin (como convites).
create policy logos_comunidades_api_inserir on uj.logos_comunidades for insert to uj_api
  with check (comunidade_id = (select uj.comunidade_atual())
              and ((select uj.nivel_gravavel_no_contexto()) >= 30 or (select uj.eh_proprietario())));
create policy logos_comunidades_api_trocar on uj.logos_comunidades for update to uj_api
  using (comunidade_id = (select uj.comunidade_atual())
         and ((select uj.nivel_gravavel_no_contexto()) >= 30 or (select uj.eh_proprietario())))
  with check (comunidade_id = (select uj.comunidade_atual())
              and ((select uj.nivel_gravavel_no_contexto()) >= 30 or (select uj.eh_proprietario())));
create policy logos_comunidades_api_remover on uj.logos_comunidades for delete to uj_api
  using (comunidade_id = (select uj.comunidade_atual())
         and ((select uj.nivel_gravavel_no_contexto()) >= 30 or (select uj.eh_proprietario())));

-- ================================================================ foto de outra pessoa

-- Foto de um vínculo, para quem tem vínculo ativo na comunidade do contexto.
-- Nada volta (a API responde 404) se o vínculo é de outra comunidade, não está
-- ativo, a conta não está ativa ou não há foto. `p_etags`: os SHA-256 (hex) que
-- o aparelho já tem; se a foto atual é um deles, o conteúdo volta nulo (304).
create function uj.foto_da_pessoa(p_vinculo uuid, p_etags text[])
  returns table (tipo text, hash bytea, conteudo bytea)
  language sql stable security definer
  set search_path = pg_catalog, uj
  as $$
    select f.tipo, f.hash,
           case when encode(f.hash, 'hex') = any (coalesce(p_etags, '{}'))
                  or '*' = any (coalesce(p_etags, '{}'))
                then null else f.conteudo end
      from uj.vinculos v
      join uj.contas a on a.id = v.conta_id
      join uj.fotos_contas f on f.conta_id = v.conta_id
     where v.id = p_vinculo
       and v.comunidade_id = uj.comunidade_atual()
       and v.estado = 'ativo'
       and a.estado = 'ativa'
       and uj.nivel_no_contexto() >= 10
  $$;

-- ================================================================ pessoas da comunidade

-- Igual à de 0016, com a versão da foto no fim (só de vínculo ativo de conta
-- ativa: é exatamente quando uj.foto_da_pessoa entrega a imagem).
drop function uj.pessoas_da_comunidade();
create function uj.pessoas_da_comunidade()
  returns table (vinculo_id uuid, conta_id uuid, nome text, papel text, estado text,
                 designacoes text[], email text, whatsapp text, eh_proprietario boolean,
                 desde timestamptz, avatar_icone text, avatar_cor text, foto_versao text)
  language sql stable security definer
  set search_path = pg_catalog, uj
  as $$
    with eu as (select uj.nivel_no_contexto() as nivel)
    select v.id, v.conta_id,
           case when a.estado = 'anonimizada' then 'Pessoa removida' else a.nome end,
           v.papel, v.estado, v.designacoes,
           case when eu.nivel >= 20 and a.estado = 'ativa' then a.email end,
           case when eu.nivel >= 20 and a.estado = 'ativa' then a.whatsapp end,
           a.plataforma_proprietario,
           v.criado_em,
           case when a.estado = 'ativa' then a.avatar_icone end,
           case when a.estado = 'ativa' then a.avatar_cor end,
           case when a.estado = 'ativa' and v.estado = 'ativo'
                then left(encode(f.hash, 'hex'), 16) end
      from uj.vinculos v
      join uj.contas a on a.id = v.conta_id
      left join uj.fotos_contas f on f.conta_id = v.conta_id
      cross join eu
     where v.comunidade_id = uj.comunidade_atual()
       and eu.nivel >= 10
       -- Membros veem só vínculos ativos; quem administra vê também os inativos.
       and (v.estado = 'ativo' or eu.nivel >= 30)
  $$;

-- ================================================================ conta excluída

-- Igual à de 0016, apagando também a foto. Excluir a conta (uj.excluir_conta)
-- anonimiza a linha e, no mesmo momento, a foto deixa de existir: nada da
-- imagem sobra no banco (o backup segue a retenção dele).
create or replace function uj.limpar_identidade_ao_anonimizar() returns trigger
  language plpgsql security definer
  set search_path = pg_catalog, uj
  as $$
begin
  if new.estado = 'anonimizada' and old.estado is distinct from 'anonimizada' then
    new.avatar_icone := null;
    new.avatar_cor := null;
    delete from uj.contas_provedores where conta_id = new.id;
    delete from uj.fotos_contas where conta_id = new.id;
  end if;
  return new;
end
$$;

-- ================================================================ exportar meus dados

-- Igual à de 0012, com `conta.foto`: tipo, tamanho e data da foto de perfil (ou
-- nulo sem foto). A imagem em si a rota GET /api/v1/eu/exportar acrescenta em
-- base64 (`conta.foto.conteudoBase64`): o arquivo exportado fica completo e
-- não depende de link nem de sessão para abrir depois.
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

-- ================================================================ privilégios

grant select, delete on uj.fotos_contas to uj_api;
grant insert (conta_id, conteudo, tipo, hash) on uj.fotos_contas to uj_api;
grant update (conteudo, tipo, hash) on uj.fotos_contas to uj_api;

grant select, delete on uj.logos_comunidades to uj_api;
grant insert (comunidade_id, conteudo, tipo, hash) on uj.logos_comunidades to uj_api;
grant update (conteudo, tipo, hash) on uj.logos_comunidades to uj_api;

revoke execute on function uj.foto_da_pessoa(uuid, text[]), uj.pessoas_da_comunidade() from public;
grant execute on function uj.foto_da_pessoa(uuid, text[]), uj.pessoas_da_comunidade() to uj_api;
