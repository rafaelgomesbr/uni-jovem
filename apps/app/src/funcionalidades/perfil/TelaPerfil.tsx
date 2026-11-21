import { useQuery } from '@tanstack/react-query'
import { NOME_DO_PAPEL } from '@uj/dominio'
import { ESPACO } from '@uj/tokens'
import Constants from 'expo-constants'
import { router, type Href } from 'expo-router'
import { useState, type ReactNode } from 'react'
import { Pressable, View } from 'react-native'

import { NOME_DO_APP } from '@/constantes'
import { CHAVES } from '@/estado/clienteDeConsulta'
import { useSessao } from '@/estado/sessao'
import { api } from '@/servicos/api'
import type { Conta } from '@/servicos/contrato'
import { confirmar } from '@/utilidades/confirmar'
import { Avatar } from '@/ui/Avatar'
import { CartaoDeVidro } from '@/ui/CartaoDeVidro'
import { Chip } from '@/ui/Chip'
import { LinhaDeLista, Lista } from '@/ui/LinhaDeLista'
import { Secao } from '@/ui/Secao'
import { Tela } from '@/ui/Tela'
import { Texto } from '@/ui/Texto'
import { mostrarToast } from '@/ui/Toast'

import { useDetalheDaComunidade } from '../comunidade/consultas'
import { TelaDoApp } from '../navegacao/TelaDoApp'
import { mensagemDePendencias } from '../offline/avisoAntesDeApagar'
import { useOffline } from '../offline/ProvedorOffline'
import { fotoDaConta, logoDaComunidade } from './imagens'

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

/**
 * Perfil (3.6.4, quadro 04 e D57): só a conta. Cartão de identidade (avatar
 * de 72 com anel, nome e e-mail; "Editar perfil" mora só na lista, D62), "Sua conta", as
 * comunidades (trocar), o grupo do Criador e "Mais opções" no fim, cada um
 * com a sobrancelha fora do cartão e um cartão lista. Os módulos da
 * comunidade (avisos, oração, relatórios...) moram na aba Comunidade.
 * "Sair deste aparelho" fica isolado no fim, com a versão do app.
 */
export function TelaPerfil({ naPilha = false }: { naPilha?: boolean }) {
  const { conta, sair, comunidadeAtiva, comunidades, trocarComunidade } = useSessao()
  const offline = useOffline()
  const idPublico = useDetalheDaComunidade(comunidadeAtiva?.id ?? null).data?.idPublico ?? null
  const transferenciaPendente = useTransferenciaPendente(conta !== null)
  const [saindo, setSaindo] = useState(false)
  // O alerta "Desligado" é de quem administra: para o membro, o código extra é opcional e o aviso só incomoda (D62).
  const administra = comunidadeAtiva?.papel === 'admin' || conta?.criador === true

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

  const conteudo = (
    <>
      <Identidade conta={conta} />

      <Grupo titulo="Sua conta">
        <LinhaDeLista
          icone="pessoa"
          titulo="Editar perfil"
          descricao="Nome, e-mail, WhatsApp e foto"
          aoPressionar={() => router.push('/editar-perfil')}
        />
        <LinhaDeLista
          icone="sino"
          titulo="Ajustes de notificação"
          descricao="O que o app avisa: encontros, escalas e avisos"
          aoPressionar={() => router.push('/notificacoes')}
        />
        <LinhaDeLista
          icone="seguranca"
          titulo="Segurança"
          descricao="Código extra ao entrar, Face ID e aparelhos"
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
          icone="versiculo"
          titulo="Versículo do dia"
          descricao="Ligar, desligar e o horário"
          aoPressionar={() => router.push('/versiculo')}
        />
        <LinhaDeLista
          icone="documento"
          titulo="Privacidade e dados"
          descricao="Exportar dados ou excluir a conta"
          aoPressionar={() => router.push('/privacidade')}
        />
        <LinhaDeLista
          icone="ajuda"
          titulo="Ajuda e sobre"
          descricao="Primeiros passos, termos e versão"
          aoPressionar={() => router.push('/ajuda')}
        />
      </Grupo>

      {comunidades.length ? (
        <Grupo titulo="Comunidades">
          {comunidades.map((c) => {
            const ativa = c.id === comunidadeAtiva?.id
            const descricao = `${NOME_DO_PAPEL[c.papel]}${ativa ? ' · em uso agora' : ''}`
            return (
              <LinhaDeLista
                key={c.id}
                avatar={{
                  nome: c.nome,
                  dados: { foto: logoDaComunidade(c) },
                  ...(ativa ? {} : { cor: c.cor }),
                }}
                titulo={c.nome}
                descricao={descricao}
                rotuloAcessivel={
                  ativa
                    ? `${c.nome}, ${descricao}. Abrir a aba Comunidade`
                    : `${c.nome}, ${descricao}. Usar esta comunidade`
                }
                aoPressionar={() => {
                  if (ativa) {
                    router.push('/comunidade')
                    return
                  }
                  void trocarComunidade(c.id).then(() =>
                    mostrarToast({ texto: `Agora em ${c.nome}` }),
                  )
                }}
              />
            )
          })}
        </Grupo>
      ) : null}

      {conta.criador || transferenciaPendente ? (
        <Grupo titulo="Criador">
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
        </Grupo>
      ) : null}

      <Grupo titulo="Mais opções">
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
          {...(offline.pendentes
            ? { extra: <Chip texto={`${offline.pendentes} a enviar`} tom="alerta" /> }
            : {})}
          aoPressionar={() => router.push('/pendencias')}
        />
        <LinhaDeLista
          icone="link"
          titulo="Entrar em outra comunidade"
          descricao="Código, convite ou busca"
          aoPressionar={() => router.push('/comece-por-aqui')}
        />
        <LinhaDeLista
          icone="adicionar"
          titulo="Criar comunidade"
          rotuloAcessivel="Criar comunidade"
          aoPressionar={() => router.push(conta.criador ? '/plataforma/nova' : '/criar-comunidade')}
        />
        {comunidadeAtiva && idPublico ? (
          <LinhaDeLista
            icone="denuncia"
            titulo="Denunciar comunidade"
            descricao={`Algo errado em ${comunidadeAtiva.nome}? A equipe do app olha`}
            aoPressionar={() =>
              router.push({
                pathname: '/denunciar-comunidade',
                params: { idPublico, nome: comunidadeAtiva.nome },
              })
            }
          />
        ) : null}
      </Grupo>

      <View style={{ marginTop: ESPACO.e8 }}>
        <CartaoDeVidro lista opaco>
          <LinhaDeLista
            icone="sair"
            titulo="Sair deste aparelho"
            destrutivo
            dica="Você vai precisar do e-mail e da senha para entrar de novo."
            aoPressionar={saindo ? undefined : () => void pedirParaSair()}
          />
        </CartaoDeVidro>
      </View>
      <Texto variante="legenda" cor="textoSuave" tabular selectable>
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

/** Grupo: sobrancelha fora do cartão (24 acima, 8 abaixo) e um cartão lista. */
function Grupo({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <Secao titulo={titulo}>
      <CartaoDeVidro lista>
        <Lista>{children}</Lista>
      </CartaoDeVidro>
    </Secao>
  )
}

/**
 * Identidade (quadro 04): avatar de 72 com anel (a foto, quando há; o toque
 * troca o avatar), nome e e-mail. Quem edita os dados usa "Editar perfil" na
 * lista: antes havia dois caminhos para a mesma tela.
 */
function Identidade({ conta }: { conta: Conta }) {
  return (
    <CartaoDeVidro>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: ESPACO.e16 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Trocar avatar"
          onPress={() => router.push('/escolher-avatar')}
        >
          <Avatar
            nome={conta.nome}
            avatar={conta.avatar ?? null}
            foto={fotoDaConta(conta)}
            proprio
            tamanho="perfil"
            anel="perfil"
            decorativo
          />
        </Pressable>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Texto variante="tituloCartao" accessibilityRole="header" nivel={2}>
            {conta.nome}
          </Texto>
          <Texto variante="legenda" cor="textoSuave" selectable>
            {conta.email}
          </Texto>
        </View>
      </View>
    </CartaoDeVidro>
  )
}
