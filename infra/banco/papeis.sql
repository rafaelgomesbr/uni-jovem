-- Papéis e banco do Uni Jovem. Rodado UMA vez por cluster, como superusuário,
-- com as senhas passadas por variável do psql (nunca escritas aqui):
--
--   psql -v senha_dono="$UJ_SENHA_DONO" -v senha_api="$UJ_SENHA_API" \
--        -v senha_auth="$UJ_SENHA_AUTH" -f infra/banco/papeis.sql
--
-- uj_dono  dono do esquema; usado só pelo executor de migrações.
-- uj_api   aplicativo; sujeito a RLS (NOBYPASSRLS, não é dono).
-- uj_auth  autenticação e convites; sujeito a RLS, acesso só a identidade.

create role uj_dono login password :'senha_dono' nosuperuser nocreatedb nocreaterole nobypassrls;
create role uj_api login password :'senha_api' nosuperuser nocreatedb nocreaterole nobypassrls;
create role uj_auth login password :'senha_auth' nosuperuser nocreatedb nocreaterole nobypassrls;

-- Transação esquecida aberta seguraria o cursor de sincronização de todos
-- (ADR 0005): o banco encerra a sessão ociosa em transação e a consulta longa.
alter role uj_api set statement_timeout = '15s';
alter role uj_api set idle_in_transaction_session_timeout = '30s';
alter role uj_api set lock_timeout = '5s';
alter role uj_auth set statement_timeout = '15s';
alter role uj_auth set idle_in_transaction_session_timeout = '30s';
alter role uj_auth set lock_timeout = '5s';

create database unijovem owner uj_dono;
revoke all on database unijovem from public;
grant connect on database unijovem to uj_api, uj_auth;
