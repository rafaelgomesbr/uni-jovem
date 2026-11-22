-- 0031: links do Google Drive e do YouTube na música (D80). Segue o padrão do
-- cabeçalho de 0001 (comunidade_id, RLS por contexto, log de mudanças).
--
--   * `uj.musicas.links` (jsonb): uma lista de até 3 entradas `{ url, rotulo? }`. A
--     coluna mora na própria música, então a RLS (`musicas_ler`: vínculo ativo,
--     nível 10; `musicas_gravar`: organizador para cima), o log de mudanças e a
--     cópia do repertório de um encontro para outro valem sem política nova. Uma
--     tabela à parte só daria mais uma política para errar.
--   * SÓ HTTPS E SÓ ESTES ENDEREÇOS: drive.google.com, docs.google.com,
--     youtube.com (também www. e m.), music.youtube.com e youtu.be. Nada de
--     usuário e senha na URL (`https://a:b@...`), porta, barra invertida, espaço
--     ou caractere de controle, nada de javascript:, data: ou http:. O servidor
--     precisa ser exatamente um da lista: `youtube.com.outro.site` não passa. A
--     lista é a mesma de `packages/dominio/src/links-de-musica.ts` (que o app e a
--     API usam antes de chegar aqui): o banco é a terceira camada, para que nem
--     uma rota esquecida grave um endereço qualquer.
--   * O `link` antigo (um só, qualquer https, de 0009) fica como está para quem
--     ainda o tem: o que cabe na regra nova vai para `links` e sai de `link`; o
--     que não cabe continua lá, só para leitura, e o app oferece apagá-lo. Daqui
--     em diante `link` só recebe um valor que passa na mesma regra.
--   * O endereço nunca vai para log nem para auditoria: o log de mudanças leva só
--     o id (já era assim) e a auditoria da rota leva o id da música e a contagem.
--
-- Código de erro: UJ103 link da música fora da regra (a API responde 400).

-- ---------------------------------------------------------------- a regra do endereço

-- Um endereço só. Sem `security definer`: é uma conta sobre o próprio texto.
create function uj.link_de_musica_valido(p_url text) returns boolean
  language sql immutable parallel safe
  set search_path = pg_catalog
  as $$
  select p_url is not null
     and length(p_url) <= 2000
     and p_url ~* '^https://(drive\.google\.com|docs\.google\.com|youtube\.com|www\.youtube\.com|m\.youtube\.com|music\.youtube\.com|youtu\.be)([/?#]|$)'
     and p_url !~ '[[:space:][:cntrl:]\u0080-\u009f\u2028\u2029]'
$$;

-- A lista inteira: no máximo 3 entradas, cada uma só com `url` (válida) e `rotulo`
-- (texto de 1 a 40 letras, sem controle), nada além disso.
create function uj.links_de_musica_validos(p_links jsonb) returns boolean
  language plpgsql immutable
  set search_path = pg_catalog, uj
  as $$
declare
  entrada jsonb;
  chave text;
  nome text;
begin
  if p_links is null or jsonb_typeof(p_links) <> 'array' or jsonb_array_length(p_links) > 3 then
    return false;
  end if;
  for entrada in select value from jsonb_array_elements(p_links) loop
    if jsonb_typeof(entrada) <> 'object' then
      return false;
    end if;
    for chave in select jsonb_object_keys(entrada) loop
      if chave not in ('url', 'rotulo') then
        return false;
      end if;
    end loop;
    if jsonb_typeof(entrada -> 'url') is distinct from 'string'
       or not uj.link_de_musica_valido(entrada ->> 'url') then
      return false;
    end if;
    if jsonb_exists(entrada, 'rotulo') then
      if jsonb_typeof(entrada -> 'rotulo') is distinct from 'string' then
        return false;
      end if;
      nome := entrada ->> 'rotulo';
      if length(btrim(nome)) = 0 or length(nome) > 40 or nome ~ '[[:cntrl:]]' then
        return false;
      end if;
    end if;
  end loop;
  return true;
end
$$;

-- ---------------------------------------------------------------- músicas

alter table uj.musicas
  add column links jsonb not null default '[]'::jsonb
    -- Só builtins no CHECK (o resto da regra mora no gatilho, que não pede EXECUTE a quem grava).
    check (jsonb_typeof(links) = 'array' and jsonb_array_length(links) <= 3);

-- `security definer` porque o gatilho chama as funções acima, que o papel da API não executa
-- direto; ele só lê o `new` e devolve o `new`.
create function uj.guardar_links_da_musica() returns trigger
  language plpgsql security definer
  set search_path = pg_catalog, uj
  as $$
begin
  if not uj.links_de_musica_validos(new.links) then
    raise exception 'links da musica fora da regra' using errcode = 'UJ103';
  end if;
  if new.link is not null
     and (tg_op = 'INSERT' or new.link is distinct from old.link)
     and not uj.link_de_musica_valido(new.link) then
    raise exception 'link da musica fora da regra' using errcode = 'UJ103';
  end if;
  return new;
end
$$;
create trigger musicas_links before insert or update on uj.musicas
  for each row execute function uj.guardar_links_da_musica();

-- O link antigo que cabe na regra nova vira o primeiro item de `links`.
update uj.musicas
   set links = jsonb_build_array(jsonb_build_object('url', link)),
       link = null
 where link is not null
   and links = '[]'::jsonb
   and uj.link_de_musica_valido(link);

-- ---------------------------------------------------------------- privilégios

revoke execute on all functions in schema uj from public;

grant insert (links), update (links) on uj.musicas to uj_api;
