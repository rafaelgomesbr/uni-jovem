# Pendências humanas

O que só o dono do projeto pode fazer (contas, DNS, chaves, aprovações) e o que cada item bloqueia. Um agente nunca marca um item como feito: quem fecha é o dono, com a data.

Estados: **aberta** (ninguém agiu), **em andamento**, **feita em dd/mm/aaaa**, **dispensada em dd/mm/aaaa** (com motivo).

Atualizado em 14/11/2026.

| #     | Fase | Ação do dono                                                                                                                         | Bloqueia                                                          | Estado |
| ----- | ---- | ------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------- | ------ |
| PH-01 | F0   | Autorizar a criação de um repositório **privado** no GitHub. Até lá, o git fica só nesta máquina.                                    | Cópia do código fora da máquina                                   | aberta |
| PH-02 | F1   | Escolher a direção visual entre as propostas. Sem resposta em tempo razoável, adota-se a recomendada e a decisão é registrada.       | Nada (há um padrão)                                               | aberta |
| PH-03 | F3   | Criar conta gratuita no Resend e adicionar no Cloudflare os registros DNS do domínio de envio.                                       | E-mail real (o resto segue com o notificador de teste em arquivo) | aberta |
| PH-04 | F6   | Adicionar os hostnames `unijovem-hml` e `unijovem` como regras de ingress do túnel existente (sem iniciar um segundo `cloudflared`). | Homologação e produção no ar                                      | aberta |
| PH-05 | F6   | Criar um bucket gratuito no Cloudflare R2 e um token restrito a ele.                                                                 | Cópia externa dos backups                                         | aberta |
| PH-06 | F6   | Liberar o acesso `ssh mac-cityhall` para o deploy.                                                                                   | Deploy em homologação e produção                                  | aberta |
| PH-07 | F6   | Rodar `eas init` do projeto na conta Expo do dono (interativo, se pedir).                                                            | Builds                                                            | aberta |
| PH-08 | F14  | Criar o projeto Firebase (FCM) e a chave APNs `.p8` do Uni Jovem; criar a chave do Google Maps restrita por app.                     | Push real e mapa no Android                                       | aberta |
| PH-09 | F19  | Criar o app no App Store Connect e no Play Console.                                                                                  | Lojas                                                             | aberta |
| PH-10 | F19  | Aprovar **cada** envio, um por vez: distribuição de teste (TestFlight interno ou Play interno), envio para revisão e publicação.     | Lojas                                                             | aberta |
| PH-11 | F20  | Encomendar revisão jurídica da política de privacidade, dos termos e dos textos de consentimento.                                    | Qualquer declaração de conformidade legal                         | aberta |
