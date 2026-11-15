# Exclusão de conta, saída, remoção e anonimização

> Especificação de engenharia e de produto, versão 0.2, de 15/11/2026, conferida contra o código na mesma data (migrações `0012`, `0014`, `0015`, `0016` e `0018`, `apps/api/src/rotas/privacidade.ts`, `apps/api/src/autenticacao/servico.ts`, `apps/app/src`). Os textos voltados à pessoa estão em `textos-de-consentimento.md` (TC-12, TC-13). A página pública `/excluir-conta` sai da seção 10 deste arquivo (`apps/api/src/publico/documentos.ts`) e está no ar em produção, com revisão jurídica pendente (PH-11).
> Estado em 15/11/2026. **Existem:** excluir conta (`POST /api/v1/eu/excluir-conta`, `uj.excluir_conta` com prova de reautenticação de uso único), sair da comunidade com o efeito do art. 16 na hora (`POST /api/v1/c/:comunidadeId/sair` e `uj.efeitos_da_saida`), efeito da remoção pelo administrador depois de 30 dias (job), exportar meus dados (`GET /api/v1/eu/exportar`), "cancelar e apagar agora" da inscrição pública (`uj.apagar_inscricao_publica`), retenção diária (`uj.executar_retencao`, contêiner `tarefas`) e a página `/excluir-conta`. **Ainda não existem** os itens marcados **[A IMPLEMENTAR]**.

## 1. Os casos, lado a lado

| Caso                                     | Quem faz                                                         | Reversível?                                              | Efeito principal                                                                                                                  |
| ---------------------------------------- | ---------------------------------------------------------------- | -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| 1. Excluir conta                         | A própria pessoa (app, web ou via `/excluir-conta`)              | **Não**                                                  | Sai de tudo, apaga dados pessoais, autoria vira "Pessoa removida"                                                                 |
| 2. Sair de comunidade                    | A própria pessoa                                                 | Só com novo convite, sem o histórico                     | Revoga o consentimento daquela comunidade; apaga oração e disponibilidade ali; histórico desligado do nome                        |
| 3. Remoção pelo administrador            | Administrador (ou Criador em intervenção)                        | Por 30 dias, com convite dirigido; depois, como o caso 2 | Perde o acesso na hora; após 30 dias, mesmo efeito do caso 2                                                                      |
| 4. Desativação de vínculo                | Administrador                                                    | Sim (convite dirigido, D14)                              | Perde o acesso; dados preservados e ocultos; após 12 meses, vira remoção **[A IMPLEMENTAR]**                                      |
| 5. Revogação de sessão ou aparelho       | A própria pessoa; automática na troca de senha ou reuso de token | Basta entrar de novo                                     | Só desconecta; nenhum dado é apagado além da sessão                                                                               |
| 6. Retenção e anonimização automáticas   | Job diário                                                       | Não                                                      | Inscrições públicas e presenças avulsas vencidas, e os prazos do mapa de dados; contas sem acesso há 24 meses **[A IMPLEMENTAR]** |
| 7. Inscrição pública: cancelar ou apagar | Quem se inscreveu, pelo link                                     | Cancelar: não; apagar: não                               | Cancelar libera a vaga; apagar anonimiza na hora                                                                                  |
| 8. Exclusão de comunidade                | Criador, com 2FA e confirmação                                   | 30 dias de carência                                      | Hoje só agenda; apagar ao fim da carência **[A IMPLEMENTAR]**                                                                     |
| 9. Conta de menor de 16                  | Operador, ao saber                                               | Não                                                      | Igual ao caso 1, com aviso à comunidade (procedimento manual; ferramenta **[A IMPLEMENTAR]**)                                     |

## 2. Caso 1: excluir conta

### 2.1 Pré-condições (a API recusa com explicação, nunca em silêncio)

- **Reautenticação:** senha sempre, e código de segundo fator se estiver ligado. Mesma mensagem genérica do login para senha errada; falha de código conta no bloqueio por conta. Limite de 5 tentativas por conta a cada 15 minutos.
- **Criador:** recusado enquanto a pessoa for a proprietária da plataforma. Mensagem: "Você é o Criador do Uni Jovem. Transfira a propriedade antes de excluir sua conta."
- **Única pessoa administradora** de comunidade que tem outras pessoas ativas: recusado com 409, `acao: nomear_admin` e a lista das comunidades. Mensagem: "Você é a única pessoa administradora de _{comunidades}_. Antes de excluir a conta, abra a lista de membros e nomeie outra pessoa como administradora." Se a pessoa é a única ativa da comunidade, não há a quem nomear e a exclusão segue.
- **Operações offline não enviadas** no aparelho: o app mostra quantas são e pede confirmação antes de descartar **[A IMPLEMENTAR]**. Hoje o fim da sessão descarta a fila e mostra a lista do que se perdeu na tela de entrada (D30).

Sem período de carência: a exclusão vale na hora em que é confirmada. Decisão: o mais protetor para a pessoa é o dado sair imediatamente; o risco de exclusão por engano ou por terceiro é tratado pela reautenticação e pelo e-mail de confirmação.

### 2.2 API

- `POST /api/v1/eu/excluir-conta`, corpo `{ senha, codigo? }` (Zod). Rota da conta, fora de `/c/:comunidadeId`.
- Respostas: `200 { ok: true }` e cookie de refresh apagado; `401` credencial errada; `409 { erro: 'conta_do_criador' }` ou `409 { erro: 'unico_admin', acao: 'nomear_admin', comunidades }`; `429` limite.
- Depois da reautenticação, o serviço grava o hash de uma prova de uso único válida por 5 minutos (`uj.provas_de_reautenticacao`) e chama `uj.excluir_conta(p_conta, p_prova)`, `SECURITY DEFINER`, com o papel `uj_auth`. Sem a prova, a função recusa (D29).
- Testes em `apps/api/test/banco/privacidade.test.ts`.

### 2.3 O que a função faz, em ordem, numa transação

1. Consome a prova; trava os vínculos e depois a linha da conta; confere `estado = 'ativa'` e as pré-condições.
2. Para cada vínculo, `uj.desligar_vinculo(v, false)`: **pedidos de oração** e **intercessões** da pessoa naquela comunidade apagados; **disponibilidades** apagadas; **substituições** abertas canceladas e **motivos** apagados; **escalas futuras** apagadas; **inscrições** em eventos futuros canceladas (promovendo a lista de espera) e `nome` de todas as inscrições trocado por "Pessoa removida"; **músicos e palestrantes** ligados ao vínculo com `nome` "Pessoa removida" e `observacoes` e `vinculo_id` nulos; **exportações**, **notificações** e **preferências de notificação** daquela comunidade apagadas; **consentimento TC-03** revogado.
3. **Vínculos**: `estado = 'removido'`, `designacoes = '{}'`, `anonimizado_em = now()`.
4. **Pedidos de oração, intercessões e exportações** que sobraram em comunidades onde o vínculo já não existia: apagados.
5. **Convites** dirigidos ao e-mail dela: `email_destino` nulo. Convites que ela criou continuam valendo (são atos da comunidade).
6. **Aparelhos de push, notificações, preferências (conta e notificação), sessões, códigos de recuperação, provas de 2FA e de reautenticação, links de senha e verificações de e-mail** (pelo e-mail): apagados.
7. **Consentimentos**: marcados como revogados agora; a linha fica como prova (mapa de dados, seção 3).
8. **Conta**: `nome = 'Pessoa removida'`, `email = 'removida-{id}@anonimizada.invalid'`, `whatsapp`, `email_verificado_em`, `senha_hash`, `totp_*`, `bloqueio_2fa_ate` e `faixa_etaria` nulos, `falhas_2fa = 0`, `estado = 'anonimizada'`, `anonimizada_em = now()`. O gatilho `uj.limpar_identidade_ao_anonimizar` apaga no mesmo momento o avatar, a **foto de perfil** (`uj.fotos_contas`) e as **contas conectadas do Google e da Apple** (`uj.contas_provedores`).
9. **Auditoria**: `conta.excluida`, com `conta_id` e sem detalhes.
10. **Lista de exclusões**: grava `(conta_id, momento)` em `uj.exclusoes_de_conta` (só o UUID; ver seção 6).

O que **fica**, ligado à conta anonimizada (sem nome, e-mail, telefone nem senha): escalas e presenças passadas, autoria de eventos, avisos, notas, sugestões, denúncias (com o detalhe escrito), conteúdos, tarefas e comandos do ao vivo, linhas de auditoria e consentimentos revogados. As telas mostram "Pessoa removida". As contagens e relatórios agregados não mudam.

Organizadores **não** recebem aviso de que uma escala futura ficou vaga **[A IMPLEMENTAR]**.

### 2.4 Depois da transação

- **E-mail de confirmação** ao endereço antigo, guardado só em memória até o envio: "Sua conta no Uni Jovem foi excluída, como você pediu. [...] Se não foi você, responda a este e-mail o quanto antes." Sem nome de comunidade. Serve de alarme se alguém excluiu a conta com a senha roubada. Depende do envio de e-mail ligado (PH-03); com `EMAIL_MODO=desligado`, não sai.
- **Aparelhos**: na próxima chamada recebem 401, e o app apaga refresh, conta salva, comunidade ativa e partições offline. Celular que não se conectar mais: os dados offline vencem em 7 dias (ou o prazo da comunidade, até 30), e a cópia da conta salva, em até 30 dias. Limite L01.
- **Registros técnicos**: não guardam nome, e-mail nem telefone; são rotativos por tamanho (`infra/prod/compose.yaml`: 3 arquivos de 10 MB por contêiner).
- **Resend**: o e-mail fica no histórico dele por 30 dias.
- **Backups**: não são editados; vencem em até cerca de 100 dias (seção 6).
- **Planilhas** que administradores já baixaram: fora do sistema, responsabilidade da comunidade (Termos, seção 9).

### 2.5 Limite honesto da anonimização

O que fica no banco não identifica a pessoa por si: não há nome, contato nem credencial, e o identificador interno é aleatório. Mas quem estava na comunidade pode deduzir quem era a "Pessoa removida" pelo contexto (por exemplo, quem tocava teclado no sábado tal). Isso é anonimização perante o sistema, não perante a memória das pessoas. [REVISÃO JURÍDICA: avaliar se esse resultado atende ao art. 12 da LGPD (dado anonimizado) ou se deve ser tratado como pseudonimizado, e se o texto das sugestões e o detalhe das denúncias devem ser apagados em vez de mantidos.]

## 3. Caso 2: sair de comunidade

`POST /api/v1/c/:comunidadeId/sair` marca o próprio vínculo como `removido` e chama `uj.efeitos_da_saida()`, que aplica `uj.desligar_vinculo(v, true)` na mesma transação, restrito àquela comunidade:

1. Pedidos de oração e intercessões da pessoa: apagados.
2. Disponibilidades e escalas futuras: apagadas; substituições abertas: canceladas; motivos: apagados.
3. Inscrições em eventos futuros: canceladas; nome nas inscrições, músicos e palestrantes: "Pessoa removida".
4. Exportações, notificações e preferências daquela comunidade: apagadas. Consentimento TC-03 daquela comunidade: revogado.
5. **Histórico desligado do nome**: o vínculo e todas as autorias naquela comunidade (eventos, séries, modelos, tarefas, checklists, notas, anexos, sugestões, avisos, conteúdos, denúncias) passam para uma conta-fantasma anonimizada criada para isso. A pessoa continua existindo; o passado dela ali é de "Pessoa removida", e um convite futuro cria um vínculo novo. A auditoria (só inserção) continua com o identificador original, sem nome. A troca de autoria não gera versão, data nem linha no log de mudanças (D29), para não revelar a autoria de sugestões anônimas e denúncias.
6. No aparelho: a partição offline daquela comunidade é apagada. A confirmação mostra o que não foi enviado (`apps/app/src/funcionalidades/comunidade/sairDaComunidade.ts`).

Por que desligar o histórico: a base para tratar esses dados era o consentimento sobre a fé, e a pessoa acabou de revogá-lo. Depois do fim do tratamento, a LGPD (art. 16) só permite conservar o dado em hipóteses restritas, e a mais próxima aqui é "uso exclusivo do controlador, desde que anonimizado". A comunidade continua com os números.

Bloqueio: a única pessoa administradora não sai enquanto houver outras pessoas ativas (mensagem do TC-12).

## 4. Casos 3 e 4: remoção e desativação pelo administrador

|                             | Remoção                                                                                                                                                | Desativação                                                                        |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| Acesso                      | Perde na hora                                                                                                                                          | Perde na hora                                                                      |
| Pedidos de oração da pessoa | Ocultos de todos na hora (a política `pedidos_oracao_ler` exige vínculo ativo do autor); **apagados após 30 dias** se a remoção não for desfeita (job) | Ocultos de todos; preservados                                                      |
| Histórico                   | Desligado do nome após 30 dias, como no caso 2 (`uj.executar_retencao`, `removido_em`)                                                                 | Preservado                                                                         |
| Volta                       | Por convite dirigido dentro dos 30 dias, com tudo de volta; depois, como pessoa nova                                                                   | Por convite dirigido (D14), com tudo de volta                                      |
| Prazo máximo                | 30 dias                                                                                                                                                | **12 meses**; depois, vira remoção, com aviso ao administrador **[A IMPLEMENTAR]** |
| Auditoria                   | `vinculo.alterado` com antes e depois (papel, estado)                                                                                                  | Idem                                                                               |
| Aparelhos                   | Na próxima sincronização, a partição daquela comunidade é apagada e o servidor rejeita operações enviadas depois da revogação                          | Idem                                                                               |

A pessoa removida ou desativada continua com a conta e com os direitos de titular: em **Perfil > Privacidade e dados > Exportar meus dados** ela recebe também o que é dela nas comunidades onde não está mais ativa (enquanto o vínculo não foi desligado), e pode pedir ao encarregado que apague antes do prazo.

Por que 30 dias na remoção: dá tempo para desfazer um engano do administrador sem manter indefinidamente dado de quem saiu. Por que 12 meses na desativação: é a pausa de quem se afastou por um tempo (intercâmbio, serviço militar) sem virar retenção eterna.

## 5. Caso 5: revogação de sessão ou aparelho

- **Perfil > Segurança > Aparelhos conectados > Desconectar** (`DELETE /api/v1/eu/aparelhos/:familia`): revoga a família de sessões daquele aparelho.
- **Sair** (`POST /api/auth/sair`): revoga a família atual e descarta as provas de 2FA; o app apaga refresh, conta salva, comunidade ativa e partições offline, e remove o token de push.
- **Automática**: troca ou redefinição de senha derruba todas as sessões; reuso de refresh derruba a família; 90 dias sem uso ou 365 dias de família encerram a sessão.
- Nenhum dado além da sessão é apagado. A linha da sessão revogada ou vencida é apagada 30 dias depois, e o aparelho de push sem sessão viva sai no mesmo job.

## 6. Caso 6: retenção automática, backups e restauração

**Job diário** (`apps/api/src/cli/tarefas-diarias.ts`, contêiner `unijovem-prod-tarefas`, conexão do dono, relatório só com contagens; PRIV-05): executa `uj.executar_retencao()` e a poda do log de mudanças com mais de 90 dias. Hoje cobre: inscrições públicas e presenças avulsas `retencao_inscricoes_dias` após o evento (P3); exportações vencidas; sessões, links de senha, códigos de verificação e provas de 2FA e de reautenticação vencidos; e-mail de convites encerrados há 30 dias; cotas com mais de 30 dias; disponibilidades com mais de 6 meses; notificações com mais de 30 dias; idempotência offline com mais de 45 dias; remoções de vínculo com mais de 30 dias (caso 3); pedidos de oração e intercessões órfãos.

Ainda faltam no job **[A IMPLEMENTAR]**:

- Contas sem nenhum acesso há **24 meses**: e-mail de aviso ("sua conta será excluída em 30 dias; entre no app para mantê-la"); sem acesso em 30 dias, executa o caso 1. Exceções: a conta do Criador e o único administrador de uma comunidade ativa (o aviso vai também ao Criador). A Política v0.2 deixou de prometer isto.
- Vínculos desativados há 12 meses viram remoção (caso 4).
- Auditoria com mais de 2 anos e consentimentos revogados há mais de 2 anos (prometidos na Política, seção 9; primeiro vencimento em 15/11/2028).

**Backups.** O `pg_dump` diário (`infra/prod/backup.sh`) guarda 7 diários, 4 semanais e 3 mensais no disco do Mac, com permissão restrita; o mais antigo tem cerca de 3 meses, então declaramos "até cerca de 100 dias". Hoje **não há cifragem** dos arquivos nem cópia externa (PH-05). Os backups não são editados. Para que uma restauração não ressuscite contas excluídas:

1. Toda exclusão de conta grava o UUID e a data em `uj.exclusoes_de_conta` (só identificador, sem dado pessoal). Existe.
2. Copiar essa lista para um arquivo à parte, junto dos backups, com retenção maior que a do backup mais antigo (por exemplo, 13 meses) **[A IMPLEMENTAR]**.
3. O runbook de restauração (`infra/prod/provar-restauracao.sh` e LEIA-ME) ganha um passo obrigatório: depois de restaurar, reaplicar o caso 1 a todo UUID da lista posterior à data do backup, e reaplicar as retenções do job diário, antes de liberar o acesso **[A IMPLEMENTAR]**.

## 7. Caso 7: inscrição pública

- **Cancelar**: pelo link de cancelamento (`/e/{idPublico}/cancelar#t=...`), libera a vaga e promove a lista de espera. Os dados ficam até o prazo de retenção.
- **Cancelar e apagar agora**: na mesma página, o botão "Cancelar e apagar meus dados agora" (`uj.apagar_inscricao_publica`) anonimiza a inscrição na hora (nome "Participante", contatos e hash nulos), revoga o consentimento TC-04 e promove a espera. Se já houver presença registrada, ela fica, sem nome.
- Sem o link: a pessoa pede à comunidade ou ao encarregado, que confirma pelo WhatsApp ou e-mail informado na inscrição.

## 8. Caso 8: exclusão de comunidade

Existe: o ciclo `ativa → suspensa → arquivada → exclusao_agendada`, com 2FA recente do Criador e o nome digitado; `exclusao_agendada_para` recebe a data de 30 dias depois. **[A IMPLEMENTAR]**: gerar a exportação para o administrador antes de agendar (hoje o operador avisa a administração, que exporta pelas telas de relatório) e, ao fim da carência, apagar todas as linhas com aquele `comunidade_id` (eventos, escalas, inscrições, presenças, oração, sugestões, denúncias, avisos, conteúdos, exportações, mudanças, consentimentos, vínculos, convites e o logotipo). A auditoria fica até completar 2 anos, com `comunidade_id` e `conta_id` apenas. Contas que só tinham vínculo nessa comunidade continuam existindo, sem comunidade; a pessoa é avisada por e-mail e pode excluir a conta. Enquanto isso não existir, o Criador não agenda exclusão de comunidade.

## 9. Caso 9: conta de menor de 16 anos

Ao saber (denúncia, informação da comunidade, declaração), o operador executa o caso 1 com motivo registrado na auditoria (sem nome nem idade no texto) e avisa os administradores das comunidades da pessoa. Não pedimos documento para provar idade. Hoje não há ferramenta para isso: `uj.excluir_conta` exige a prova de reautenticação da própria pessoa, então o operador precisa agir pelo banco com a conexão do dono **[A IMPLEMENTAR: comando de linha em `apps/api/src/cli` para o operador excluir uma conta com motivo auditado]**.

## 10. Página pública `/excluir-conta` (exigência do Google Play)

Página renderizada no servidor, como as outras públicas: funciona sem JavaScript, sem login para ler, com o mesmo CSS e CSP estrita. Pode ser indexada (o Google precisa acessá-la). URL a informar no Play Console: `https://unijovem.solerte.com.br/excluir-conta`. O texto abaixo é o publicado; os caminhos de tela foram conferidos em `apps/app/src` em 15/11/2026 (a web interna fica em `/app`, `experiments.baseUrl` de `apps/app/app.config.ts`).

**Conteúdo da página (rascunho):**

> # Excluir sua conta do Uni Jovem
>
> Uni Jovem, de Rafael Gomes.
>
> ## Pelo app
>
> Abra o Uni Jovem, toque em **Perfil > Privacidade e dados > Excluir minha conta** e confirme com sua senha (e com o código do app autenticador, se a verificação em duas etapas estiver ligada). A exclusão vale na hora e não pode ser desfeita.
> Se você for a única pessoa administradora de uma comunidade que tem outros membros, o app pede que você nomeie outra pessoa como administradora antes.
>
> ## Pela web
>
> Entre em [unijovem.solerte.com.br/app](/app) com seu e-mail e senha e siga o mesmo caminho: **Perfil > Privacidade e dados > Excluir minha conta**. Se você já estiver conectado neste navegador, [este link abre direto a tela de exclusão](/app/excluir-conta).
> Esqueceu a senha? [Recupere aqui](/app/recuperar-senha) e depois volte a esta página.
> Perdeu o acesso ao e-mail? Escreva para [contact@solerte.com.br](mailto:contact@solerte.com.br) a partir de outro endereço, dizendo o seu nome e a sua comunidade. Vamos confirmar sua identidade com a liderança da comunidade antes de excluir.
>
> ## O que é apagado na hora
>
> Nome, e-mail, WhatsApp, senha, segundo fator, foto de perfil e avatar, contas do Google ou da Apple conectadas, aparelhos conectados e notificações, pedidos de oração e as suas marcações de "estou orando", disponibilidade, escalas e inscrições em eventos futuros, e as planilhas que você exportou.
>
> ## O que fica, sem o seu nome
>
> Escalas e presenças passadas, avisos, sugestões, denúncias e outros registros que você criou numa comunidade passam a aparecer como "Pessoa removida". Os números da comunidade (quantas pessoas vieram, por exemplo) continuam.
> Registros de segurança sem seu nome (ação, data e parte do endereço IP) ficam por 2 anos. O registro dos consentimentos que você deu fica como prova, sem seus dados de contato, também por 2 anos. [IMPLEMENTAÇÃO: o expurgo de 2 anos da auditoria e dos consentimentos revogados não existe; o primeiro vencimento é em 15/11/2028]
>
> ## Prazos
>
> Depois da exclusão, enviamos um e-mail de confirmação ao endereço antigo. Cópias do seu dado fora do banco somem sozinhas: e-mails no serviço de envio, em até 30 dias; cópias de segurança, em até cerca de 100 dias. Os registros técnicos do servidor não guardam seu nome, e-mail nem telefone. Um celular que estava sem internet apaga o que guardou para uso offline na próxima conexão ou quando o prazo vence (7 dias, ou até 30, conforme a comunidade). Planilhas que a liderança da sua comunidade já tenha baixado ficam com ela.
>
> ## Quer apagar só uma parte?
>
> Sem excluir a conta, você pode apagar um pedido de oração na própria tela, sair de uma comunidade (na aba **Equipe**, toque em "Sair de" e o nome da comunidade), apagar seu WhatsApp em **Perfil > Conta** ou desconectar o Google ou a Apple em **Perfil > Segurança > Contas conectadas**. Para apagar uma sugestão ou outro dado, escreva para [contact@solerte.com.br](mailto:contact@solerte.com.br).
>
> ## Fez uma inscrição pública num evento, sem conta?
>
> Use o link de cancelamento que apareceu na confirmação da inscrição: ele tem a opção "Cancelar e apagar meus dados agora". Sem o link, fale com a organização do evento ou escreva para [contact@solerte.com.br](mailto:contact@solerte.com.br).

**Decisão:** a página não tem formulário próprio de exclusão por e-mail. Ela leva ao login da web interna, que já tem reautenticação, limites e 2FA, e a mesma função do app. Um formulário "digite seu e-mail e receba um link para excluir" criaria um segundo caminho de ataque e gastaria a cota de 100 e-mails por dia do Resend. Quem perdeu o acesso ao e-mail tem o canal do encarregado.

Limite conhecido em 15/11/2026: sem sessão, `/app/excluir-conta` leva à tela de entrada e, depois do login, a web abre o Início (não volta para a exclusão). Por isso o texto manda seguir o caminho pelo Perfil.

[REVISÃO JURÍDICA: confirmar que a página atende à política de exclusão de dados do Google Play e que a verificação de identidade pelo canal do encarregado (confirmação com a liderança da comunidade) é adequada.]

## 11. Exportar meus dados (complemento do direito de acesso)

- `GET /api/v1/eu/exportar` (D26): gera e devolve o arquivo na hora, como anexo `meus-dados-uni-jovem.json`; nada fica guardado no servidor. Limite de 10 por conta por hora. No app: **Perfil > Privacidade e dados > Exportar meus dados > Gerar arquivo** (no celular, abre a folha de compartilhamento; na web, baixa o arquivo).
- Formato JSON, com um campo `leiaMe` em texto explicando cada parte.
- Contém (`uj.exportar_meus_dados`, versão de 0018, mais a rota): conta (sem hash de senha nem segredo TOTP), avatar, foto de perfil em base64, contas conectadas do Google e da Apple (provedor, e-mail informado, datas), faixa de idade, preferências, consentimentos, vínculos (inclusive desativados e removidos ainda ligados à conta), escalas, substituições, disponibilidades, inscrições, presenças, pedidos de oração **decifrados**, intercessões feitas, sugestões (inclusive as anônimas, que são dela), avisos, notas internas, denúncias que ela fez, sessões, aparelhos de notificação e as linhas de auditoria em que ela é a autora.
- Não contém: dados de outras pessoas (de quem orou pelo pedido dela, só a contagem), autoria de sugestões anônimas alheias, conteúdo de pedidos de oração de terceiros.
- Teste (PRIV-04) em `apps/api/test/banco/privacidade.test.ts`.
