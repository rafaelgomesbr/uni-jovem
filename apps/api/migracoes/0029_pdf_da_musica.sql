-- 0029: PDF anexado à música (D76). Segue o padrão do cabeçalho de 0001
-- (comunidade_id, índice por comunidade, RLS por contexto com InitPlan, log de
-- mudanças).
--
--   * UM PDF POR MÚSICA (cifra ou partitura que o músico já tem em arquivo). Trocar
--     é regravar a mesma linha; remover apaga a linha. O texto da cifra (0027)
--     continua existindo: a música pode ter as duas coisas.
--   * NO PRÓPRIO POSTGRES (bytea), como as imagens de 0018: sem armazenamento
--     externo e sem custo (D4); o arquivo entra no backup do banco e fica sob as
--     mesmas regras de acesso (RLS) do resto. Teto de 10 MB por arquivo. Se o
--     volume crescer, o caminho é o armazenamento de objetos (ADR da D33).
--   * O BANCO NÃO INTERPRETA O PDF: só confere o que dá para conferir sem abrir o
--     arquivo (assinatura `%PDF-` nos primeiros bytes, tamanho e o SHA-256 do
--     conteúdo, que é a versão do arquivo e o ETag da resposta).
--   * DIREITOS AUTORAIS: gravar ou trocar o PDF exige a MESMA confirmação de
--     direitos da cifra em texto (`direito_confirmado_em` renovado na mesma
--     gravação). A rota pede a confirmação com mensagem clara; o gatilho abaixo é
--     a segunda camada (mesmo código UJ100 de 0027), para que nem uma rota
--     esquecida grave um PDF sem o aceite.
--   * QUEM LÊ: quem lê a música (vínculo ativo, nível 10, como `musicas`).
--     QUEM GRAVA E REMOVE: organizador para cima, na comunidade ativa.
--   * O log de mudanças leva só o id: nunca o nome do arquivo nem o conteúdo.
--   * Apagar a música (ou a comunidade, `apagar_comunidade` apaga as músicas)
--     apaga o PDF junto, por `on delete cascade`.
--
-- Códigos de erro: UJ100 PDF sem confirmação de direitos (o de 0027).

create table uj.musica_pdfs (
  id uuid primary key default gen_random_uuid(),
  comunidade_id uuid not null references uj.comunidades (id),
  musica_id uuid not null unique references uj.musicas (id) on delete cascade,
  -- Só para a tela dizer "PDF anexado (nome, tamanho)": a API já tira caminho e
  -- caracteres de controle. Nunca vai para log nem para auditoria.
  nome text not null check (length(nome) between 1 and 120),
  conteudo bytea not null check (octet_length(conteudo) between 8 and 10485760),
  tamanho int not null check (tamanho = octet_length(conteudo)),
  hash bytea not null check (hash = sha256(conteudo)),
  direito_confirmado_em timestamptz not null,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  -- `%PDF-`
  check (substring(conteudo from 1 for 5) = '\x255044462d'::bytea)
);
create index musica_pdfs_comunidade on uj.musica_pdfs (comunidade_id, musica_id);

-- O PDF já vem comprimido: tentar comprimir de novo (pglz) só gasta CPU.
alter table uj.musica_pdfs alter column conteudo set storage external;

create trigger musica_pdfs_atualizado before update on uj.musica_pdfs
  for each row execute function uj.tocar_atualizado_em();

-- Música e PDF são sempre da MESMA comunidade.
create function uj.guardar_musica_pdf() returns trigger
  language plpgsql security definer
  set search_path = pg_catalog, uj
  as $$
begin
  if not exists (select 1 from uj.musicas where id = new.musica_id and comunidade_id = new.comunidade_id) then
    raise exception 'pdf com musica de outra comunidade' using errcode = '23503';
  end if;
  return new;
end
$$;
create trigger musica_pdfs_guardar before insert or update on uj.musica_pdfs
  for each row execute function uj.guardar_musica_pdf();

-- Direitos: SEM `security definer`, para `current_user` ser quem gravou (como em
-- uj.guardar_musica, de 0027). O dono do banco (sementes e migrações) fica de fora.
create function uj.exigir_direitos_do_pdf() returns trigger
  language plpgsql
  set search_path = pg_catalog, uj
  as $$
begin
  if current_user = 'uj_dono' then
    return new;
  end if;
  if (tg_op = 'INSERT' or new.conteudo is distinct from old.conteudo)
     and (new.direito_confirmado_em is null
          or (tg_op = 'UPDATE'
              and new.direito_confirmado_em is not distinct from old.direito_confirmado_em)) then
    raise exception 'confirme o direito de uso da letra e da cifra' using errcode = 'UJ100';
  end if;
  return new;
end
$$;
create trigger musica_pdfs_direitos before insert or update on uj.musica_pdfs
  for each row execute function uj.exigir_direitos_do_pdf();

-- Log de mudanças: só o id (a tabela é nova para o aparelho, que só conta as mudanças).
create trigger musica_pdfs_mudanca after insert or update or delete on uj.musica_pdfs
  for each row execute function uj.registrar_mudanca('10');

-- ---------------------------------------------------------------- RLS e políticas

alter table uj.musica_pdfs enable row level security;

create policy musica_pdfs_ler on uj.musica_pdfs for select to uj_api
  using (comunidade_id = (select uj.comunidade_atual()) and (select uj.nivel_no_contexto()) >= 10);
create policy musica_pdfs_gravar on uj.musica_pdfs for all to uj_api
  using (comunidade_id = (select uj.comunidade_atual()) and (select uj.nivel_gravavel_no_contexto()) >= 20)
  with check (comunidade_id = (select uj.comunidade_atual()) and (select uj.nivel_gravavel_no_contexto()) >= 20);

-- ---------------------------------------------------------------- privilégios

revoke execute on all functions in schema uj from public;

grant select, delete on uj.musica_pdfs to uj_api;
grant insert (comunidade_id, musica_id, nome, conteudo, tamanho, hash, direito_confirmado_em),
  update (nome, conteudo, tamanho, hash, direito_confirmado_em) on uj.musica_pdfs to uj_api;
