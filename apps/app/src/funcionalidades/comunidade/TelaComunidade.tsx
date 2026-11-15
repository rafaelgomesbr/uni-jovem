import { NOME_DO_PAPEL } from '@uj/dominio'
import { ESPACO } from '@uj/tokens'
import { router, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'
import { View } from 'react-native'

import { useSessao } from '@/estado/sessao'
import type { ComunidadeDoVinculo, Membro } from '@/servicos/contrato'
import { Aviso } from '@/ui/Aviso'
import { Botao } from '@/ui/Botao'
import { CampoDeBusca } from '@/ui/Campo'
import { CartaoDeDestaque } from '@/ui/CartaoDeDestaque'
import { CartaoDeVidro } from '@/ui/CartaoDeVidro'
import { Chip } from '@/ui/Chip'
import { CartaoDeEsqueleto, Esqueleto } from '@/ui/Esqueleto'
import { EstadoVazio } from '@/ui/EstadoVazio'
import { AvisoDeFalha, ErroDaTela } from '@/ui/Falha'
import { LinhaDeLista, Lista } from '@/ui/LinhaDeLista'
import { Secao } from '@/ui/Secao'
import { Segmentos } from '@/ui/Segmentos'
import { parametro } from '@/utilidades/parametros'

import { SemComunidade } from '../navegacao/SemComunidade'
import { TelaDoApp } from '../navegacao/TelaDoApp'
import { logoDaComunidade } from '../perfil/imagens'
import { AvisoDeComunidadeNova } from './ComunidadeNova'
import { useConvites, useDetalheDaComunidade, useMembros, usePedidosDeEntrada } from './consultas'
import { linhaDoMembro } from './LinhaDoMembro'
import { CHIP_DO_ESTADO_DA_COMUNIDADE, NOME_CURTO_DO_ESTADO_DA_COMUNIDADE } from './nomes'
import { usePode } from './permissoes'
import { useSairDaComunidade } from './sairDaComunidade'
import { SecaoConvites } from './SecaoConvites'
import { SecaoPedidos } from './SecaoPedidos'

type Aba = 'pessoas' | 'pedidos' | 'convites'

/** `/comunidade?segmento=pedidos` (toque na notificação de pedido) abre direto nos pedidos. */
function abaDoParametro(valor: string | null): Aba | null {
  return valor === 'pessoas' || valor === 'pedidos' || valor === 'convites' ? valor : null
}

function semAcento(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

/**
 * Aba Equipe (rota `/comunidade`, 3.6.1 e quadro 08): o papel e quantas
 * pessoas no subtítulo, a identidade da comunidade (para o admin, o caminho
 * das Configurações), o destaque "Convidar pessoas" para quem convida, os
 * segmentos Pessoas, Pedidos (admin e organizador, ADR 0007) e Convites e,
 * no fim, "Sair". Cada bloco só aparece para quem pode usá-lo (mesma matriz
 * da API, que decide de verdade).
 */
export function TelaComunidade() {
  const { comunidadeAtiva } = useSessao()
  if (!comunidadeAtiva) {
    return (
      <TelaDoApp titulo="Equipe">
        <SemComunidade />
      </TelaDoApp>
    )
  }
  return <Equipe comunidade={comunidadeAtiva} />
}

function Equipe({ comunidade }: { comunidade: ComunidadeDoVinculo }) {
  const pode = usePode()
  const { conta } = useSessao()
  const membros = useMembros(comunidade.id)
  const verConvites = pode('convite', 'listar')
  const convites = useConvites(comunidade.id, verConvites)
  const verPedidos = pode('pedido_entrada', 'ler')
  const pedidos = usePedidosDeEntrada(comunidade.id, verPedidos)
  const detalhe = useDetalheDaComunidade(comunidade.id)
  const parametros = useLocalSearchParams<{ segmento?: string }>()
  const segmento = abaDoParametro(parametro(parametros.segmento))
  const [aba, setAba] = useState<Aba>(segmento ?? 'pessoas')
  // A aba fica montada: um toque novo na notificação troca o segmento já aberto.
  const [ultimoSegmento, setUltimoSegmento] = useState(segmento)
  if (segmento !== ultimoSegmento) {
    setUltimoSegmento(segmento)
    if (segmento) setAba(segmento)
  }
  const configurar = pode('comunidade', 'configurar')
  const ativa = comunidade.estado === 'ativa'
  const podeConvidar = pode('convite', 'criar')
  const sair = useSairDaComunidade(comunidade)
  const oracao = comunidade.designacoes.includes('equipe_oracao')

  const ativos = membros.data?.filter((m) => m.estado === 'ativo').length
  const papel = NOME_DO_PAPEL[comunidade.papel]
  const descricao =
    ativos === undefined
      ? `Você é ${papel}`
      : `Você é ${papel} · ${ativos} ${ativos === 1 ? 'pessoa' : 'pessoas'}`
  const validos = convites.data?.filter((c) => c.situacao === 'valido').length ?? 0
  const pendentes = pedidos.data?.length ?? 0
  const segmentos = [
    { valor: 'pessoas' as const, rotulo: 'Pessoas' },
    ...(verPedidos
      ? [{ valor: 'pedidos' as const, rotulo: pendentes ? `Pedidos (${pendentes})` : 'Pedidos' }]
      : []),
    ...(verConvites
      ? [{ valor: 'convites' as const, rotulo: validos ? `Convites (${validos})` : 'Convites' }]
      : []),
  ]
  const abaVisivel: Aba =
    (aba === 'pedidos' && !verPedidos) || (aba === 'convites' && !verConvites) ? 'pessoas' : aba

  return (
    <TelaDoApp titulo="Equipe" descricao={descricao}>
      {!ativa || oracao ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: ESPACO.e8 }}>
          {!ativa ? (
            <Chip
              texto={NOME_CURTO_DO_ESTADO_DA_COMUNIDADE[comunidade.estado]}
              tom={CHIP_DO_ESTADO_DA_COMUNIDADE[comunidade.estado].tom}
            />
          ) : null}
          {oracao ? <Chip texto="Equipe de oração" tom="quente" /> : null}
        </View>
      ) : null}

      {configurar && ativa ? (
        <CartaoDeVidro lista>
          <LinhaDeLista
            avatar={{
              nome: comunidade.nome,
              cor: comunidade.cor,
              dados: { foto: logoDaComunidade(comunidade) },
            }}
            titulo={comunidade.nome}
            descricao="Configurações, código e quem pode entrar"
            rotuloAcessivel={`Configurações da comunidade ${comunidade.nome}`}
            aoPressionar={() => router.push('/configurar-comunidade')}
          />
        </CartaoDeVidro>
      ) : null}

      {verPedidos ? <AvisoDeComunidadeNova detalhe={detalhe.data} /> : null}

      {!ativa ? (
        <Aviso tipo="alerta" titulo="Comunidade sem alterações por enquanto">
          {comunidade.estado === 'suspensa'
            ? 'Esta comunidade está suspensa: dá para consultar, mas não convidar nem mudar papéis.'
            : 'Esta comunidade não está ativa. Fale com o Criador da plataforma se precisar reativá-la.'}
        </Aviso>
      ) : null}

      {podeConvidar && ativa ? (
        <CartaoDeDestaque
          sobrancelha="Convites"
          titulo="Convidar pessoas"
          descricao="Mande um link para quem vai servir com você. Você escolhe o papel e quantos dias ele vale."
          acoes={
            <Botao
              titulo="Criar convite"
              icone="link"
              rotuloAcessivel={`Criar convite para ${comunidade.nome}`}
              aoPressionar={() => router.push('/convidar')}
            />
          }
        />
      ) : null}

      {segmentos.length > 1 ? (
        <Segmentos rotulo="Equipe" valor={abaVisivel} aoMudar={setAba} segmentos={segmentos} />
      ) : null}

      {abaVisivel === 'convites' ? (
        <SecaoConvites comunidade={comunidade} podeAlterar={ativa && podeConvidar} />
      ) : abaVisivel === 'pedidos' ? (
        <SecaoPedidos comunidade={comunidade} pedidos={pedidos} podeAlterar={ativa} />
      ) : (
        <Pessoas comunidadeId={comunidade.id} podeAlterar={ativa} membros={membros} />
      )}

      <Secao titulo="Comunidade">
        <CartaoDeVidro lista>
          <Lista>
            {configurar && ativa ? (
              <LinhaDeLista
                icone="ajustes"
                titulo="Configurações da comunidade"
                descricao="Nome, cor, logotipo, cidade e quem pode entrar"
                aoPressionar={() => router.push('/configurar-comunidade')}
              />
            ) : null}
            {configurar && ativa ? (
              <LinhaDeLista
                icone="qr"
                titulo="Código da comunidade"
                descricao="Código, QR e envio pelo WhatsApp"
                aoPressionar={() => router.push('/codigo-da-comunidade')}
              />
            ) : null}
            <LinhaDeLista
              icone="link"
              titulo="Entrar em outra comunidade"
              descricao="Código, convite ou busca"
              aoPressionar={() => router.push('/comece-por-aqui')}
            />
            {conta?.criador ? (
              <LinhaDeLista
                icone="plataforma"
                titulo="Plataforma do Criador"
                descricao="Criar e cuidar das comunidades"
                aoPressionar={() => router.push('/plataforma')}
              />
            ) : null}
            <LinhaDeLista
              icone="adicionar"
              titulo="Criar comunidade"
              rotuloAcessivel="Criar comunidade"
              aoPressionar={() =>
                router.push(conta?.criador ? '/plataforma/nova' : '/criar-comunidade')
              }
            />
            {detalhe.data?.idPublico ? (
              <LinhaDeLista
                icone="denuncia"
                titulo="Denunciar comunidade"
                descricao="Algo errado aqui? A equipe do app olha"
                aoPressionar={() =>
                  router.push({
                    pathname: '/denunciar-comunidade',
                    params: { idPublico: detalhe.data?.idPublico ?? '', nome: comunidade.nome },
                  })
                }
              />
            ) : null}
          </Lista>
        </CartaoDeVidro>
      </Secao>

      {sair.erro ? <AvisoDeFalha erro={sair.erro} titulo="Você continua na comunidade" /> : null}
      <CartaoDeVidro lista opaco>
        <LinhaDeLista
          icone="sair"
          titulo={`Sair de ${comunidade.nome}`}
          {...(sair.saindo ? { descricao: 'Saindo da comunidade' } : {})}
          destrutivo
          dica="Apaga só o seu vínculo com esta comunidade. Sua conta continua existindo."
          {...(sair.saindo ? {} : { aoPressionar: () => void sair.pedirParaSair() })}
        />
      </CartaoDeVidro>
    </TelaDoApp>
  )
}

function Pessoas({
  comunidadeId,
  podeAlterar,
  membros,
}: {
  comunidadeId: string
  podeAlterar: boolean
  membros: ReturnType<typeof useMembros>
}) {
  const pode = usePode()
  const { conta } = useSessao()
  const [busca, setBusca] = useState('')
  const podeEditar =
    podeAlterar &&
    (pode('vinculo', 'alterar_papel') ||
      pode('vinculo', 'desativar') ||
      pode('vinculo', 'designar_equipe_oracao'))

  if (membros.isPending) {
    return (
      <Esqueleto rotulo="Carregando as pessoas">
        <CartaoDeEsqueleto />
        <CartaoDeEsqueleto />
      </Esqueleto>
    )
  }
  if (membros.error) {
    return (
      <ErroDaTela
        erro={membros.error}
        titulo="As pessoas não carregaram"
        aoTentarDeNovo={() => void membros.refetch()}
      />
    )
  }

  const termo = semAcento(busca.trim())
  const casa = (m: Membro) => !termo || semAcento(m.nome).includes(termo)
  const ativos = membros.data.filter((m) => m.estado === 'ativo')
  const fora = membros.data.filter((m) => m.estado !== 'ativo')

  function linha(membro: Membro) {
    const ehVoce = membro.contaId === conta?.id
    // Ninguém mexe no próprio vínculo nem no do Criador (a API recusa os dois).
    const editavel = podeEditar && !ehVoce && !membro.criador
    return linhaDoMembro({
      comunidadeId,
      membro,
      ehVoce,
      ...(editavel
        ? {
            aoPressionar: () =>
              router.push({
                pathname: '/membro/[vinculoId]',
                params: { vinculoId: membro.vinculoId },
              }),
          }
        : {}),
    })
  }

  if (ativos.length <= 1 && fora.length === 0) {
    return (
      <>
        <CartaoDeVidro lista>
          <Lista>{ativos.map(linha)}</Lista>
        </CartaoDeVidro>
        <EstadoVazio
          icone="convidar"
          titulo="Por enquanto, só você"
          descricao={
            pode('convite', 'criar')
              ? 'Convide as pessoas da liderança para começar.'
              : 'Quando a administração convidar mais gente, as pessoas aparecem aqui.'
          }
          acao={
            pode('convite', 'criar') && podeAlterar
              ? {
                  titulo: 'Criar convite',
                  icone: 'link',
                  variante: 'secundario',
                  aoPressionar: () => router.push('/convidar'),
                }
              : {
                  titulo: 'Ver a agenda',
                  variante: 'secundario',
                  aoPressionar: () => router.push('/agenda'),
                }
          }
        />
      </>
    )
  }

  const ativosVisiveis = ativos.filter(casa)
  const foraVisiveis = fora.filter(casa)
  return (
    <>
      <CampoDeBusca rotulo="Buscar pelo nome" valor={busca} aoMudar={setBusca} />
      {ativosVisiveis.length + foraVisiveis.length === 0 ? (
        <EstadoVazio
          icone="buscar"
          titulo="Ninguém com esse nome"
          descricao="Confira a grafia ou busque por outra parte do nome."
          acao={{
            titulo: 'Limpar a busca',
            variante: 'secundario',
            aoPressionar: () => setBusca(''),
          }}
        />
      ) : null}
      {ativosVisiveis.length ? (
        <CartaoDeVidro lista>
          <Lista>{ativosVisiveis.map(linha)}</Lista>
        </CartaoDeVidro>
      ) : null}
      {foraVisiveis.length ? (
        <Secao
          titulo="Desativados e removidos"
          rodape="Desativado pode ser reativado. Removido só volta com um convite novo."
        >
          <CartaoDeVidro lista>
            <Lista>{foraVisiveis.map(linha)}</Lista>
          </CartaoDeVidro>
        </Secao>
      ) : null}
    </>
  )
}
