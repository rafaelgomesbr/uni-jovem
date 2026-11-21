-- Pedido do dono em 17/11/2026: cadastrar sem confirmar e-mail nesta etapa.
-- A conta continua explicitamente NÃO verificada; só uj_auth pode criá-la.
create function uj.criar_conta_sem_confirmacao(p_nome text, p_email text, p_senha_hash text,
                                               p_whatsapp text)
  returns uuid
  language plpgsql security definer
  set search_path = pg_catalog, uj
  as $$
declare nova uuid;
begin
  if exists (select 1 from uj.contas where email = lower(p_email)) then
    raise exception 'e-mail ja possui conta' using errcode = 'UJ005';
  end if;
  insert into uj.contas (nome, email, senha_hash, whatsapp)
    values (btrim(p_nome), lower(p_email), p_senha_hash, p_whatsapp)
    returning id into nova;
  return nova;
exception when unique_violation then
  raise exception 'e-mail ja possui conta' using errcode = 'UJ005';
end
$$;
revoke all on function uj.criar_conta_sem_confirmacao(text, text, text, text) from public;
grant execute on function uj.criar_conta_sem_confirmacao(text, text, text, text) to uj_auth;

-- Mesma pol?tica tempor?ria do dom?nio, conferida por teste.
create function uj.cadastro_simplificado_habilitado() returns boolean
  language sql immutable as $$ select true $$;
revoke all on function uj.cadastro_simplificado_habilitado() from public;
grant execute on function uj.cadastro_simplificado_habilitado() to uj_api, uj_auth;

create or replace function uj.criar_comunidade_aberta(p_nome text, p_cor text, p_cidade text, p_fuso text,
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
  if conta.email_verificado_em is null and not uj.cadastro_simplificado_habilitado() then
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
