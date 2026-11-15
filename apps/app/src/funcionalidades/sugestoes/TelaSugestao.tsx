import { ESPACO } from '@uj/tokens'
import { router, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { View } from 'react-native'

import { useSessao } from '@/estado/sessao'
import {
  STATUS_DA_SUGESTAO,
  type StatusDaSugestao,
  type Sugestao,
} from '@/servicos/contratoDosModulos'
import { mensagemDoErro, SemConexao } from '@/servicos/erros'
import { confirmar } from '@/utilidades/confirmar'
import { formatarData } from '@/utilidades/formatos'
import { parametro } from '@/utilidades/parametros'
import { Aviso } from '@/ui/Aviso'
import { BarraDeAcao } from '@/ui/BarraDeAcao'
import { Botao } from '@/ui/Botao'
import { voltar } from '@/ui/CabecalhoDeTela'
import { Campo } from '@/ui/Campo'
import { CartaoDeVidro } from '@/ui/CartaoDeVidro'
import { Chip } from '@/ui/Chip'
import { CartaoDeEsqueleto, Esqueleto } from '@/ui/Esqueleto'
import { EstadoVazio } from '@/ui/EstadoVazio'
import { LinhaDeLista } from '@/ui/LinhaDeLista'
import { Secao } from '@/ui/Secao'
import { Segmentos } from '@/ui/Segmentos'
import { Tela } from '@/ui/Tela'
import { Texto } from '@/ui/Texto'
import { mostrarToast } from '@/ui/Toast'

import { usePode } from '../comunidade/permissoes'
import { BotaoDenunciar } from '../denuncias/BotaoDenunciar'
import { SemComunidade } from '../navegacao/SemComunidade'
import {
  NOME_DO_STATUS,
  TOM_DO_STATUS,
  useExcluirSugestao,
  useModerarSugestao,
  useSugestao,
} from './consultas'

/** Rota `/sugestoes/[sugestaoId]`: ler; organizador para cima também modera. */
export function TelaSugestao() {
  const sugestaoId = parametro(useLocalSearchParams<{ sugestaoId: string }>().sugestaoId)
  const { comunidadeAtiva } = useSessao()
  if (!comunidadeAtiva || !sugestaoId) {
    return (
      <Tela pilha titulo="Sugestão">
        {comunidadeAtiva ? null : <SemComunidade oQue="a sugestão" />}
      </Tela>
    )
  }
  return <Detalhe comunidadeId={comunidadeAtiva.id} sugestaoId={sugestaoId} />
}

function Detalhe({ comunidadeId, sugestaoId }: { comunidadeId: string; sugestaoId: string }) {
  const pode = usePode()
  const sugestao = useSugestao(comunidadeId, sugestaoId)
  if (sugestao.isPending) {
    return (
      <Tela pilha titulo="Sugestão">
        <Esqueleto rotulo="Carregando a sugestão">
          <CartaoDeEsqueleto titulo />
        </Esqueleto>
      </Tela>
    )
  }
  if (sugestao.error) {
    return (
      <Tela pilha titulo="Sugestão">
        <EstadoVazio
          icone={sugestao.error instanceof SemConexao ? 'semConexao' : 'erro'}
          titulo="Não deu para abrir a sugestão"
          descricao={mensagemDoErro(sugestao.error)}
          acao={{ titulo: 'Tentar de novo', aoPressionar: () => void sugestao.refetch() }}
        />
      </Tela>
    )
  }
  const s = sugestao.data
  return pode('sugestao', 'moderar') ? (
    <Moderacao key={s.versao} comunidadeId={comunidadeId} sugestao={s} />
  ) : (
    <Tela pilha titulo={s.titulo}>
      <Leitura sugestao={s} />
      {!s.minha ? (
        <BotaoDenunciar
          comunidadeId={comunidadeId}
          recursoTipo="sugestao"
          recursoId={s.id}
          descricao={`a sugestão "${s.titulo}"`}
          // Bloquear quem enviou uma sugestão anônima revelaria a autoria.
          podeBloquear={!s.anonima}
          // Depois de bloquear, o conteúdo some: a tela volta.
          aoBloquear={voltar}
        />
      ) : null}
    </Tela>
  )
}

/** Situação, quem enviou e quando, o texto em `leitura` e a resposta da organização. */
function Leitura({ sugestao: s }: { sugestao: Sugestao }) {
  return (
    <>
      <View style={{ gap: ESPACO.e8 }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: ESPACO.e8 }}>
          <Chip texto={NOME_DO_STATUS[s.status]} tom={TOM_DO_STATUS[s.status]} />
          {s.anonima ? <Chip texto="Anônima" tom="neutro" /> : null}
        </View>
        <Texto variante="legenda" cor="textoSuave">
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
      <CartaoDeVidro>
        <Texto variante="leitura" selectable>
          {s.texto}
        </Texto>
      </CartaoDeVidro>
      <CartaoDeVidro sobrancelha="Resposta da organização">
        {s.resposta ? (
          <>
            <Texto variante="leitura" selectable>
              {s.resposta}
            </Texto>
            <Texto variante="legenda" cor="textoSuave">
              {[s.respondidaPorNome, s.respondidaEm ? formatarData(s.respondidaEm) : null]
                .filter(Boolean)
                .join(' · ')}
            </Texto>
          </>
        ) : (
          <Texto variante="corpo" cor="textoSuave">
            Ainda sem resposta. Quando a organização responder, aparece aqui.
          </Texto>
        )}
      </CartaoDeVidro>
    </>
  )
}

/**
 * Moderação (3.7.2): segmentos de situação, o campo de resposta e "Salvar
 * status e resposta" na barra de ação; excluir fica isolado numa linha
 * destrutiva, com confirmação nativa.
 */
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
    <Tela
      pilha
      titulo={sugestao.titulo}
      barraDeAcao={
        <BarraDeAcao>
          <Botao
            titulo="Salvar status e resposta"
            tamanho="grande"
            desabilitado={!mudou}
            motivo="Mude o status ou a resposta para salvar."
            carregando={moderar.isPending}
            aoPressionar={() =>
              moderar.mutate(
                {
                  id: sugestao.id,
                  status,
                  resposta: resposta.trim() || null,
                  versao: sugestao.versao,
                },
                { onSuccess: () => mostrarToast({ texto: 'Moderação salva' }) },
              )
            }
          />
        </BarraDeAcao>
      }
    >
      <Leitura sugestao={sugestao} />
      <Secao titulo="Moderar">
        <Segmentos
          rotulo="Status"
          valor={status}
          aoMudar={setStatus}
          segmentos={STATUS_DA_SUGESTAO.map((v) => ({ valor: v, rotulo: NOME_DO_STATUS[v] }))}
        />
        <CartaoDeVidro opaco>
          <Campo
            rotulo="Resposta (quem sugeriu lê)"
            value={resposta}
            onChangeText={setResposta}
            multiline
            maxLength={2000}
            mostrarContador
            ajuda="Deixe em branco para não responder agora."
          />
        </CartaoDeVidro>
        {moderar.error ? (
          <Aviso tipo="erro" titulo="Não deu para salvar a moderação" anunciar>
            {mensagemDoErro(moderar.error)}
          </Aviso>
        ) : null}
      </Secao>
      {excluir.error ? (
        <Aviso tipo="erro" titulo="Não deu para excluir" anunciar>
          {mensagemDoErro(excluir.error)}
        </Aviso>
      ) : null}
      <CartaoDeVidro lista opaco>
        <LinhaDeLista
          icone="excluir"
          titulo="Excluir sugestão"
          descricao="Some para quem enviou e para a organização."
          rotuloAcessivel="Excluir sugestão"
          dica="Some para quem enviou e para a organização. Pede confirmação."
          destrutivo
          aoPressionar={excluir.isPending ? undefined : () => void pedirExclusao()}
        />
      </CartaoDeVidro>
      {!sugestao.minha ? (
        <BotaoDenunciar
          comunidadeId={comunidadeId}
          recursoTipo="sugestao"
          recursoId={sugestao.id}
          descricao={`a sugestão "${sugestao.titulo}"`}
          podeBloquear={!sugestao.anonima}
          aoBloquear={voltar}
        />
      ) : null}
    </Tela>
  )
}
