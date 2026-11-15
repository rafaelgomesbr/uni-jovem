# Exclusão de conta, saída, remoção e anonimização

> Especificação de engenharia e de produto, versão 0.1, de 14/11/2026. Os textos voltados à pessoa estão em `textos-de-consentimento.md` (TC-12, TC-13). A página pública `/excluir-conta` (seção 8) é rascunho para revisão jurídica (PH-11).
> Estado em 14/11/2026: existem "sair da comunidade" (`POST /api/v1/c/:comunidadeId/sair`), alterar papel e estado do vínculo (`PATCH /api/v1/c/:comunidadeId/membros/:vinculoId`), revogar aparelho (`DELETE /api/v1/eu/aparelhos/:familia`), sair (`POST /api/auth/sair`) e a anonimização de inscrições públicas (`uj.anonimizar_inscricoes_vencidas()`). Todo o resto marcado **[A IMPLEMENTAR]**.

## 1. Os casos, lado a lado

| Caso                                     | Quem faz                                                         | Reversível?                                              | Efeito principal                                                                                           |
| ---------------------------------------- | ---------------------------------------------------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| 1. Excluir conta                         | A própria pessoa (app, web ou via `/excluir-conta`)              | **Não**                                                  | Sai de tudo, apaga dados pessoais, autoria vira "Pessoa removida"                                          |
| 2. Sair de comunidade                    | A própria pessoa                                                 | Só com novo convite, sem o histórico                     | Revoga o consentimento daquela comunidade; apaga oração e disponibilidade ali; histórico desligado do nome |
| 3. Remoção pelo administrador            | Administrador (ou Criador em intervenção)                        | Por 30 dias, com convite dirigido; depois, como o caso 2 | Perde o acesso na hora; após 30 dias, mesmo efeito do caso 2                                               |
| 4. Desativação de vínculo                | Administrador                                                    | Sim (convite dirigido, D14)                              | Perde o acesso; dados preservados e ocultos; após 12 meses, vira remoção                                   |
| 5. Revogação de sessão ou aparelho       | A própria pessoa; automática na troca de senha ou reuso de token | Basta entrar de novo                                     | Só desconecta; nenhum dado é apagado além da sessão                                                        |
| 6. Anonimização automática               | Job diário                                                       | Não                                                      | Inscrições públicas vencidas; contas sem acesso há 24 meses                                                |
| 7. Inscrição pública: cancelar ou apagar | Quem se inscreveu, pelo link                                     | Cancelar: não; apagar: não                               | Cancelar libera a vaga; apagar anonimiza na hora                                                           |
| 8. Exclusão de comunidade                | Criador, com 2FA e confirmação                                   | 30 dias de carência                                      | Exportação ao administrador, depois apaga tudo da comunidade                                               |
| 9. Conta de menor de 16                  | Operador, ao saber                                               | Não                                                      | Igual ao caso 1, com aviso à comunidade                                                                    |

## 2. Caso 1: excluir conta

### 2.1 Pré-condições (a API recusa com explicação, nunca em silêncio)

- **Reautenticação:** senha sempre, e código de segundo fator se estiver ligado. Mesmos limites de tentativa do login.
- **Criador:** recusado enquanto a pessoa for a proprietária da plataforma. Mensagem: "Você é o Criador do Uni Jovem. Transfira a propriedade antes de excluir sua conta."
- **Único administrador ativo** de alguma comunidade: recusado, listando as comunidades. Mensagem: "Você é o único administrador de _{comunidades}_. Nomeie outra pessoa como administradora antes." (O banco já barra isso pelo gatilho `manter_um_admin_ao_encerrar_conta`.)
- **Operações offline não enviadas** no aparelho: o app mostra quantas são e pede confirmação antes de descartar.

Sem período de carência: a exclusão vale na hora em que é confirmada. Decisão: o mais protetor para a pessoa é o dado sair imediatamente; o risco de exclusão por engano ou por terceiro é tratado pela reautenticação e pelo e-mail de confirmação.

### 2.2 API [A IMPLEMENTAR]

- `POST /api/v1/eu/excluir-conta`, corpo `{ senha, codigo? }` (Zod). Rota da conta, fora de `/c/:comunidadeId`.
- Respostas: `200 { ok: true }` e cookie de refresh apagado; `401` credencial errada (mesma mensagem genérica do login); `409 { motivo: 'criador' | 'unico_admin', comunidades? }`; `429` limite.
- Executa uma função atômica no banco, `uj.excluir_conta(p_conta uuid)`, `SECURITY DEFINER`, chamada pelo papel `uj_auth` só depois da reautenticação, no mesmo padrão de `aceitar_convite` (D12).
- Teste obrigatório (PAP-05, PRIV-01, PRIV-03): depois da exclusão, nenhuma coluna de nenhuma tabela contém o nome, o e-mail ou o WhatsApp originais (varredura do banco inteiro com os valores da semente), e as contagens de presença, inscrição e escala da comunidade não mudam. O mesmo teste roda pelo caminho do app e pelo da web (PRIV-03: "os dois caminhos produzem o mesmo resultado").

### 2.3 O que a função faz, em ordem, numa transação

1. Trava a linha da conta; confere `estado = 'ativa'` e as pré-condições.
2. **Pedidos de oração** da pessoa, em todas as comunidades: apagados (as intercessões de outras pessoas neles saem em cascata). **Intercessões** da pessoa em pedidos alheios: apagadas.
3. **Disponibilidades**: apagadas.
4. **Escalas futuras** (`atribuicoes` de eventos que ainda não começaram): apagadas; pedidos de substituição abertos dela: cancelados. Os organizadores recebem o aviso genérico "Uma escala ficou vaga" (gancho para a F14).
5. **Motivo** das substituições pedidas pela pessoa: apagado (texto livre, pode ter saúde).
6. **Inscrições de membro**: as de eventos futuros são canceladas (promovendo a lista de espera); em todas, `nome` vira "Pessoa removida". O estado fica, para as contagens.
7. **Músicos e palestrantes** ligados a um vínculo dela: `nome` vira "Pessoa removida", `observacoes` e `vinculo_id` ficam nulos.
8. **Exportações** que ela gerou: apagadas.
9. **Convites** dirigidos ao e-mail dela: `email_destino` nulo. Convites que ela criou continuam valendo (são atos da comunidade); a autoria vira "Pessoa removida".
10. **Vínculos**: `estado = 'removido'`, `designacoes = '{}'`.
11. **Sessões, códigos de recuperação, provas de 2FA, links de senha, verificações de e-mail** (pelo e-mail): apagados. **Tokens de push**: apagados (F14).
12. **Consentimentos**: marcados como revogados agora; a linha fica como prova pelo prazo do mapa de dados.
13. **Conta**: `nome = 'Pessoa removida'`, `email = 'removida-{id}@anonimizada.invalid'`, `whatsapp`, `email_verificado_em`, `senha_hash`, `totp_*`, `bloqueio_2fa_ate` e a faixa de idade nulos, `falhas_2fa = 0`, `estado = 'anonimizada'`, `anonimizada_em = now()`.
14. **Auditoria**: `conta.excluida`, com `conta_id` e sem detalhes.
15. **Lista de exclusões**: grava `(conta_id, momento)` em `uj.exclusoes_de_conta` (só o UUID; ver seção 6).

O que **fica**, ligado à conta anonimizada (sem nome, e-mail, telefone nem senha): escalas e presenças passadas, autoria de eventos, avisos, notas, sugestões, conteúdos, tarefas e comandos do ao vivo, linhas de auditoria. As telas mostram "Pessoa removida" (as funções `0002` e `0009` já fazem isso para `estado = 'anonimizada'`). As contagens e relatórios agregados não mudam.

### 2.4 Depois da transação

- **E-mail de confirmação** ao endereço antigo, guardado só em memória até o envio: "Sua conta no Uni Jovem foi excluída. Se não foi você, responda a este e-mail." Sem nome de comunidade. Serve de alarme se alguém excluiu a conta com a senha roubada.
- **Aparelhos**: na próxima chamada recebem 401, e o app apaga refresh, comunidade ativa e partições offline. Aparelho que não se conectar mais: os dados offline vencem em até 7 dias (ou o prazo da comunidade, até 30). Limite L01.
- **Registros técnicos**: vencem em 30 dias.
- **Resend**: o e-mail fica no histórico dele até 30 dias (plano gratuito; reconfirmar).
- **Backups**: não são editados; vencem em até cerca de 100 dias (seção 6).
- **Planilhas** que administradores já baixaram: fora do sistema, responsabilidade da comunidade (Termos, seção 9).

### 2.5 Limite honesto da anonimização

O que fica no banco não identifica a pessoa por si: não há nome, contato nem credencial, e o identificador interno é aleatório. Mas quem estava na comunidade pode deduzir quem era a "Pessoa removida" pelo contexto (por exemplo, quem tocava teclado no sábado tal). Isso é anonimização perante o sistema, não perante a memória das pessoas. [REVISÃO JURÍDICA: avaliar se esse resultado atende ao art. 12 da LGPD (dado anonimizado) ou se deve ser tratado como pseudonimizado, e se o texto das sugestões deve ser apagado em vez de mantido.]

## 3. Caso 2: sair de comunidade

Existe hoje como `POST /api/v1/c/:comunidadeId/sair`, que só muda `vinculos.estado` para `removido` e audita `vinculo.saiu`. **[A IMPLEMENTAR]** completar, na mesma transação, restrito àquela comunidade:

1. Pedidos de oração e intercessões da pessoa: apagados.
2. Disponibilidades e escalas futuras: apagadas; substituições abertas: canceladas; motivos: apagados.
3. Inscrições em eventos futuros: canceladas.
4. Consentimento TC-03 daquela comunidade: revogado.
5. **Histórico desligado do nome**: as linhas passadas (escalas, presenças, inscrições, autoria) passam a mostrar "Pessoa removida" naquela comunidade, mantendo as contagens. Sugestão de implementação: coluna `vinculos.anonimizado_em` e as funções de leitura tratam vínculo anonimizado como conta anonimizada; `inscricoes.nome` e o nome de músico ou palestrante ligado são trocados.
6. No aparelho: a partição offline daquela comunidade é apagada (com aviso sobre operações não enviadas).

Por que desligar o histórico: a base para tratar esses dados era o consentimento sobre a fé, e a pessoa acabou de revogá-lo. Depois do fim do tratamento, a LGPD (art. 16) só permite conservar o dado em hipóteses restritas, e a mais próxima aqui é "uso exclusivo do controlador, desde que anonimizado". A comunidade continua com os números.

Bloqueio: o único administrador não sai (mensagem do TC-12).

## 4. Casos 3 e 4: remoção e desativação pelo administrador

|                             | Remoção                                                                                                                                                                 | Desativação                                                                        |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Acesso                      | Perde na hora                                                                                                                                                           | Perde na hora                                                                      |
| Pedidos de oração da pessoa | Ocultos de todos na hora (a política `pedidos_oracao_ler` já exige vínculo ativo do autor); **apagados após 30 dias** se a remoção não for desfeita **[A IMPLEMENTAR]** | Ocultos de todos; preservados                                                      |
| Histórico                   | Desligado do nome após 30 dias (como no caso 2) **[A IMPLEMENTAR]**                                                                                                     | Preservado                                                                         |
| Volta                       | Por convite dirigido dentro dos 30 dias, com tudo de volta; depois, como pessoa nova                                                                                    | Por convite dirigido (D14), com tudo de volta                                      |
| Prazo máximo                | 30 dias                                                                                                                                                                 | **12 meses**; depois, vira remoção, com aviso ao administrador **[A IMPLEMENTAR]** |
| Auditoria                   | `vinculo.alterado` com antes e depois (papel, estado)                                                                                                                   | Idem                                                                               |
| Aparelhos                   | Na próxima sincronização, a partição daquela comunidade é apagada e o servidor rejeita operações enviadas depois da revogação                                           | Idem                                                                               |

A pessoa removida ou desativada continua com a conta e com os direitos de titular: em **Perfil > Exportar meus dados** ela recebe também o que é dela nas comunidades onde não está mais ativa, e pode pedir ao encarregado que apague antes do prazo.

Por que 30 dias na remoção: dá tempo para desfazer um engano do administrador sem manter indefinidamente dado de quem saiu. Por que 12 meses na desativação: é a pausa de quem se afastou por um tempo (intercâmbio, serviço militar) sem virar retenção eterna.

## 5. Caso 5: revogação de sessão ou aparelho

- **Perfil > Aparelhos > Desconectar** (`DELETE /api/v1/eu/aparelhos/:familia`): revoga a família de sessões daquele aparelho.
- **Sair** (`POST /api/auth/sair`): revoga a família atual e descarta as provas de 2FA; o app apaga refresh, comunidade ativa e partições offline, e remove o token de push (F14).
- **Automática**: troca ou redefinição de senha derruba todas as sessões; reuso de refresh derruba a família; 90 dias sem uso ou 365 dias de família encerram a sessão.
- Nenhum dado além da sessão é apagado. A linha da sessão revogada ou vencida é apagada 30 dias depois **[A IMPLEMENTAR]**.

## 6. Caso 6: anonimização automática, backups e restauração

**Job diário** (conexão do dono, relatório com contagens por tipo, nunca com dados; PRIV-05) **[A IMPLEMENTAR]**: executa as retenções da seção 10 do `mapa-de-dados.md`, incluindo:

- Inscrições públicas e presenças avulsas `retencao_inscricoes_dias` após o evento (P3).
- Contas sem nenhum acesso há **24 meses**: e-mail de aviso ("sua conta será excluída em 30 dias; entre no app para mantê-la"); sem acesso em 30 dias, executa o caso 1. Exceções: a conta do Criador e o único administrador de uma comunidade ativa (o aviso vai também ao Criador).

**Backups.** Os `pg_dump` cifrados não são editados (7 diários, 4 semanais, 3 mensais; o mais antigo tem cerca de 3 meses, então declaramos "até cerca de 100 dias"). Para que uma restauração não ressuscite contas excluídas:

1. Toda exclusão de conta grava o UUID e a data em `uj.exclusoes_de_conta` (só identificador, sem dado pessoal).
2. O job diário copia essa lista para um arquivo à parte, junto dos backups, com retenção maior que a do backup mais antigo (por exemplo, 13 meses).
3. O runbook de restauração ganha um passo obrigatório: depois de restaurar, reaplicar o caso 1 a todo UUID da lista posterior à data do backup, e reaplicar as retenções do job diário, antes de liberar o acesso. A evidência do ensaio de restauração mensal inclui esse passo.

## 7. Caso 7: inscrição pública

- **Cancelar** (existe): pelo link de cancelamento (`/e/{idPublico}/cancelar#t=...`), libera a vaga e promove a lista de espera. Os dados ficam até o prazo de retenção.
- **Cancelar e apagar agora** **[A IMPLEMENTAR]**: na mesma página, um segundo botão anonimiza a inscrição na hora (nome "Participante", contatos e hash nulos). Se já houver presença registrada, ela fica, sem nome.
- Sem o link: a pessoa pede à comunidade ou ao encarregado, que confirma pelo WhatsApp ou e-mail informado na inscrição.

## 8. Caso 8: exclusão de comunidade

Ciclo já previsto: `ativa → suspensa → arquivada → exclusao_agendada` (30 dias de carência, 2FA do Criador e digitar o nome). Antes de agendar, o sistema gera uma exportação para o administrador. Ao fim da carência **[A IMPLEMENTAR]**: apaga todas as linhas com aquele `comunidade_id` (eventos, escalas, inscrições, presenças, oração, sugestões, avisos, conteúdos, exportações, mudanças, vínculos e convites) e os arquivos do prefixo `comunidades/{id}/`. A auditoria fica até completar 2 anos, com `comunidade_id` e `conta_id` apenas. Contas que só tinham vínculo nessa comunidade continuam existindo, sem comunidade; a pessoa é avisada por e-mail e pode excluir a conta.

## 9. Caso 9: conta de menor de 16 anos

Ao saber (denúncia, informação da comunidade, declaração), o operador executa o caso 1 com motivo registrado na auditoria (sem nome nem idade no texto) e avisa os administradores das comunidades da pessoa. Não pedimos documento para provar idade.

## 10. Página pública `/excluir-conta` (exigência do Google Play) [A IMPLEMENTAR]

Página renderizada no servidor, como as outras públicas: funciona sem JavaScript, sem login para ler, com o mesmo CSS e CSP estrita. Pode ser indexada (o Google precisa acessá-la). URL a informar no Play Console: `https://unijovem.solerte.com.br/excluir-conta`.

**Conteúdo da página (rascunho):**

> # Excluir sua conta do Uni Jovem
>
> Uni Jovem, de [PREENCHER: nome do desenvolvedor como aparece na loja].
>
> ## Pelo app
>
> Abra o Uni Jovem, toque em **Perfil > Excluir conta**, confirme com sua senha.
>
> ## Pela web
>
> [Entrar e excluir minha conta](/app/excluir-conta) [PREENCHER: rota final da tela na web interna]. Você vai entrar com seu e-mail e senha e confirmar.
> Esqueceu a senha? [Recupere aqui](/app/recuperar-senha) e depois volte a esta página.
> Perdeu o acesso ao e-mail? Escreva para [PREENCHER: e-mail do encarregado] a partir de outro endereço, dizendo o nome e a comunidade. Vamos confirmar sua identidade com a liderança da comunidade antes de excluir.
>
> ## O que é apagado
>
> Nome, e-mail, WhatsApp, senha, segundo fator, aparelhos conectados, pedidos de oração, disponibilidade e escalas futuras: apagados na hora.
>
> ## O que fica, sem o seu nome
>
> Escalas e presenças passadas, avisos, sugestões e outros registros que você criou numa comunidade passam a aparecer como "Pessoa removida". Os números da comunidade (quantas pessoas vieram, por exemplo) continuam.
> Registros de segurança sem seu nome (ação, data e parte do endereço IP) ficam por 2 anos.
>
> ## Prazos
>
> Registros técnicos do servidor: até 30 dias. E-mails no serviço de envio: até 30 dias. Cópias de segurança cifradas: até cerca de 100 dias. Planilhas que a liderança da sua comunidade já tenha baixado ficam com ela.
>
> ## Quer apagar só uma parte?
>
> Sem excluir a conta, você pode apagar um pedido de oração ou uma sugestão na própria tela, sair de uma comunidade, ou apagar seu WhatsApp em **Perfil**.
>
> ## Fez uma inscrição pública num evento, sem conta?
>
> Use o link de cancelamento que apareceu na confirmação: ele permite cancelar e apagar seus dados. Sem o link, fale com a organização do evento ou com [PREENCHER: e-mail do encarregado].

**Decisão:** a página não tem formulário próprio de exclusão por e-mail. Ela leva ao login da web interna, que já tem reautenticação, limites e 2FA, e a mesma função do app. Um formulário "digite seu e-mail e receba um link para excluir" criaria um segundo caminho de ataque e gastaria a cota de 100 e-mails por dia do Resend. Quem perdeu o acesso ao e-mail tem o canal do encarregado.

[REVISÃO JURÍDICA: confirmar que a página atende à política de exclusão de dados do Google Play e que a verificação de identidade pelo canal do encarregado (confirmação com a liderança da comunidade) é adequada.]

## 11. Exportar meus dados (complemento do direito de acesso) [A IMPLEMENTAR]

- `POST /api/v1/eu/exportacao` gera; `GET` com token de uso próprio baixa; expira em 24 h. Mecanismo análogo ao de `uj.exportacoes` (token com hash, expurgo pelo job), mas sem `comunidade_id`, porque o arquivo junta todas as comunidades da pessoa: tabela própria ou coluna `comunidade_id` opcional com política só do dono.
- Formato JSON, com um `LEIA-ME` em texto explicando cada campo.
- Contém: conta (sem hash de senha nem segredo TOTP), faixa de idade, consentimentos, vínculos (inclusive desativados e removidos ainda não anonimizados), escalas, substituições, disponibilidades, inscrições, presenças, pedidos de oração **decifrados**, intercessões feitas, sugestões (inclusive as anônimas, que são dela), avisos e notas que ela escreveu, sessões, e as linhas de auditoria em que ela é a autora.
- Não contém: dados de outras pessoas (nomes de quem orou pelo pedido dela aparecem só como contagem), autoria de sugestões anônimas alheias, conteúdo de pedidos de oração de terceiros.
- Teste obrigatório (PRIV-04): a exportação de A não contém nenhum valor da semente de B, nem de outra comunidade; link vencido responde 404.
