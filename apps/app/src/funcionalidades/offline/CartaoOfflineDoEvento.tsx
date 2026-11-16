import { useMutation } from '@tanstack/react-query'

import { mensagemDoErro } from '@/servicos/erros'
import { confirmar } from '@/utilidades/confirmar'
import { Aviso } from '@/ui/Aviso'
import { Botao, ParDeBotoes } from '@/ui/Botao'
import { CartaoDeVidro } from '@/ui/CartaoDeVidro'
import { Texto } from '@/ui/Texto'

import { textoDoPreparo } from './formatos'
import { MENSAGEM_DA_WEB } from './mensagens'
import { useOffline, usePacoteDoEvento } from './ProvedorOffline'

/**
 * "Baixar para usar sem internet": baixa o pacote do encontro (roteiro,
 * equipe, tarefas, checklists e, para a organização, a lista de entrada com
 * telefone mascarado) para o banco cifrado deste aparelho.
 */
export function CartaoOfflineDoEvento({ eventoId, titulo }: { eventoId: string; titulo: string }) {
  const offline = useOffline()
  const pacote = usePacoteDoEvento(eventoId)
  const preparar = useMutation({
    mutationFn: () => offline.prepararEvento(eventoId),
    // Baixar exige rede de verdade: sem ela, o pedido falha e a tela explica.
    networkMode: 'always',
  })
  const remover = useMutation({
    mutationFn: () => offline.removerPacote(eventoId),
    networkMode: 'always',
  })

  if (!offline.disponivel) {
    return (
      <CartaoDeVidro sobrancelha="Usar sem internet">
        <Texto variante="corpo" cor="textoSuave">
          {offline.motivoIndisponivel ?? MENSAGEM_DA_WEB}
        </Texto>
      </CartaoDeVidro>
    )
  }

  const guardado = pacote.data ?? null
  const validoAte = guardado ? (offline.validoAte ?? guardado.validoAte) : null

  async function pedirRemocao() {
    const ok = await confirmar({
      titulo: 'Remover do aparelho?',
      mensagem: `A cópia de "${titulo}" sai do aparelho. Sem internet, ela deixa de abrir.`,
      confirmar: 'Remover',
      destrutivo: true,
    })
    if (ok) remover.mutate()
  }

  const erro = preparar.error ?? remover.error
  return (
    <CartaoDeVidro
      sobrancelha="Usar sem internet"
      acoes={
        <ParDeBotoes>
          <Botao
            titulo={guardado ? 'Atualizar agora' : 'Baixar para usar sem internet'}
            icone={guardado ? 'sincronizar' : 'baixar'}
            variante="secundario"
            carregando={preparar.isPending}
            desabilitado={!offline.online}
            motivo="Baixar exige conexão com a internet."
            aoPressionar={() => preparar.mutate()}
          />
          {guardado ? (
            <Botao
              titulo="Remover do aparelho"
              icone="excluir"
              variante="destrutivo"
              carregando={remover.isPending}
              aoPressionar={() => void pedirRemocao()}
            />
          ) : null}
        </ParDeBotoes>
      }
    >
      {guardado && validoAte ? (
        <>
          <Texto variante="tituloItem">{textoDoPreparo(guardado.baixadoEm, validoAte)}</Texto>
          <Texto variante="legenda" cor="textoSuave">
            Guardado cifrado neste aparelho. Pedidos de oração nunca ficam guardados.
          </Texto>
        </>
      ) : (
        <Texto variante="corpo" cor="textoSuave">
          Baixe o roteiro, quem serve, as tarefas e os checklists para consultar e marcar o que foi
          feito mesmo sem conexão. Fica cifrado neste aparelho.
        </Texto>
      )}
      {erro ? (
        <Aviso tipo="erro" titulo="Não deu certo" anunciar>
          {mensagemDoErro(erro)}
        </Aviso>
      ) : null}
    </CartaoDeVidro>
  )
}
