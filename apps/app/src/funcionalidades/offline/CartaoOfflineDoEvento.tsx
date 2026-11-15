import { useMutation } from '@tanstack/react-query'
import { ESPACO } from '@uj/tokens'
import { View } from 'react-native'

import { confirmar } from '@/utilidades/confirmar'
import { AvisoDeErro } from '@/ui/AvisoDeErro'
import { Botao } from '@/ui/Botao'
import { Cartao } from '@/ui/Cartao'
import { Linha } from '@/ui/Linha'
import { Texto } from '@/ui/Texto'

import { textoDoPreparo } from './formatos'
import { MENSAGEM_DA_WEB } from './mensagens'
import { useOffline, usePacoteDoEvento } from './ProvedorOffline'

/**
 * "Preparar para usar sem internet": baixa o pacote do evento (programação,
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
      <Cartao titulo="Usar sem internet" icone="guardadoNoAparelho">
        <Texto variante="corpo">{offline.motivoIndisponivel ?? MENSAGEM_DA_WEB}</Texto>
      </Cartao>
    )
  }

  const guardado = pacote.data ?? null
  const validoAte = guardado ? (offline.validoAte ?? guardado.validoAte) : null

  async function pedirRemocao() {
    const ok = await confirmar({
      titulo: 'Remover deste aparelho?',
      mensagem: `A cópia de "${titulo}" sai do aparelho. Sem internet, ela deixa de abrir.`,
      confirmar: 'Remover',
      destrutivo: true,
    })
    if (ok) remover.mutate()
  }

  return (
    <Cartao titulo="Usar sem internet" icone="guardadoNoAparelho">
      {guardado && validoAte ? (
        <Linha
          icone="confirmado"
          titulo={textoDoPreparo(guardado.baixadoEm, validoAte)}
          descricao="Guardado cifrado neste aparelho. Pedidos de oração nunca ficam guardados."
        />
      ) : (
        <Texto variante="corpo">
          Baixe a programação, a equipe, as tarefas e os checklists para consultar e marcar o que
          foi feito mesmo sem conexão. Fica cifrado neste aparelho.
        </Texto>
      )}
      {preparar.error ? <AvisoDeErro erro={preparar.error} /> : null}
      {remover.error ? <AvisoDeErro erro={remover.error} /> : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: ESPACO.e8 }}>
        <Botao
          titulo={guardado ? 'Atualizar agora' : 'Preparar para usar sem internet'}
          icone={guardado ? 'sincronizar' : 'baixar'}
          variante={guardado ? 'secundario' : 'primario'}
          larguraTotal={!guardado}
          carregando={preparar.isPending}
          desabilitado={!offline.online}
          motivo="Preparar exige conexão com a internet."
          aoPressionar={() => preparar.mutate()}
        />
        {guardado ? (
          <Botao
            titulo="Remover deste aparelho"
            icone="excluir"
            variante="terciario"
            larguraTotal={false}
            carregando={remover.isPending}
            aoPressionar={() => void pedirRemocao()}
          />
        ) : null}
      </View>
    </Cartao>
  )
}
