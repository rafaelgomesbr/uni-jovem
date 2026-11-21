# ADR 0008: Cadastro simplificado sem confirmação de e-mail nesta etapa

- Estado: aceita, temporária.
- Data: 17/11/2026.
- Decisão do dono: "permite login com google e ios cadastro simplificado. Permite nesse primeiro momento criar sem confirmar email. depois eu ajusto esse ponto".

## Decisão

O cadastro por senha deixa de depender do envio de e-mail. Nome, e-mail, senha, faixa etária e aceites criam a conta e abrem a sessão. No convite, a mesma transação cria a conta e o vínculo, consome o convite e registra o consentimento sobre a fé. Permanecem a declaração de idade, a ciência do responsável para 16 e 17 anos e os limites de tentativas. A web mantém o desafio de segurança no cadastro público.

`CADASTRO_SIMPLIFICADO` em `packages/dominio` é a política desta etapa. O banco expõe a mesma política em `uj.cadastro_simplificado_habilitado()`. Contas criadas por senha continuam com `email_verificado_em = null`; a aplicação não afirma que o endereço foi verificado. Contas por Google e Apple usam a confirmação de posse assinada pelo provedor, sem enviar outro código.

Criar comunidade também dispensa a confirmação de e-mail nesta etapa, para não bloquear a pessoa imediatamente depois do cadastro. Permanecem a idade mínima de 18 para criar comunidade, os aceites e os limites das comunidades novas.

As rotas com código continuam existindo para compatibilidade e retomada futura. As telas atualizadas usam `POST /api/auth/cadastro/criar` e `POST /api/auth/convite/criar`, sem chamar o envio de código.

## Limites mantidos

- Cadastro não sobrescreve conta já existente nem sua senha.
- Convite errado, vencido, usado ou destinado a outro e-mail desfaz a transação inteira.
- Login por provedor não conecta automaticamente a uma conta com e-mail ainda não confirmado; a conexão a partir de uma conta existente requer sua autenticação.
- Menor de 16 continua impedido de criar conta; a simplificação não retira os consentimentos.

## Retomada futura

Para voltar a exigir confirmação, revisar a política compartilhada e a função do banco na mesma migração, reativar o fluxo de código e configurar o envio real. O suporte a SMTP permanece disponível; a senha de app do Gmail deixa de bloquear o cadastro simplificado.
