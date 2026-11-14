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

create database unijovem owner uj_dono;
revoke all on database unijovem from public;
grant connect on database unijovem to uj_api, uj_auth;
