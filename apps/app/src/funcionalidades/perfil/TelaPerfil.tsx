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
import { Botao } from '@/ui/Botao'
import { CartaoDeVidro } from '@/ui/CartaoDeVidro'
import { Chip } from '@/ui/Chip'
import { LinhaDeLista, Lista } from '@/ui/LinhaDeLista'
import { Secao } from '@/ui/Secao'
import { Tela } from '@/ui/Tela'
import { Texto } from '@/ui/Texto'
import { mostrarToast } from '@/ui/Toast'

import { useGruposDoMais } from '../navegacao/mais'
import { TelaDoApp } from '../navegacao/TelaDoApp'
import { mensagemDePendencias } from '../offline/avisoAntesDeApagar'
import { useOffline } from '../offline/ProvedorOffline'
import { fotoDaConta, logoDaComunidade } from './imagens'

/**
 * Segurança da conta (Face ID, contas conectadas, verificação em duas etapas,
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
 * Perfil (3.6.4 e quadro 04): aba que absorveu o "Mais". Cartão de
 * identidade (avatar de 72 com anel, nome, e-mail e "Editar dados") e as
 * categorias, cada uma com a sobrancelha fora do cartão e um cartão lista.
 * "Sair deste aparelho" fica isolado no fim, com a versão do app.
 */
export function TelaPerfil({ naPilha = false }: { naPilha?: boolean }) {
  const { conta, sair, comunidadeAtiva, comunidades, trocarComunidade } = useSessao()
  const offline = useOffline()
  const grupos = useGruposDoMais()
  const transferenciaPendente = useTransferenciaPendente(conta !== null)
  const [saindo, setSaindo] = useState(false)

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

  const [naComunidade, organizacao] = [
    grupos.find((g) => g.titulo === 'Comunidade'),
    grupos.find((g) => g.titulo === 'Organização'),
  ]

  const conteudo = (
    <>
      <Identidade conta={conta} />

      {conta.criador || transferenciaPendente ? (
        <Grupo titulo="Criador">
          {conta.criador ? (
            <LinhaDeLista
              icone="plataforma"
              titulo="Plataforma"
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

      {comunidadeAtiva && naComunidade?.itens.length ? (
        <Grupo titulo="Na comunidade">
          {naComunidade.itens.map((i) => (
            <LinhaDeLista
              key={i.rotulo}
              icone={i.icone}
              titulo={i.rotulo}
              descricao={i.descricao}
              aoPressionar={() => router.push(i.href)}
            />
          ))}
        </Grupo>
      ) : null}

      {comunidadeAtiva && organizacao?.itens.length ? (
        <Grupo titulo="Organização">
          {organizacao.itens.map((i) => (
            <LinhaDeLista
              key={i.rotulo}
              icone={i.icone}
              titulo={i.rotulo}
              descricao={i.descricao}
              aoPressionar={() => router.push(i.href)}
            />
          ))}
        </Grupo>
      ) : null}

      <Grupo titulo="Sua conta">
        <LinhaDeLista
          icone="pessoa"
          titulo="Conta"
          descricao="Nome, e-mail e WhatsApp"
          aoPressionar={() => router.push('/editar-perfil')}
        />
        <LinhaDeLista
          icone="seguranca"
          titulo="Segurança"
          descricao="Duas etapas, Face ID e aparelhos"
          extra={
            <Chip
              texto={conta.doisFatores ? 'Ligada' : 'Desligada'}
              tom={conta.doisFatores ? 'sucesso' : 'alerta'}
            />
          }
          rotuloAcessivel={`Segurança. Verificação em duas etapas ${conta.doisFatores ? 'ligada' : 'desligada'}.`}
          aoPressionar={() => router.push(ROTA_DA_SEGURANCA)}
        />
        <LinhaDeLista
          icone="sino"
          titulo="Notificações"
          descricao="Eventos, escalas e avisos"
          aoPressionar={() => router.push('/notificacoes')}
        />
        <LinhaDeLista
          icone="versiculo"
          titulo="Versículo do dia"
          descricao="Ligar, desligar e o horário"
          aoPressionar={() => router.push('/versiculo')}
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
                    ? `${c.nome}, ${descricao}. Abrir a Equipe`
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

      <Grupo titulo="Ajuda e privacidade">
        <LinhaDeLista
          icone="sincronizar"
          titulo="Pendências e uso sem internet"
          descricao="O que está neste aparelho e o que falta enviar"
          {...(offline.pendentes
            ? { extra: <Chip texto={String(offline.pendentes)} tom="alerta" /> }
            : {})}
          aoPressionar={() => router.push('/pendencias')}
        />
        <LinhaDeLista
          icone="seguranca"
          titulo="Privacidade e dados"
          descricao="Exportar dados ou excluir a conta"
          aoPressionar={() => router.push('/privacidade')}
        />
        <LinhaDeLista
          icone="anonimo"
          titulo="Pessoas bloqueadas"
          descricao="Quem você bloqueou e o que deixa de ver"
          aoPressionar={() => router.push('/bloqueados')}
        />
        <LinhaDeLista
          icone="ajuda"
          titulo="Ajuda e sobre"
          descricao="Mapa da missão, termos e versão"
          aoPressionar={() => router.push('/ajuda')}
        />
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
 * troca o avatar), nome, e-mail e "Editar dados".
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
          <Botao
            titulo="Editar dados"
            variante="terciario"
            alinhado
            aoPressionar={() => router.push('/editar-perfil')}
          />
        </View>
      </View>
    </CartaoDeVidro>
  )
}
