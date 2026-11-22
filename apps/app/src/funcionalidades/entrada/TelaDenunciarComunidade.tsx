import { useMutation } from '@tanstack/react-query'
import { ESPACO } from '@uj/tokens'
import { useLocalSearchParams } from 'expo-router'
import { useState } from 'react'

import { NOME_DO_APP } from '@/constantes'
import { api } from '@/servicos/api'
import type { MotivoDaDenunciaDeComunidade } from '@/servicos/contrato'
import { Aviso } from '@/ui/Aviso'
import { BarraDeAcao } from '@/ui/BarraDeAcao'
import { Botao } from '@/ui/Botao'
import { Campo } from '@/ui/Campo'
import { Cartao } from '@/ui/Cartao'
import { CartaoDeVidro } from '@/ui/CartaoDeVidro'
import { EstadoVazio } from '@/ui/EstadoVazio'
import { AvisoDeFalha } from '@/ui/Falha'
import { ListaDeOpcoes, type Opcao } from '@/ui/ListaDeOpcoes'
import { useConfirmarDescarte, useTravaDeEnvio, voltarOu } from '@/ui/navegacao'
import { Tela } from '@/ui/Tela'
import { Texto } from '@/ui/Texto'
import { parametro } from '@/utilidades/parametros'

/**
 * TC-19.v1: os motivos que a API aceita hoje. "Risco a criança ou
 * adolescente" e "Pessoa com menos de 16 anos" entram quando a API aceitar.
 */
export const NOME_DO_MOTIVO_DA_DENUNCIA: Readonly<Record<MotivoDaDenunciaDeComunidade, string>> = {
  falsa: 'Comunidade falsa ou que se passa por outra',
  golpe: 'Golpe',
  ofensiva: 'Conteúdo ofensivo ou ilegal',
  spam: 'Spam ou propaganda',
  outro: 'Outro',
}

const MOTIVOS: readonly Opcao<MotivoDaDenunciaDeComunidade>[] = (
  Object.keys(NOME_DO_MOTIVO_DA_DENUNCIA) as MotivoDaDenunciaDeComunidade[]
).map((valor) => ({ valor, rotulo: NOME_DO_MOTIVO_DA_DENUNCIA[valor] }))

/**
 * Denunciar comunidade (ADR 0007, Apple 1.2): a comunidade achada na busca ou
 * a própria. Vai para a fila da Plataforma; quem denunciou não aparece para
 * a comunidade. Rota `/denunciar-comunidade?idPublico=&nome=`.
 */
export function TelaDenunciarComunidade() {
  const parametros = useLocalSearchParams<{ idPublico: string; nome: string }>()
  const idPublico = parametro(parametros.idPublico)
  const nome = parametro(parametros.nome) ?? 'esta comunidade'
  const [motivo, setMotivo] = useState<MotivoDaDenunciaDeComunidade | null>(null)
  const [detalhe, setDetalhe] = useState('')
  const trava = useTravaDeEnvio()
  const enviar = useMutation({
    mutationFn: () =>
      api.post(`/api/v1/comunidades/${idPublico}/denuncias`, {
        motivo,
        ...(detalhe.trim() ? { detalhe: detalhe.trim() } : {}),
      }),
    // O detalhe pode citar pessoas: não fica guardado depois do envio.
    gcTime: 0,
    onSettled: () => trava.soltar(),
  })
  const liberarSaida = useConfirmarDescarte(
    !enviar.isSuccess && (motivo !== null || detalhe.trim().length > 0),
  )

  if (!idPublico) {
    return (
      <Tela pilha titulo="Denunciar comunidade">
        <EstadoVazio
          icone="denuncia"
          titulo="Escolha a comunidade primeiro"
          descricao="Abra a comunidade pela busca, ou use Perfil, Mais opções, Denunciar comunidade."
          acao={{ titulo: 'Voltar', aoPressionar: () => voltarOu('/') }}
        />
      </Tela>
    )
  }

  if (enviar.isSuccess) {
    return (
      <Tela pilha titulo="Denúncia enviada">
        <Aviso tipo="sucesso" titulo="Denúncia enviada. Obrigado por avisar." anunciar>
          {`Ninguém da ${nome} fica sabendo quem denunciou.`}
        </Aviso>
        <Botao
          titulo="Voltar"
          variante="secundario"
          aoPressionar={() => {
            liberarSaida()
            voltarOu('/')
          }}
        />
      </Tela>
    )
  }

  return (
    <Tela
      pilha
      titulo={`Denunciar ${nome}?`}
      barraDeAcao={
        <BarraDeAcao>
          <Botao
            titulo="Enviar denúncia"
            tamanho="grande"
            desabilitado={motivo === null}
            motivo="Escolha o motivo."
            carregando={enviar.isPending}
            aoPressionar={() => {
              if (!motivo || !trava.pegar()) return
              enviar.mutate()
            }}
          />
        </BarraDeAcao>
      }
    >
      {/* Em cartão: texto nu sob o brilho coral do topo não tem o contraste provado (fundação, regra 12). */}
      <Cartao>
        <Texto variante="corpo">
          {`Sua denúncia vai para a equipe do ${NOME_DO_APP}, não para a comunidade. Ninguém da comunidade fica sabendo quem denunciou.`}
        </Texto>
      </Cartao>
      <ListaDeOpcoes rotulo="Motivo" opcoes={MOTIVOS} valor={motivo} aoMudar={setMotivo} />
      <CartaoDeVidro opaco intervalo={ESPACO.e8}>
        <Campo
          rotulo="Conte o que aconteceu"
          opcional
          ajuda="Não escreva dados de saúde nem documentos."
          value={detalhe}
          onChangeText={setDetalhe}
          multiline
          maxLength={500}
          mostrarContador
        />
      </CartaoDeVidro>
      {enviar.error ? (
        <AvisoDeFalha erro={enviar.error} titulo="A denúncia não foi enviada" />
      ) : null}
      <Botao titulo="Cancelar" variante="terciario" alinhado aoPressionar={() => voltarOu('/')} />
    </Tela>
  )
}
