-- 0002: projeções de pessoas da comunidade, resumo para o Criador e
-- transferência de propriedade. Segue o padrão do cabeçalho de 0001.

-- ---------------------------------------------------------------- pessoas da comunidade

-- `uj_api` só lê a PRÓPRIA linha de `contas`. Os nomes dos outros membros saem
-- por esta função, que só responde na comunidade do contexto, a quem tem
-- vínculo ativo, e só entrega e-mail e WhatsApp a partir de Organizador.
create function uj.pessoas_da_comunidade()
  returns table (vinculo_id uuid, conta_id uuid, nome text, papel text, estado text,
                 designacoes text[], email text, whatsapp text, eh_proprietario boolean,
                 desde timestamptz)
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
           v.criado_em
      from uj.vinculos v
      join uj.contas a on a.id = v.conta_id
      cross join eu
     where v.comunidade_id = uj.comunidade_atual()
       and eu.nivel >= 10
       -- Membros veem só vínculos ativos; quem administra vê também os inativos.
       and (v.estado = 'ativo' or eu.nivel >= 30)
  $$;

-- ---------------------------------------------------------------- resumo para o Criador

-- Números agregados de todas as comunidades, sem nomes de pessoas: o Criador
-- acompanha a operação sem ler quem participa de cada comunidade.
create function uj.resumo_das_comunidades()
  returns table (id uuid, nome text, cor text, estado text, exclusao_agendada_para timestamptz,
                 membros_ativos int, admins_ativos int, criado_em timestamptz)
  language sql stable security definer
  set search_path = pg_catalog, uj
  as $$
    select c.id, c.nome, c.cor, c.estado, c.exclusao_agendada_para,
           (select count(*)::int from uj.vinculos v join uj.contas a on a.id = v.conta_id
             where v.comunidade_id = c.id and v.estado = 'ativo' and a.estado = 'ativa'),
           (select count(*)::int from uj.vinculos v join uj.contas a on a.id = v.conta_id
             where v.comunidade_id = c.id and v.estado = 'ativo' and v.papel = 'admin'
               and a.estado = 'ativa'),
           c.criado_em
      from uj.comunidades c
     where uj.eh_proprietario()
     order by c.nome
  $$;

-- ---------------------------------------------------------------- transferência de propriedade

-- Fluxo: o Criador inicia (2FA) indicando uma conta com 2FA ativo; o
-- destinatário aceita (2FA); passadas 72 h do início, qualquer um dos dois
-- conclui. Qualquer um cancela antes. Tudo auditado.
-- Erros: UJ010 destino inválido, UJ011 sem transferência aberta, UJ012 cedo demais.

create function uj.iniciar_transferencia(p_email_destino text) returns uuid
  language plpgsql security definer
  set search_path = pg_catalog, uj
  as $$
declare
  destino uuid;
  t uuid;
begin
  if not uj.eh_proprietario() then
    raise exception 'so o proprietario transfere' using errcode = '42501';
  end if;
  select id into destino from uj.contas
   where email = lower(btrim(p_email_destino)) and estado = 'ativa'
     and totp_ativado_em is not null and id <> uj.conta_atual();
  if destino is null then
    raise exception 'destino invalido' using errcode = 'UJ010';
  end if;
  insert into uj.transferencias_propriedade (de_conta, para_conta, efetiva_apos)
    values (uj.conta_atual(), destino, now() + interval '72 hours')
  returning id into t;
  insert into uj.auditoria (conta_id, acao, recurso_tipo, recurso_id, detalhes)
    values (uj.conta_atual(), 'plataforma.transferencia_iniciada', 'transferencia', t::text,
            jsonb_build_object('para', destino));
  return t;
end
$$;

create function uj.transferencia_aberta()
  returns table (id uuid, de_conta uuid, para_conta uuid, para_nome text, criado_em timestamptz,
                 efetiva_apos timestamptz, aceita_em timestamptz)
  language sql stable security definer
  set search_path = pg_catalog, uj
  as $$
    select t.id, t.de_conta, t.para_conta, a.nome, t.criado_em, t.efetiva_apos, t.aceita_em
      from uj.transferencias_propriedade t join uj.contas a on a.id = t.para_conta
     where t.cancelada_em is null and t.concluida_em is null
       and (t.para_conta = uj.conta_atual() or uj.eh_proprietario())
  $$;

create function uj.cancelar_transferencia() returns void
  language plpgsql security definer
  set search_path = pg_catalog, uj
  as $$
declare
  t uj.transferencias_propriedade;
begin
  select * into t from uj.transferencias_propriedade
   where cancelada_em is null and concluida_em is null for update;
  if not found or not (uj.eh_proprietario() or t.para_conta = uj.conta_atual()) then
    raise exception 'sem transferencia aberta' using errcode = 'UJ011';
  end if;
  update uj.transferencias_propriedade set cancelada_em = now() where id = t.id;
  insert into uj.auditoria (conta_id, acao, recurso_tipo, recurso_id)
    values (uj.conta_atual(), 'plataforma.transferencia_cancelada', 'transferencia', t.id::text);
end
$$;

-- O aceite exige a prova de 2FA do DESTINATÁRIO (app.prova da conta atual),
-- conferida aqui porque o destinatário ainda não é proprietário.
create function uj.tem_prova_recente() returns boolean
  language sql stable security definer
  set search_path = pg_catalog, uj
  as $$
    select exists (
      select 1 from uj.provas_de_plataforma p
       where p.conta_id = uj.conta_atual() and p.expira_em > now()
         and p.prova_hash = sha256(convert_to(coalesce(current_setting('app.prova', true), ''), 'UTF8')))
  $$;

create function uj.aceitar_transferencia() returns void
  language plpgsql security definer
  set search_path = pg_catalog, uj
  as $$
declare
  t uj.transferencias_propriedade;
begin
  select * into t from uj.transferencias_propriedade
   where cancelada_em is null and concluida_em is null and para_conta = uj.conta_atual()
   for update;
  if not found or not uj.tem_prova_recente() then
    raise exception 'sem transferencia aberta' using errcode = 'UJ011';
  end if;
  update uj.transferencias_propriedade set aceita_em = now() where id = t.id;
  insert into uj.auditoria (conta_id, acao, recurso_tipo, recurso_id)
    values (uj.conta_atual(), 'plataforma.transferencia_aceita', 'transferencia', t.id::text);
end
$$;

create function uj.concluir_transferencia() returns void
  language plpgsql security definer
  set search_path = pg_catalog, uj
  as $$
declare
  t uj.transferencias_propriedade;
begin
  select * into t from uj.transferencias_propriedade
   where cancelada_em is null and concluida_em is null for update;
  if not found or t.aceita_em is null
     or not (uj.eh_proprietario() or (t.para_conta = uj.conta_atual() and uj.tem_prova_recente())) then
    raise exception 'sem transferencia aberta' using errcode = 'UJ011';
  end if;
  if t.efetiva_apos > now() then
    raise exception 'ainda no prazo de espera' using errcode = 'UJ012';
  end if;
  -- Ordem importa: o índice único só admite um proprietário.
  update uj.contas set plataforma_proprietario = false where id = t.de_conta;
  update uj.contas set plataforma_proprietario = true where id = t.para_conta;
  update uj.transferencias_propriedade set concluida_em = now() where id = t.id;
  insert into uj.auditoria (conta_id, acao, recurso_tipo, recurso_id, detalhes)
    values (uj.conta_atual(), 'plataforma.transferencia_concluida', 'transferencia', t.id::text,
            jsonb_build_object('de', t.de_conta, 'para', t.para_conta));
end
$$;

-- Destinatário precisa poder gravar a própria prova de 2FA (como o Criador faz).
-- Já coberto por `provas_auth_inserir` em 0001 (uj_auth insere para qualquer conta
-- depois de conferir o TOTP na API).

revoke execute on all functions in schema uj from public;
grant execute on function uj.pessoas_da_comunidade(), uj.resumo_das_comunidades(),
  uj.iniciar_transferencia(text), uj.transferencia_aberta(), uj.cancelar_transferencia(),
  uj.tem_prova_recente(), uj.aceitar_transferencia(), uj.concluir_transferencia()
  to uj_api;
