import { ESPACO } from '@uj/tokens'
import { useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { View } from 'react-native'

import { useSessao } from '@/estado/sessao'
import type { Aviso } from '@/servicos/contratoDosModulos'
import { mensagemDoErro, SemConexao } from '@/servicos/erros'
import { MenuDeAcoes } from '@/ui/FolhaNaTela'
import { confirmar } from '@/utilidades/confirmar'
import { formatarData } from '@/utilidades/formatos'
import { parametro } from '@/utilidades/parametros'
import { Aviso as CaixaDeAviso } from '@/ui/Aviso'
import { BarraDeAcao } from '@/ui/BarraDeAcao'
import { Botao, BotaoIcone } from '@/ui/Botao'
import { CartaoDeVidro } from '@/ui/CartaoDeVidro'
import { Chip } from '@/ui/Chip'
import { CartaoDeEsqueleto, Esqueleto } from '@/ui/Esqueleto'
import { EstadoVazio } from '@/ui/EstadoVazio'
import { useConfirmarDescarte, voltarOu } from '@/ui/navegacao'
import { Tela } from '@/ui/Tela'
import { Texto } from '@/ui/Texto'
import { mostrarToast } from '@/ui/Toast'

import { useFusoDaComunidade } from '../comunidade/consultas'
import { usePode } from '../comunidade/permissoes'
import { BotaoDenunciar } from '../denuncias/BotaoDenunciar'
import { SemComunidade } from '../navegacao/SemComunidade'
import { useAviso, useEditarAviso, useExcluirAviso, usePublicacaoDoAviso } from './consultas'
import { CamposDoAviso, lerFormulario, valoresIniciais } from './TelaNovoAviso'

/** Rota `/avisos/[avisoId]`. */
export function TelaAviso() {
  const avisoId = parametro(useLocalSearchParams<{ avisoId: string }>().avisoId)
  const { comunidadeAtiva } = useSessao()
  if (!comunidadeAtiva || !avisoId) {
    return (
      <Tela pilha titulo="Aviso">
        {comunidadeAtiva ? null : <SemComunidade oQue="o aviso" />}
      </Tela>
    )
  }
  return <Detalhe comunidadeId={comunidadeAtiva.id} avisoId={avisoId} />
}

function Detalhe({ comunidadeId, avisoId }: { comunidadeId: string; avisoId: string }) {
  const pode = usePode()
  const aviso = useAviso(comunidadeId, avisoId)
  if (aviso.isPending) {
    return (
      <Tela pilha titulo="Aviso">
        <Esqueleto rotulo="Carregando o aviso">
          <CartaoDeEsqueleto titulo />
        </Esqueleto>
      </Tela>
    )
  }
  if (aviso.error) {
    return (
      <Tela pilha titulo="Aviso">
        <EstadoVazio
          icone={aviso.error instanceof SemConexao ? 'semConexao' : 'erro'}
          titulo="Não deu para abrir o aviso"
          descricao={mensagemDoErro(aviso.error)}
          acao={{ titulo: 'Tentar de novo', aoPressionar: () => void aviso.refetch() }}
        />
      </Tela>
    )
  }
  const a = aviso.data
  if (pode('aviso', 'publicar')) {
    return <Gestao key={a.versao} comunidadeId={comunidadeId} aviso={a} />
  }
  return (
    <Tela pilha titulo={a.titulo}>
      <Leitura aviso={a} publica={false} />
      <BotaoDenunciar
        comunidadeId={comunidadeId}
        recursoTipo="aviso"
        recursoId={a.id}
        descricao={`o aviso "${a.titulo}"`}
      />
    </Tela>
  )
}

/** Chips, quem publicou e quando (`legenda`) e o texto em `leitura`. */
function Leitura({ aviso: a, publica }: { aviso: Aviso; publica: boolean }) {
  const chipDoEstado = publica && a.estado !== 'publicado'
  return (
    <>
      <View style={{ gap: ESPACO.e8 }}>
        {a.fixado || chipDoEstado ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: ESPACO.e8 }}>
            {a.fixado ? <Chip texto="Fixado" tom="quente" icone="fixar" /> : null}
            {chipDoEstado ? (
              <Chip
                texto={a.estado === 'rascunho' ? 'Rascunho' : 'Fora do ar'}
                tom={a.estado === 'rascunho' ? 'neutro' : 'alerta'}
              />
            ) : null}
          </View>
        ) : null}
        <Texto variante="meta" cor="textoSuave">
          {[
            a.autorNome ? `Por ${a.autorNome}` : null,
            a.publicadoEm ? `publicado em ${formatarData(a.publicadoEm)}` : 'ainda não publicado',
            a.visivelAte ? `fica no ar até ${formatarData(a.visivelAte)}` : null,
          ]
            .filter(Boolean)
            .join(' · ')}
        </Texto>
      </View>
      <CartaoDeVidro>
        <Texto variante="leitura" selectable>
          {a.texto}
        </Texto>
      </CartaoDeVidro>
    </>
  )
}

/**
 * Organização (3.7.4): barra de ação com o primário do momento ("Publicar"
 * no rascunho; "Fixar no topo" ou "Desafixar do topo" no publicado) e "Mais
 * ações" (Editar, Despublicar, Excluir aviso). Editar troca a leitura pelo
 * formulário, com "Cancelar" e "Salvar alterações" na barra.
 */
function Gestao({ comunidadeId, aviso }: { comunidadeId: string; aviso: Aviso }) {
  const fuso = useFusoDaComunidade()
  const [editando, setEditando] = useState(false)
  const [maisAcoes, setMaisAcoes] = useState(false)
  const [valores, setValores] = useState(() => valoresIniciais(aviso, fuso))
  const [erros, setErros] = useState<Partial<Record<'titulo' | 'texto' | 'ate', string>>>({})
  const editar = useEditarAviso(comunidadeId)
  const publicacao = usePublicacaoDoAviso(comunidadeId)
  const excluir = useExcluirAviso(comunidadeId)
  const publicado = aviso.estado === 'publicado'
  const erro = editar.error ?? publicacao.error ?? excluir.error
  // Editando com algo mudado, sair pergunta antes (A5). Salvo, o aviso novo é a base: nada a perder.
  const iniciais = valoresIniciais(aviso, fuso)
  useConfirmarDescarte(
    editando &&
      (valores.titulo !== iniciais.titulo ||
        valores.texto !== iniciais.texto ||
        valores.ate !== iniciais.ate),
  )

  function salvar() {
    const r = lerFormulario(valores, fuso)
    if ('erros' in r) {
      setErros(r.erros)
      return
    }
    setErros({})
    editar.mutate(
      { id: aviso.id, versao: aviso.versao, ...r.dados },
      { onSuccess: () => mostrarToast({ texto: 'Alterações salvas' }) },
    )
  }

  async function despublicar() {
    const ok = await confirmar({
      titulo: 'Tirar este aviso do ar?',
      mensagem: 'Os membros deixam de ver o aviso. Você pode publicar de novo depois.',
      confirmar: 'Despublicar',
    })
    if (ok) {
      publicacao.mutate(
        { id: aviso.id, acao: 'despublicar' },
        { onSuccess: () => mostrarToast({ texto: 'Aviso fora do ar' }) },
      )
    }
  }

  async function pedirExclusao() {
    const ok = await confirmar({
      titulo: 'Excluir este aviso?',
      mensagem: 'O aviso some para todos. Não dá para desfazer.',
      confirmar: 'Excluir aviso',
      destrutivo: true,
    })
    if (ok) excluir.mutate(aviso.id, { onSuccess: () => voltarOu('/avisos') })
  }

  if (editando) {
    return (
      <Tela
        pilha
        titulo="Editar aviso"
        barraDeAcao={
          <BarraDeAcao>
            <Botao
              titulo="Cancelar"
              variante="secundario"
              tamanho="grande"
              desabilitado={editar.isPending}
              aoPressionar={() => {
                setValores(valoresIniciais(aviso, fuso))
                setErros({})
                setEditando(false)
              }}
            />
            <Botao
              titulo="Salvar alterações"
              tamanho="grande"
              carregando={editar.isPending}
              aoPressionar={salvar}
            />
          </BarraDeAcao>
        }
      >
        <CartaoDeVidro opaco intervalo={ESPACO.e16}>
          <CamposDoAviso valores={valores} aoMudar={setValores} erros={erros} fuso={fuso} />
        </CartaoDeVidro>
        {editar.error ? <ErroDaAcao erro={editar.error} /> : null}
      </Tela>
    )
  }

  const situacao = publicado
    ? 'Publicado: os membros veem no Início e na lista de avisos.'
    : aviso.estado === 'rascunho'
      ? 'Rascunho: só a organização vê.'
      : 'Fora do ar: os membros não veem mais.'

  return (
    <Tela
      pilha
      titulo={aviso.titulo}
      barraDeAcao={
        <BarraDeAcao>
          {/* "Editar" mora aqui: com "Mais" escrito, quem não lê o "…" acha (U-05). */}
          <BotaoIcone
            icone="maisAcoes"
            texto="Mais"
            rotulo="Mais ações"
            lado={48}
            dica="Editar, tirar do ar ou excluir o aviso."
            aoPressionar={() => setMaisAcoes(true)}
          />
          {publicado ? (
            <Botao
              titulo={aviso.fixado ? 'Desafixar do topo' : 'Fixar no topo'}
              icone="fixar"
              tamanho="grande"
              carregando={editar.isPending}
              aoPressionar={() =>
                editar.mutate(
                  { id: aviso.id, versao: aviso.versao, fixado: !aviso.fixado },
                  {
                    onSuccess: () =>
                      mostrarToast({ texto: aviso.fixado ? 'Aviso desafixado' : 'Aviso fixado' }),
                  },
                )
              }
            />
          ) : (
            <Botao
              titulo="Publicar"
              icone="publicar"
              tamanho="grande"
              carregando={publicacao.isPending}
              dica="Membros veem o aviso e recebem notificação, se tiverem ligado."
              aoPressionar={() =>
                publicacao.mutate(
                  { id: aviso.id, acao: 'publicar' },
                  { onSuccess: () => mostrarToast({ texto: 'Aviso publicado' }) },
                )
              }
            />
          )}
        </BarraDeAcao>
      }
    >
      <Leitura aviso={aviso} publica />
      <Texto variante="corpo" cor="textoSuave">
        {situacao}
      </Texto>
      {erro ? <ErroDaAcao erro={erro} /> : null}
      <MenuDeAcoes
        titulo="Mais ações"
        aberto={maisAcoes}
        esperarAcao
        aoFechar={() => setMaisAcoes(false)}
        acoes={[
          { titulo: 'Editar', icone: 'editar', aoPressionar: () => setEditando(true) },
          ...(publicado
            ? [
                {
                  titulo: 'Despublicar',
                  icone: 'ocultar' as const,
                  aoPressionar: despublicar,
                },
              ]
            : []),
          {
            titulo: 'Excluir aviso',
            icone: 'excluir',
            destrutiva: true,
            aoPressionar: pedirExclusao,
          },
        ]}
      />
    </Tela>
  )
}

function ErroDaAcao({ erro }: { erro: unknown }) {
  return (
    <CaixaDeAviso tipo="erro" titulo="Não deu certo" anunciar>
      {mensagemDoErro(erro)}
    </CaixaDeAviso>
  )
}
