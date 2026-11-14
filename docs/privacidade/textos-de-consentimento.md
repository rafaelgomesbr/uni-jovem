# Textos de consentimento e avisos de tela

> **Rascunho para revisão jurídica, sem validade até a revisão.** Versão 0.1, de 14/11/2026.
> Textos curtos que aparecem nas telas do app e nas páginas públicas. Cada um tem um identificador com versão (`TC-nn.vN`). Mudou o texto de um consentimento, muda a versão, e quem aceitou a versão anterior continua registrado com ela.

## Regras que valem para todos

1. **Caixa desmarcada.** Nenhum consentimento vem pré-marcado. O botão de continuar fica desabilitado até marcar, e o motivo aparece em texto (não só pela cor do botão).
2. **Separado dos Termos.** O consentimento sobre a fé (art. 11, I) aparece em bloco próprio, com título, e não é misturado ao "li e aceito os Termos".
3. **Registro.** Cada aceite grava: quem (conta ou inscrição), qual comunidade, o identificador e a versão do texto, data e hora, e a forma (tela e plataforma: `ios`, `android`, `web`, `pagina_publica`). [IMPLEMENTAÇÃO: hoje só existe `inscricoes.consentimento_em`, sem versão; contas e vínculos não têm registro. Proposta no `mapa-de-dados.md`, seção "Lacunas".]
4. **Revogar com o mesmo esforço.** Todo consentimento diz em uma frase como desfazer.
5. **Acessibilidade.** Texto do consentimento como rótulo da caixa (leitor de tela lê tudo), alvo de toque de 44 pt, link "Saiba mais" com texto descritivo, sem depender de cor.
6. **Linguagem.** Frases curtas, segunda pessoa, sem juridiquês. Sem travessão.

---

## TC-01.v1: Declaração de idade (criação de conta por convite)

**Onde aparece:** fluxo do convite para conta nova (`/convite`, no app e na web), logo depois de nome, e-mail e WhatsApp, antes do código de verificação.

**Texto (escolha única, nenhuma opção pré-selecionada):**

> **Quantos anos você tem?**
> ( ) Tenho 18 anos ou mais.
> ( ) Tenho 16 ou 17 anos, e meu pai, minha mãe ou meu responsável legal sabe que vou usar o Uni Jovem e concorda.
> ( ) Tenho menos de 16 anos.
>
> Não pedimos sua data de nascimento. Guardamos só a sua resposta.

**Se escolher "menos de 16":** o fluxo para com a mensagem:

> Que bom que você quer participar! Para ter uma conta no Uni Jovem é preciso ter 16 anos ou mais. Fale com a liderança da sua comunidade: ela pode inscrever você nos eventos com a ajuda do seu responsável.

O convite **não** é consumido (pode ser usado por outra pessoa a quem a liderança o repasse) e nenhum dado digitado é gravado.

**O que é registrado:** a faixa (`18_mais` ou `16_17`), o identificador `TC-01.v1`, data e forma.

---

## TC-02.v1: Termos e Política (criação de conta por convite)

**Onde aparece:** mesma tela, abaixo da TC-01.

**Texto:**

> [ ] Li e concordo com os [Termos de Uso](/termos) e a [Política de Privacidade](/privacidade).

**Se recusar:** não cria a conta. Mensagem: "Para criar a conta, é preciso concordar com os Termos de Uso."

**Base legal:** execução de contrato (art. 7º, V). Não é o consentimento sobre a fé, que vem a seguir.

---

## TC-03.v1: Consentimento sobre a fé, ao entrar numa comunidade

**Onde aparece:**

- Conta nova: depois do código de verificação e da senha, antes de concluir (a conta e o vínculo só são criados com esta caixa marcada).
- Conta existente: na tela "Entrar em _Comunidade X_ como _Papel_", antes do botão de confirmar.
- Sempre que a pessoa entrar em **outra** comunidade (um consentimento por comunidade).

**Texto (bloco destacado, com título):**

> **Sobre a sua fé**
>
> Participar da _{nome da comunidade}_ no Uni Jovem mostra que você faz parte de uma comunidade de igreja. A lei considera isso um dado sensível.
>
> [ ] Concordo que a _{nome da comunidade}_ e o Uni Jovem tratem meus dados para organizar a minha participação nesta comunidade: eventos, escalas, presença, avisos, sugestões e pedidos de oração. Sei que nome e papel ficam visíveis para os membros desta comunidade, e meu e-mail e WhatsApp só para organizadores e administradores.
>
> Você pode desfazer isso quando quiser: em **Perfil > Sair da comunidade**, ou excluindo sua conta. [Saiba mais](/privacidade#fe)

**Texto adicional, só para quem declarou 16 ou 17 anos:**

> [ ] Meu pai, minha mãe ou meu responsável legal sabe deste consentimento e concorda.

**Se recusar:** não entra na comunidade. Para conta nova, a conta também não é criada (sem comunidade, não há uso). Mensagem:

> Sem essa concordância não conseguimos incluir você na comunidade, porque o app usa esses dados para funcionar. Se mudar de ideia, o mesmo convite continua valendo até {data}.

**O que é registrado:** conta, comunidade, vínculo, `TC-03.v1`, data, forma; para 16 e 17 anos, também a confirmação da ciência do responsável.

**Revogação:** sair da comunidade revoga este consentimento para aquela comunidade (ver `exclusao-de-conta.md`, caso 2).

---

## TC-04.v1: Inscrição pública em evento (página `/e/{idPublico}`)

**Onde aparece:** formulário público de inscrição, acima do botão "Confirmar inscrição".

**Texto atual no código (14/11/2026, `apps/api/src/publico/rotas.ts`):**

> Concordo que {comunidade} use meu nome e WhatsApp só para organizar este evento. Os dados ficam guardados por tempo limitado e depois são apagados. Saiba mais.

**Problema:** não menciona o caráter religioso (dado sensível), não cita o e-mail opcional, não diz o prazo nem como desfazer, e não trata menores de 16. **Substituir por:**

> [ ] Concordo que a _{nome da comunidade}_ use meu nome, WhatsApp e e-mail (se eu informar) só para organizar este evento. Sei que me inscrever num evento de igreja mostra que participo de uma comunidade religiosa. Meus dados são apagados {N} dias depois do evento. Posso cancelar e apagar antes pelo link que recebo ao me inscrever. [Saiba mais](/privacidade#inscricao)
>
> [ ] A pessoa inscrita tem 16 anos ou mais, ou eu sou o pai, a mãe ou o responsável legal dela e informei o meu WhatsApp como contato.

`{N}` é o prazo de retenção configurado pela comunidade (padrão 90).

**Se recusar qualquer uma das duas:** a inscrição não é gravada. Mensagens (já no padrão do código):

- "Para se inscrever, marque a concordância com o uso dos seus dados."
- "Para se inscrever, confirme a idade ou que você é o responsável."

**O que é registrado:** `inscricoes.consentimento_em` (já existe) mais o identificador `TC-04.v1` e a confirmação da idade ou responsável [IMPLEMENTAÇÃO: colunas novas].

**Revogação:** o link de cancelamento da confirmação passa a oferecer "Cancelar e apagar meus dados agora" [IMPLEMENTAÇÃO].

---

## TC-05.v1: Inscrição de membro em evento (dentro do app)

**Onde aparece:** botão "Quero participar" num evento, para quem já tem conta.

**Não é consentimento novo** (a participação já está coberta pela TC-03). Só uma linha informativa abaixo do botão:

> Organizadores e administradores desta comunidade verão que você se inscreveu.

---

## TC-06.v1: Pedido de oração, ao escolher a visibilidade

**Onde aparece:** tela de novo pedido de oração, no seletor de visibilidade, antes de "Publicar". O padrão é sempre **Somente eu**.

**Textos de cada opção (aparecem antes de publicar, sem precisar tocar em "saiba mais"):**

> **Somente eu** (padrão)
> Só você vê. Nem administradores nem o Criador do app têm tela para ler.
>
> **Equipe de oração**
> Você e as {n} pessoas da equipe de oração da _{comunidade}_ veem. Administradores só veem se estiverem na equipe.
>
> **Comunidade**
> Você e todos os membros ativos da _{comunidade}_ veem ({n} pessoas hoje).

**Aviso fixo abaixo do campo de texto:**

> Escreva só o necessário. Evite nomes e detalhes de saúde de outras pessoas sem a permissão delas. O texto é guardado cifrado, mas não é criptografia de ponta a ponta: quem administra o servidor tem capacidade técnica de ler. [Entenda](/privacidade#oracao)

**Confirmação ao publicar com "Equipe de oração" ou "Comunidade" (diálogo):**

> Publicar para {a equipe de oração / toda a comunidade}?
> {n} pessoas vão poder ler este pedido.
> [Voltar] [Publicar]

**Se recusar (tocar em Voltar ou sair da tela):** o pedido não é enviado nem salvo. O texto não fica guardado no aparelho (pedidos de oração nunca vão para o armazenamento offline).

**Base legal:** consentimento específico (art. 11, I), registrado pela própria ação de publicar com a visibilidade escolhida. [REVISÃO JURÍDICA: confirmar se a ação de publicar após a explicação, sem caixa de seleção, é manifestação suficiente para dado sensível, ou se cabe uma caixa na primeira vez.]

---

## TC-07.v1: Mudança de visibilidade de um pedido de oração

**Onde aparece:** ao trocar a visibilidade de um pedido já publicado.

> Mudar a visibilidade para {nova}?
> Antes: {quem via}. Depois: {quem vai ver}.
> {Se estiver ampliando:} Mais pessoas vão poder ler este pedido.
> {Se estiver reduzindo:} Quem já leu pode ter lido antes desta mudança.
> [Cancelar] [Mudar]

**Se cancelar:** nada muda.

---

## TC-08.v1: Sugestão anônima

**Onde aparece:** chave "Enviar como anônima" na tela de nova sugestão.

> **Enviar como anônima**
> Ninguém da comunidade, nem organizadores e administradores, verá quem enviou. O sistema guarda a autoria para segurança (por exemplo, em caso de abuso), sem mostrar em nenhuma tela; quem administra o servidor tem capacidade técnica de consultá-la.

---

## TC-09.v1: Notificações (antes do pedido do sistema)

**Onde aparece:** tela explicativa mostrada em contexto (por exemplo, ao confirmar a primeira escala ou na missão "ativar notificações"), nunca na primeira abertura do app. Só depois de "Ativar" aparece o diálogo do sistema.

> **Quer ser avisado?**
> Avisamos quando você for escalado, quando um evento mudar ou for cancelado, quando pedirem substituição e quando sair um aviso da sua comunidade.
> Na tela bloqueada, assuntos pessoais aparecem com texto genérico. Pedidos de oração nunca viram notificação.
> Você escolhe os tipos e as comunidades em **Perfil > Notificações**.
> [Agora não] [Ativar]

**Se recusar ("Agora não" ou negar no sistema):** nada se perde; tudo aparece no Início do app. A tela de preferências mostra os dois estados separados ("Ligado no app, bloqueado no sistema: abrir Ajustes").

---

## TC-10.v1: Versículo do dia

**Onde aparece:** Perfil > Versículo do dia (e na missão de boas-vindas).

> O versículo do dia é agendado no seu aparelho. Nada sobre ele é enviado ao servidor. Você pode desligar ou mudar o horário quando quiser.

Não é consentimento (não há tratamento de dado pessoal). A notificação local depende da permissão de notificações do sistema; se ela estiver negada, o versículo aparece no Início.

---

## TC-11.v1: Câmera

**Onde aparece:** texto do sistema ao pedir a câmera, na primeira vez que alguém toca em "Ler QR Code". Já está em `apps/app/app.config.ts`:

> A câmera é usada só para ler o QR Code de presença na entrada de um evento. Nenhuma foto é tirada nem guardada.

**Se recusar:** o check-in continua pela busca por nome com o botão "Marcar presença".

---

## TC-12.v1: Sair da comunidade

**Onde aparece:** Perfil > Comunidades > _{comunidade}_ > Sair.

> **Sair da _{comunidade}_?**
>
> - Seus pedidos de oração nesta comunidade serão apagados.
> - Sua disponibilidade e suas escalas futuras serão retiradas.
> - Seu histórico aqui (presenças e escalas passadas) deixa de mostrar seu nome e passa a aparecer como "Pessoa removida".
> - O que estiver baixado para uso sem internet nesta comunidade será apagado deste aparelho.
> - Para voltar, você vai precisar de um novo convite.
>   {Se houver operações não enviadas:} Há {n} alterações ainda não enviadas. Elas serão descartadas.
>   {Se for o único administrador:} Você é o único administrador. Antes de sair, nomeie outra pessoa como administradora.
>   [Cancelar] [Sair da comunidade]

---

## TC-13.v1: Excluir conta

**Onde aparece:** Perfil > Excluir conta (app e web) e `/excluir-conta`. Exige a senha (e o código de segundo fator, se ligado).

> **Excluir sua conta?**
> Isso não pode ser desfeito.
>
> - Você sai de todas as comunidades e é desconectado de todos os aparelhos.
> - Seus pedidos de oração e sua disponibilidade são apagados.
> - Seu nome, e-mail, WhatsApp e senha são apagados. Onde você aparecia (escalas passadas, presenças, sugestões, avisos), passa a aparecer "Pessoa removida". Os números da comunidade continuam.
> - Cópias de segurança cifradas com seus dados se apagam sozinhas em até 100 dias.
> - Antes, se quiser, [baixe uma cópia dos seus dados].
>   [Cancelar] [Excluir minha conta]

---

## TC-14.v1: Exportar meus dados

**Onde aparece:** Perfil > Exportar meus dados.

> Vamos gerar um arquivo com os seus dados: conta, comunidades, escalas, inscrições, presenças, seus pedidos de oração e suas sugestões. Ele fica disponível por 24 horas e só pode ser baixado por você. Guarde-o com cuidado: ele contém seus pedidos de oração sem cifragem.
> [Gerar arquivo]

---

## Notas para a revisão jurídica

1. TC-03: consentimento por comunidade como condição de participação (art. 9º, § 3º) e redação do destaque (art. 11, I).
2. TC-01 e TC-03: suficiência da autodeclaração de idade e da ciência do responsável declarada pelo próprio adolescente de 16 e 17 anos (Lei nº 15.211/2025; Código Civil, art. 4º, I).
3. TC-04: inscrição de menores de 16 pelo responsável, com o contato do responsável; menores de 12 (LGPD, art. 14, § 1º).
4. TC-06: forma da manifestação de consentimento para o pedido de oração.
