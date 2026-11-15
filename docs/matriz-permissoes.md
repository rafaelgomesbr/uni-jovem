# Matriz de permissões

> Gerado de `packages/dominio/src/permissoes.ts` por `npm run gerar:matriz`. Não edite à mão:
> o teste `matriz-documento` reprova quando este arquivo diverge do código.

Hierarquia: Administrador (30) > Organizador (20) > Membro (10). "Criador" é o proprietário
da plataforma, um atributo global e não um papel de comunidade. Tudo que não está listado é negado.

| Recurso | Ação | Quem pode |
| --- | --- | --- |
| plataforma | criar_comunidade | Criador (2FA) |
| plataforma | suspender_comunidade | Criador (2FA) |
| plataforma | arquivar_comunidade | Criador (2FA) |
| plataforma | excluir_comunidade | Criador (2FA) |
| plataforma | nomear_admin | Criador (2FA) |
| plataforma | intervir_em_vinculo | Criador (2FA) |
| plataforma | transferir_propriedade | Criador (2FA) |
| plataforma | ler_auditoria_da_plataforma | Criador (2FA) |
| plataforma | ler_saude_da_plataforma | Criador (2FA) |
| comunidade | ler | Membro ou acima |
| comunidade | configurar | Administrador ou acima |
| comunidade | trocar_logo | Administrador ou acima |
| vinculo | listar | Membro ou acima |
| vinculo | ver_contato | Organizador ou acima |
| vinculo | alterar_papel | Administrador ou acima |
| vinculo | desativar | Administrador ou acima |
| vinculo | remover | Administrador ou acima |
| vinculo | designar_equipe_oracao | Administrador ou acima |
| vinculo | sair | Membro ou acima, só o próprio |
| convite | listar | Administrador ou acima |
| convite | criar | Administrador ou acima |
| convite | revogar | Administrador ou acima |
| evento | ler | Membro ou acima |
| evento | criar | Organizador ou acima |
| evento | editar | Organizador ou acima |
| evento | publicar | Organizador ou acima |
| evento | cancelar_ou_adiar | Organizador ou acima |
| evento | excluir | Organizador ou acima |
| evento | ler_pacote_offline | Membro ou acima |
| modelo | ler | Organizador ou acima |
| modelo | gerenciar | Organizador ou acima |
| etapa | ler | Membro ou acima |
| etapa | gerenciar | Organizador ou acima |
| escala | ler | Membro ou acima |
| escala | atribuir | Organizador ou acima |
| escala | confirmar | Membro ou acima, só o próprio |
| escala | pedir_substituicao | Membro ou acima, só o próprio |
| escala | assumir_substituicao | Membro ou acima |
| disponibilidade | ler | Organizador ou acima; Membro ou acima, só o próprio |
| disponibilidade | informar | Membro ou acima, só o próprio |
| tarefa | ler | Membro ou acima |
| tarefa | gerenciar | Organizador ou acima |
| tarefa | concluir | Organizador ou acima; Membro ou acima, só o próprio |
| material | ler | Membro ou acima |
| material | gerenciar | Organizador ou acima |
| checklist | ler | Membro ou acima |
| checklist | gerenciar | Organizador ou acima |
| checklist | marcar | Organizador ou acima; Membro ou acima, só o próprio |
| nota_interna | ler | Organizador ou acima |
| nota_interna | gerenciar | Organizador ou acima |
| anexo | ler | Membro ou acima |
| anexo | gerenciar | Organizador ou acima |
| inscricao | ler_lista | Organizador ou acima |
| inscricao | inscrever_se | Membro ou acima, só o próprio |
| inscricao | ler_proprias | Membro ou acima, só o próprio |
| inscricao | cancelar | Organizador ou acima; Membro ou acima, só o próprio |
| inscricao | gerenciar | Organizador ou acima |
| presenca | ler | Organizador ou acima |
| presenca | registrar | Organizador ou acima |
| ao_vivo | acompanhar | Membro ou acima |
| ao_vivo | conduzir | Organizador ou acima |
| sugestao | criar | Membro ou acima |
| sugestao | ler | Organizador ou acima; Membro ou acima, só o próprio |
| sugestao | moderar | Organizador ou acima |
| pedido_oracao | criar | Membro ou acima |
| pedido_oracao | editar | Membro ou acima, só o próprio |
| pedido_oracao | excluir | Membro ou acima, só o próprio |
| pedido_oracao | mudar_visibilidade | Membro ou acima, só o próprio |
| pedido_oracao | marcar_respondido | Membro ou acima, só o próprio |
| pedido_oracao | orar | Membro ou acima |
| conteudo | ler | Membro ou acima |
| conteudo | gerenciar | Organizador ou acima |
| aviso | ler | Membro ou acima |
| aviso | publicar | Organizador ou acima |
| relatorio | ler | Organizador ou acima |
| exportacao | sem_contatos | Organizador ou acima |
| exportacao | com_contatos | Administrador ou acima |
| exportacao | baixar | Organizador ou acima, só o próprio |
| auditoria | ler | Administrador ou acima |
| denuncia | criar | Membro ou acima |
| denuncia | ler | Administrador ou acima |
| denuncia | resolver | Administrador ou acima |
| bloqueio | criar | Membro ou acima |
| bloqueio | ler_proprios | Membro ou acima, só o próprio |
| bloqueio | desfazer | Membro ou acima, só o próprio |
| notificacao | configurar_proprias | Membro ou acima |
| sincronizacao | ler_mudancas | Membro ou acima |
| sincronizacao | enviar_operacoes | Membro ou acima |

## Pedidos de oração

| Visibilidade | Quem lê |
| --- | --- |
| somente_eu | Só você. |
| equipe_oracao | Você e as pessoas designadas para a equipe de oração desta comunidade. Administradores não veem, a menos que estejam na equipe. |
| comunidade | Você e todos os membros ativos desta comunidade. |

Administradores e o Criador não recebem acesso automático a pedidos de outras pessoas.
