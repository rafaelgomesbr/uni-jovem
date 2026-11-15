# Termo do Administrador da Comunidade

> **Texto novo (ADR 0007), versão 1 (`TC-16.v1`), de 15/11/2026, com revisão jurídica pendente (PH-11).** Publicar só junto com a API que implementa a ADR 0007 (criação de comunidade por qualquer conta com e-mail confirmado).
> **Onde aparece:** o texto curto (seção "Em resumo") vai na tela de criar comunidade, acima da caixa de aceite; o texto completo fica público em `/termos#administrador`, logo depois dos Termos de Uso (a API precisa anexar este arquivo à página: ver o anexo). O registro do aceite está em `textos-de-consentimento.md`, TC-16.
> **Versão:** mudou o texto, muda a versão aqui e em `VERSAO_DO_TEXTO` (`apps/api/src/privacidade/consentimentos.ts`); quem aceitou a versão anterior continua registrado com ela e aceita a nova na próxima vez que abrir a comunidade como administrador.
> Os trechos `[REVISÃO JURÍDICA: ...]` são dúvidas para o advogado e saem do texto publicado, assim como o anexo.

Versão 1, de 15/11/2026.

## Em resumo

Ao criar esta comunidade, você passa a administrá-la e responde, em nome dela, pelos dados das pessoas que entram: a comunidade é a controladora desses dados, e o Uni Jovem os guarda e trata em nome dela. Só aceite quem tem 16 anos ou mais, com cuidado redobrado com quem tem 16 ou 17, e use os dados só para organizar as atividades da comunidade, nunca para propaganda, política, venda ou outra finalidade. Participar revela a fé das pessoas: guarde sigilo, analise as denúncias e responda a quem pedir para ver, corrigir ou apagar os próprios dados. Até a verificação pelo Uni Jovem, a comunidade tem no máximo 30 pessoas e não publica página aberta de evento, e o Uni Jovem pode suspendê-la se este termo ou a lei forem descumpridos.

## A1. Para quem vale este termo

Este termo vale para quem cria uma comunidade no Uni Jovem e para quem for promovido a administrador de uma comunidade depois. Ele completa os [Termos de Uso](/termos) e a [Política de Privacidade](/privacidade); se houver diferença sobre o que um administrador deve fazer, vale este termo.

Ao criar a comunidade, você declara que:

1. Tem 18 anos ou mais ou, se tem 16 ou 17 anos, cria a comunidade com a concordância do seu pai, mãe ou responsável legal e da liderança adulta do grupo. [REVISÃO JURÍDICA: a ADR 0007 deixa qualquer conta com e-mail confirmado criar comunidade, inclusive de 16 e 17 anos. Avaliar se a criação deve exigir 18 anos, já que o administrador assume, em nome da comunidade, obrigações de controlador sobre dado sensível de terceiros, e quem tem 16 ou 17 anos é relativamente incapaz (Código Civil, art. 4º, I). Se a resposta for sim, a API passa a exigir a faixa `18_mais` para criar comunidade (decisão do dono) e este item muda.]
2. Cria a comunidade para um grupo real (o grupo de jovens de uma igreja, um ministério, uma célula), e não para se passar por outra pessoa, igreja ou organização.
3. Se a comunidade representa uma igreja ou outra organização, tem autorização da liderança dela para usar o Uni Jovem em nome do grupo. Se não tiver, a responsabilidade por este termo é sua, como pessoa.

## A2. Quem responde por quais dados

| Quem                                                      | Papel na lei (LGPD)                                                                         | Sobre quais dados                                                                                                                                                                                    |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A comunidade**, representada pelos administradores dela | **Controladora**: decide para que os dados são usados e responde por isso                   | Tudo o que acontece dentro da comunidade: quem participa e com qual papel, pedidos de entrada, escalas, presença, inscrições, avisos, sugestões, denúncias de conteúdo, pedidos de oração, conteúdos |
| **O Uni Jovem** (Rafael Gomes, pessoa física)             | **Operador** desses dados: guarda e trata em nome da comunidade, segundo as instruções dela | Os mesmos dados acima, só para prestar o serviço                                                                                                                                                     |
| **O Uni Jovem**                                           | **Controlador**                                                                             | A conta de cada pessoa (nome, e-mail, senha, foto, contas conectadas, idade declarada), a segurança, a verificação das comunidades, as denúncias de comunidade e a moderação da plataforma           |

Na prática: as regras do app (quem vê o quê, prazos de guarda, cifragem dos pedidos de oração) são as mesmas para todas as comunidades e estão na Política de Privacidade. Dentro delas, a comunidade decide quem entra, o que publica, quais eventos cria e por quanto tempo guarda as inscrições públicas.

## A3. Quem entra e como

1. **Você escolhe como as pessoas entram**, em Configurações: só por convite, por código com aprovação (o padrão das comunidades novas) ou por código direto. O código da comunidade é como uma chave: mostre só a quem você quer na comunidade e troque-o se ele vazar (o antigo deixa de valer na hora).
2. **Pedidos de entrada:** administradores e organizadores aceitam ou recusam. Aceite só quem você conhece ou tem motivo para receber. Quem pediu vê só "Pendente", "Aceito" ou "Não aprovado", nunca quem decidiu.
3. **Ninguém com menos de 16 anos** pode ter conta nem entrar na comunidade (seção A6).
4. **Papéis:** quem entra por código ou por pedido aceito é membro. Só administradores promovem alguém, e ninguém pede cargo. Dê o papel de organizador ou administrador só a quem precisa dele para servir.
5. **Aparecer na busca** é escolha sua, desligada por padrão. Ligada, quem tem conta no Uni Jovem acha a comunidade pelo nome e pela cidade e vê nome, cidade, cor, logotipo e se ela é verificada. Ninguém vê, pela busca, quem participa nem quantas pessoas há.
6. **Comunidade nova tem limites** até o Uni Jovem verificar (seção A10): no máximo 30 pessoas ativas e nenhuma página aberta de inscrição em evento. Cada conta tem uma comunidade nova por vez e cria no máximo 3 comunidades.

## A4. Para que usar os dados

Os dados das pessoas da comunidade servem **só para organizar as atividades da própria comunidade**: programação, eventos, escalas, tarefas, inscrições, presença, avisos, sugestões, conteúdos e pedidos de oração.

Você e os demais administradores e organizadores **não podem**:

1. Usar nomes, e-mails ou WhatsApps vistos no app para propaganda, campanha política, venda, correntes, pesquisas ou listas de outras igrejas e organizações.
2. Copiar a lista de pessoas para outro sistema, planilha ou grupo sem necessidade real da comunidade.
3. Usar o app para vigiar a vida das pessoas, cobrar presença de forma vexatória ou expor alguém.
4. Pedir que as pessoas escrevam no app dado que a comunidade não precisa (documentos, endereço, saúde, situação familiar).
5. Repassar a terceiros o que viram no app.

**Planilhas exportadas** são responsabilidade da comunidade: baixe só quando precisar, guarde com cuidado, não repasse e apague quando terminar. No servidor elas somem em 24 horas, mas a cópia baixada fica com quem baixou.

[REVISÃO JURÍDICA: confirmar se a lista de finalidades vedadas atende ao art. 6º, I e II, da LGPD e se cabe prever penalidade contratual além da suspensão (seção A11).]

## A5. Dado sensível: a fé das pessoas

Participar de uma comunidade de igreja revela convicção religiosa, que a lei trata como **dado pessoal sensível** (LGPD, art. 5º, II). Por isso:

1. Cada pessoa dá um **consentimento específico** ao pedir para entrar ou ao entrar na comunidade, e pode desfazê-lo saindo dela. Não pressione ninguém a entrar, a ficar nem a consentir.
2. **Guarde sigilo** sobre quem participa e sobre o que é escrito na comunidade. Não confirme a terceiros que uma pessoa faz parte do grupo.
3. **Pedidos de oração:** o que a pessoa marca como "Somente eu" ninguém da administração lê, nem pode pedir para ler. O que é marcado para a equipe de oração ou para a comunidade continua sendo confidencial fora dela.
4. **Nada de dado sensível fora do lugar:** avisos, nomes de eventos e notas internas não devem expor saúde, vida íntima ou situação familiar de ninguém.

## A6. Idade: menores de 16 e adolescentes de 16 e 17

1. **Menores de 16 anos não entram.** O Uni Jovem pede a idade a todos ao criar a conta, mas não confere documento, e uma declaração pode ser falsa. Você costuma conhecer as pessoas do grupo: se souber ou desconfiar que alguém tem menos de 16, não aceite o pedido, remova a pessoa da comunidade e avise o Uni Jovem em [contact@solerte.com.br](mailto:contact@solerte.com.br), sem expor a pessoa a ninguém.
2. **Quem tem menos de 16 participa dos eventos de outro jeito:** a inscrição pela página do evento, feita pelo pai, pela mãe ou pelo responsável, com o contato do responsável. Comunidade nova não tem página aberta de inscrição até ser verificada.
3. **Adolescentes de 16 e 17 anos** podem ter conta com a ciência e a concordância do responsável. O app não mostra a idade de ninguém à administração; por isso, trate todo o grupo com o cuidado que um adolescente merece.
4. Adultos da liderança não usam o app nem os contatos vistos nele para conversa privada e individual com adolescentes fora das finalidades da comunidade.
5. Não publique fotos, nomes completos ou detalhes de adolescentes em avisos e conteúdos sem necessidade, e mantenha as configurações protetoras do app (pedido de oração em "Somente eu" por padrão, nenhum perfil público, nenhuma mensagem direta).
6. Pais e responsáveis podem pedir informações sobre os dados de um adolescente; se não souber responder, encaminhe o pedido ao Uni Jovem.

[REVISÃO JURÍDICA: confirmar se o dever do administrador de recusar e informar menores de 16, somado à declaração de idade, é contribuição proporcional à aferição de idade pedida pela Lei nº 15.211/2025 e pelas orientações da ANPD. Ver a Política de Privacidade, seção 12, e o anexo dela.]

## A7. Denúncias e moderação

1. Pessoas da comunidade podem **denunciar** um pedido de oração visível à comunidade, uma sugestão ou um aviso. A denúncia chega aos administradores, que veem o conteúdo, o motivo e o detalhe, mas não quem denunciou. Não tente descobrir quem foi.
2. **Analise as denúncias o quanto antes.** Retire o conteúdo que viole a lei, os Termos de Uso ou este termo, e desative ou remova quem abusa.
3. **Risco a criança ou adolescente, ameaça, violência ou conteúdo ilegal:** retire o conteúdo na hora e avise o Uni Jovem no mesmo dia, em [contact@solerte.com.br](mailto:contact@solerte.com.br). Não espere ordem judicial.
4. Qualquer pessoa com conta também pode **denunciar a comunidade** inteira ao Uni Jovem (por exemplo, comunidade falsa, spam ou abuso). Essas denúncias vão para a equipe do Uni Jovem, que pode pedir explicações a você e agir conforme a seção A11.

## A8. Pedidos das pessoas sobre os próprios dados

Como a comunidade é a controladora, é ela que responde aos pedidos das pessoas sobre os dados da comunidade (LGPD, art. 18), com a ajuda do Uni Jovem:

1. Muita coisa a própria pessoa faz pelo app: exportar os dados, corrigir nome e WhatsApp, apagar um pedido de oração, sair da comunidade, excluir a conta. Indique esses caminhos primeiro.
2. Pedido que o app não resolve (por exemplo, apagar uma sugestão ou corrigir um registro de presença): responda em até **15 dias**. Se não souber como fazer, escreva para [contact@solerte.com.br](mailto:contact@solerte.com.br).
3. Pedido sobre a conta, a senha ou a segurança: encaminhe ao Uni Jovem, que é o controlador desses dados.
4. Quando o Uni Jovem receber um pedido sobre dados da sua comunidade, ele encaminha a você e acompanha a resposta.

## A9. Segurança

1. Ligue a verificação em duas etapas na sua conta. Administrador com senha roubada expõe a comunidade inteira.
2. Não compartilhe a sua conta. Cada pessoa da liderança tem a própria conta e o próprio papel.
3. Se souber de um incidente (conta invadida, planilha vazada, código da comunidade espalhado), avise o Uni Jovem **imediatamente** e troque o código da comunidade.

## A10. Verificação da comunidade

1. Toda comunidade nasce como **nova**, com os limites da seção A3. O Uni Jovem pode verificá-la, e ela ganha o selo "Verificada" e perde os limites.
2. Para verificar, o Uni Jovem vê o nome, a cidade e a data de criação da comunidade, o seu nome e o seu e-mail (como quem a criou), o número de membros e as denúncias abertas. Ele pode escrever para você pedindo informações sobre o grupo. Ele não vê contatos dos membros, pedidos de oração nem notas.
3. A verificação pode ser retirada se o grupo deixar de cumprir este termo. Os limites voltam, e nada é apagado.

## A11. Suspensão e encerramento pelo Uni Jovem

O Uni Jovem pode **suspender** a comunidade (ela fica só para leitura), **arquivar** ou **excluir**, e pode **suspender ou encerrar a conta** de um administrador, quando houver:

1. descumprimento deste termo, dos Termos de Uso ou da lei;
2. comunidade falsa, que se passa por outra pessoa, igreja ou organização, ou criada para spam;
3. risco a criança ou adolescente, inclusive menores de 16 aceitos depois de aviso;
4. denúncias graves ou repetidas sem resposta da administração;
5. ordem de autoridade competente.

Sempre que possível, o Uni Jovem avisa a administração antes, explica o motivo e dá prazo para corrigir. Em caso de risco grave ou de conteúdo ilegal, age primeiro e avisa depois. Você pode contestar a decisão em [contact@solerte.com.br](mailto:contact@solerte.com.br).

A exclusão tem **30 dias de carência**. Antes dela, a administração é avisada para exportar o que precisar; depois, os dados da comunidade são apagados (só o registro de auditoria, sem dado que identifique pessoas, fica até completar 2 anos).

## A12. O que o Uni Jovem faz em nome da comunidade

Como operador, o Uni Jovem se compromete a:

1. tratar os dados da comunidade só para prestar o serviço e segundo as instruções da comunidade, dadas pelas configurações e pelas ações da administração no app;
2. manter as medidas de segurança descritas na Política de Privacidade, inclusive o isolamento entre comunidades e a cifragem dos pedidos de oração;
3. guardar sigilo e não usar os dados da comunidade para nenhuma finalidade própria (sem anúncio, sem venda, sem perfil de comportamento, sem treinar inteligência artificial);
4. avisar a comunidade sobre incidente de segurança que a afete;
5. não usar subprocessador novo sem antes atualizar a lista da Política de Privacidade;
6. ajudar a comunidade a responder aos pedidos das pessoas;
7. apagar os dados da comunidade quando ela for excluída, depois da carência.

[REVISÃO JURÍDICA: estas são as obrigações mínimas do art. 39 da LGPD entre controlador e operador. Avaliar (1) se o aceite eletrônico deste termo por uma pessoa física basta como contrato com a comunidade, inclusive quando ela é grupo sem personalidade jurídica de uma igreja; (2) se a definição dos meios essenciais pelo Uni Jovem (regras de visibilidade, prazos padrão, cifragem) leva a controladoria conjunta em vez de controlador e operador; (3) se a cláusula de contestação da seção A11 basta como canal de recurso exigido pela Lei nº 15.211/2025.]

## A13. Quando você deixa de administrar

1. A comunidade nunca fica sem administrador ativo. Antes de sair da comunidade ou de excluir sua conta, nomeie outra pessoa como administradora.
2. As obrigações de sigilo das seções A4 e A5 continuam depois que você deixa a função.
3. Planilhas que você baixou continuam sob sua responsabilidade: apague-as.

## A14. Mudanças neste termo

Quando este termo mudar, a nova versão aparece em [unijovem.solerte.com.br/termos](/termos#administrador), com a data. Mudança relevante pede um novo aceite dos administradores no app. As versões anteriores podem ser pedidas em [contact@solerte.com.br](mailto:contact@solerte.com.br).

---

## Anexo (não publicar): como este termo vira tela, página e registro

1. **Tela de criar comunidade:** depois de nome, cor e cidade, o bloco "Em resumo" (texto corrido, sem a lista), o link "Ler o termo completo" para `/termos#administrador` e a caixa, desmarcada: "[ ] Li e aceito o Termo do Administrador da Comunidade." O botão "Criar comunidade" fica desabilitado até marcar, e o motivo aparece em texto. A mesma tela pede o TC-03 (consentimento sobre a fé) em bloco separado, porque quem cria também participa.
2. **Registro (TC-16):** uma linha em `uj.consentimentos` com a conta, a comunidade criada, o vínculo de admin, `TC-16`, a versão, a data e a forma. A API só cria a comunidade com `aceiteDoTermoDoAdmin: true` (ADR 0007).
3. **Página pública:** hoje `/termos` só renderiza `termos-de-uso.md`. Para o termo completo aparecer em `/termos#administrador`, a API precisa anexá-lo à página (descrito no relatório da tarefa de 15/11/2026; nenhuma mudança de código foi feita pelos textos). Os títulos usam o prefixo "A" (A1 a A14) para que as âncoras não colidam com as dos Termos.
4. **Administradores promovidos depois:** o termo vale para eles pelos Termos de Uso (seção 9). Recomendação: pedir o aceite do TC-16 na primeira vez que a pessoa abrir a comunidade como administradora.
5. **Notas para a revisão jurídica:** idade mínima para criar comunidade (A1; recomendação técnica: 18 anos); contrato do art. 39 aceito por pessoa física (A12); controladoria conjunta (A12); canal de contestação (A11); proporcionalidade da contribuição do administrador para a aferição de idade (A6).
