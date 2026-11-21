# Envio de códigos pelo SMTP existente

O serviço de envio roda na própria API, no Mac. `EMAIL_MODO=smtp` usa uma conta SMTP existente, com TLS obrigatório. Não é preciso contratar Resend nem abrir um servidor SMTP para a internet.

O encaminhamento de entrada do Cloudflare continua independente. Ele não configura automaticamente a autenticação de saída da aplicação.

## Configuração

Preencher somente no arquivo de segredos, fora do Git:

```dotenv
EMAIL_MODO=smtp
SMTP_HOST=smtp.gmail.com
SMTP_PORTA=587
SMTP_USUARIO=conta-de-envio
SMTP_SENHA=
EMAIL_REMETENTE="Uni Jovem <endereco-da-conta-de-envio>"
```

No Gmail, usar uma senha de app, com verificação em duas etapas habilitada. Nunca usar a senha principal da conta. A geração é feita pelo dono em [Senhas de app do Google](https://myaccount.google.com/apppasswords). Orientações e restrições em [Ajuda da Conta do Google](https://support.google.com/accounts/answer/185833?hl=pt-BR).

O remetente precisa ser a conta autenticada ou um endereço de envio autorizado por ela. O endereço que só recebe encaminhamento não se torna um remetente autorizado automaticamente.

Para outro provedor, usar o host e a porta indicados por ele. A porta 465 usa TLS desde a conexão; a 587 exige STARTTLS. A aplicação não desliga a validação do certificado e não permite autenticação sem TLS.

## Ativação

1. Validar os quatro campos obrigatórios e a porta. Manter os arquivos de segredo com permissão 600 no Mac.
2. Guardar uma cópia protegida da configuração anterior.
3. Atualizar somente as variáveis de e-mail no `.env` da stack `unijovem-prod`.
4. Validar a autenticação SMTP antes de recriar `api` e `tarefas`. Se falhar, restaurar o arquivo anterior.
5. Recriar os dois serviços com o compose da própria stack e conferir `/api/saude`.
6. Testar código de cadastro e convite, conclusão do cadastro e reenvio. Confirmar recebimento na caixa de entrada ou spam. Não registrar códigos, senha ou conteúdo das mensagens no log.

Credenciais SMTP não entram no app, no bundle web ou no TestFlight. Ficam exclusivamente no servidor.
