import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ESPACO } from '@uj/tokens'
import { router } from 'expo-router'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { View } from 'react-native'

import { NOME_DO_APP } from '@/constantes'
import { CHAVES } from '@/estado/clienteDeConsulta'
import { useSessao } from '@/estado/sessao'
import { api } from '@/servicos/api'
import type { ComunidadeCriadaPorConta } from '@/servicos/contrato'
import { ehErroDaApi } from '@/servicos/erros'
import { BarraDeAcao } from '@/ui/BarraDeAcao'
import { Botao } from '@/ui/Botao'
import { CaixaDeMarcar } from '@/ui/CaixaDeMarcar'
import { Campo } from '@/ui/Campo'
import { CartaoDeVidro } from '@/ui/CartaoDeVidro'
import { EstadoVazio } from '@/ui/EstadoVazio'
import { AvisoDeFalha } from '@/ui/Falha'
import { focar, type NoDeTexto } from '@/ui/foco'
import { useConfirmarDescarte, useTravaDeEnvio } from '@/ui/navegacao'
import { Secao } from '@/ui/Secao'
import { Tela } from '@/ui/Tela'
import { Texto } from '@/ui/Texto'

import { EscolhaDeImagem } from '../perfil/EscolhaDeImagem'
import { caminhoDoLogotipo, escolherImagem, type OrigemDaImagem } from '../perfil/imagens'
import {
  ConsentimentoDaEntrada,
  MENSAGEM_SEM_CONSENTIMENTO,
} from '../entrada/ConsentimentoDaEntrada'
import { abrirDocumento } from '../privacidade/TelaPrivacidade'
import { IdentidadeDaComunidade } from './Identidade'
import { COR_PADRAO, SeletorDeCor, type CorDaComunidade } from './SeletorDeCor'

type Passo = 1 | 2 | 3

const TITULO: Readonly<Record<Passo, string>> = {
  1: 'Nome e cidade',
  2: 'Cor e logotipo',
  3: 'Antes de criar, leia com atenção',
}

/** TC-16.v1 (docs/privacidade/textos-de-consentimento.md), palavra por palavra. */
export const RESUMO_DO_TERMO_DO_ADMIN = `Ao criar esta comunidade, você passa a administrá-la e responde, em nome dela, pelos dados das pessoas que entram: a comunidade é a controladora desses dados, e o ${NOME_DO_APP} os guarda e trata em nome dela. Só aceite quem tem 16 anos ou mais, com cuidado redobrado com quem tem 16 ou 17, e use os dados só para organizar as atividades da comunidade, nunca para propaganda, política, venda ou outra finalidade. Participar revela a fé das pessoas: guarde sigilo, analise as denúncias e responda a quem pedir para ver, corrigir ou apagar os próprios dados. Até a verificação pelo ${NOME_DO_APP}, a comunidade tem no máximo 30 pessoas e não publica página aberta de evento, e o ${NOME_DO_APP} pode suspendê-la se este termo ou a lei forem descumpridos.`

export const ACEITE_DO_TERMO_DO_ADMIN = 'Li e aceito o Termo do Administrador da Comunidade.'

export const MENSAGEM_SEM_TERMO_DO_ADMIN =
  'Para criar a comunidade, é preciso aceitar o Termo do Administrador.'

/** O resumo do TC-16, "Ler o termo completo" e a caixa; também na folha do termo pendente. */
export function TermoDoAdministrador({
  aceite,
  aoMudar,
}: {
  aceite: boolean
  aoMudar: (v: boolean) => void
}) {
  return (
    <View style={{ gap: ESPACO.e12 }}>
      <Texto variante="corpo">{RESUMO_DO_TERMO_DO_ADMIN}</Texto>
      <View style={{ alignItems: 'flex-start' }}>
        <Botao
          titulo="Ler o termo completo"
          icone="externo"
          variante="terciario"
          alinhado
          aoPressionar={() => void abrirDocumento('/termos#administrador')}
        />
      </View>
      <CaixaDeMarcar rotulo={ACEITE_DO_TERMO_DO_ADMIN} marcada={aceite} aoMudar={aoMudar} />
    </View>
  )
}

/** 403: e-mail ainda não confirmado; 409: acima dos limites (ADR 0007). */
function tituloDoErro(erro: unknown): string {
  if (ehErroDaApi(erro) && erro.status === 403) return 'Confirme seu e-mail primeiro'
  if (ehErroDaApi(erro) && erro.status === 409) return 'Não dá para criar outra agora'
  return 'A comunidade não foi criada'
}

/**
 * Criar comunidade (ADR 0007), qualquer conta, em 3 passos com o cabeçalho
 * de passos: (1) nome e cidade; (2) cor, com a prévia, e o logotipo opcional,
 * escolhido aqui e enviado depois que a comunidade existe; (3) o Termo do
 * Administrador (TC-16.v1, com "Ler o termo completo" e a caixa) e, em bloco
 * separado, o consentimento sobre a fé (TC-03.v4, forma de criação). Pede 18
 * anos ou mais: quem declarou 16 ou 17 vê como entrar numa comunidade.
 * Ao concluir, a comunidade vira a ativa e abre "Convide sua equipe".
 */
export function TelaCriarComunidade() {
  const { conta } = useSessao()
  // Criar comunidade pede 18 anos ou mais (entrar continua a partir de 16).
  if (conta?.faixaEtaria === '16_17') {
    return (
      <Tela pilha modal titulo="Criar comunidade">
        <EstadoVazio
          icone="pessoas"
          titulo="Para criar, é preciso ter 18 anos"
          descricao="Quem cria uma comunidade responde pelos dados de todas as pessoas que entram. Por isso, só quem tem 18 anos ou mais pode criar. Você pode entrar na comunidade do seu grupo: procure pelo nome ou use o código que a liderança passou."
          acao={{
            titulo: 'Procurar uma comunidade',
            aoPressionar: () => router.replace('/procurar-comunidade'),
          }}
          acaoSecundaria={{
            titulo: 'Tenho um código',
            aoPressionar: () => router.replace('/tenho-um-codigo'),
          }}
        />
      </Tela>
    )
  }
  if (conta?.criador) {
    return (
      <Tela pilha modal titulo="Criar comunidade">
        <EstadoVazio
          icone="plataforma"
          titulo="Pela Plataforma"
          descricao="Como Criador, você cria comunidades na Plataforma e manda o convite para quem vai administrar."
          acao={{
            titulo: 'Abrir a Plataforma',
            aoPressionar: () => router.replace('/plataforma/nova'),
          }}
        />
      </Tela>
    )
  }
  return <Assistente />
}

function Assistente() {
  const consultas = useQueryClient()
  const { trocarComunidade } = useSessao()
  const [passo, setPassoAtual] = useState<Passo>(1)
  const [trocouDePasso, setTrocouDePasso] = useState(false)
  const titulo = useRef<NoDeTexto>(null)
  useEffect(() => {
    if (trocouDePasso) focar(titulo)
  }, [passo, trocouDePasso])
  const irPara = (novo: Passo) => {
    setTrocouDePasso(true)
    setPassoAtual(novo)
  }

  const [nome, setNome] = useState('')
  const [cidade, setCidade] = useState('')
  const [cor, setCor] = useState<CorDaComunidade>(COR_PADRAO)
  const [logo, setLogo] = useState<string | null>(null)
  const [aceite, setAceite] = useState(false)
  const [fe, setFe] = useState(false)
  const [erroDoNome, setErroDoNome] = useState<string | null>(null)
  const trava = useTravaDeEnvio()

  // O logotipo fica só neste aparelho até a comunidade existir.
  const escolherLogo = useMutation<unknown, Error, OrigemDaImagem>({
    mutationFn: async (origem) => {
      const imagem = await escolherImagem(origem, 'tras')
      if (imagem) setLogo(imagem)
      return imagem
    },
    gcTime: 0,
  })
  const removerLogo = useMutation<unknown, Error, void>({
    mutationFn: async () => {
      setLogo(null)
      return true
    },
  })

  const criar = useMutation({
    mutationFn: async () => {
      const criada = await api.post<ComunidadeCriadaPorConta>('/api/v1/comunidades', {
        nome: nome.trim(),
        cor,
        ...(cidade.trim() ? { cidade: cidade.trim() } : {}),
        aceiteDoTermoDoAdmin: true,
        // TC-03.v4 na forma de criação: quem cria também participa.
        consentimentoFe: true,
      })
      // A comunidade já existe: se o logotipo falhar, dá para enviar depois em Configurações.
      let logoFalhou = false
      if (logo) {
        try {
          await api.put(caminhoDoLogotipo(criada.id), { imagem: logo })
        } catch {
          logoFalhou = true
        }
      }
      await consultas.invalidateQueries({ queryKey: CHAVES.eu })
      await trocarComunidade(criada.id)
      return { ...criada, logoFalhou }
    },
    gcTime: 0,
    onSettled: () => trava.soltar(),
  })

  const sujo = !criar.isSuccess && !!(nome.trim() || cidade.trim() || logo)
  const liberarSaida = useConfirmarDescarte(sujo)

  function concluir() {
    if (!aceite || !fe || !trava.pegar()) return
    criar.mutate(undefined, {
      onSuccess: (r) => {
        liberarSaida()
        router.replace({
          pathname: '/codigo-da-comunidade',
          params: { novo: '1', ...(r.logoFalhou ? { logo: 'falhou' } : {}) },
        })
      },
    })
  }

  function avancarDoNome() {
    if (nome.trim().length < 2) {
      setErroDoNome('O nome precisa ter pelo menos 2 letras.')
      return
    }
    setErroDoNome(null)
    irPara(2)
  }

  const nomeDaPrevia = nome.trim() || 'Nova comunidade'

  let barra: ReactNode
  let conteudo: ReactNode
  if (passo === 1) {
    barra = (
      <BarraDeAcao>
        <Botao titulo="Continuar" tamanho="grande" aoPressionar={avancarDoNome} />
      </BarraDeAcao>
    )
    conteudo = (
      <>
        <Texto variante="corpo" cor="textoSuave">
          Você vira o administrador e convida a equipe depois. Dá para mudar tudo nas configurações.
        </Texto>
        <CartaoDeVidro opaco intervalo={ESPACO.e16}>
          <Campo
            rotulo="Nome da comunidade"
            exemplo="Jovens da Igreja Central"
            value={nome}
            onChangeText={setNome}
            erro={erroDoNome}
            autoCapitalize="words"
            maxLength={80}
          />
          <Campo
            rotulo="Cidade"
            opcional
            exemplo="Campinas"
            ajuda="Ajuda quem procura a comunidade pelo nome."
            value={cidade}
            onChangeText={setCidade}
            autoCapitalize="words"
            maxLength={80}
            onSubmitEditing={avancarDoNome}
          />
        </CartaoDeVidro>
      </>
    )
  } else if (passo === 2) {
    barra = (
      <BarraDeAcao>
        <Botao
          titulo="Voltar"
          variante="secundario"
          tamanho="grande"
          aoPressionar={() => irPara(1)}
        />
        <Botao titulo="Continuar" tamanho="grande" aoPressionar={() => irPara(3)} />
      </BarraDeAcao>
    )
    conteudo = (
      <>
        <Secao titulo="Cor">
          <CartaoDeVidro opaco>
            <SeletorDeCor valor={cor} aoMudar={setCor} />
          </CartaoDeVidro>
        </Secao>
        <EscolhaDeImagem
          nome={nomeDaPrevia}
          cor={cor}
          foto={logo ? { caminho: `data:image/jpeg;base64,${logo}`, versao: 'local' } : null}
          mutacoes={{ enviar: escolherLogo, remover: removerLogo }}
          textos={{
            titulo: 'Logotipo (opcional)',
            descricao: 'Aparece no topo do app de quem participa. Sem logotipo, ficam as iniciais.',
            remover: 'Remover logotipo',
            perguntaDeRemover: 'Remover o logotipo?',
            consequenciaDeRemover: 'No lugar dele voltam as iniciais na cor da comunidade.',
            trocada: 'Logotipo escolhido',
            removida: 'Logotipo removido',
          }}
        />
        <Secao titulo="Prévia" rodape="Assim a comunidade aparece para quem participa.">
          <CartaoDeVidro>
            <IdentidadeDaComunidade
              nome={nomeDaPrevia}
              cor={cor}
              {...(cidade.trim() ? { detalhe: cidade.trim() } : {})}
              logo={logo ? { caminho: `data:image/jpeg;base64,${logo}`, versao: 'local' } : null}
            />
          </CartaoDeVidro>
        </Secao>
      </>
    )
  } else {
    const motivo = !aceite ? MENSAGEM_SEM_TERMO_DO_ADMIN : !fe ? MENSAGEM_SEM_CONSENTIMENTO : null
    barra = (
      <BarraDeAcao>
        <Botao
          titulo="Voltar"
          variante="secundario"
          tamanho="grande"
          aoPressionar={() => irPara(2)}
        />
        <Botao
          titulo="Criar comunidade"
          tamanho="grande"
          rotuloAcessivel={`Criar a comunidade ${nomeDaPrevia}`}
          carregando={criar.isPending}
          desabilitado={motivo !== null}
          {...(motivo ? { motivo } : {})}
          aoPressionar={concluir}
        />
      </BarraDeAcao>
    )
    conteudo = (
      <>
        <CartaoDeVidro opaco>
          <TermoDoAdministrador aceite={aceite} aoMudar={setAceite} />
        </CartaoDeVidro>
        <CartaoDeVidro opaco>
          <ConsentimentoDaEntrada
            comunidade={nomeDaPrevia}
            forma="criacao"
            marcada={fe}
            aoMudar={setFe}
            pedirResponsavel={false}
            responsavel={false}
            aoMudarResponsavel={() => undefined}
          />
        </CartaoDeVidro>
        {criar.error ? (
          <AvisoDeFalha erro={criar.error} titulo={tituloDoErro(criar.error)} />
        ) : null}
      </>
    )
  }

  return (
    <Tela
      pilha
      modal
      passos={{ atual: passo, total: 3 }}
      titulo={TITULO[passo]}
      refDoTitulo={titulo}
      barraDeAcao={barra}
    >
      {conteudo}
    </Tela>
  )
}
