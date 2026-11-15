-- 0015: correções da revisão de segurança independente feita sobre os commits
-- 15060d4 a bba28a5 (14/11/2026). Cada seção cita o achado (A1, M1, M2, B1 a B6).
-- As migrações 0001 a 0014 já foram aplicadas e não se editam: o que muda
-- aqui substitui funções e gatilhos delas.

-- ================================================================ A1: autoria trocada sem rastro

-- Ao sair da comunidade (ou no job dos 30 dias), `desligar_vinculo` passa a
-- autoria para a conta-fantasma. Se essa troca subisse `versao` e
-- `atualizado_em` e gerasse linha em `uj.mudancas` no mesmo instante da linha
-- de `vinculos`, o log de sincronização e `sugestoes_visiveis()` diriam quem
-- escreveu a sugestão anônima e quem fez a denúncia. Regra: quando SÓ colunas
-- de autoria mudam, nada de versão, data ou mudança.
create function uj.so_autoria_mudou(p_antes jsonb, p_depois jsonb) returns boolean
  language sql immutable
  set search_path = pg_catalog
  as $$
    select (p_antes - array['autor_conta_id', 'respondida_por', 'denunciante_conta_id',
                            'resolvida_por', 'atualizado_em', 'versao'])
           = (p_depois - array['autor_conta_id', 'respondida_por', 'denunciante_conta_id',
                               'resolvida_por', 'atualizado_em', 'versao'])
       and (p_antes - array['atualizado_em', 'versao'])
           <> (p_depois - array['atualizado_em', 'versao'])
  $$;

create function uj.tocar_atualizado_em_sem_autoria() returns trigger
  language plpgsql
  set search_path = pg_catalog, uj
  as $$
begin
  if not uj.so_autoria_mudou(to_jsonb(old), to_jsonb(new)) then
    new.atualizado_em := now();
  end if;
  return new;
end
$$;

create function uj.subir_versao_sem_autoria() returns trigger
  language plpgsql
  set search_path = pg_catalog, uj
  as $$
begin
  if not uj.so_autoria_mudou(to_jsonb(old), to_jsonb(new)) then
    new.versao := old.versao + 1;
  end if;
  return new;
end
$$;

-- Mesmos nomes de gatilho: a ordem alfabética (atualizado, guardar, versao) não muda.
drop trigger sugestoes_atualizado on uj.sugestoes;
create trigger sugestoes_atualizado before update on uj.sugestoes
  for each row execute function uj.tocar_atualizado_em_sem_autoria();
drop trigger sugestoes_versao on uj.sugestoes;
create trigger sugestoes_versao before update on uj.sugestoes
  for each row execute function uj.subir_versao_sem_autoria();

create or replace function uj.registrar_mudanca_de_sugestao() returns trigger
  language plpgsql security definer
  set search_path = pg_catalog, uj
  as $$
declare
  linha record;
begin
  if tg_op = 'UPDATE' and uj.so_autoria_mudou(to_jsonb(old), to_jsonb(new)) then
    return null;
  end if;
  if tg_op = 'DELETE' then linha := old; else linha := new; end if;
  insert into uj.mudancas (comunidade_id, tabela, registro_id, operacao, nivel_minimo)
    values (linha.comunidade_id, 'sugestoes', linha.id, left(tg_op, 1), 20);
  insert into uj.mudancas (comunidade_id, tabela, registro_id, operacao, conta_alvo)
    values (linha.comunidade_id, 'sugestoes', linha.id, left(tg_op, 1), linha.autor_conta_id);
  return null;
end
$$;

create or replace function uj.registrar_mudanca_de_denuncia() returns trigger
  language plpgsql security definer
  set search_path = pg_catalog, uj
  as $$
declare
  linha record;
begin
  if tg_op = 'UPDATE' and uj.so_autoria_mudou(to_jsonb(old), to_jsonb(new)) then
    return null;
  end if;
  if tg_op = 'DELETE' then linha := old; else linha := new; end if;
  insert into uj.mudancas (comunidade_id, tabela, registro_id, operacao, nivel_minimo)
    values (linha.comunidade_id, 'denuncias', linha.id, left(tg_op, 1), 30);
  return null;
end
$$;

-- ================================================================ M1: vínculo citado é da comunidade

-- Presença e inscrição citam vínculo (e inscrição) da MESMA comunidade e do
-- MESMO evento. Antes, uma presença em B podia citar o vínculo de alguém de A,
-- e ela aparecia no "exportar meus dados" dessa pessoa.
create or replace function uj.guardar_filho_de_evento() returns trigger
  language plpgsql security definer
  set search_path = pg_catalog, uj
  as $$
begin
  if not exists (select 1 from uj.eventos where id = new.evento_id and comunidade_id = new.comunidade_id) then
    raise exception 'evento de outra comunidade' using errcode = '23503';
  end if;
  if tg_table_name = 'atribuicoes' then
    perform uj.exigir_vinculo_da_comunidade(new.vinculo_id, new.comunidade_id);
    if new.etapa_id is not null and not exists (
         select 1 from uj.etapas where id = new.etapa_id and evento_id = new.evento_id) then
      raise exception 'etapa de outro evento' using errcode = '23503';
    end if;
  elsif tg_table_name in ('tarefas', 'materiais', 'checklist_itens') then
    perform uj.exigir_vinculo_da_comunidade(new.responsavel_vinculo_id, new.comunidade_id);
  elsif tg_table_name = 'inscricoes' then
    perform uj.exigir_vinculo_da_comunidade(new.vinculo_id, new.comunidade_id);
  elsif tg_table_name = 'presencas' then
    perform uj.exigir_vinculo_da_comunidade(new.vinculo_id, new.comunidade_id);
    perform uj.exigir_vinculo_da_comunidade(new.registrada_por, new.comunidade_id);
    if new.inscricao_id is not null and not exists (
         select 1 from uj.inscricoes where id = new.inscricao_id and evento_id = new.evento_id) then
      raise exception 'inscricao de outro evento' using errcode = '23503';
    end if;
  end if;
  return new;
end
$$;

-- Linhas que só existem por causa da falha (presença em uma comunidade citando
-- vínculo de outra, ou inscrição de outro evento) são inválidas por definição.
delete from uj.presencas p using uj.vinculos v
 where v.id = p.vinculo_id and v.comunidade_id <> p.comunidade_id;
delete from uj.presencas p using uj.inscricoes i
 where i.id = p.inscricao_id and i.evento_id <> p.evento_id;

-- ================================================================ M2: inscrição pública repetida

-- Repetir a inscrição com o mesmo WhatsApp não devolve mais o código, o estado
-- nem a confirmação de que havia inscrição: quem só sabe o número de alguém não
-- leva o QR de entrada dela. O código só sai de novo com o token do link de
-- cancelamento (`uj.codigo_da_inscricao_publica`).
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
     and c.estado = 'ativa'
   for update of ev;
  if not found then
    raise exception 'inscricoes indisponiveis' using errcode = 'UJ030';
  end if;
  if exists (select 1 from uj.inscricoes
              where evento_id = e.id and telefone = p_telefone and estado <> 'cancelada') then
    return query select null::uuid, null::text, null::text, true;
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

-- Reemite o código de entrada para quem tem o link de cancelamento (token).
create function uj.codigo_da_inscricao_publica(p_id_publico text, p_token_hash bytea)
  returns table (estado text, codigo_checkin text)
  language sql stable security definer
  set search_path = pg_catalog, uj
  as $$
    select i.estado, i.codigo_checkin
      from uj.inscricoes i join uj.eventos e on e.id = i.evento_id
     where e.id_publico = p_id_publico and i.token_cancelamento_hash = p_token_hash
       and i.origem = 'publica' and i.anonimizada_em is null and i.estado <> 'cancelada'
  $$;

-- ================================================================ B1: corrida na exclusão de conta

-- Quem escreve oração, intercessão ou sugestão trava o PRÓPRIO vínculo ativo
-- (FOR KEY SHARE) antes de gravar. `excluir_conta` e `desligar_vinculo` travam
-- o vínculo com FOR UPDATE, que conflita com KEY SHARE: a escrita concorrente
-- espera e, quando a exclusão confirma, relê o vínculo (já removido) e é
-- recusada; ou a escrita confirma antes, e a exclusão a apaga. A mensagem cita
-- "row-level security" para a API tratar como a recusa da política (403).
create function uj.travar_vinculo_de_quem_escreve() returns trigger
  language plpgsql security definer
  set search_path = pg_catalog, uj
  as $$
declare
  conta uuid;
begin
  if tg_table_name = 'intercessoes' then
    conta := new.conta_id;
  else
    conta := new.autor_conta_id;
  end if;
  perform 1 from uj.vinculos v
   where v.comunidade_id = new.comunidade_id and v.conta_id = conta and v.estado = 'ativo'
   for key share;
  if not found then
    raise exception 'new row violates row-level security policy (sem vinculo ativo)'
      using errcode = '42501';
  end if;
  return new;
end
$$;
create trigger pedidos_oracao_travar_vinculo before insert on uj.pedidos_oracao
  for each row execute function uj.travar_vinculo_de_quem_escreve();
create trigger intercessoes_travar_vinculo before insert on uj.intercessoes
  for each row execute function uj.travar_vinculo_de_quem_escreve();
create trigger sugestoes_travar_vinculo before insert on uj.sugestoes
  for each row execute function uj.travar_vinculo_de_quem_escreve();

-- ================================================================ B5: exclusão exige prova de reautenticação

-- Mesmo padrão de `provas_de_plataforma`: o serviço de autenticação confere
-- senha e 2FA e grava só o HASH de uma prova de uso único, válida por 5 min.
-- `excluir_conta` consome a prova; sem ela, um `p_conta` qualquer não basta.
create table uj.provas_de_reautenticacao (
  prova_hash bytea primary key check (octet_length(prova_hash) = 32),
  conta_id uuid not null references uj.contas (id),
  finalidade text not null check (finalidade in ('excluir_conta')),
  expira_em timestamptz not null,
  criado_em timestamptz not null default now(),
  check (expira_em <= criado_em + interval '5 minutes')
);
create index provas_de_reautenticacao_conta on uj.provas_de_reautenticacao (conta_id);
alter table uj.provas_de_reautenticacao enable row level security;
create policy provas_de_reautenticacao_inserir on uj.provas_de_reautenticacao for insert to uj_auth
  with check (expira_em <= now() + interval '5 minutes');
grant insert on uj.provas_de_reautenticacao to uj_auth;

drop function uj.excluir_conta(uuid);

-- Igual à de 0012, com a prova (UJ042 sem prova válida) e a trava dos vínculos
-- ANTES da conta (B1: mesma ordem de quem escreve, vínculo e depois conta).
create function uj.excluir_conta(p_conta uuid, p_prova text) returns text
  language plpgsql security definer
  set search_path = pg_catalog, uj
  as $$
declare
  a uj.contas;
  v record;
begin
  delete from uj.provas_de_reautenticacao
   where conta_id = p_conta and finalidade = 'excluir_conta' and expira_em > now()
     and prova_hash = sha256(convert_to(coalesce(p_prova, ''), 'UTF8'));
  if not found then
    raise exception 'reautenticacao necessaria' using errcode = 'UJ042';
  end if;
  perform 1 from uj.vinculos where conta_id = p_conta order by id for update;
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
  update uj.vinculos set anonimizado_em = now() where conta_id = p_conta;

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
  delete from uj.provas_de_reautenticacao where conta_id = p_conta;
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

-- Consentimento citando comunidade só com vínculo ativo da própria conta nela.
create or replace function uj.registrar_consentimento(p_conta uuid, p_comunidade uuid, p_vinculo uuid,
                                                      p_texto text, p_versao int, p_forma text,
                                                      p_faixa text, p_confirmacao boolean)
  returns uuid
  language plpgsql security definer
  set search_path = pg_catalog, uj
  as $$
declare
  novo uuid;
  c uuid := p_comunidade;
begin
  if p_vinculo is not null then
    select comunidade_id into c from uj.vinculos where id = p_vinculo and conta_id = p_conta;
    if c is null or (p_comunidade is not null and c <> p_comunidade) then
      raise exception 'vinculo de outra conta' using errcode = '23503';
    end if;
  elsif p_comunidade is not null and not exists (
          select 1 from uj.vinculos
           where conta_id = p_conta and comunidade_id = p_comunidade and estado = 'ativo') then
    raise exception 'comunidade sem vinculo da conta' using errcode = '23503';
  end if;
  insert into uj.consentimentos (conta_id, comunidade_id, vinculo_id, texto_id, versao, forma,
                                 faixa_etaria, confirmacao_adicional)
    values (p_conta, c, p_vinculo, p_texto, p_versao, p_forma, p_faixa, p_confirmacao)
  returning id into novo;
  return novo;
end
$$;

-- Só quem é da comunidade do contexto pergunta se alguém está ativo nela:
-- de fora, a função não vira um verificador de quem participa de qual comunidade.
create or replace function uj.conta_ativa_no_contexto(p_conta uuid) returns boolean
  language sql stable security definer
  set search_path = pg_catalog, uj
  as $$
    select uj.nivel_no_contexto() >= 10
       and exists (
         select 1 from uj.vinculos v join uj.contas a on a.id = v.conta_id
          where v.comunidade_id = uj.comunidade_atual() and v.conta_id = p_conta
            and v.estado = 'ativo' and a.estado = 'ativa')
  $$;

-- ================================================================ B2: cotas por finalidade

-- Push: cota diária por (conta, comunidade), para o organizador de A não
-- esgotar o que a pessoa receberia de B. Tipos críticos (evento cancelado ou
-- adiado, substituição) têm cota própria e não são calados pelos avisos.
create function uj.limite_diario_de_push_critico() returns int
  language sql immutable
  as $$ select 30 $$;

create or replace function uj.enfileirar_notificacao(p_comunidade uuid, p_conta uuid, p_tipo text,
                                                     p_recurso_tipo text, p_recurso uuid,
                                                     p_titulo text, p_corpo text) returns void
  language plpgsql security definer
  set search_path = pg_catalog, uj
  as $$
declare
  chave text;
  nova uuid;
  critico boolean := p_tipo in ('alteracoes_importantes', 'substituicoes');
begin
  if p_conta is null or p_conta is not distinct from uj.conta_atual() then
    return;
  end if;
  if not uj.notificacao_permitida(p_conta, p_comunidade, p_tipo) then
    return;
  end if;
  if exists (select 1 from uj.notificacoes n
              where n.conta_id = p_conta and n.tipo = p_tipo and n.recurso_id = p_recurso
                and n.criado_em > now() - interval '1 hour') then
    return;
  end if;
  chave := p_conta::text || ':' || p_tipo || ':' || p_recurso::text || ':'
           || floor(extract(epoch from now()) / 3600)::bigint::text;
  if not uj.consumir_cota(
           case when critico then 'push-critico:' else 'push:' end
             || p_conta::text || ':' || p_comunidade::text,
           case when critico then uj.limite_diario_de_push_critico()
                else uj.limite_diario_de_push() end) then
    return;
  end if;
  insert into uj.notificacoes (comunidade_id, conta_id, tipo, recurso_tipo, recurso_id, titulo,
                               corpo, chave_dedup)
    values (p_comunidade, p_conta, p_tipo, p_recurso_tipo, p_recurso, p_titulo, p_corpo, chave)
    on conflict (chave_dedup) do nothing
  returning id into nova;
  if nova is null then
    return;
  end if;
  insert into uj.envios_push (notificacao_id, aparelho_id)
    select nova, a.id from uj.aparelhos_push a where a.conta_id = p_conta;
end
$$;

-- Publicação de avisos por hora, por comunidade (cada aviso notifica todos).
-- UJ060: limite atingido. Janela fixa por hora do relógio de São Paulo.
create function uj.limite_de_avisos_por_hora() returns int
  language sql immutable
  as $$ select 20 $$;

create function uj.limitar_publicacao_de_aviso() returns trigger
  language plpgsql security definer
  set search_path = pg_catalog, uj
  as $$
begin
  if new.estado = 'publicado' and (tg_op = 'INSERT' or old.estado <> 'publicado')
     and not uj.consumir_cota('avisos:' || new.comunidade_id::text || ':'
                                || to_char(now() at time zone 'America/Sao_Paulo', 'HH24'),
                              uj.limite_de_avisos_por_hora()) then
    raise exception 'limite de avisos por hora' using errcode = 'UJ060';
  end if;
  return new;
end
$$;
create trigger avisos_limitar before insert or update of estado on uj.avisos
  for each row execute function uj.limitar_publicacao_de_aviso();

-- E-mail: as finalidades que a autenticação usa, cada uma com o seu limite.
-- A função genérica `consumir_cota(chave, limite)` deixa de ser do aplicativo:
-- com ela, o papel podia gastar a cota de push de qualquer pessoa.
create function uj.cota_email_recuperacao() returns boolean
  language sql security definer
  set search_path = pg_catalog, uj
  as $$ select uj.consumir_cota('email:recuperacao', 30) $$;

create function uj.cota_email_convite(p_convite uuid) returns boolean
  language plpgsql security definer
  set search_path = pg_catalog, uj
  as $$
begin
  if not exists (select 1 from uj.convites where id = p_convite) then
    return false;
  end if;
  -- Em sequência (como antes, na API): a cota do convite só é gasta se a geral permitir.
  if not uj.consumir_cota('email:convite', 60) then
    return false;
  end if;
  return uj.consumir_cota('email:convite:' || p_convite::text, 15);
end
$$;

-- ================================================================ B6: cota de exportações

-- Por dia: 20 exportações por conta e 50 MB por comunidade. Consome as duas ou
-- nenhuma (na mesma transação do arquivo: se a gravação falhar, nada é gasto).
create function uj.cota_de_exportacao(p_bytes int) returns boolean
  language plpgsql security definer
  set search_path = pg_catalog, uj
  as $$
declare
  hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  chave_bytes text := 'exportacao:bytes:' || uj.comunidade_atual()::text;
  chave_conta text := 'exportacao:conta:' || uj.conta_atual()::text;
  bytes int;
  quantas int;
begin
  if uj.conta_atual() is null or uj.comunidade_atual() is null
     or uj.nivel_gravavel_no_contexto() < 20 or p_bytes < 0 then
    return false;
  end if;
  insert into uj.cotas_diarias (dia, chave, quantidade)
    values (hoje, chave_bytes, 0), (hoje, chave_conta, 0)
    on conflict (dia, chave) do nothing;
  -- Sempre na mesma ordem (bytes, depois conta), para não travar em ciclo.
  select quantidade into bytes from uj.cotas_diarias
   where dia = hoje and chave = chave_bytes for update;
  select quantidade into quantas from uj.cotas_diarias
   where dia = hoje and chave = chave_conta for update;
  if quantas >= 20 or bytes::bigint + p_bytes > 50000000 then
    return false;
  end if;
  update uj.cotas_diarias set quantidade = quantidade + p_bytes
   where dia = hoje and chave = chave_bytes;
  update uj.cotas_diarias set quantidade = quantidade + 1
   where dia = hoje and chave = chave_conta;
  return true;
end
$$;

-- ================================================================ B3: fila de push

-- Cada reserva leva um identificador aleatório que `push_concluir` exige:
-- quem não reservou não conclui (nem apaga o aparelho de ninguém).
alter table uj.envios_push add column reserva_id uuid;

drop function uj.push_reservar(int, int);
create function uj.push_reservar(p_lote int, p_reserva_s int)
  returns table (envio_id bigint, reserva_id uuid, para_token text, para_plataforma text,
                 para_ambiente text, texto_titulo text, texto_corpo text, dados jsonb)
  language plpgsql security definer
  set search_path = pg_catalog, uj
  as $$
#variable_conflict use_column
begin
  -- Reserva vencida (o processo caiu no meio do envio) também conta tentativa:
  -- passou do limite, falha de vez em vez de voltar para sempre.
  update uj.envios_push x
     set estado = 'falhou', erro = 'reserva_vencida', reservado_ate = null, reserva_id = null
   where x.estado = 'enviando' and x.reservado_ate < now() and x.tentativas >= 5;
  -- Revalida no envio, inclusive o que estava 'enviando' e venceu: aparelho sem
  -- sessão viva, vínculo encerrado, preferência desligada ou notificação velha.
  update uj.envios_push x set estado = 'descartado', reservado_ate = null, reserva_id = null
    from uj.notificacoes n, uj.aparelhos_push a
   where n.id = x.notificacao_id and a.id = x.aparelho_id
     and ((x.estado = 'pendente' and x.proxima_em <= now())
          or (x.estado = 'enviando' and x.reservado_ate < now()))
     and (a.conta_id <> n.conta_id
          or n.criado_em < now() - interval '24 hours'
          or not uj.notificacao_permitida(n.conta_id, n.comunidade_id, n.tipo)
          or not exists (select 1 from uj.sessoes s
                          where s.familia = a.familia and s.conta_id = a.conta_id
                            and s.revogada_em is null and s.expira_em > now()));
  return query
    with escolhidos as (
      select y.id from uj.envios_push y
       where (y.estado = 'pendente' and y.proxima_em <= now())
          or (y.estado = 'enviando' and y.reservado_ate < now())
       order by y.id
       limit greatest(1, least(p_lote, 500))
       for update skip locked)
    update uj.envios_push x
       set estado = 'enviando', tentativas = x.tentativas + 1,
           reservado_ate = now() + make_interval(secs => greatest(10, p_reserva_s)),
           reserva_id = gen_random_uuid()
      from escolhidos s, uj.notificacoes n, uj.aparelhos_push a
     where x.id = s.id and n.id = x.notificacao_id and a.id = x.aparelho_id
    returning x.id, x.reserva_id, a.token, a.plataforma, a.ambiente_apns, n.titulo, n.corpo,
              jsonb_build_object('comunidadeId', n.comunidade_id, 'tipo', n.tipo,
                                 'recursoTipo', n.recurso_tipo, 'recursoId', n.recurso_id,
                                 'notificacaoId', n.id);
end
$$;

drop function uj.push_concluir(bigint, text, text);
-- Só vale para o envio ainda reservado COM esta reserva. Devolve se aplicou.
create function uj.push_concluir(p_envio bigint, p_reserva uuid, p_resultado text, p_erro text)
  returns boolean
  language plpgsql security definer
  set search_path = pg_catalog, uj
  as $$
declare
  e uj.envios_push;
begin
  select * into e from uj.envios_push
   where id = p_envio and estado = 'enviando' and reserva_id = p_reserva
   for update;
  if not found then
    return false;
  end if;
  if p_resultado = 'enviado' then
    update uj.envios_push set estado = 'enviado', enviado_em = now(), erro = null,
           reservado_ate = null, reserva_id = null
     where id = p_envio;
  elsif p_resultado = 'token_invalido' then
    delete from uj.aparelhos_push where id = e.aparelho_id;
  elsif p_resultado = 'tentar_de_novo' then
    update uj.envios_push
       set estado = case when tentativas >= 5 then 'falhou' else 'pendente' end,
           proxima_em = now() + make_interval(secs => 30 * power(2, least(tentativas, 8))::int),
           erro = left(p_erro, 120), reservado_ate = null, reserva_id = null
     where id = p_envio;
  else
    update uj.envios_push set estado = 'falhou', erro = left(p_erro, 120), reservado_ate = null,
           reserva_id = null
     where id = p_envio;
  end if;
  return true;
end
$$;

-- ================================================================ B1: varredura na retenção diária

-- Igual à de 0014, mais uma varredura de segurança: pedido de oração e
-- intercessão de autora anonimizada, ou de quem não tem mais vínculo seu na
-- comunidade (saiu; o vínculo passou para a conta-fantasma), são apagados.
-- Remoção pelo admin dentro dos 30 dias mantém o vínculo com a conta: fica.
create or replace function uj.executar_retencao() returns jsonb
  language plpgsql security definer
  set search_path = pg_catalog, uj
  as $$
declare
  r jsonb := '{}'::jsonb;
  n int;
  v record;
begin
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

  return r;
end
$$;

-- ================================================================ privilégios

revoke execute on all functions in schema uj from public;
revoke execute on function uj.consumir_cota(text, int) from uj_api, uj_auth;
grant execute on function uj.so_autoria_mudou(jsonb, jsonb),
  uj.codigo_da_inscricao_publica(text, bytea), uj.cota_de_exportacao(int)
  to uj_api;
grant execute on function uj.excluir_conta(uuid, text), uj.cota_email_recuperacao(),
  uj.cota_email_convite(uuid), uj.push_reservar(int, int),
  uj.push_concluir(bigint, uuid, text, text)
  to uj_auth;
