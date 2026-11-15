import { ESPACO } from '@uj/tokens'
import { router, useLocalSearchParams } from 'expo-router'
import { View } from 'react-native'

import { NOME_DO_APP } from '@/constantes'
import { useSessao } from '@/estado/sessao'
import type { CodigoDaComunidade, ComunidadeDoVinculo } from '@/servicos/contrato'
import { Aviso } from '@/ui/Aviso'
import { Botao, ParDeBotoes } from '@/ui/Botao'
import { CartaoDeDestaque } from '@/ui/CartaoDeDestaque'
import { CartaoDeVidro } from '@/ui/CartaoDeVidro'
import { CodigoQR } from '@/ui/CodigoQR'
import { CartaoDeEsqueleto, Esqueleto } from '@/ui/Esqueleto'
import { EstadoVazio } from '@/ui/EstadoVazio'
import { AvisoDeFalha, ErroDaTela } from '@/ui/Falha'
import { LinhaDeLista, Lista } from '@/ui/LinhaDeLista'
import { voltarOu } from '@/ui/navegacao'
import { Tela } from '@/ui/Tela'
import { Texto } from '@/ui/Texto'
import { mostrarToast } from '@/ui/Toast'
import {
  abrirLink,
  compartilharTexto,
  copiarTexto,
  linkDoWhatsApp,
} from '@/utilidades/compartilhar'
import { confirmar } from '@/utilidades/confirmar'
import { parametro } from '@/utilidades/parametros'

import { SemComunidade } from '../navegacao/SemComunidade'
import { formatarCodigoDaComunidade } from '../entrada/consultas'
import { AvisoDeComunidadeNova } from './ComunidadeNova'
import { useCodigoDaComunidade, useDetalheDaComunidade, useTrocarCodigo } from './consultas'
import { usePode } from './permissoes'

/** TC-20.v1 (docs/privacidade/textos-de-consentimento.md), conforme o modo de entrada. */
export function avisoDoCodigo(modo: string | undefined): string {
  const acao = modo === 'codigo_direto' ? 'entrar na comunidade como membro' : 'pedir para entrar'
  return `Quem tiver este código pode ${acao}, conforme a forma de entrada escolhida em Configurações. Mostre só a quem você quer na comunidade. Se o código se espalhar, toque em "Trocar código": o antigo deixa de valer na hora.`
}

/**
 * Rota `/codigo-da-comunidade` (admin). Com `?novo=1`, é o "Convide sua
 * equipe" que aparece logo depois de criar a comunidade.
 */
export function TelaCodigoDaComunidade() {
  const { comunidadeAtiva } = useSessao()
  const pode = usePode()
  const parametros = useLocalSearchParams<{ novo?: string; logo?: string }>()
  const novo = parametro(parametros.novo) === '1'
  const logoFalhou = parametro(parametros.logo) === 'falhou'
  const admin = pode('comunidade', 'ver_codigo')
  const codigo = useCodigoDaComunidade(comunidadeAtiva?.id ?? null, admin)
  const titulo = novo ? 'Convide sua equipe' : 'Código da comunidade'

  if (!comunidadeAtiva) {
    return (
      <Tela pilha titulo={titulo}>
        <SemComunidade oQue="o código" />
      </Tela>
    )
  }
  if (!admin) {
    return (
      <Tela pilha titulo={titulo} descricao={comunidadeAtiva.nome}>
        <EstadoVazio
          icone="seguranca"
          titulo="Só a administração vê o código"
          descricao="Peça o código ou um convite a uma pessoa administradora."
          acao={{ titulo: 'Voltar para a Equipe', aoPressionar: () => voltarOu('/comunidade') }}
        />
      </Tela>
    )
  }
  if (codigo.isPending) {
    return (
      <Tela pilha titulo={titulo}>
        <Esqueleto rotulo="Carregando o código">
          <CartaoDeEsqueleto titulo />
        </Esqueleto>
      </Tela>
    )
  }
  if (codigo.error) {
    return (
      <Tela pilha titulo={titulo}>
        <ErroDaTela
          erro={codigo.error}
          titulo="O código não abriu"
          aoTentarDeNovo={() => void codigo.refetch()}
        />
      </Tela>
    )
  }
  return (
    <Codigo
      comunidade={comunidadeAtiva}
      atual={codigo.data}
      novo={novo}
      logoFalhou={logoFalhou}
      titulo={titulo}
    />
  )
}

/**
 * O código grande (8 caracteres em dois blocos), o QR com o link, "Compartilhar
 * no WhatsApp", copiar e os outros apps, como funciona o modo de entrada de
 * hoje e "Trocar código" com confirmação (o antigo deixa de valer na hora).
 */
function Codigo({
  comunidade,
  atual,
  novo,
  logoFalhou,
  titulo,
}: {
  comunidade: ComunidadeDoVinculo
  atual: CodigoDaComunidade
  novo: boolean
  logoFalhou: boolean
  titulo: string
}) {
  const detalhe = useDetalheDaComunidade(comunidade.id)
  const trocar = useTrocarCodigo(comunidade.id)
  const legivel = formatarCodigoDaComunidade(atual.codigo)
  const modo = atual.modoEntrada ?? detalhe.data?.modoEntrada
  const mensagem = `Entre na ${comunidade.nome} no ${NOME_DO_APP}: abra o link ou use o código ${legivel}.\n${atual.link}`

  async function noWhatsApp() {
    const ok = await abrirLink(linkDoWhatsApp(mensagem))
    if (!ok) {
      const copiou = await copiarTexto(mensagem)
      mostrarToast(
        copiou
          ? { texto: 'O WhatsApp não abriu aqui; a mensagem foi copiada. Cole no WhatsApp.' }
          : { texto: 'Não deu para abrir o WhatsApp agora.', tipo: 'erro' },
      )
    }
  }

  async function copiar() {
    const ok = await copiarTexto(atual.codigo)
    mostrarToast(
      ok ? { texto: 'Código copiado.' } : { texto: 'Não foi possível copiar.', tipo: 'erro' },
    )
  }

  async function outrosApps() {
    const r = await compartilharTexto(mensagem)
    if (r === 'copiado') mostrarToast({ texto: 'A mensagem foi copiada. Cole onde quiser.' })
    if (r === 'falhou')
      mostrarToast({ texto: 'Não foi possível compartilhar agora.', tipo: 'erro' })
  }

  async function pedirTroca() {
    // TC-20.v1, ao trocar.
    const ok = await confirmar({
      titulo: 'Trocar o código?',
      mensagem:
        'Quem tem o código antigo não vai mais conseguir usá-lo. Quem já entrou continua na comunidade.',
      confirmar: 'Trocar',
      destrutivo: true,
    })
    if (ok)
      trocar.mutate(undefined, { onSuccess: () => mostrarToast({ texto: 'Código trocado.' }) })
  }

  return (
    <Tela
      pilha
      titulo={titulo}
      descricao={
        novo
          ? `${comunidade.nome} está pronta. Mande o código para quem vai servir com você.`
          : comunidade.nome
      }
    >
      {logoFalhou ? (
        <Aviso tipo="alerta" titulo="O logotipo não foi enviado">
          A comunidade foi criada. Envie o logotipo de novo em Configurações da comunidade.
        </Aviso>
      ) : null}
      <CartaoDeDestaque
        sobrancelha="Código da comunidade"
        acoes={
          <View style={{ gap: ESPACO.e12 }}>
            <Botao
              titulo="Compartilhar no WhatsApp"
              larguraTotal
              aoPressionar={() => void noWhatsApp()}
            />
            <ParDeBotoes>
              <Botao
                titulo="Copiar código"
                variante="secundario"
                aoPressionar={() => void copiar()}
              />
              <Botao
                titulo="Outros apps"
                variante="secundario"
                dica="Abre o compartilhamento do aparelho."
                aoPressionar={() => void outrosApps()}
              />
            </ParDeBotoes>
          </View>
        }
      >
        <View style={{ alignItems: 'center', gap: ESPACO.e12 }}>
          <Texto
            variante="numero"
            centralizado
            selectable
            accessibilityLabel={`Código: ${atual.codigo.split('').join(' ')}`}
            style={{ letterSpacing: ESPACO.e4 }}
          >
            {legivel}
          </Texto>
          <CodigoQR valor={atual.link} rotulo="QR para entrar na comunidade" />
          <Texto variante="meta" cor="textoSuave" centralizado>
            Quem estiver ao seu lado aponta a câmera para o QR. Quem estiver longe usa o código ou o
            link.
          </Texto>
        </View>
      </CartaoDeDestaque>

      <Texto variante="corpo">{avisoDoCodigo(modo)}</Texto>

      {trocar.error ? <AvisoDeFalha erro={trocar.error} titulo="O código não foi trocado" /> : null}

      {modo === 'convite' ? (
        <Aviso
          tipo="alerta"
          titulo="Hoje a entrada é só por convite"
          acao={{
            titulo: 'Mudar em Configurações',
            aoPressionar: () => router.push('/configurar-comunidade'),
          }}
        >
          Com o modo "Só por convite", o código não funciona. Escolha um modo com código para ele
          valer.
        </Aviso>
      ) : null}

      <AvisoDeComunidadeNova detalhe={detalhe.data} />

      <CartaoDeVidro lista>
        <Lista>
          <LinhaDeLista
            icone="link"
            titulo="Convite com função"
            descricao="Para chamar alguém já como organizador ou administrador"
            aoPressionar={() => router.push('/convidar')}
          />
          <LinhaDeLista
            icone="ajustes"
            titulo="Configurações da comunidade"
            descricao="Modo de entrada, busca, nome, cor e logotipo"
            aoPressionar={() => router.push('/configurar-comunidade')}
          />
        </Lista>
      </CartaoDeVidro>

      <View style={{ alignItems: 'flex-start', gap: ESPACO.e4 }}>
        <Botao
          titulo="Trocar código"
          icone="repetir"
          variante="destrutivo"
          carregando={trocar.isPending}
          aoPressionar={() => void pedirTroca()}
        />
        <Texto variante="meta" cor="textoSuave">
          O antigo deixa de valer na hora.
        </Texto>
      </View>

      {novo ? (
        <Botao
          titulo="Ir para o início"
          variante="secundario"
          tamanho="grande"
          larguraTotal
          aoPressionar={() => router.replace('/')}
        />
      ) : null}
    </Tela>
  )
}
