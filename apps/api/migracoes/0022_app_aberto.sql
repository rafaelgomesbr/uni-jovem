-- 0022: app aberto, comunidades criadas por qualquer pessoa ("livre com rodinhas").
-- Decisão: docs/adr/0007-app-aberto.md. Segue o padrão do cabeçalho de 0001.
--
--   * CONTA ABERTA: cadastro por e-mail (código de 6 dígitos de
--     `verificacoes_email`, finalidade nova `cadastro`) e por Google ou Apple
--     (token de cadastro de 15 minutos, uso único, guardado só como SHA-256).
--     Conta nova nasce sem vínculo. Só `uj_auth` cria conta, por função.
--   * COMUNIDADE ABERTA: qualquer conta com e-mail confirmado cria comunidade
--     (`uj.criar_comunidade_aberta`), vira admin dela e aceita o termo do
--     administrador (TC-16). A comunidade nasce `nova`, com entrada por código
--     com aprovação e fora da busca.
--   * RODINHAS (comunidade `nova`), no BANCO e não só na rota: até 30 vínculos
--     ativos (gatilho em vínculos), nenhum evento público (gatilho em eventos
--     e as funções da página pública), uma comunidade nova por conta de cada
--     vez e até 3 criadas por conta (na função de criação, com a conta travada).
--   * CÓDIGO DA COMUNIDADE: só o HMAC (para achar) e uma semente aleatória (para
--     o admin rever o código); os dois só servem com o segredo do servidor.
--   * BUSCA, PEDIDOS DE ENTRADA e DENÚNCIA DE COMUNIDADE: funções SECURITY
--     DEFINER que devolvem só o necessário; quem não é da comunidade nunca lê
--     as tabelas dela.
--   * CRIADOR SEM CÓDIGO DO AUTENTICADOR (revisa D12 e D31): criar, listar,
--     verificar e desverificar comunidade e resolver denúncia de comunidade
--     conferem só que a conta do contexto é a proprietária (`uj.eh_criador`).
--     Suspender, arquivar, excluir, intervir e transferir continuam exigindo a
--     prova de 2FA (`uj.eh_proprietario`).

-- ================================================================ Criador sem prova

-- A conta do contexto é a proprietária da plataforma (ativa), SEM exigir a
-- prova de 2FA. Só para o que não destrói nada (ADR 0007); o resto continua em
-- `uj.eh_proprietario()`.
create function uj.eh_criador() returns boolean
  language sql stable security definer
  set search_path = pg_catalog, uj
  as $$
    select exists (select 1 from uj.contas a
                    where a.id = uj.conta_atual() and a.plataforma_proprietario
                      and a.estado = 'ativa')
  $$;

-- ================================================================ limites (rodinhas)

-- Os mesmos números de packages/dominio/src/politicas.ts (o teste confere).
create function uj.limite_de_vinculos_da_comunidade_nova() returns int
  language sql immutable as $$ select 30 $$;
create function uj.limite_de_comunidades_novas_por_conta() returns int
  language sql immutable as $$ select 1 $$;
create function uj.limite_de_comunidades_criadas_por_conta() returns int
  language sql immutable as $$ select 3 $$;
create function uj.limite_de_pedidos_pendentes_por_conta() returns int
  language sql immutable as $$ select 3 $$;
create function uj.dias_de_espera_depois_de_recusa() returns int
  language sql immutable as $$ select 30 $$;

-- ================================================================ comunidades

-- `verificacao` nasce 'verificada' nas linhas que já existem (todas criadas
-- pelo Criador) e no padrão da coluna: o único caminho de uma conta comum é
-- `uj.criar_comunidade_aberta`, que grava 'nova' explicitamente.
alter table uj.comunidades
  add column verificacao text not null default 'verificada'
    check (verificacao in ('nova', 'verificada')),
  add column verificacao_alterada_em timestamptz,
  add column encontravel boolean not null default false,
  add column cidade text check (cidade is null or length(btrim(cidade)) between 2 and 80),
  -- Identificador dos links e da busca: 128 bits aleatórios, nunca o id interno.
  add column id_publico text not null unique default replace(gen_random_uuid()::text, '-', ''),
  add column codigo_semente bytea check (codigo_semente is null or length(codigo_semente) = 16),
  add column codigo_hmac bytea unique,
  add column codigo_gerado_em timestamptz,
  add constraint comunidades_codigo_completo
    check ((codigo_semente is null) = (codigo_hmac is null)
           and (codigo_hmac is null) = (codigo_gerado_em is null));

-- Modos de entrada da ADR 0007. 'solicitacao' (nunca habilitado) vira
-- 'codigo_com_aprovacao'; 'livre' continua como ponto de extensão recusado.
alter table uj.comunidades drop constraint comunidades_modo_entrada_check;
alter table uj.comunidades add constraint comunidades_modo_entrada_check
  check (modo_entrada in ('convite', 'codigo_com_aprovacao', 'codigo_direto', 'livre'));

create index comunidades_encontraveis on uj.comunidades (nome) where encontravel and estado = 'ativa';

-- Igual à de 0001, com os modos novos e a verificação só pelo Criador.
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
  -- Outra exceção: a comunidade que ficou sem ninguém ativo vai para a exclusão
  -- agendada pelo gatilho da exclusão de conta (`uj.agendar_comunidades_orfas`),
  -- nunca por um UPDATE direto do aplicativo (profundidade de gatilho 1).
  if tg_op = 'UPDATE' and session_user <> 'uj_dono' and not uj.eh_proprietario()
     and not (pg_trigger_depth() > 1 and new.estado = 'exclusao_agendada') and (
       new.estado is distinct from old.estado
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
  end if;
  return new;
end
$$;

-- A política de criação direta passa a conferir só a conta proprietária (sem
-- a prova). Conta comum não insere: cria por `uj.criar_comunidade_aberta`.
drop policy comunidades_api_criar on uj.comunidades;
create policy comunidades_api_criar on uj.comunidades for insert to uj_api
  with check ((select uj.eh_criador()) and criado_por = (select uj.conta_atual()));

-- Configurações do admin (ADR 0007): modo de entrada, aparecer na busca,
-- cidade e o código (o HMAC é calculado na API, com o segredo fora do banco).
grant update (modo_entrada, encontravel, cidade, codigo_semente, codigo_hmac, codigo_gerado_em)
  on uj.comunidades to uj_api;

-- ================================================================ rodinhas no banco

-- Até 30 vínculos ativos numa comunidade `nova`, venha a entrada de onde vier
-- (convite, código, pedido aceito, reativação). A trava na linha da comunidade
-- serializa duas entradas simultâneas.
create function uj.limitar_vinculos_da_comunidade_nova() returns trigger
  language plpgsql security definer
  set search_path = pg_catalog, uj
  as $$
declare
  ativos int;
begin
  if new.estado <> 'ativo' or (tg_op = 'UPDATE' and old.estado = 'ativo') then
    return new;
  end if;
  perform 1 from uj.comunidades
   where id = new.comunidade_id and verificacao = 'nova'
   for no key update;
  if not found then
    return new;
  end if;
  select count(*) into ativos from uj.vinculos
   where comunidade_id = new.comunidade_id and estado = 'ativo' and id <> new.id;
  if ativos >= uj.limite_de_vinculos_da_comunidade_nova() then
    raise exception 'comunidade nova no limite de participantes' using errcode = 'UJ080';
  end if;
  return new;
end
$$;
create trigger vinculos_limite_da_comunidade_nova before insert or update of estado on uj.vinculos
  for each row execute function uj.limitar_vinculos_da_comunidade_nova();

-- Evento público (página de inscrição) só em comunidade verificada.
create function uj.recusar_evento_publico_de_comunidade_nova() returns trigger
  language plpgsql security definer
  set search_path = pg_catalog, uj
  as $$
begin
  if new.visibilidade = 'publica'
     and (tg_op = 'INSERT' or old.visibilidade is distinct from 'publica')
     and exists (select 1 from uj.comunidades
                  where id = new.comunidade_id and verificacao = 'nova') then
    raise exception 'comunidade nova sem evento publico' using errcode = 'UJ081';
  end if;
  return new;
end
$$;
create trigger eventos_publico_so_em_verificada before insert or update of visibilidade
  on uj.eventos
  for each row execute function uj.recusar_evento_publico_de_comunidade_nova();

-- Igual à de 0012, mais: comunidade desverificada não mostra a página pública
-- (o evento continua lá, como estava; "desverificar não apaga nada").
create or replace function uj.evento_publico(p_id_publico text)
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
       and c.estado = 'ativa' and c.verificacao = 'verificada'
  $$;

-- Igual à de 0021, mais a comunidade verificada.
create or replace function uj.inscrever_publico(p_id_publico text, p_nome text, p_telefone text,
                                                p_email text, p_token_hash bytea, p_texto text,
                                                p_versao int, p_idade_confirmada boolean)
  returns table (inscricao_id uuid, estado text, codigo_checkin text, ja_existia boolean)
  language plpgsql security definer
  set search_path = pg_catalog, uj
  as $$
#variable_conflict use_column
declare
  e uj.eventos;
  novo_estado text;
  nova uj.inscricoes;
begin
  if p_idade_confirmada is not true or p_texto <> 'TC-04' then
    raise exception 'idade nao confirmada' using errcode = 'UJ035';
  end if;
  select ev.* into e from uj.eventos ev join uj.comunidades c on c.id = ev.comunidade_id
   where ev.id_publico = p_id_publico and ev.visibilidade = 'publica' and ev.status = 'publicado'
     and ev.inicio > now() and (ev.inscricao_ate is null or ev.inscricao_ate > now())
     and c.estado = 'ativa' and c.verificacao = 'verificada'
   for update of ev;
  if not found then
    raise exception 'inscricoes indisponiveis' using errcode = 'UJ030';
  end if;
  if exists (select 1 from uj.inscricoes
              where evento_id = e.id and telefone = p_telefone and estado <> 'cancelada'
                and uj.nome_normalizado(nome) = uj.nome_normalizado(p_nome)) then
    return query select null::uuid, null::text, null::text, true;
    return;
  end if;
  if (select count(*) from uj.inscricoes
       where evento_id = e.id and telefone = p_telefone and estado <> 'cancelada') >= 10 then
    raise exception 'teto por whatsapp' using errcode = 'UJ036';
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

-- ================================================================ criar comunidade

-- Comunidade criada por qualquer conta com e-mail confirmado (ADR 0007): nasce
-- `nova`, com entrada por código com aprovação, fora da busca, com o código
-- já gerado e o vínculo de admin de quem criou, mais o aceite do termo do
-- administrador (TC-16). A conta é travada: duas criações simultâneas não
-- passam juntas dos limites.
-- Erros: UJ004 conta inválida, UJ090 e-mail não confirmado, UJ091 já tem uma
-- comunidade nova, UJ092 limite de comunidades criadas, UJ093 menos de 18
-- anos (decisão do dono em 15/11/2026: criar comunidade exige 18 anos ou mais;
-- entrar continua a partir de 16, D27).
create function uj.criar_comunidade_aberta(p_nome text, p_cor text, p_cidade text, p_fuso text,
                                           p_codigo_semente bytea, p_codigo_hmac bytea,
                                           p_versao_termo int, p_versao_tc03 int, p_forma text)
  returns uuid
  language plpgsql security definer
  set search_path = pg_catalog, uj
  as $$
declare
  conta uj.contas;
  nova uuid;
  vinculo uuid;
begin
  select * into conta from uj.contas where id = uj.conta_atual() and estado = 'ativa' for update;
  if not found then
    raise exception 'conta invalida' using errcode = 'UJ004';
  end if;
  if conta.email_verificado_em is null then
    raise exception 'e-mail nao confirmado' using errcode = 'UJ090';
  end if;
  if conta.faixa_etaria is distinct from '18_mais' then
    raise exception 'criar comunidade exige 18 anos' using errcode = 'UJ093';
  end if;
  if (select count(*) from uj.comunidades
       where criado_por = conta.id and verificacao = 'nova' and estado <> 'exclusao_agendada')
     >= uj.limite_de_comunidades_novas_por_conta() then
    raise exception 'ja existe comunidade nova' using errcode = 'UJ091';
  end if;
  if (select count(*) from uj.comunidades where criado_por = conta.id)
     >= uj.limite_de_comunidades_criadas_por_conta() then
    raise exception 'limite de comunidades criadas' using errcode = 'UJ092';
  end if;

  insert into uj.comunidades (nome, cor, cidade, fuso, criado_por, verificacao, modo_entrada,
                              encontravel, codigo_semente, codigo_hmac, codigo_gerado_em)
    values (btrim(p_nome), p_cor, nullif(btrim(p_cidade), ''), p_fuso, conta.id, 'nova',
            'codigo_com_aprovacao', false, p_codigo_semente, p_codigo_hmac, now())
  returning id into nova;
  insert into uj.vinculos (conta_id, comunidade_id, papel)
    values (conta.id, nova, 'admin')
  returning id into vinculo;
  insert into uj.consentimentos (conta_id, comunidade_id, vinculo_id, texto_id, versao, forma)
    values (conta.id, nova, vinculo, 'TC-16', p_versao_termo, p_forma),
           -- Quem cria também participa: o consentimento sobre a fé (TC-03.v3).
           (conta.id, nova, vinculo, 'TC-03', p_versao_tc03, p_forma);
  return nova;
end
$$;

-- Criação pelo Criador na Plataforma: sem a prova de 2FA (ADR 0007), já
-- verificada, com o convite do primeiro admin (o Criador continua fora das
-- comunidades). O token do convite chega como HMAC, calculado na API.
create function uj.criar_comunidade_pela_plataforma(p_nome text, p_cor text, p_fuso text,
                                                    p_email_admin text, p_token_hmac bytea,
                                                    p_validade_dias int)
  returns table (comunidade_id uuid, convite_id uuid, expira_em timestamptz)
  language plpgsql security definer
  set search_path = pg_catalog, uj
  as $$
#variable_conflict use_column
declare
  nova uuid;
  convite uj.convites;
begin
  if not uj.eh_criador() then
    raise exception 'so o proprietario cria comunidade pela plataforma' using errcode = '42501';
  end if;
  insert into uj.comunidades (nome, cor, fuso, criado_por, verificacao)
    values (btrim(p_nome), p_cor, p_fuso, uj.conta_atual(), 'verificada')
  returning id into nova;
  insert into uj.convites (comunidade_id, papel, email_destino, token_hmac, expira_em, criado_por)
    values (nova, 'admin', lower(p_email_admin), p_token_hmac,
            now() + make_interval(days => p_validade_dias), uj.conta_atual())
  returning * into convite;
  return query select nova, convite.id, convite.expira_em;
end
$$;

-- Verificar (selo "Verificada", sem rodinhas) ou desverificar (as rodinhas
-- voltam sem apagar nada). Devolve a verificação nova; nulo se não existe.
create function uj.definir_verificacao(p_comunidade uuid, p_verificada boolean) returns text
  language plpgsql security definer
  set search_path = pg_catalog, uj
  as $$
declare
  nova text;
begin
  if not uj.eh_criador() then
    raise exception 'verificacao e exclusiva do proprietario' using errcode = '42501';
  end if;
  update uj.comunidades
     set verificacao = case when p_verificada then 'verificada' else 'nova' end
   where id = p_comunidade and estado <> 'exclusao_agendada'
  returning verificacao into nova;
  return nova;
end
$$;

-- ================================================================ busca

-- Só comunidades ativas que escolheram aparecer. Nunca membros nem contagem.
-- Mínimo de letras e o máximo de resultados também ficam aqui (a rota confere
-- antes, com mensagem). `p_q` casa com o nome ou a cidade; `p_cidade`, só a cidade.
create function uj.buscar_comunidades(p_q text, p_cidade text)
  returns table (id_publico text, nome text, cidade text, cor text, tem_logo boolean,
                 logo_versao text, verificada boolean, modo_entrada text)
  language sql stable security definer
  set search_path = pg_catalog, uj
  as $$
    select c.id_publico, c.nome, c.cidade, c.cor, l.hash is not null,
           left(encode(l.hash, 'hex'), 16), c.verificacao = 'verificada', c.modo_entrada
      from uj.comunidades c
      left join uj.logos_comunidades l on l.comunidade_id = c.id
     where uj.conta_atual() is not null
       and c.estado = 'ativa' and c.encontravel
       and (p_q is not null or p_cidade is not null)
       and (p_q is null or length(uj.nome_normalizado(p_q)) >= 3)
       and (p_cidade is null or length(uj.nome_normalizado(p_cidade)) >= 3)
       and (p_q is null
            or position(uj.nome_normalizado(p_q) in uj.nome_normalizado(c.nome)) > 0
            or position(uj.nome_normalizado(p_q) in uj.nome_normalizado(coalesce(c.cidade, ''))) > 0)
       and (p_cidade is null
            or position(uj.nome_normalizado(p_cidade) in uj.nome_normalizado(coalesce(c.cidade, ''))) > 0)
     order by c.verificacao = 'verificada' desc, c.nome, c.id_publico
     limit 20
  $$;

-- Logotipo de uma comunidade que aparece na busca (o resto do logotipo segue a
-- D33: só para quem é da comunidade).
create function uj.logo_da_comunidade_encontravel(p_id_publico text, p_etags text[])
  returns table (tipo text, hash bytea, conteudo bytea)
  language sql stable security definer
  set search_path = pg_catalog, uj
  as $$
    select l.tipo, l.hash,
           case when encode(l.hash, 'hex') = any (p_etags) or '*' = any (p_etags)
                then null else l.conteudo end
      from uj.comunidades c join uj.logos_comunidades l on l.comunidade_id = c.id
     where uj.conta_atual() is not null
       and c.id_publico = p_id_publico and c.estado = 'ativa' and c.encontravel
  $$;

-- ================================================================ pedidos de entrada

create table uj.pedidos_de_entrada (
  id uuid primary key default gen_random_uuid(),
  comunidade_id uuid not null references uj.comunidades (id) on delete cascade,
  conta_id uuid not null references uj.contas (id),
  origem text not null check (origem in ('codigo', 'busca')),
  -- Mensagem curta para quem decide; some quando o pedido é respondido.
  mensagem text check (length(mensagem) between 1 and 280),
  estado text not null default 'pendente'
    check (estado in ('pendente', 'aceito', 'recusado', 'cancelado')),
  -- TC-03 aceito no pedido: vira o consentimento do vínculo se o pedido for aceito.
  consentimento_versao int not null check (consentimento_versao between 1 and 999),
  consentimento_forma text not null check (consentimento_forma in ('ios', 'android', 'web')),
  responsavel_ciente boolean,
  -- Quem decidiu: só para a auditoria; quem pediu nunca vê.
  decidido_por uuid references uj.contas (id),
  decidido_em timestamptz,
  criado_em timestamptz not null default now(),
  check ((estado = 'pendente') = (decidido_em is null)),
  check (estado = 'pendente' or mensagem is null)
);
create index pedidos_de_entrada_comunidade
  on uj.pedidos_de_entrada (comunidade_id, estado, criado_em desc);
create index pedidos_de_entrada_conta on uj.pedidos_de_entrada (conta_id, estado, criado_em desc);
create index pedidos_de_entrada_decidido_por on uj.pedidos_de_entrada (decidido_por);
create unique index pedidos_de_entrada_um_pendente
  on uj.pedidos_de_entrada (comunidade_id, conta_id) where estado = 'pendente';
create trigger pedidos_de_entrada_mudanca after insert or update or delete on uj.pedidos_de_entrada
  for each row execute function uj.registrar_mudanca('20');

alter table uj.pedidos_de_entrada enable row level security;
-- Quem pediu vê os seus; admin e organizador veem os da comunidade do contexto.
create policy pedidos_de_entrada_ler on uj.pedidos_de_entrada for select to uj_api
  using (conta_id = (select uj.conta_atual())
         or (comunidade_id = (select uj.comunidade_atual())
             and (select uj.nivel_no_contexto()) >= 20));
grant select on uj.pedidos_de_entrada to uj_api;

-- Idade antes de entrar (TC-01): a conta que ainda não declarou declara aqui;
-- 16 e 17 anos confirmam a ciência do responsável. UJ086: faixa necessária;
-- UJ087: responsável necessário. Menor de 16 nunca chega: a API recusa antes.
create function uj.conferir_idade_para_entrar(p_conta uuid, p_faixa text, p_versao_tc01 int,
                                              p_forma text, p_responsavel boolean)
  returns void
  language plpgsql security definer
  set search_path = pg_catalog, uj
  as $$
declare
  faixa text;
begin
  select faixa_etaria into faixa from uj.contas where id = p_conta;
  if faixa is null then
    if p_faixa is null then
      raise exception 'faixa etaria necessaria' using errcode = 'UJ086';
    end if;
    perform uj.declarar_faixa_etaria(p_conta, p_faixa, p_versao_tc01, p_forma);
    faixa := p_faixa;
  end if;
  if faixa = '16_17' and p_responsavel is not true then
    raise exception 'responsavel necessario' using errcode = 'UJ087';
  end if;
end
$$;

-- Notificação genérica (D25, D42) para admins e organizadores ativos. Nunca a
-- mensagem do pedido nem o nome de quem pediu.
create function uj.avisar_pedido_de_entrada(p_comunidade uuid, p_pedido uuid) returns void
  language plpgsql security definer
  set search_path = pg_catalog, uj
  as $$
declare
  r record;
begin
  for r in select v.conta_id from uj.vinculos v
            where v.comunidade_id = p_comunidade and v.estado = 'ativo'
              and v.papel in ('admin', 'organizador') loop
    perform uj.enfileirar_notificacao(p_comunidade, r.conta_id, 'pedido_de_entrada',
      'pedido_de_entrada', p_pedido, 'Novo pedido de entrada',
      'Uma pessoa pediu para entrar na comunidade. Abra o app para responder.');
  end loop;
end
$$;

-- Cria (ou devolve, se já existe) o pedido pendente da conta do contexto.
-- UJ084: 3 pendentes; UJ085: recusado há menos de 30 dias nesta comunidade.
create function uj.pedir_entrada(p_comunidade uuid, p_origem text, p_mensagem text,
                                 p_versao_tc03 int, p_forma text, p_responsavel boolean)
  returns uuid
  language plpgsql security definer
  set search_path = pg_catalog, uj
  as $$
declare
  conta uuid := uj.conta_atual();
  existente uuid;
  novo uuid;
begin
  -- A conta travada serializa os pedidos dela (o teto de pendentes não estoura).
  perform 1 from uj.contas where id = conta for update;
  select id into existente from uj.pedidos_de_entrada
   where comunidade_id = p_comunidade and conta_id = conta and estado = 'pendente';
  if existente is not null then
    return existente;
  end if;
  if (select count(*) from uj.pedidos_de_entrada p join uj.comunidades c on c.id = p.comunidade_id
       where p.conta_id = conta and p.estado = 'pendente' and c.estado = 'ativa')
     >= uj.limite_de_pedidos_pendentes_por_conta() then
    raise exception 'pedidos pendentes demais' using errcode = 'UJ084';
  end if;
  if exists (select 1 from uj.pedidos_de_entrada
              where comunidade_id = p_comunidade and conta_id = conta and estado = 'recusado'
                and decidido_em > now() - make_interval(days => uj.dias_de_espera_depois_de_recusa())) then
    raise exception 'pedido recusado recentemente' using errcode = 'UJ085';
  end if;
  insert into uj.pedidos_de_entrada (comunidade_id, conta_id, origem, mensagem,
                                     consentimento_versao, consentimento_forma, responsavel_ciente)
    values (p_comunidade, conta, p_origem, nullif(btrim(p_mensagem), ''), p_versao_tc03, p_forma,
            p_responsavel)
  returning id into novo;
  perform uj.avisar_pedido_de_entrada(p_comunidade, novo);
  insert into uj.auditoria (conta_id, comunidade_id, acao, recurso_tipo, recurso_id, detalhes)
    values (conta, p_comunidade, 'pedido_entrada.criado', 'pedido_de_entrada', novo::text,
            jsonb_build_object('origem', p_origem));
  return novo;
end
$$;

-- Vínculo de membro para a conta (novo, ou o antigo de quem saiu reativado),
-- com o consentimento TC-03. A regra das rodinhas vale pelo gatilho.
create function uj.entrar_como_membro(p_conta uuid, p_comunidade uuid, p_versao_tc03 int,
                                      p_forma text, p_responsavel boolean)
  returns uuid
  language plpgsql security definer
  set search_path = pg_catalog, uj
  as $$
declare
  existente uj.vinculos;
  v uuid;
begin
  select * into existente from uj.vinculos
   where conta_id = p_conta and comunidade_id = p_comunidade for update;
  if found and existente.estado = 'ativo' then
    return existente.id;
  end if;
  if found then
    update uj.vinculos set papel = 'membro', estado = 'ativo', designacoes = '{}', convite_id = null
     where id = existente.id
    returning id into v;
  else
    insert into uj.vinculos (conta_id, comunidade_id, papel)
      values (p_conta, p_comunidade, 'membro')
    returning id into v;
  end if;
  insert into uj.consentimentos (conta_id, comunidade_id, vinculo_id, texto_id, versao, forma,
                                 confirmacao_adicional)
    values (p_conta, p_comunidade, v, 'TC-03', p_versao_tc03, p_forma,
            case when p_responsavel then true end);
  return v;
end
$$;

-- Entrada pelo código da comunidade. Código desconhecido, de comunidade que
-- não está ativa ou que só aceita convite: UJ083 (a API responde 404).
-- UJ003: já participa; UJ088: vínculo desativado pela liderança.
create function uj.entrar_por_codigo(p_codigo_hmac bytea, p_mensagem text, p_faixa text,
                                     p_responsavel boolean, p_versao_tc01 int,
                                     p_versao_tc03 int, p_forma text)
  returns table (resultado text, comunidade_id uuid, comunidade_nome text)
  language plpgsql security definer
  set search_path = pg_catalog, uj
  as $$
#variable_conflict use_column
declare
  conta uuid := uj.conta_atual();
  c uj.comunidades;
  atual text;
  v uuid;
begin
  if not exists (select 1 from uj.contas where id = conta and estado = 'ativa') then
    raise exception 'conta invalida' using errcode = 'UJ004';
  end if;
  select * into c from uj.comunidades
   where codigo_hmac = p_codigo_hmac and estado = 'ativa'
     and modo_entrada in ('codigo_com_aprovacao', 'codigo_direto');
  if not found then
    raise exception 'codigo desconhecido' using errcode = 'UJ083';
  end if;
  select estado into atual from uj.vinculos where conta_id = conta and comunidade_id = c.id;
  if atual = 'ativo' then
    raise exception 'ja participa da comunidade' using errcode = 'UJ003';
  end if;
  if atual = 'desativado' then
    raise exception 'vinculo desativado' using errcode = 'UJ088';
  end if;
  perform uj.conferir_idade_para_entrar(conta, p_faixa, p_versao_tc01, p_forma, p_responsavel);
  if c.modo_entrada = 'codigo_direto' then
    v := uj.entrar_como_membro(conta, c.id, p_versao_tc03, p_forma, p_responsavel);
    insert into uj.auditoria (conta_id, comunidade_id, acao, recurso_tipo, recurso_id)
      values (conta, c.id, 'vinculo.entrou_por_codigo', 'vinculo', v::text);
    return query select 'membro'::text, c.id, c.nome;
    return;
  end if;
  perform uj.pedir_entrada(c.id, 'codigo', p_mensagem, p_versao_tc03, p_forma, p_responsavel);
  return query select 'pedido_pendente'::text, c.id, c.nome;
end
$$;

-- Pedido a partir da busca: sempre com aprovação (achar a comunidade não é
-- saber o código), mesmo que ela entre direto por código. UJ089: só convite.
create function uj.pedir_entrada_pela_busca(p_id_publico text, p_mensagem text, p_faixa text,
                                            p_responsavel boolean, p_versao_tc01 int,
                                            p_versao_tc03 int, p_forma text)
  returns table (resultado text, comunidade_id uuid, comunidade_nome text)
  language plpgsql security definer
  set search_path = pg_catalog, uj
  as $$
#variable_conflict use_column
declare
  conta uuid := uj.conta_atual();
  c uj.comunidades;
  atual text;
begin
  if not exists (select 1 from uj.contas where id = conta and estado = 'ativa') then
    raise exception 'conta invalida' using errcode = 'UJ004';
  end if;
  select * into c from uj.comunidades
   where id_publico = p_id_publico and estado = 'ativa' and encontravel;
  if not found then
    raise exception 'comunidade nao encontrada' using errcode = 'UJ083';
  end if;
  if c.modo_entrada = 'convite' then
    raise exception 'so por convite' using errcode = 'UJ089';
  end if;
  select estado into atual from uj.vinculos where conta_id = conta and comunidade_id = c.id;
  if atual = 'ativo' then
    raise exception 'ja participa da comunidade' using errcode = 'UJ003';
  end if;
  if atual = 'desativado' then
    raise exception 'vinculo desativado' using errcode = 'UJ088';
  end if;
  perform uj.conferir_idade_para_entrar(conta, p_faixa, p_versao_tc01, p_forma, p_responsavel);
  perform uj.pedir_entrada(c.id, 'busca', p_mensagem, p_versao_tc03, p_forma, p_responsavel);
  return query select 'pedido_pendente'::text, c.id, c.nome;
end
$$;

-- Admin ou organizador (comunidade ativa do contexto) aceita ou recusa.
-- Idempotente: repetir a mesma decisão devolve o mesmo resultado; mudar uma
-- decisão já tomada é UJ082. Pedido de outra comunidade, cancelado ou
-- inexistente: P0002 (404). Quem pediu e não está mais ativa: UJ004.
create function uj.decidir_pedido(p_pedido uuid, p_aceitar boolean)
  returns table (estado text, vinculo_id uuid, conta_id uuid)
  language plpgsql security definer
  set search_path = pg_catalog, uj
  as $$
#variable_conflict use_column
declare
  p uj.pedidos_de_entrada;
  v uuid;
begin
  if uj.nivel_gravavel_no_contexto() < 20 then
    raise exception 'so organizadores decidem pedidos' using errcode = '42501';
  end if;
  select * into p from uj.pedidos_de_entrada x
   where x.id = p_pedido and x.comunidade_id = uj.comunidade_atual()
   for update;
  if not found or p.estado = 'cancelado' then
    raise exception 'pedido nao encontrado' using errcode = 'P0002';
  end if;
  if p.estado = 'aceito' and p_aceitar then
    select x.id into v from uj.vinculos x
     where x.conta_id = p.conta_id and x.comunidade_id = p.comunidade_id;
    return query select 'aceito'::text, v, p.conta_id;
    return;
  end if;
  if p.estado = 'recusado' and not p_aceitar then
    return query select 'recusado'::text, null::uuid, p.conta_id;
    return;
  end if;
  if p.estado <> 'pendente' then
    raise exception 'pedido ja respondido' using errcode = 'UJ082';
  end if;

  if p_aceitar then
    if not exists (select 1 from uj.contas a where a.id = p.conta_id and a.estado = 'ativa') then
      raise exception 'conta invalida' using errcode = 'UJ004';
    end if;
    v := uj.entrar_como_membro(p.conta_id, p.comunidade_id, p.consentimento_versao,
                               p.consentimento_forma, p.responsavel_ciente);
  end if;
  update uj.pedidos_de_entrada x
     set estado = case when p_aceitar then 'aceito' else 'recusado' end,
         decidido_por = uj.conta_atual(), decidido_em = now(), mensagem = null
   where x.id = p.id;
  perform uj.enfileirar_notificacao(p.comunidade_id, p.conta_id, 'pedido_decidido',
    'pedido_de_entrada', p.id, 'Pedido de entrada respondido',
    'Seu pedido para entrar numa comunidade foi respondido. Abra o app para ver.');
  return query select case when p_aceitar then 'aceito' else 'recusado' end, v, p.conta_id;
end
$$;

-- Pedidos da comunidade do contexto, com o nome de quem pediu (admin e organizador).
create function uj.pedidos_da_comunidade(p_estado text)
  returns table (id uuid, nome text, mensagem text, origem text, estado text,
                 criado_em timestamptz, decidido_em timestamptz)
  language sql stable security definer
  set search_path = pg_catalog, uj
  as $$
    select p.id, a.nome, p.mensagem, p.origem, p.estado, p.criado_em, p.decidido_em
      from uj.pedidos_de_entrada p join uj.contas a on a.id = p.conta_id
     where p.comunidade_id = uj.comunidade_atual()
       and uj.nivel_no_contexto() >= 20
       and p.estado <> 'cancelado'
       and (p_estado is null or p.estado = p_estado)
     order by p.criado_em desc, p.id
     limit 200
  $$;

-- Os pedidos da própria conta, com o nome e a cor da comunidade (quem pediu
-- ainda não lê a comunidade pela RLS). Nunca quem decidiu.
create function uj.meus_pedidos()
  returns table (id uuid, comunidade_id uuid, comunidade_nome text, comunidade_cor text,
                 estado text, criado_em timestamptz, decidido_em timestamptz)
  language sql stable security definer
  set search_path = pg_catalog, uj
  as $$
    select p.id,
           case when p.estado = 'aceito' and exists (
                  select 1 from uj.vinculos v where v.conta_id = p.conta_id
                     and v.comunidade_id = p.comunidade_id and v.estado = 'ativo')
                then c.id end,
           c.nome, c.cor, p.estado, p.criado_em, p.decidido_em
      from uj.pedidos_de_entrada p join uj.comunidades c on c.id = p.comunidade_id
     where p.conta_id = uj.conta_atual() and p.estado <> 'cancelado'
     order by p.criado_em desc
     limit 50
  $$;

-- Quem pediu desiste de um pedido pendente.
create function uj.cancelar_meu_pedido(p_pedido uuid) returns boolean
  language plpgsql security definer
  set search_path = pg_catalog, uj
  as $$
begin
  update uj.pedidos_de_entrada
     set estado = 'cancelado', decidido_em = now(), mensagem = null
   where id = p_pedido and conta_id = uj.conta_atual() and estado = 'pendente';
  return found;
end
$$;

-- ================================================================ denúncia de comunidade

create table uj.denuncias_de_comunidade (
  id uuid primary key default gen_random_uuid(),
  comunidade_id uuid not null references uj.comunidades (id) on delete cascade,
  -- Guardado para o Criador investigar abuso de denúncia; ninguém da comunidade lê.
  denunciante_conta_id uuid not null references uj.contas (id),
  -- `menor_de_16` e `risco_a_menor` sobem para o topo da fila da Plataforma.
  motivo text not null check (motivo in ('menor_de_16', 'risco_a_menor', 'falsa', 'golpe',
                                         'ofensiva', 'spam', 'outro')),
  detalhe text check (length(detalhe) <= 500),
  estado text not null default 'aberta' check (estado in ('aberta', 'procedente', 'improcedente')),
  resolucao text check (length(resolucao) <= 500),
  resolvida_por uuid references uj.contas (id),
  resolvida_em timestamptz,
  criado_em timestamptz not null default now(),
  check ((estado = 'aberta') = (resolvida_em is null))
);
create index denuncias_de_comunidade_comunidade
  on uj.denuncias_de_comunidade (comunidade_id, estado, criado_em desc);
create index denuncias_de_comunidade_fila on uj.denuncias_de_comunidade (estado, criado_em desc);
create index denuncias_de_comunidade_denunciante on uj.denuncias_de_comunidade (denunciante_conta_id);
create index denuncias_de_comunidade_resolvida_por on uj.denuncias_de_comunidade (resolvida_por);
-- A mesma pessoa não abre duas denúncias abertas da mesma comunidade.
create unique index denuncias_de_comunidade_uma_aberta
  on uj.denuncias_de_comunidade (comunidade_id, denunciante_conta_id) where estado = 'aberta';

-- Sem gatilho de log de mudanças, de propósito: anunciar a mudança aos
-- membros contaria à comunidade que alguém a denunciou.
alter table uj.denuncias_de_comunidade enable row level security;
create policy denuncias_de_comunidade_proprias on uj.denuncias_de_comunidade for select to uj_api
  using (denunciante_conta_id = (select uj.conta_atual()));
grant select on uj.denuncias_de_comunidade to uj_api;

-- Qualquer conta denuncia uma comunidade que aparece na busca ou da qual
-- participa. UJ083: comunidade fora disso (404). Repetir devolve a aberta.
create function uj.denunciar_comunidade(p_id_publico text, p_motivo text, p_detalhe text)
  returns uuid
  language plpgsql security definer
  set search_path = pg_catalog, uj
  as $$
declare
  conta uuid := uj.conta_atual();
  c uuid;
  d uuid;
begin
  select x.id into c from uj.comunidades x
   where x.id_publico = p_id_publico and x.estado in ('ativa', 'suspensa')
     and (x.encontravel or exists (select 1 from uj.vinculos v
                                    where v.comunidade_id = x.id and v.conta_id = conta
                                      and v.estado = 'ativo'));
  if c is null or not exists (select 1 from uj.contas where id = conta and estado = 'ativa') then
    raise exception 'comunidade nao encontrada' using errcode = 'UJ083';
  end if;
  insert into uj.denuncias_de_comunidade (comunidade_id, denunciante_conta_id, motivo, detalhe)
    values (c, conta, p_motivo, nullif(btrim(p_detalhe), ''))
    on conflict (comunidade_id, denunciante_conta_id) where estado = 'aberta' do nothing
  returning id into d;
  if d is null then
    select id into d from uj.denuncias_de_comunidade
     where comunidade_id = c and denunciante_conta_id = conta and estado = 'aberta';
  else
    -- Auditoria sem comunidade (a administração dela não deve ver) e sem o detalhe.
    insert into uj.auditoria (conta_id, acao, recurso_tipo, recurso_id, detalhes)
      values (conta, 'comunidade.denunciada', 'denuncia_de_comunidade', d::text,
              jsonb_build_object('motivo', p_motivo));
  end if;
  return d;
end
$$;

-- Fila da Plataforma. Nunca quem denunciou.
create function uj.denuncias_de_comunidade_da_plataforma(p_estado text)
  returns table (id uuid, comunidade_id uuid, comunidade_nome text, motivo text, detalhe text,
                 estado text, resolucao text, criado_em timestamptz, resolvida_em timestamptz)
  language sql stable security definer
  set search_path = pg_catalog, uj
  as $$
    select d.id, c.id, c.nome, d.motivo, d.detalhe, d.estado, d.resolucao, d.criado_em,
           d.resolvida_em
      from uj.denuncias_de_comunidade d join uj.comunidades c on c.id = d.comunidade_id
     where uj.eh_criador() and (p_estado is null or d.estado = p_estado)
     order by d.estado = 'aberta' and d.motivo in ('menor_de_16', 'risco_a_menor') desc,
              d.criado_em desc, d.id
     limit 200
  $$;

create function uj.resolver_denuncia_de_comunidade(p_denuncia uuid, p_estado text,
                                                   p_resolucao text)
  returns uuid
  language plpgsql security definer
  set search_path = pg_catalog, uj
  as $$
declare
  c uuid;
begin
  if not uj.eh_criador() then
    raise exception 'so o proprietario resolve denuncia de comunidade' using errcode = '42501';
  end if;
  if p_estado not in ('procedente', 'improcedente') then
    raise exception 'estado invalido' using errcode = '22023';
  end if;
  update uj.denuncias_de_comunidade
     set estado = p_estado, resolucao = nullif(btrim(p_resolucao), ''),
         resolvida_por = uj.conta_atual(), resolvida_em = now()
   where id = p_denuncia and estado = 'aberta'
  returning comunidade_id into c;
  return c;
end
$$;

-- Lista da Plataforma (ADR 0007), da mais nova para a mais antiga, por cursor
-- (criado_em em microssegundos e id). Quem criou aparece com nome e e-mail
-- só quando não é o próprio Criador (comunidade aberta, admin criador).
create function uj.comunidades_da_plataforma(p_verificacao text, p_busca text,
                                             p_antes_micros bigint, p_antes_id uuid,
                                             p_limite int)
  returns table (id uuid, nome text, cor text, cidade text, estado text, verificacao text,
                 exclusao_agendada_para timestamptz, criado_em timestamptz, micros text,
                 membros_ativos int, admins_ativos int, denuncias_abertas int,
                 criador_nome text, criador_email text)
  language sql stable security definer
  set search_path = pg_catalog, uj
  as $$
    select c.id, c.nome, c.cor, c.cidade, c.estado, c.verificacao, c.exclusao_agendada_para,
           c.criado_em, (extract(epoch from c.criado_em) * 1000000)::bigint::text,
           (select count(*)::int from uj.vinculos v join uj.contas a on a.id = v.conta_id
             where v.comunidade_id = c.id and v.estado = 'ativo' and a.estado = 'ativa'),
           (select count(*)::int from uj.vinculos v join uj.contas a on a.id = v.conta_id
             where v.comunidade_id = c.id and v.estado = 'ativo' and v.papel = 'admin'
               and a.estado = 'ativa'),
           (select count(*)::int from uj.denuncias_de_comunidade d
             where d.comunidade_id = c.id and d.estado = 'aberta'),
           case when not quem.plataforma_proprietario then quem.nome end,
           case when not quem.plataforma_proprietario then quem.email end
      from uj.comunidades c
      left join uj.contas quem on quem.id = c.criado_por
     where uj.eh_criador()
       and (p_verificacao is null or c.verificacao = p_verificacao)
       and (p_busca is null
            or position(uj.nome_normalizado(p_busca) in uj.nome_normalizado(c.nome)) > 0
            or position(uj.nome_normalizado(p_busca) in uj.nome_normalizado(coalesce(c.cidade, ''))) > 0)
       and (p_antes_micros is null
            or (c.criado_em, c.id) < (timestamptz 'epoch' + p_antes_micros * interval '1 microsecond',
                                      p_antes_id))
     order by c.criado_em desc, c.id desc
     limit greatest(1, least(p_limite, 101))
  $$;

-- ================================================================ conta anonimizada

-- Excluir a conta (uj.excluir_conta) anonimiza a linha: os pedidos de entrada
-- da pessoa saem, e o detalhe que ela escreveu em denúncias também.
create function uj.limpar_pedidos_ao_anonimizar() returns trigger
  language plpgsql security definer
  set search_path = pg_catalog, uj
  as $$
begin
  if new.estado = 'anonimizada' and old.estado <> 'anonimizada' then
    delete from uj.pedidos_de_entrada where conta_id = new.id;
    update uj.denuncias_de_comunidade set detalhe = null where denunciante_conta_id = new.id;
  end if;
  return null;
end
$$;
create trigger contas_limpar_pedidos after update of estado on uj.contas
  for each row execute function uj.limpar_pedidos_ao_anonimizar();

-- Comunidade órfã (ADR 0007): quem a criou excluiu a conta e não sobrou ninguém
-- ativo nela. Vai sozinha para a exclusão agendada (30 dias de carência, como
-- a do Criador), auditada sem pessoa.
create function uj.agendar_comunidades_orfas() returns trigger
  language plpgsql security definer
  set search_path = pg_catalog, uj
  as $$
declare
  c uuid;
begin
  if new.estado <> 'anonimizada' or old.estado = 'anonimizada' then
    return null;
  end if;
  for c in select x.id from uj.comunidades x
            where x.criado_por = new.id and x.estado in ('ativa', 'suspensa', 'arquivada')
              and not exists (select 1 from uj.vinculos v join uj.contas a on a.id = v.conta_id
                               where v.comunidade_id = x.id and v.estado = 'ativo'
                                 and a.estado = 'ativa' and a.id <> new.id) loop
    update uj.comunidades
       set estado = 'exclusao_agendada', exclusao_agendada_para = now() + interval '30 days'
     where id = c;
    insert into uj.auditoria (comunidade_id, acao, recurso_tipo, recurso_id)
      values (c, 'comunidade.orfa_agendada', 'comunidade', c::text);
  end loop;
  return null;
end
$$;
create trigger contas_comunidades_orfas after update of estado on uj.contas
  for each row execute function uj.agendar_comunidades_orfas();

-- ================================================================ termo do administrador (TC-16)

-- A conta do contexto é admin ativa da comunidade do contexto e ainda não
-- aceitou a versão vigente do termo do administrador (quem foi promovido
-- depois da criação, ou quando o texto ganha versão nova).
create function uj.precisa_aceitar_termo_do_admin(p_versao int) returns boolean
  language sql stable security definer
  set search_path = pg_catalog, uj
  as $$
    select uj.nivel_no_contexto() >= 30
       and not exists (select 1 from uj.consentimentos t
                        where t.conta_id = uj.conta_atual()
                          and t.comunidade_id = uj.comunidade_atual()
                          and t.texto_id = 'TC-16' and t.versao >= p_versao
                          and t.revogado_em is null)
  $$;

create function uj.aceitar_termo_do_admin(p_versao int, p_forma text) returns boolean
  language plpgsql security definer
  set search_path = pg_catalog, uj
  as $$
declare
  v uuid;
begin
  select x.id into v from uj.vinculos x
   where x.conta_id = uj.conta_atual() and x.comunidade_id = uj.comunidade_atual()
     and x.estado = 'ativo' and x.papel = 'admin';
  if v is null then
    raise exception 'so administradores aceitam o termo' using errcode = '42501';
  end if;
  if not uj.precisa_aceitar_termo_do_admin(p_versao) then
    return false;
  end if;
  insert into uj.consentimentos (conta_id, comunidade_id, vinculo_id, texto_id, versao, forma)
    values (uj.conta_atual(), uj.comunidade_atual(), v, 'TC-16', p_versao, p_forma);
  return true;
end
$$;

-- ================================================================ exportar meus dados

-- Os pedidos de entrada e as denúncias de comunidade feitos pela pessoa, para
-- "Exportar meus dados" (a rota junta ao que `uj.exportar_meus_dados` devolve).
create function uj.meus_dados_da_abertura() returns jsonb
  language sql stable security definer
  set search_path = pg_catalog, uj
  as $$
    select jsonb_build_object(
      'pedidosDeEntrada', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'comunidade', c.nome, 'origem', p.origem, 'mensagem', p.mensagem,
                 'estado', case p.estado when 'recusado' then 'nao_aprovado' else p.estado end,
                 'criadoEm', p.criado_em, 'respondidoEm', p.decidido_em)
               order by p.criado_em)
          from uj.pedidos_de_entrada p join uj.comunidades c on c.id = p.comunidade_id
         where p.conta_id = uj.conta_atual()), '[]'::jsonb),
      'denunciasDeComunidade', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'comunidade', c.nome, 'motivo', d.motivo, 'detalhe', d.detalhe,
                 'estado', d.estado, 'criadoEm', d.criado_em, 'resolvidaEm', d.resolvida_em)
               order by d.criado_em)
          from uj.denuncias_de_comunidade d join uj.comunidades c on c.id = d.comunidade_id
         where d.denunciante_conta_id = uj.conta_atual()), '[]'::jsonb))
  $$;

-- ================================================================ retenção (job diário)

-- Pedido pendente vence em 30 dias (vira cancelado, sem a mensagem); pedido
-- respondido ou cancelado é apagado 30 dias depois (a recusa só precisa durar
-- os 30 dias de espera); denúncia de comunidade resolvida sai depois de 2 anos;
-- cadastros pendentes de Google e Apple vencidos saem no dia seguinte.
create function uj.retencao_da_abertura() returns jsonb
  language plpgsql security definer
  set search_path = pg_catalog, uj
  as $$
declare
  r jsonb := '{}'::jsonb;
  n int;
begin
  update uj.pedidos_de_entrada
     set estado = 'cancelado', decidido_em = now(), mensagem = null
   where estado = 'pendente' and criado_em < now() - interval '30 days';
  get diagnostics n = row_count;
  r := r || jsonb_build_object('pedidos_de_entrada_vencidos', n);

  delete from uj.pedidos_de_entrada
   where estado <> 'pendente' and decidido_em < now() - interval '30 days';
  get diagnostics n = row_count;
  r := r || jsonb_build_object('pedidos_de_entrada_apagados', n);

  delete from uj.denuncias_de_comunidade
   where estado <> 'aberta' and resolvida_em < now() - interval '2 years';
  get diagnostics n = row_count;
  r := r || jsonb_build_object('denuncias_de_comunidade_apagadas', n);

  delete from uj.cadastros_por_provedor
   where expira_em < now() - interval '24 hours' or usado_em < now() - interval '24 hours';
  get diagnostics n = row_count;
  r := r || jsonb_build_object('cadastros_por_provedor_apagados', n);
  return r;
end
$$;


-- ================================================================ notificações de pedido

alter table uj.notificacoes drop constraint notificacoes_tipo_check;
alter table uj.notificacoes add constraint notificacoes_tipo_check
  check (tipo in ('eventos', 'escalas', 'inscricoes', 'tarefas', 'substituicoes',
                  'alteracoes_importantes', 'avisos', 'pedido_de_entrada', 'pedido_decidido'));

-- Igual à de 0011, mais o aviso a quem pediu: a pessoa recusada não tem
-- vínculo, mas pode saber que o pedido DELA foi respondido.
create or replace function uj.notificacao_permitida(p_conta uuid, p_comunidade uuid, p_tipo text)
  returns boolean
  language sql stable security definer
  set search_path = pg_catalog, uj
  as $$
    select case when p_tipo = 'pedido_decidido' then
             exists (select 1 from uj.contas a where a.id = p_conta and a.estado = 'ativa')
             and exists (select 1 from uj.comunidades c
                          where c.id = p_comunidade and c.estado = 'ativa')
             and exists (select 1 from uj.pedidos_de_entrada p
                          where p.conta_id = p_conta and p.comunidade_id = p_comunidade
                            and p.estado in ('aceito', 'recusado'))
           else
             exists (
               select 1 from uj.vinculos v
                 join uj.contas a on a.id = v.conta_id
                 join uj.comunidades c on c.id = v.comunidade_id
                where v.conta_id = p_conta and v.comunidade_id = p_comunidade
                  and v.estado = 'ativo' and a.estado = 'ativa' and c.estado = 'ativa')
             and not exists (
               select 1 from uj.preferencias_notificacao p
                where p.conta_id = p_conta and p.comunidade_id = p_comunidade
                  and p.tipo in ('todos', p_tipo) and not p.ativo)
           end
  $$;

-- A caixa (D42) mostra também a resposta ao pedido de quem não tem vínculo.
drop policy notificacoes_caixa on uj.notificacoes;
create policy notificacoes_caixa on uj.notificacoes for select to uj_api
  using (conta_id = (select uj.conta_atual())
         and (comunidade_id = any ((select uj.comunidades_da_caixa())::uuid[])
              or tipo = 'pedido_decidido'));
drop policy notificacoes_marcar_lida on uj.notificacoes;
create policy notificacoes_marcar_lida on uj.notificacoes for update to uj_api
  using (conta_id = (select uj.conta_atual())
         and (comunidade_id = any ((select uj.comunidades_da_caixa())::uuid[])
              or tipo = 'pedido_decidido'))
  with check (conta_id = (select uj.conta_atual())
              and (comunidade_id = any ((select uj.comunidades_da_caixa())::uuid[])
                   or tipo = 'pedido_decidido'));

-- Nome da comunidade de uma notificação da própria conta (a pessoa recusada
-- não lê a comunidade pela RLS, mas foi ela quem pediu para entrar).
create function uj.nome_da_comunidade_da_notificacao(p_notificacao uuid) returns text
  language sql stable security definer
  set search_path = pg_catalog, uj
  as $$
    select c.nome from uj.notificacoes n join uj.comunidades c on c.id = n.comunidade_id
     where n.id = p_notificacao and n.conta_id = uj.conta_atual()
  $$;

-- ================================================================ conta aberta (uj_auth)

-- Código de 6 dígitos do cadastro por e-mail: mesma tabela do convite (a
-- retenção diária já apaga), com o nome e a idade declarados no primeiro passo.
alter table uj.verificacoes_email drop constraint verificacoes_email_finalidade_check;
alter table uj.verificacoes_email add constraint verificacoes_email_finalidade_check
  check (finalidade in ('convite', 'cadastro'));
alter table uj.verificacoes_email
  add column nome text check (nome is null or length(btrim(nome)) between 1 and 120),
  add column faixa_etaria text check (faixa_etaria in ('16_17', '18_mais')),
  add column responsavel_ciente boolean,
  add constraint verificacoes_email_cadastro_completo
    check (finalidade <> 'cadastro' or (nome is not null and faixa_etaria is not null));

-- Cota diária dos e-mails de cadastro (o plano gratuito do Resend tem teto
-- de 100 por dia; Google e Apple não gastam). Mesma forma das de 0015.
create function uj.cota_email_cadastro() returns boolean
  language sql security definer
  set search_path = pg_catalog, uj
  as $$ select uj.consumir_cota('email:cadastro', 30) $$;

-- Conta aberta por e-mail (o código já conferido pela API). UJ005: e-mail com conta.
create function uj.criar_conta_aberta(p_nome text, p_email text, p_senha_hash text) returns uuid
  language plpgsql security definer
  set search_path = pg_catalog, uj
  as $$
declare
  nova uuid;
begin
  if exists (select 1 from uj.contas where email = lower(p_email)) then
    raise exception 'e-mail ja possui conta' using errcode = 'UJ005';
  end if;
  insert into uj.contas (nome, email, email_verificado_em, senha_hash)
    values (btrim(p_nome), lower(p_email), now(), p_senha_hash)
  returning id into nova;
  return nova;
end
$$;

-- Cadastro pendente de Google ou Apple: o token (256 bits) só como SHA-256,
-- 15 minutos, uso único. Sem comunidade: é identidade, só `uj_auth`.
create table uj.cadastros_por_provedor (
  token_hash bytea primary key,
  provedor text not null check (provedor in ('google', 'apple')),
  sub text not null check (length(sub) between 1 and 255),
  email text not null check (email = lower(email) and length(email) <= 254),
  nome text check (nome is null or length(btrim(nome)) between 1 and 120),
  aparelho text check (length(aparelho) <= 80),
  plataforma text not null check (plataforma in ('ios', 'android', 'web')),
  expira_em timestamptz not null,
  usado_em timestamptz,
  criado_em timestamptz not null default now(),
  check (expira_em <= criado_em + interval '15 minutes')
);
create index cadastros_por_provedor_expira on uj.cadastros_por_provedor (expira_em);
alter table uj.cadastros_por_provedor enable row level security;
create policy cadastros_por_provedor_auth on uj.cadastros_por_provedor to uj_auth
  using (true) with check (true);
grant select, insert, delete on uj.cadastros_por_provedor to uj_auth;
grant update (usado_em) on uj.cadastros_por_provedor to uj_auth;

-- Conta aberta por Google ou Apple: e-mail já verificado pelo provedor, sem
-- senha, com o vínculo do provedor. UJ005: e-mail com conta; UJ006: esta
-- conta do provedor já está ligada a outra conta.
create function uj.criar_conta_por_provedor(p_nome text, p_email text, p_provedor text,
                                            p_sub text)
  returns uuid
  language plpgsql security definer
  set search_path = pg_catalog, uj
  as $$
declare
  nova uuid;
begin
  if exists (select 1 from uj.contas where email = lower(p_email)) then
    raise exception 'e-mail ja possui conta' using errcode = 'UJ005';
  end if;
  if exists (select 1 from uj.contas_provedores where provedor = p_provedor and sub = p_sub) then
    raise exception 'provedor ja conectado' using errcode = 'UJ006';
  end if;
  insert into uj.contas (nome, email, email_verificado_em)
    values (btrim(p_nome), lower(p_email), now())
  returning id into nova;
  insert into uj.contas_provedores (conta_id, provedor, sub, email_informado, ultimo_uso_em)
    values (nova, p_provedor, p_sub, lower(p_email), now());
  return nova;
end
$$;

-- ================================================================ retenção: job diário

-- Igual à de 0019, mais `uj.retencao_da_abertura()`.
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

  delete from uj.bloqueios b
   where exists (select 1 from uj.contas a
                  where a.id in (b.conta_id, b.bloqueada_conta_id) and a.estado = 'anonimizada')
      or not exists (select 1 from uj.vinculos x
                      where x.conta_id = b.conta_id and x.comunidade_id = b.comunidade_id)
      or not exists (select 1 from uj.vinculos x
                      where x.conta_id = b.bloqueada_conta_id and x.comunidade_id = b.comunidade_id);
  get diagnostics n = row_count;
  r := r || jsonb_build_object('bloqueios_orfaos_apagados', n);

  r := r || uj.retencao_da_abertura();
  return r;
end
$$;

-- ================================================================ privilégios

revoke execute on all functions in schema uj from public;

grant execute on function
  uj.eh_criador(),
  uj.criar_comunidade_aberta(text, text, text, text, bytea, bytea, int, int, text),
  uj.criar_comunidade_pela_plataforma(text, text, text, text, bytea, int),
  uj.definir_verificacao(uuid, boolean),
  uj.comunidades_da_plataforma(text, text, bigint, uuid, int),
  uj.buscar_comunidades(text, text),
  uj.logo_da_comunidade_encontravel(text, text[]),
  uj.entrar_por_codigo(bytea, text, text, boolean, int, int, text),
  uj.pedir_entrada_pela_busca(text, text, text, boolean, int, int, text),
  uj.decidir_pedido(uuid, boolean),
  uj.pedidos_da_comunidade(text),
  uj.meus_pedidos(),
  uj.cancelar_meu_pedido(uuid),
  uj.denunciar_comunidade(text, text, text),
  uj.denuncias_de_comunidade_da_plataforma(text),
  uj.resolver_denuncia_de_comunidade(uuid, text, text),
  uj.nome_da_comunidade_da_notificacao(uuid),
  uj.precisa_aceitar_termo_do_admin(int),
  uj.aceitar_termo_do_admin(int, text),
  uj.meus_dados_da_abertura(),
  uj.limite_de_vinculos_da_comunidade_nova()
  to uj_api;

grant execute on function
  uj.cota_email_cadastro(),
  uj.criar_conta_aberta(text, text, text),
  uj.criar_conta_por_provedor(text, text, text, text)
  to uj_auth;
