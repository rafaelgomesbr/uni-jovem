import { ESPACO } from '@uj/tokens'
import { router, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { View } from 'react-native'

import {
  STATUS_DA_SUGESTAO,
  type StatusDaSugestao,
  type Sugestao,
} from '@/servicos/contratoDosModulos'
import { confirmar } from '@/utilidades/confirmar'
import { formatarData } from '@/utilidades/formatos'
import { parametro } from '@/utilidades/parametros'
import { AvisoDeErro } from '@/ui/AvisoDeErro'
import { Botao } from '@/ui/Botao'
import { Campo } from '@/ui/Campo'
import { Carregando } from '@/ui/Carregando'
import { Cartao } from '@/ui/Cartao'
import { GrupoDeOpcoes } from '@/ui/GrupoDeOpcoes'
import { Selo } from '@/ui/Selo'
import { Texto } from '@/ui/Texto'
import { TextoAnunciado } from '@/ui/TextoAnunciado'

import { usePode } from '../comunidade/permissoes'
import { BotaoDenunciar } from '../denuncias/BotaoDenunciar'
import { TelaDaComunidade } from '../navegacao/TelaDaComunidade'
import { NOME_DO_STATUS, useExcluirSugestao, useModerarSugestao, useSugestao } from './consultas'
import { corDoStatus } from './TelaSugestoes'

/** Rota `/sugestoes/[sugestaoId]`: ler; organizador para cima também modera. */
export function TelaSugestao() {
  const sugestaoId = parametro(useLocalSearchParams<{ sugestaoId: string }>().sugestaoId)
  return (
    <TelaDaComunidade oQue="a sugestão">
      {(c) => (sugestaoId ? <Detalhe comunidadeId={c.id} sugestaoId={sugestaoId} /> : null)}
    </TelaDaComunidade>
  )
}

function Detalhe({ comunidadeId, sugestaoId }: { comunidadeId: string; sugestaoId: string }) {
  const pode = usePode()
  const sugestao = useSugestao(comunidadeId, sugestaoId)
  if (sugestao.isPending) return <Carregando texto="Carregando a sugestão" />
  if (sugestao.error) {
    return <AvisoDeErro erro={sugestao.error} aoTentarDeNovo={() => void sugestao.refetch()} />
  }
  const s = sugestao.data
  return (
    <>
      <View style={{ gap: ESPACO.x2 }}>
        <Texto variante="titulo">{s.titulo}</Texto>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: ESPACO.x2 }}>
          <Selo texto={NOME_DO_STATUS[s.status]} cor={corDoStatus(s.status)} />
          {s.anonima ? <Selo texto="Anônima" /> : null}
        </View>
        <Texto variante="apoio" cor="textoSuave">
          {[
            s.minha
              ? 'Sua sugestão'
              : s.anonima
                ? 'Enviada sem nome'
                : `De ${s.autorNome ?? 'uma pessoa'}`,
            `em ${formatarData(s.criadoEm)}`,
          ].join(' ')}
        </Texto>
      </View>
      <Cartao>
        <Texto>{s.texto}</Texto>
      </Cartao>
      <Cartao titulo="Resposta da organização" icone="info">
        {s.resposta ? (
          <>
            <Texto>{s.resposta}</Texto>
            <Texto variante="apoio" cor="textoSuave">
              {[s.respondidaPorNome, s.respondidaEm ? formatarData(s.respondidaEm) : null]
                .filter(Boolean)
                .join(' · ')}
            </Texto>
          </>
        ) : (
          <Texto variante="apoio" cor="textoSuave">
            Ainda sem resposta. Quando a organização responder, aparece aqui.
          </Texto>
        )}
      </Cartao>
      {pode('sugestao', 'moderar') ? (
        <Moderacao key={s.versao} comunidadeId={comunidadeId} sugestao={s} />
      ) : null}
      {!s.minha ? (
        <BotaoDenunciar
          comunidadeId={comunidadeId}
          recursoTipo="sugestao"
          recursoId={s.id}
          descricao={`a sugestão "${s.titulo}"`}
        />
      ) : null}
    </>
  )
}

function Moderacao({ comunidadeId, sugestao }: { comunidadeId: string; sugestao: Sugestao }) {
  const [status, setStatus] = useState<StatusDaSugestao>(sugestao.status)
  const [resposta, setResposta] = useState(sugestao.resposta ?? '')
  const moderar = useModerarSugestao(comunidadeId)
  const excluir = useExcluirSugestao(comunidadeId)
  const mudou = status !== sugestao.status || resposta.trim() !== (sugestao.resposta ?? '')

  async function pedirExclusao() {
    const ok = await confirmar({
      titulo: 'Excluir esta sugestão?',
      mensagem: 'Ela some para quem enviou e para a organização. Não dá para desfazer.',
      confirmar: 'Excluir sugestão',
      destrutivo: true,
    })
    if (ok) excluir.mutate(sugestao.id, { onSuccess: () => router.back() })
  }

  return (
    <Cartao titulo="Moderar" icone="editar">
      <GrupoDeOpcoes
        rotulo="Status"
        valor={status}
        aoMudar={setStatus}
        opcoes={STATUS_DA_SUGESTAO.map((v) => ({ valor: v, rotulo: NOME_DO_STATUS[v] }))}
      />
      <Campo
        rotulo="Resposta (quem sugeriu lê)"
        value={resposta}
        onChangeText={setResposta}
        multiline
        maxLength={2000}
        ajuda="Deixe em branco para não responder agora."
      />
      {moderar.error ? <AvisoDeErro erro={moderar.error} /> : null}
      {moderar.isSuccess && !mudou ? (
        <TextoAnunciado variante="apoio" cor="sucesso">
          Moderação salva.
        </TextoAnunciado>
      ) : null}
      <Botao
        titulo="Salvar status e resposta"
        desabilitado={!mudou}
        motivo="Mude o status ou a resposta para salvar."
        carregando={moderar.isPending}
        aoPressionar={() =>
          moderar.mutate({
            id: sugestao.id,
            status,
            resposta: resposta.trim() || null,
            versao: sugestao.versao,
          })
        }
      />
      {excluir.error ? <AvisoDeErro erro={excluir.error} /> : null}
      <Botao
        titulo="Excluir sugestão"
        icone="excluir"
        variante="perigo"
        carregando={excluir.isPending}
        aoPressionar={() => void pedirExclusao()}
      />
    </Cartao>
  )
}
