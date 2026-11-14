-- 0003: cotas diárias no banco (sobrevivem a reinício do processo).
--
-- Uso principal: e-mail. O plano gratuito do Resend tem teto de 100 envios por
-- dia; sem cota própria, alguém com um link de convite poderia esgotar o teto
-- e parar a recuperação de senha de todo mundo. Cada finalidade tem a sua cota
-- (ex.: 'email:convite', 'email:recuperacao', 'email:convite:<id>').

create table uj.cotas_diarias (
  dia date not null default (now() at time zone 'America/Sao_Paulo')::date,
  chave text not null check (length(chave) <= 120),
  quantidade int not null default 0,
  primary key (dia, chave)
);
alter table uj.cotas_diarias enable row level security;

-- Consome uma unidade; devolve false (sem consumir) se o limite do dia acabou.
create function uj.consumir_cota(p_chave text, p_limite int) returns boolean
  language plpgsql security definer
  set search_path = pg_catalog, uj
  as $$
declare
  hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  usada int;
begin
  insert into uj.cotas_diarias (dia, chave, quantidade) values (hoje, p_chave, 0)
    on conflict (dia, chave) do nothing;
  select quantidade into usada from uj.cotas_diarias
   where dia = hoje and chave = p_chave for update;
  if usada >= p_limite then
    return false;
  end if;
  update uj.cotas_diarias set quantidade = quantidade + 1 where dia = hoje and chave = p_chave;
  return true;
end
$$;

-- Leitura para o painel do Criador (alerta a 80% da cota).
create function uj.cotas_de_hoje() returns table (chave text, quantidade int)
  language sql stable security definer
  set search_path = pg_catalog, uj
  as $$
    select chave, quantidade from uj.cotas_diarias
     where dia = (now() at time zone 'America/Sao_Paulo')::date and uj.eh_proprietario()
  $$;

revoke execute on all functions in schema uj from public;
grant execute on function uj.consumir_cota(text, int) to uj_auth, uj_api;
grant execute on function uj.cotas_de_hoje() to uj_api;
