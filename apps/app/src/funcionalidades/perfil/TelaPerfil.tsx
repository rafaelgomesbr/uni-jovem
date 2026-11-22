import { useQuery } from '@tanstack/react-query'
import { NOME_DO_PAPEL } from '@uj/dominio'
import { ESPACO } from '@uj/tokens'
import Constants from 'expo-constants'
import { router, type Href } from 'expo-router'
import { useEffect, useState } from 'react'
import { View } from 'react-native'

import { NOME_DO_APP } from '@/constantes'
import { CHAVES } from '@/estado/clienteDeConsulta'
import { useSessao } from '@/estado/sessao'
import { api } from '@/servicos/api'
import type { Conta } from '@/servicos/contrato'
import { confirmar } from '@/utilidades/confirmar'
import { Acordeao } from '@/ui/Acordeao'
import { Avatar } from '@/ui/Avatar'
import { Botao } from '@/ui/Botao'
import { Cartao } from '@/ui/Cartao'
import { Chip } from '@/ui/Chip'
import { Icone } from '@/ui/Icone'
import { LinhaDeLista, Lista, RECUO_DA_LISTA } from '@/ui/LinhaDeLista'
import { Tela } from '@/ui/Tela'
import { useTema } from '@/ui/tema'
import { Texto } from '@/ui/Texto'
import { mostrarToast } from '@/ui/Toast'

import { CabecalhoDeAcordeao } from '../comunidade/CabecalhoDeAcordeao'
import { useDetalheDaComunidade } from '../comunidade/consultas'
import { TelaDoApp } from '../navegacao/TelaDoApp'
import { mensagemDePendencias } from '../offline/avisoAntesDeApagar'
import { useOffline } from '../offline/ProvedorOffline'
import { fotoDaConta } from './imagens'

/**
 * Segurança da conta (Face ID, contas conectadas, código extra ao entrar,
 * aparelhos) é uma tela própria, mantida junto da autenticação.
 */
export const ROTA_DA_SEGURANCA = '/conta/seguranca' satisfies Href

export function versaoDoApp(): string {
  const versao = Constants.expoConfig?.version ?? '0.0.0'
  const variante = (Constants.expoConfig?.extra as { variante?: string } | undefined)?.variante
  return variante && variante !== 'producao' ? `${versao} (${variante})` : versao
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

/** "Toque de novo para sair" vale por 4 s; depois volta a "Sair" (sem diálogo, sem pressa). */
const SAIR_ARMADO_MS = 4000

/**
 * Perfil (D70, UX 3.7 e protótipo da direção A): o cartão da pessoa (abre Editar perfil),
 * cinco linhas (Ajustes de notificação, Segurança, Privacidade e dados, Comunidades, Ajuda),
 * a Plataforma só para o Criador, "Mais opções" dobrado com o resto (versículo, bloqueados,
 * uso sem internet, denunciar) e "Sair", que pede um segundo toque no próprio botão em vez
 * de um diálogo. Nada aparece duas vezes: entrar, criar e sair de comunidade moram na folha
 * "Comunidades". Os módulos da comunidade (avisos, oração, relatórios...) moram na aba
 * Comunidade.
 */
export function TelaPerfil({ naPilha = false }: { naPilha?: boolean }) {
  const { conta, sair, comunidadeAtiva } = useSessao()
  const offline = useOffline()
  const idPublico = useDetalheDaComunidade(comunidadeAtiva?.id ?? null).data?.idPublico ?? null
  const transferenciaPendente = useTransferenciaPendente(conta !== null)
  const [saindo, setSaindo] = useState(false)
  const [armado, setArmado] = useState(false)
  // O alerta "Desligado" é de quem administra: para o membro, o código extra é opcional e o aviso só incomoda (D62).
  const administra = comunidadeAtiva?.papel === 'admin' || conta?.criador === true

  useEffect(() => {
    if (!armado) return
    const fim = setTimeout(() => setArmado(false), SAIR_ARMADO_MS)
    return () => clearTimeout(fim)
  }, [armado])

  if (!conta) return null

  async function sairDeVez() {
    // Sair apaga os dados guardados para uso sem internet: antes, mostra o que não foi enviado.
    const naoEnviadas = await offline.naoEnviadas()
    if (naoEnviadas.length) {
      const ok = await confirmar({
        titulo: 'Sair e apagar o que não foi enviado?',
        mensagem: mensagemDePendencias(naoEnviadas),
        confirmar: 'Sair e apagar',
        destrutivo: true,
      })
      if (!ok) {
        setArmado(false)
        return
      }
    }
    setSaindo(true)
    await sair()
    mostrarToast({ texto: 'Você saiu. Seus dados neste aparelho foram apagados.' })
  }

  const funcao = comunidadeAtiva
    ? `${NOME_DO_PAPEL[comunidadeAtiva.papel]} · ${comunidadeAtiva.nome}`
    : null
  const conteudo = (
    <>
      <Identidade conta={conta} funcao={funcao} />

      <Cartao lista>
        <Lista>
          <LinhaDeLista
            icone="sino"
            titulo="Ajustes de notificação"
            descricao="Encontros, convocações, avisos, versículo"
            aoPressionar={() => router.push('/notificacoes')}
          />
          <LinhaDeLista
            icone="seguranca"
            titulo="Segurança"
            descricao="Código extra, Face ID, aparelhos"
            {...(conta.doisFatores
              ? { extra: <Chip texto="Ligado" tom="sucesso" /> }
              : administra
                ? { extra: <Chip texto="Desligado" tom="alerta" /> }
                : {})}
            rotuloAcessivel={`Segurança.${
              conta.doisFatores
                ? ' Código extra ao entrar ligado.'
                : administra
                  ? ' Código extra ao entrar desligado.'
                  : ''
            }`}
            aoPressionar={() => router.push(ROTA_DA_SEGURANCA)}
          />
          <LinhaDeLista
            icone="cadeado"
            titulo="Privacidade e dados"
            descricao="Exportar dados ou excluir a conta"
            aoPressionar={() => router.push('/privacidade')}
          />
          <LinhaDeLista
            icone="pessoas"
            titulo="Comunidades"
            descricao={
              comunidadeAtiva
                ? `${comunidadeAtiva.nome} · trocar, entrar, criar, sair`
                : 'Entrar ou criar uma comunidade'
            }
            rotuloAcessivel={`Comunidades. ${
              comunidadeAtiva ? `Agora em ${comunidadeAtiva.nome}. ` : ''
            }Trocar, entrar, criar ou sair`}
            aoPressionar={() => router.push('/trocar-comunidade')}
          />
          <LinhaDeLista
            icone="ajuda"
            titulo="Ajuda"
            descricao="Primeiros passos, termos, versão, falar com a gente"
            aoPressionar={() => router.push('/ajuda')}
          />
        </Lista>
      </Cartao>

      {conta.criador || transferenciaPendente ? (
        <Cartao lista>
          <Lista>
            {conta.criador ? (
              <LinhaDeLista
                icone="plataforma"
                titulo="Plataforma do Criador"
                descricao="Comunidades, saúde e auditoria"
                aoPressionar={() => router.push('/plataforma')}
              />
            ) : null}
            <LinhaDeLista
              icone="trocar"
              titulo="Transferência de propriedade"
              descricao={
                transferenciaPendente
                  ? 'Há uma transferência esperando a sua resposta.'
                  : 'Passar a plataforma para outra pessoa.'
              }
              {...(transferenciaPendente ? { extra: <Chip texto="Pendente" tom="alerta" /> } : {})}
              aoPressionar={() => router.push('/plataforma/transferencia')}
            />
          </Lista>
        </Cartao>
      ) : null}

      <MaisOpcoes
        pendentes={offline.pendentes}
        denunciar={comunidadeAtiva && idPublico ? { idPublico, nome: comunidadeAtiva.nome } : null}
      />

      <View style={{ alignItems: 'center' }}>
        <Botao
          titulo={armado ? 'Toque de novo para sair' : 'Sair'}
          icone="sair"
          variante="destrutivo"
          carregando={saindo}
          desabilitado={saindo}
          {...(armado
            ? {}
            : { dica: 'Você vai precisar do e-mail e da senha para entrar de novo.' })}
          aoPressionar={() => {
            if (!armado) {
              setArmado(true)
              return
            }
            void sairDeVez()
          }}
        />
      </View>
      <Texto variante="legenda" cor="textoSuave" tabular selectable style={{ textAlign: 'center' }}>
        {NOME_DO_APP} {versaoDoApp()}
      </Texto>
    </>
  )

  return naPilha ? (
    <Tela pilha titulo="Perfil">
      {conteudo}
    </Tela>
  ) : (
    <TelaDoApp titulo="Perfil">{conteudo}</TelaDoApp>
  )
}

/**
 * "Mais opções", dobrado: o que se usa pouco. O número de itens a enviar fica visível no
 * cabeçalho mesmo fechado, em texto (nada se perde sem a pessoa saber).
 */
function MaisOpcoes({
  pendentes,
  denunciar,
}: {
  pendentes: number
  denunciar: { idPublico: string; nome: string } | null
}) {
  return (
    <Cartao lista>
      <Acordeao
        chave="perfil-mais-opcoes"
        recuo={RECUO_DA_LISTA.texto}
        rotuloRecolhido={`Mais opções${pendentes ? `, ${pendentes} a enviar` : ''}. Recolhido, toque para ver.`}
        rotuloAberto="Mais opções. Aberto, toque para recolher."
        cabecalho={() => (
          <CabecalhoDeAcordeao
            icone="mais"
            titulo="Mais opções"
            {...(pendentes > 0
              ? { extra: <Chip texto={`${pendentes} a enviar`} tom="alerta" /> }
              : {})}
          />
        )}
      >
        <Lista>
          <LinhaDeLista
            icone="versiculo"
            titulo="Versículo do dia"
            descricao="Ligar, desligar e o horário"
            aoPressionar={() => router.push('/versiculo')}
          />
          <LinhaDeLista
            icone="anonimo"
            titulo="Pessoas bloqueadas"
            descricao="Quem você bloqueou e o que deixa de ver"
            aoPressionar={() => router.push('/bloqueados')}
          />
          <LinhaDeLista
            icone="sincronizar"
            titulo="Uso sem internet"
            descricao="O que está neste aparelho e o que falta enviar"
            {...(pendentes ? { extra: <Chip texto={`${pendentes} a enviar`} tom="alerta" /> } : {})}
            aoPressionar={() => router.push('/pendencias')}
          />
          {denunciar ? (
            <LinhaDeLista
              icone="denuncia"
              titulo="Denunciar comunidade"
              descricao={`Algo errado em ${denunciar.nome}? A equipe do app olha`}
              aoPressionar={() =>
                router.push({
                  pathname: '/denunciar-comunidade',
                  params: { idPublico: denunciar.idPublico, nome: denunciar.nome },
                })
              }
            />
          ) : null}
        </Lista>
      </Acordeao>
    </Cartao>
  )
}

/**
 * O cartão da pessoa (protótipo): avatar, nome, função e comunidade, e e-mail. O cartão
 * inteiro abre "Editar perfil" (foto, nome, e-mail e WhatsApp), e dali se escolhe o avatar:
 * uma porta só para os dados (D62).
 */
function Identidade({ conta, funcao }: { conta: Conta; funcao: string | null }) {
  const { cores } = useTema()
  return (
    <Cartao
      aoPressionar={() => router.push('/editar-perfil')}
      rotuloAcessivel={`Editar perfil. ${conta.nome}${funcao ? `, ${funcao}` : ''}`}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: ESPACO.e16 }}>
        <Avatar
          nome={conta.nome}
          avatar={conta.avatar ?? null}
          foto={fotoDaConta(conta)}
          proprio
          lado={64}
          decorativo
        />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Texto variante="tituloCartao" accessibilityRole="header" nivel={2}>
            {conta.nome}
          </Texto>
          {funcao ? (
            <Texto variante="meta" cor="textoSuave">
              {funcao}
            </Texto>
          ) : null}
          <Texto variante="legenda" cor="textoSuave" selectable>
            {conta.email}
          </Texto>
        </View>
        <Icone nome="avancar" cor={cores.textoSuave} tamanho={18} />
      </View>
    </Cartao>
  )
}
