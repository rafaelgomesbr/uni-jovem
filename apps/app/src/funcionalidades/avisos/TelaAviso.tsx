import { ESPACO } from '@uj/tokens'
import { router, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { View } from 'react-native'

import type { Aviso } from '@/servicos/contratoDosModulos'
import { confirmar } from '@/utilidades/confirmar'
import { formatarData } from '@/utilidades/formatos'
import { parametro } from '@/utilidades/parametros'
import { AvisoDeErro } from '@/ui/AvisoDeErro'
import { Botao } from '@/ui/Botao'
import { Carregando } from '@/ui/Carregando'
import { Cartao } from '@/ui/Cartao'
import { Selo } from '@/ui/Selo'
import { Texto } from '@/ui/Texto'

import { useFusoDaComunidade } from '../comunidade/consultas'
import { usePode } from '../comunidade/permissoes'
import { BotaoDenunciar } from '../denuncias/BotaoDenunciar'
import { TelaDaComunidade } from '../navegacao/TelaDaComunidade'
import {
  NOME_DO_ESTADO,
  useAviso,
  useEditarAviso,
  useExcluirAviso,
  usePublicacaoDoAviso,
} from './consultas'
import { CamposDoAviso, lerFormulario, valoresIniciais } from './TelaNovoAviso'

/** Rota `/avisos/[avisoId]`. */
export function TelaAviso() {
  const avisoId = parametro(useLocalSearchParams<{ avisoId: string }>().avisoId)
  return (
    <TelaDaComunidade oQue="o aviso">
      {(c) => (avisoId ? <Detalhe comunidadeId={c.id} avisoId={avisoId} /> : null)}
    </TelaDaComunidade>
  )
}

function Detalhe({ comunidadeId, avisoId }: { comunidadeId: string; avisoId: string }) {
  const pode = usePode()
  const aviso = useAviso(comunidadeId, avisoId)
  if (aviso.isPending) return <Carregando texto="Carregando o aviso" />
  if (aviso.error) {
    return <AvisoDeErro erro={aviso.error} aoTentarDeNovo={() => void aviso.refetch()} />
  }
  const a = aviso.data
  const publica = pode('aviso', 'publicar')
  return (
    <>
      <View style={{ gap: ESPACO.e8 }}>
        <Texto variante="tituloTela">{a.titulo}</Texto>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: ESPACO.e8 }}>
          {a.fixado ? <Selo texto="Fixado" cor="destaque" /> : null}
          {publica ? (
            <Selo
              texto={NOME_DO_ESTADO[a.estado]}
              cor={a.estado === 'publicado' ? 'sucesso' : 'alerta'}
            />
          ) : null}
        </View>
        <Texto variante="legenda" cor="textoSuave">
          {[
            a.autorNome ? `Por ${a.autorNome}` : null,
            a.publicadoEm ? `publicado em ${formatarData(a.publicadoEm)}` : 'ainda não publicado',
            a.visivelAte ? `fica no ar até ${formatarData(a.visivelAte)}` : null,
          ]
            .filter(Boolean)
            .join(' · ')}
        </Texto>
      </View>
      <Cartao>
        <Texto>{a.texto}</Texto>
      </Cartao>
      {publica ? (
        <Gestao key={a.versao} comunidadeId={comunidadeId} aviso={a} />
      ) : (
        <BotaoDenunciar
          comunidadeId={comunidadeId}
          recursoTipo="aviso"
          recursoId={a.id}
          descricao={`o aviso "${a.titulo}"`}
        />
      )}
    </>
  )
}

function Gestao({ comunidadeId, aviso }: { comunidadeId: string; aviso: Aviso }) {
  const fuso = useFusoDaComunidade()
  const [valores, setValores] = useState(() => valoresIniciais(aviso, fuso))
  const [erros, setErros] = useState<Partial<Record<'titulo' | 'texto' | 'ate', string>>>({})
  const editar = useEditarAviso(comunidadeId)
  const publicacao = usePublicacaoDoAviso(comunidadeId)
  const excluir = useExcluirAviso(comunidadeId)
  const publicado = aviso.estado === 'publicado'
  const erro = editar.error ?? publicacao.error ?? excluir.error

  function salvar() {
    const r = lerFormulario(valores, fuso)
    if ('erros' in r) {
      setErros(r.erros)
      return
    }
    setErros({})
    editar.mutate({ id: aviso.id, versao: aviso.versao, ...r.dados })
  }

  async function despublicar() {
    const ok = await confirmar({
      titulo: 'Tirar este aviso do ar?',
      mensagem: 'Os membros deixam de ver o aviso. Você pode publicar de novo depois.',
      confirmar: 'Despublicar',
    })
    if (ok) publicacao.mutate({ id: aviso.id, acao: 'despublicar' })
  }

  async function pedirExclusao() {
    const ok = await confirmar({
      titulo: 'Excluir este aviso?',
      mensagem: 'O aviso some para todos. Não dá para desfazer.',
      confirmar: 'Excluir aviso',
      destrutivo: true,
    })
    if (ok) excluir.mutate(aviso.id, { onSuccess: () => router.back() })
  }

  return (
    <>
      <Cartao titulo="Publicação" icone="publicar">
        <Texto variante="legenda" cor="textoSuave">
          {publicado
            ? 'Publicado: os membros veem no Início e na lista de avisos.'
            : aviso.estado === 'rascunho'
              ? 'Rascunho: só a organização vê.'
              : 'Fora do ar: os membros não veem mais.'}
        </Texto>
        {publicado ? (
          <>
            <Botao
              titulo={aviso.fixado ? 'Desafixar do topo' : 'Fixar no topo'}
              icone="fixar"
              variante="secundario"
              carregando={editar.isPending && editar.variables?.fixado !== undefined}
              aoPressionar={() =>
                editar.mutate({ id: aviso.id, versao: aviso.versao, fixado: !aviso.fixado })
              }
            />
            <Botao
              titulo="Despublicar"
              icone="ocultar"
              variante="secundario"
              carregando={publicacao.isPending}
              aoPressionar={() => void despublicar()}
            />
          </>
        ) : (
          <Botao
            titulo="Publicar"
            icone="publicar"
            carregando={publicacao.isPending}
            aoPressionar={() => publicacao.mutate({ id: aviso.id, acao: 'publicar' })}
            dica="Membros veem o aviso e recebem notificação, se tiverem ligado."
          />
        )}
      </Cartao>
      <Cartao titulo="Editar" icone="editar">
        <CamposDoAviso valores={valores} aoMudar={setValores} erros={erros} />
        <Botao
          titulo="Salvar alterações"
          variante="secundario"
          carregando={editar.isPending && editar.variables?.fixado === undefined}
          aoPressionar={salvar}
        />
      </Cartao>
      {erro ? <AvisoDeErro erro={erro} /> : null}
      <Botao
        titulo="Excluir aviso"
        icone="excluir"
        variante="destrutivo"
        carregando={excluir.isPending}
        aoPressionar={() => void pedirExclusao()}
      />
    </>
  )
}
