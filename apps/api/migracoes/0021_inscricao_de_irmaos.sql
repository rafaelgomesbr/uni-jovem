-- 0021: inscrição pública de mais de uma pessoa com o mesmo WhatsApp (U-01, D45).
--
--   * A mãe que inscreve dois filhos usa o mesmo WhatsApp nas duas vezes. Até
--     aqui a chave de repetição era só o WhatsApp: o segundo filho era
--     descartado com uma página de sucesso. Agora a chave é WhatsApp mais o
--     nome normalizado (sem acento, sem diferença de maiúscula e de espaços).
--   * A mesma pessoa repetida continua sem duplicar e sem receber o código de
--     novo (M2 de 0015): a função devolve `ja_existia` e a página diz com
--     clareza que ela já está inscrita. O código só volta pelo link de
--     cancelamento.
--   * Teto de 10 inscrições ativas por WhatsApp em cada evento (UJ036): sem a
--     chave antiga, um número só não pode ocupar todas as vagas.

-- Nome para comparar repetição. IMMUTABLE porque entra no índice único.
create function uj.nome_normalizado(p_nome text) returns text
  language sql immutable strict parallel safe
  as $$
    select lower(regexp_replace(btrim(translate(p_nome,
      'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇçÑñ',
      'AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNn')), '\s+', ' ', 'g'))
  $$;

drop index uj.inscricoes_telefone_unico;
-- A mesma pessoa (WhatsApp e nome) só tem uma inscrição ativa por evento.
create unique index inscricoes_telefone_nome_unico
  on uj.inscricoes (evento_id, telefone, uj.nome_normalizado(nome))
  where estado <> 'cancelada' and telefone is not null;

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
  -- A trava do evento serializa as inscrições dele: a contagem de vagas, a
  -- checagem de repetição e o teto por WhatsApp leem o que já foi gravado.
  select ev.* into e from uj.eventos ev join uj.comunidades c on c.id = ev.comunidade_id
   where ev.id_publico = p_id_publico and ev.visibilidade = 'publica' and ev.status = 'publicado'
     and ev.inicio > now() and (ev.inscricao_ate is null or ev.inscricao_ate > now())
     and c.estado = 'ativa'
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

revoke execute on all functions in schema uj from public;
