# ADR 0009: A administração exclui a própria comunidade, com 30 dias de carência

- **Estado:** aceita
- **Data:** 22/11/2026
- **Decisão do dono:** "quero ter um botão pra limpar os próximos eventos, pra conseguir excluir a comunidade também". A recomendação (carência de 30 dias, que o dono não vetou) segue o caso 8 de [`docs/privacidade/exclusao-de-conta.md`](../privacidade/exclusao-de-conta.md).
- **Decisão irreversível:** apagar a comunidade de vez não tem volta (o motivo desta ADR). Dentro da carência, tem.

## Contexto

Até aqui só o Criador (com o código do autenticador) mudava o ciclo de vida de uma comunidade (`ativa`, `suspensa`, `arquivada`, `exclusao_agendada`), e a rotina diária de retenção já apagava a que ficasse 30 dias em `exclusao_agendada` (`uj.excluir_comunidades_vencidas`, migração 0019). O administrador de uma comunidade, que é o dono dos dados dela e quem responde por eles, não tinha como encerrá-la. O dono do produto precisou (para sair de dados de teste) e a LGPD pede que o controlador consiga apagar o que coletou.

## Decisão

1. **A administração (nível 30) exclui a própria comunidade.** Nova ação na matriz de permissões: `comunidade.excluir` e `comunidade.desfazer_exclusao`, só `admin`. Organizador e membro recebem 403. Não é `plataforma.excluir_comunidade`, que continua do Criador e com 2FA.
2. **Carência de 30 dias**, o mesmo prazo do Criador (`DIAS_DE_CARENCIA_DA_EXCLUSAO_DA_COMUNIDADE`, em `packages/dominio`). Nesse prazo a comunidade fica em `exclusao_agendada`: some de todas as listas, nenhuma rota de comunidade a aceita (404 para todos, inclusive a administração, porque deixou de ser contexto) e a busca e o código de entrada não a encontram. Ao fim, `excluir_comunidades_vencidas` apaga tudo o que tem o `comunidade_id` (vínculos, encontros, avisos, orações, músicas e PDFs, arquivos, notificações, consentimentos da comunidade) e deixa só a auditoria anonimizada por 2 anos.
3. **As contas das pessoas NÃO são apagadas.** Só os vínculos e os dados da comunidade. A pessoa continua nas outras comunidades e pode excluir a conta pelo caminho de sempre.
4. **Desfazer dentro da carência**, só pela administração e só quando o pedido foi da própria administração (tabela `exclusoes_de_comunidade`). Pedido do Criador ou de comunidade órfã não é desfeito pela administração. Depois do prazo, nem a administração desfaz.
5. **O ciclo de vida continua protegido no banco.** O aplicativo nunca atualiza `estado` direto: duas funções `security definer` (`agendar_exclusao_da_comunidade`, `desfazer_exclusao_da_comunidade`) são o único caminho, e o gatilho `guardar_comunidade` só abre a exceção dentro da transação que a função marcou para aquela comunidade (`ciclos_de_vida_autorizados`, sem privilégio para o aplicativo). Quem não é administrador desta comunidade recebe `null` ou `false` da função e 404 da rota: não se confirma que ela existe.
6. **Aviso aos demais, sem conteúdo:** cada vínculo ativo recebe um aviso genérico ("Uma comunidade foi marcada para exclusão", sem o nome), respeitando a preferência da pessoa; desfazer avisa de novo. Nada de texto de pedido de oração em aviso, log ou auditoria. A auditoria do pedido leva só o id.
7. **Confirmação em dois passos, sem digitar** (pessoas idosas usam o app): primeiro o que some, o que não some e a carência; depois o nome da comunidade escrito na tela e o botão vermelho "Excluir para sempre". A API ainda confere o nome (422 se foi renomeada no meio).
8. **"A comunidade nunca fica sem admin ativo" (CLAUDE.md, seção 9) não se aplica à exclusão.** A regra protege os papéis DENTRO de uma comunidade que continua existindo; excluir encerra a comunidade inteira, e a carência é a proteção.

## Consequências

- A API precisa ser reimplantada (migração 0030, rotas novas). O app precisa de build novo.
- Privacidade: nenhum dado novo além de `exclusoes_de_comunidade.pedida_por` (a conta que pediu, apagada com a comunidade). O mapa de dados registra o prazo. A política já prometia a exclusão da comunidade ao fim da carência; o texto que o app mostra ao administrador entra na revisão da PH-11.
- Risco aceito: uma administração mal-intencionada (ou uma conta de administrador roubada) pode agendar a exclusão. Mitigações: confirmação em dois passos, aviso a todos os demais na hora, 30 dias para desfazer (por qualquer administrador da comunidade), o Criador pode reverter pela Plataforma e o backup de até cerca de 100 dias existe para o operador.
- Alternativa descartada: apagar na hora. Sem volta, sem tempo para um engano ser notado.
- Alternativa descartada: exigir o código do autenticador. Muitos administradores não têm 2FA ligado; a carência cobre o risco.
