# QA visual do app v3 (direção A "Aurora viva")

Capturas de 22/11/2026, tiradas da prévia local (`npm run previa`, dados fictícios) com o Playwright (Chromium) pelo script `scripts/apresentacao/capturas-v3.ts`. Regerar: subir a prévia e rodar `node --import tsx scripts/apresentacao/capturas-v3.ts todas` (ou uma variante: `390-escuro`, `390-claro`, `375-escuro`, `375-claro`).

## Como ler os nomes

`<NN>-<tela>--<variante>[-pN].jpg`. A variante é `390-escuro`, `390-claro` (390x844), `375-escuro` ou `375-claro` (375x667). `-p2`, `-p3`, `-p4` são a mesma tela rolada para baixo (só nas variantes `390-escuro` e `375-claro`). `relatorio-<variante>.json` traz, por tela, o que a auditoria automática achou: rolagem horizontal, texto que vaza, alvo menor que 40 pt, texto cortado, rota "não encontrada", tela em branco, erro de console, exceção e requisição que falhou ou voltou 4xx.

## Índice

| Prefixo | Tela                                                                                                                                                                                           |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 01 a 04 | Login, login com e-mail, criar conta, link de código inválido (sem sessão)                                                                                                                     |
| 10      | Início, membro e líder, nos estados longe, véspera, no dia, acontecendo e terminou (o estado é forçado trocando a resposta de `GET /inicio` no navegador; o servidor decide pelo relógio real) |
| 11, 11b | Sino de notificações (membro e líder)                                                                                                                                                          |
| 20 a 25 | Agenda (membro, líder, "Só o que é meu", filtro clicado), Calendário em folha, "Pedem ajuda" (no alto da 20 e da 21), "Novo encontro" em folha                                                 |
| 30 a 37 | Encontro (membro; organização em Resumo, Roteiro e Convocados), Convocar em lote, "Igual ao último sábado", Novo e Editar encontro                                                             |
| 40 a 43 | Comunidade (membro, líder, "Organização" aberta), Pessoas                                                                                                                                      |
| 50 a 52 | Perfil (membro, líder, "Mais opções")                                                                                                                                                          |
| 60 a 63 | Avisos, novo aviso, pedidos de oração, pedir oração                                                                                                                                            |
| 70 a 72 | Check-in, Ao vivo (líder e quem acompanha)                                                                                                                                                     |
| 80 a 85 | Meu repertório, repertório do encontro, leitor de cifra, Modo palco, Louvor, Biblioteca                                                                                                        |
| 90 a 93 | Comece por aqui, Tenho um código, Boas-vindas, Procurar comunidade                                                                                                                             |
| 95 a 97 | `/escalas` e `/programacoes` (redirecionam para a Agenda) e uma rota inexistente (página "Não encontrado" humana)                                                                              |

## Ressalvas (leia antes de julgar uma captura)

- A semente não traz repertório nem cifra: o script monta três músicas no próximo encontro, escreve uma cifra inventada em duas delas e a Carla aceita o Louvor. É dado da prévia, não do app.
- A Agenda do líder mostra "Rascunhos (N)": são sobras das próprias capturas, feitas antes de o app passar a apagar o rascunho de "Igual ao último sábado" quando a pessoa sai sem salvar.
- A prévia não tem o Google nem a Apple configurados: o login já abre no painel de e-mail.
- Os cinco estados do cartão do momento são simulados; o relógio do servidor não foi mexido.
- Chromium apenas. WebKit e Firefox, aparelho, VoiceOver, TalkBack, Aumentar contraste, fonte grande e Reduzir movimento não foram verificados.
- Os botões "Tom −" e "Tom +" (leitor e palco) ganharam espaço sem quebra depois da última rodada de capturas: nas imagens ainda aparecem em duas linhas.
