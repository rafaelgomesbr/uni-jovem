import { useQuery } from '@tanstack/react-query'
import { NOME_DO_PAPEL } from '@uj/dominio'
import { ESPACO, RITMO } from '@uj/tokens'
import Constants from 'expo-constants'
import { router, type Href } from 'expo-router'
import { useState, type ReactNode } from 'react'
import { View } from 'react-native'

import { NOME_DO_APP } from '@/constantes'
import { CHAVES } from '@/estado/clienteDeConsulta'
import { useSessao } from '@/estado/sessao'
import { api } from '@/servicos/api'
import type { ComunidadeDoVinculo, Conta } from '@/servicos/contrato'
import { confirmar } from '@/utilidades/confirmar'
import { Aparecer } from '@/ui/Aparecer'
import { Avatar } from '@/ui/Avatar'
import { AvisoDeErro } from '@/ui/AvisoDeErro'
import { Botao } from '@/ui/Botao'
import { Cartao } from '@/ui/Cartao'
import type { NomeDoIcone } from '@/ui/Icone'
import { useLayoutLargo } from '@/ui/LayoutDividido'
import { Linha, Lista } from '@/ui/Linha'
import { Secao } from '@/ui/Secao'
import { Selo } from '@/ui/Selo'
import { Tela } from '@/ui/Tela'
import { Texto } from '@/ui/Texto'

import { MarcaDaComunidade } from '../comunidade/Identidade'
import { useSairDaComunidade } from '../comunidade/sairDaComunidade'
import { useGruposDoMais } from '../navegacao/mais'
import { TelaDoApp } from '../navegacao/TelaDoApp'
import { mensagemDePendencias } from '../offline/avisoAntesDeApagar'
import { useOffline } from '../offline/ProvedorOffline'
import { MissoesDeConfiguracao } from '../onboarding/MissoesDeConfiguracao'
import { abrirDocumento, DOCUMENTOS } from '../privacidade/TelaPrivacidade'

/**
 * Segurança da conta (Face ID, contas conectadas, verificação em dois passos,
 * aparelhos) é uma tela própria, mantida junto da autenticação.
 */
export const ROTA_DA_SEGURANCA = '/conta/seguranca' satisfies Href

interface ItemDoPerfil {
  chave: string
  titulo: string
  descricao?: string
  icone?: NomeDoIcone
  inicio?: ReactNode
  aoPressionar?: () => void
  extra?: ReactNode
  destrutivo?: boolean
  rotuloAcessivel?: string
}

interface CategoriaDoPerfil {
  chave: string
  titulo: string
  /** Resumo da categoria, mostrado na coluna de navegação da web larga. */
  resumo: string
  icone: NomeDoIcone
  itens: ItemDoPerfil[]
  /** Bloco extra abaixo da lista (ex.: missões de configuração). */
  complemento?: ReactNode
}

function versaoDoApp(): string {
  const versao = Constants.expoConfig?.version ?? '0.0.0'
  const variante = (Constants.expoConfig?.extra as { variante?: string } | undefined)?.variante
  return variante && variante !== 'producao' ? `${versao} (${variante})` : versao
}

/** Perfil: aba na web larga; no celular, abre pelo "Mais" (`/conta`, na pilha). */
export function TelaPerfil({ naPilha = false }: { naPilha?: boolean }) {
  const { conta, sair, comunidadeAtiva } = useSessao()
  const offline = useOffline()
  const largo = useLayoutLargo()
  const [saindo, setSaindo] = useState(false)
  const categorias = useCategoriasDoPerfil(conta, comunidadeAtiva)
  const [escolhida, setEscolhida] = useState<string>('conta')
  const Moldura = naPilha ? TelaNaPilha : TelaDoApp

  if (!conta) return null

  async function pedirParaSair() {
    // Sair apaga os dados guardados para uso sem internet: antes, mostra o que não foi enviado.
    const naoEnviadas = await offline.naoEnviadas()
    const ok = await confirmar(
      naoEnviadas.length
        ? {
            titulo: 'Sair e apagar o que não foi enviado?',
            mensagem: mensagemDePendencias(naoEnviadas),
            confirmar: 'Sair e apagar',
            destrutivo: true,
          }
        : {
            titulo: 'Sair deste aparelho?',
            mensagem: 'Você vai precisar do e-mail e da senha para entrar de novo.',
            confirmar: 'Sair',
            destrutivo: true,
          },
    )
    if (!ok) return
    setSaindo(true)
    await sair()
  }

  const botaoSair = (
    <View style={{ paddingTop: ESPACO.x2 }}>
      <Botao
        titulo="Sair deste aparelho"
        icone="sair"
        variante="perigo"
        carregando={saindo}
        dica="Você vai precisar do e-mail e da senha para entrar de novo."
        aoPressionar={() => void pedirParaSair()}
      />
    </View>
  )

  if (largo) {
    const atual = categorias.find((c) => c.chave === escolhida) ?? categorias[0]!
    return (
      <Moldura titulo="Perfil" larga>
        <CabecalhoDoPerfil conta={conta} comunidade={comunidadeAtiva} largo />
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: ESPACO.x8 }}>
          <View style={{ width: 300, gap: RITMO.entreSecoes }}>
            <Cartao>
              <View accessibilityRole="tablist" accessibilityLabel="Categorias do perfil">
                <Lista>
                  {categorias.map((c) => (
                    <Linha
                      key={c.chave}
                      icone={c.icone}
                      titulo={c.titulo}
                      descricao={c.resumo}
                      linhasDaDescricao={1}
                      selecionado={c.chave === atual.chave}
                      rotuloAcessivel={`${c.titulo}. ${c.resumo}`}
                      aoPressionar={() => setEscolhida(c.chave)}
                    />
                  ))}
                </Lista>
              </View>
            </Cartao>
            {botaoSair}
          </View>
          <View style={{ flex: 1, minWidth: 0 }} accessibilityLabel={atual.titulo}>
            {/* `key` remonta a entrada curta a cada troca de categoria. */}
            <Aparecer key={atual.chave} style={{ gap: RITMO.entreSecoes }}>
              <CategoriaEmCartao categoria={atual} />
            </Aparecer>
          </View>
        </View>
      </Moldura>
    )
  }

  return (
    <Moldura titulo="Perfil">
      <CabecalhoDoPerfil conta={conta} comunidade={comunidadeAtiva} />
      {categorias.map((c) => (
        <CategoriaEmCartao key={c.chave} categoria={c} />
      ))}
      {botaoSair}
    </Moldura>
  )
}

function TelaNaPilha({
  titulo,
  larga,
  children,
}: {
  titulo: string
  larga?: boolean
  children: ReactNode
}) {
  return (
    <Tela cabecalhoNativo titulo={titulo} {...(larga ? { larga } : {})}>
      {children}
    </Tela>
  )
}

function CategoriaEmCartao({ categoria }: { categoria: CategoriaDoPerfil }) {
  return (
    <>
      <Secao titulo={categoria.titulo}>
        <Cartao style={{ paddingVertical: ESPACO.x2 }}>
          <Lista>
            {categoria.itens.map(({ chave, ...item }) => (
              <Linha key={chave} {...item} />
            ))}
          </Lista>
        </Cartao>
      </Secao>
      {categoria.complemento}
    </>
  )
}

/** Topo do Perfil: avatar grande, nome, e-mail, comunidade ativa e as duas ações de identidade. */
function CabecalhoDoPerfil({
  conta,
  comunidade,
  largo = false,
}: {
  conta: Conta
  comunidade: ComunidadeDoVinculo | null
  largo?: boolean
}) {
  return (
    <Cartao>
      <View
        style={{
          flexDirection: largo ? 'row' : 'column',
          alignItems: 'center',
          gap: largo ? ESPACO.x6 : ESPACO.x4,
        }}
      >
        <Avatar nome={conta.nome} avatar={conta.avatar ?? null} tamanho="G" />
        <View
          style={{
            flex: largo ? 1 : undefined,
            alignSelf: largo ? 'auto' : 'stretch',
            alignItems: largo ? 'flex-start' : 'center',
            gap: ESPACO.x1,
          }}
        >
          <Texto
            variante="titulo"
            centralizado={!largo}
            accessibilityRole="text"
            style={{ fontSize: 24, lineHeight: 28 }}
          >
            {conta.nome}
          </Texto>
          <Texto variante="apoio" cor="textoSuave" centralizado={!largo} selectable>
            {conta.email}
          </Texto>
          {comunidade ? (
            <View
              accessible
              accessibilityLabel={`Comunidade ativa: ${comunidade.nome}. ${NOME_DO_PAPEL[comunidade.papel]}`}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: ESPACO.x2,
                marginTop: ESPACO.x1,
                maxWidth: '100%',
              }}
            >
              <MarcaDaComunidade cor={comunidade.cor} tamanho={22} />
              <Texto variante="apoio" style={{ flexShrink: 1 }}>
                {comunidade.nome} · {NOME_DO_PAPEL[comunidade.papel]}
              </Texto>
            </View>
          ) : null}
        </View>
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            justifyContent: 'center',
            gap: RITMO.entreBotoes,
          }}
        >
          <Botao
            titulo="Editar perfil"
            icone="editar"
            variante="secundario"
            larguraTotal={false}
            aoPressionar={() => router.push('/editar-perfil')}
          />
          <Botao
            titulo="Trocar avatar"
            icone="perfil"
            variante="secundario"
            larguraTotal={false}
            aoPressionar={() => router.push('/escolher-avatar')}
          />
        </View>
      </View>
    </Cartao>
  )
}

/**
 * Há transferência de propriedade da plataforma esperando esta pessoa? Mesma
 * chave e rota da tela de transferência; sem resposta (API antiga, sem rede),
 * conta como "não".
 */
function useTransferenciaPendente(ligado: boolean): boolean {
  const consulta = useQuery({
    queryKey: [...CHAVES.eu, 'transferencia'],
    queryFn: () =>
      api
        .get<{ transferencia: unknown }>('/api/v1/eu/transferencia')
        .then((r) => r.transferencia ?? null),
    enabled: ligado,
    retry: false,
  })
  return !!consulta.data
}

/** As categorias do Perfil, na ordem em que aparecem. Cada item só aparece para quem pode usá-lo. */
function useCategoriasDoPerfil(
  conta: Conta | null,
  comunidadeAtiva: ComunidadeDoVinculo | null,
): CategoriaDoPerfil[] {
  const { comunidades } = useSessao()
  const sairDaComunidade = useSairDaComunidade(comunidadeAtiva)
  const grupos = useGruposDoMais()
  const transferenciaPendente = useTransferenciaPendente(conta !== null)
  if (!conta) return []

  // Os módulos da comunidade (antes na aba "Mais") abrem o Perfil: são o uso mais frequente.
  const modulos: CategoriaDoPerfil[] = comunidadeAtiva
    ? grupos.map((g) => ({
        chave: `modulos-${g.titulo}`,
        titulo: g.titulo,
        resumo: g.itens.map((i) => i.rotulo).join(', '),
        icone: g.titulo === 'Organização' ? ('relatorio' as const) : ('comunidade' as const),
        itens: g.itens.map((i) => ({
          chave: i.rotulo,
          titulo: i.rotulo,
          descricao: i.descricao,
          icone: i.icone,
          aoPressionar: () => router.push(i.href),
        })),
      }))
    : []

  // Plataforma no topo do Perfil, só para o Criador. A transferência de
  // propriedade aparece também para quem tem uma transferência pendente.
  const plataforma: ItemDoPerfil[] = [
    ...(conta.criador
      ? [
          {
            chave: 'plataforma',
            titulo: 'Plataforma',
            descricao: 'Criar e cuidar das comunidades',
            icone: 'plataforma' as const,
            aoPressionar: () => router.push('/plataforma'),
          },
        ]
      : []),
    ...(conta.criador || transferenciaPendente
      ? [
          {
            chave: 'transferencia',
            titulo: 'Transferência de propriedade',
            descricao: transferenciaPendente
              ? 'Há uma transferência esperando a sua resposta.'
              : 'Passar a plataforma para outra pessoa.',
            icone: 'trocar' as const,
            aoPressionar: () => router.push('/plataforma/transferencia'),
          },
        ]
      : []),
  ]

  return [
    ...(plataforma.length
      ? [
          {
            chave: 'plataforma',
            titulo: 'Plataforma',
            resumo: 'Criar e cuidar das comunidades',
            icone: 'plataforma' as const,
            itens: plataforma,
          },
        ]
      : []),
    ...modulos,
    {
      chave: 'conta',
      titulo: 'Conta',
      resumo: 'Dados pessoais e avatar',
      icone: 'perfil',
      itens: [
        {
          chave: 'dados',
          titulo: 'Dados pessoais',
          descricao: conta.whatsapp
            ? 'Nome e WhatsApp. O e-mail é o da entrada.'
            : 'Nome e WhatsApp (ainda sem WhatsApp).',
          icone: 'editar',
          aoPressionar: () => router.push('/editar-perfil'),
        },
        {
          chave: 'avatar',
          titulo: 'Avatar',
          descricao: conta.avatar ? 'Ícone e cor escolhidos por você.' : 'Usando suas iniciais.',
          inicio: <Avatar nome={conta.nome} avatar={conta.avatar ?? null} tamanho="P" decorativo />,
          aoPressionar: () => router.push('/escolher-avatar'),
        },
      ],
    },
    {
      chave: 'seguranca',
      titulo: 'Segurança',
      resumo: 'Face ID, contas conectadas e aparelhos',
      icone: 'seguranca',
      itens: [
        {
          chave: 'seguranca',
          titulo: 'Segurança da conta',
          descricao:
            'Face ID, contas conectadas, verificação em dois passos e aparelhos conectados.',
          icone: 'seguranca',
          extra: (
            <Selo
              texto={conta.doisFatores ? '2 passos ligado' : '2 passos desligado'}
              cor={conta.doisFatores ? 'sucesso' : 'alerta'}
            />
          ),
          rotuloAcessivel: `Segurança da conta. Verificação em dois passos ${conta.doisFatores ? 'ligada' : 'desligada'}.`,
          aoPressionar: () => router.push(ROTA_DA_SEGURANCA),
        },
      ],
    },
    {
      chave: 'notificacoes',
      titulo: 'Notificações',
      resumo: 'Preferências e versículo do dia',
      icone: 'sino',
      itens: [
        {
          chave: 'preferencias',
          titulo: 'Preferências de notificação',
          descricao: 'O que o app avisa, por tipo e por comunidade, e a permissão do aparelho.',
          icone: 'sino',
          aoPressionar: () => router.push('/notificacoes'),
        },
        {
          chave: 'versiculo',
          titulo: 'Versículo do dia',
          descricao: 'Ligar, desligar e escolher o horário.',
          icone: 'versiculo',
          aoPressionar: () => router.push('/versiculo'),
        },
      ],
    },
    {
      chave: 'comunidades',
      titulo: 'Comunidades',
      resumo: comunidadeAtiva ? `Ativa: ${comunidadeAtiva.nome}` : 'Trocar ou sair',
      icone: 'comunidade',
      itens: [
        ...(comunidades.length > 1 || (!comunidadeAtiva && comunidades.length > 0)
          ? [
              {
                chave: 'trocar',
                titulo: comunidadeAtiva ? 'Trocar de comunidade' : 'Escolher comunidade',
                descricao: `Você participa de ${comunidades.length} comunidades.`,
                icone: 'trocar' as const,
                aoPressionar: () => router.push('/trocar-comunidade'),
              },
            ]
          : []),
        {
          chave: 'ver',
          titulo: comunidadeAtiva ? `Ver ${comunidadeAtiva.nome}` : 'Sua comunidade',
          descricao: 'Pessoas, convites e o seu papel.',
          icone: 'comunidade',
          aoPressionar: () => router.push('/comunidade'),
        },
        ...(comunidadeAtiva
          ? [
              {
                chave: 'sair',
                titulo: `Sair de ${comunidadeAtiva.nome}`,
                descricao: 'Sua conta continua existindo; para voltar, só com convite novo.',
                icone: 'sair' as const,
                destrutivo: true,
                aoPressionar: () => void sairDaComunidade.pedirParaSair(),
              },
            ]
          : []),
      ],
      ...(sairDaComunidade.erro
        ? { complemento: <AvisoDeErro erro={sairDaComunidade.erro} /> }
        : {}),
    },
    {
      chave: 'privacidade',
      titulo: 'Privacidade e dados',
      resumo: 'Exportar, excluir conta, termos e política',
      icone: 'documento',
      itens: [
        {
          chave: 'exportar',
          titulo: 'Exportar meus dados',
          descricao: `Uma cópia de tudo que é seu no ${NOME_DO_APP}.`,
          icone: 'baixar',
          aoPressionar: () => router.push('/privacidade'),
        },
        {
          chave: 'pendencias',
          titulo: 'Pendências e uso sem internet',
          descricao: 'O que está guardado neste aparelho e o que falta enviar.',
          icone: 'sincronizar',
          aoPressionar: () => router.push('/pendencias'),
        },
        ...DOCUMENTOS.filter((d) => d.caminho !== '/suporte').map((d) => ({
          chave: d.caminho,
          titulo: d.titulo,
          descricao: 'Abre no navegador.',
          icone: d.icone,
          aoPressionar: () => void abrirDocumento(d.caminho),
        })),
        {
          chave: 'excluir',
          titulo: 'Excluir minha conta',
          descricao: 'Apaga a conta e sai de todas as comunidades.',
          icone: 'excluir',
          destrutivo: true,
          aoPressionar: () => router.push('/excluir-conta'),
        },
      ],
    },
    {
      chave: 'ajuda',
      titulo: 'Ajuda e sobre',
      resumo: 'Mapa da missão, suporte e versão',
      icone: 'ajuda',
      itens: [
        {
          chave: 'missao',
          titulo: 'Rever o mapa da missão',
          descricao: 'O passeio pelo app, com exemplos que não mudam nada de verdade.',
          icone: 'missao',
          aoPressionar: () => router.push({ pathname: '/missao', params: { rever: '1' } }),
        },
        {
          chave: 'traducao',
          titulo: 'Sobre a tradução da Bíblia',
          descricao: 'De onde vêm os versículos e a licença de uso.',
          icone: 'versiculo',
          aoPressionar: () => router.push('/versiculo/traducao'),
        },
        {
          chave: 'suporte',
          titulo: 'Suporte',
          descricao: 'Dúvidas e problemas. Abre no navegador.',
          icone: 'ajuda',
          aoPressionar: () => void abrirDocumento('/suporte'),
        },
        {
          chave: 'versao',
          titulo: 'Versão do app',
          icone: 'info',
          extra: (
            <Texto variante="apoio" cor="textoSuave" tabular selectable>
              {versaoDoApp()}
            </Texto>
          ),
          rotuloAcessivel: `Versão do app: ${versaoDoApp()}`,
        },
      ],
      complemento: (
        <Secao titulo="Primeiros passos">
          <Cartao>
            <MissoesDeConfiguracao />
          </Cartao>
        </Secao>
      ),
    },
  ]
}
