-- 0016: vínculos de provedor de identidade (Google, Apple) e avatar da conta.
-- Segue o padrão do cabeçalho de 0001.
--
-- PROVEDORES: entrar com Google ou Apple nunca cria conta (entrada só por
-- convite). O vínculo liga o `sub` do provedor a uma conta que já existe; só
-- `uj_auth` lê e escreve esta tabela (identidade), nunca `uj_api`.
-- Desconectar não apaga a linha: marca `desconectado_em` e limpa o e-mail. A
-- linha marcada impede que o mesmo provedor volte a entrar na conta só pelo
-- e-mail igual (quem desconectou não quer mais essa porta aberta); conectar
-- de novo, na tela de segurança e com a senha, reabre.
--
-- AVATAR: ícone de uma lista fechada sobre uma cor de uma paleta fechada
-- (nomes de packages/tokens/src/avatar.ts; o teste `provedores-e-avatar`
-- confere que as listas daqui e de lá são iguais). Sem foto: não há
-- armazenamento de arquivos ainda (D17).

-- ---------------------------------------------------------------- vínculos de provedor

create table uj.contas_provedores (
  id uuid primary key default gen_random_uuid(),
  conta_id uuid not null references uj.contas (id),
  provedor text not null check (provedor in ('google', 'apple')),
  -- Identificador estável da pessoa no provedor (claim `sub` do ID token).
  sub text not null check (length(sub) between 1 and 255),
  -- O e-mail que o provedor informou ao conectar (pode ser o de retransmissão
  -- privada da Apple). Só para a pessoa reconhecer a conta conectada.
  email_informado text check (email_informado = lower(email_informado)
                              and length(email_informado) <= 254),
  criado_em timestamptz not null default now(),
  ultimo_uso_em timestamptz,
  desconectado_em timestamptz,
  check (desconectado_em is null or email_informado is null),
  unique (provedor, sub),
  unique (conta_id, provedor)
);

alter table uj.contas_provedores enable row level security;
create policy contas_provedores_auth on uj.contas_provedores to uj_auth
  using (true) with check (true);

grant select, insert on uj.contas_provedores to uj_auth;
grant update (sub, email_informado, criado_em, ultimo_uso_em, desconectado_em)
  on uj.contas_provedores to uj_auth;

-- ---------------------------------------------------------------- avatar

alter table uj.contas
  add column avatar_icone text check (avatar_icone in (
    'nascer', 'sol', 'lua', 'estrela', 'coracao', 'chama', 'folha', 'flor', 'montanha', 'onda',
    'nuvem', 'raio', 'musica', 'microfone', 'livro', 'cafe', 'bola', 'jogo', 'paleta', 'camera',
    'aviao', 'bicicleta', 'pata', 'globo')),
  add column avatar_cor text check (avatar_cor in (
    'aurora', 'violeta', 'noite', 'verde', 'azul', 'rosa', 'petroleo', 'ambar', 'pessego',
    'lilas', 'menta', 'ceu')),
  -- Os dois juntos ou nenhum: avatar pela metade não existe.
  add constraint contas_avatar_completo check ((avatar_icone is null) = (avatar_cor is null));

grant update (avatar_icone, avatar_cor) on uj.contas to uj_api;

-- Trocar o avatar muda o que os outros membros veem (lista de pessoas, offline).
drop trigger contas_mudanca on uj.contas;
create trigger contas_mudanca
  after update of nome, whatsapp, estado, avatar_icone, avatar_cor on uj.contas
  for each row execute function uj.registrar_mudanca_de_conta();

-- ---------------------------------------------------------------- conta anonimizada

-- Excluir a conta (uj.excluir_conta) anonimiza a linha. Aqui, no mesmo
-- momento, saem o avatar e todos os vínculos de provedor: o `sub` do Google ou
-- da Apple identifica a pessoa e não pode sobreviver à exclusão.
create function uj.limpar_identidade_ao_anonimizar() returns trigger
  language plpgsql security definer
  set search_path = pg_catalog, uj
  as $$
begin
  if new.estado = 'anonimizada' and old.estado is distinct from 'anonimizada' then
    new.avatar_icone := null;
    new.avatar_cor := null;
    delete from uj.contas_provedores where conta_id = new.id;
  end if;
  return new;
end
$$;
create trigger contas_limpar_identidade before update of estado on uj.contas
  for each row execute function uj.limpar_identidade_ao_anonimizar();

-- ---------------------------------------------------------------- pessoas da comunidade

-- Igual à de 0002, com o avatar no fim (só de conta ativa).
drop function uj.pessoas_da_comunidade();
create function uj.pessoas_da_comunidade()
  returns table (vinculo_id uuid, conta_id uuid, nome text, papel text, estado text,
                 designacoes text[], email text, whatsapp text, eh_proprietario boolean,
                 desde timestamptz, avatar_icone text, avatar_cor text)
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
           case when a.estado = 'ativa' then a.avatar_cor end
      from uj.vinculos v
      join uj.contas a on a.id = v.conta_id
      cross join eu
     where v.comunidade_id = uj.comunidade_atual()
       and eu.nivel >= 10
       -- Membros veem só vínculos ativos; quem administra vê também os inativos.
       and (v.estado = 'ativo' or eu.nivel >= 30)
  $$;

revoke execute on function uj.pessoas_da_comunidade() from public;
grant execute on function uj.pessoas_da_comunidade() to uj_api;
