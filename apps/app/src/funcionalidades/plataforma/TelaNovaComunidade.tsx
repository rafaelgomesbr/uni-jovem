import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ESPACO } from '@uj/tokens'
import { router } from 'expo-router'
import { useEffect, useRef, useState, type Ref } from 'react'
import { View } from 'react-native'

import { NOME_DO_APP } from '@/constantes'
import { CHAVES } from '@/estado/clienteDeConsulta'
import { useSessao } from '@/estado/sessao'
import { api } from '@/servicos/api'
import type { ComunidadeCriada } from '@/servicos/contrato'
import { Aviso } from '@/ui/Aviso'
import { BarraDeAcao } from '@/ui/BarraDeAcao'
import { Botao, ParDeBotoes } from '@/ui/Botao'
import { Campo } from '@/ui/Campo'
import { Cartao } from '@/ui/Cartao'
import { CartaoDeVidro } from '@/ui/CartaoDeVidro'
import { EstadoVazio } from '@/ui/EstadoVazio'
import { AvisoDeFalha } from '@/ui/Falha'
import { useFocoAoMudar, type NoDeTexto } from '@/ui/foco'
import { LinhaDeLista } from '@/ui/LinhaDeLista'
import { ListaDeOpcoes } from '@/ui/ListaDeOpcoes'
import { PilulaDaComunidade } from '@/ui/PilulaDaComunidade'
import { Secao } from '@/ui/Secao'
import { Segmentos } from '@/ui/Segmentos'
import { Tela } from '@/ui/Tela'
import { Texto } from '@/ui/Texto'
import { mostrarToast } from '@/ui/Toast'
import { useTravaDeEnvio } from '@/ui/navegacao'
import { copiarTexto } from '@/utilidades/compartilhar'

import { FUSO_PADRAO, nomeDoFuso, opcoesDeFuso } from '../comunidade/fusos'
import { LinkCompartilhavel } from '../comunidade/LinkCompartilhavel'
import { COR_PADRAO, SeletorDeCor, type CorDaComunidade } from '../comunidade/SeletorDeCor'
import { lerTokenDoConvite } from '../comunidade/TelaEntrarComConvite'
import { AceitarComConta } from '../convite/AceitarComConta'

type QuemAdministra = 'eu' | 'outra'

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

interface Pedido {
  nome: string
  cor: CorDaComunidade
  fuso: string
  quem: QuemAdministra
  emailDoAdmin: string | null
}

/**
 * Criar comunidade (3.6.3, só o Criador): Nome, "COR" em amostras, "PRÉVIA"
 * com a pílula como vai aparecer, quem administra e o fuso, e "Criar
 * comunidade" na barra. A API cria a comunidade e um convite de
 * administrador; não vincula ninguém direto (D12). Por isso "Eu mesmo" prende
 * o convite ao e-mail do Criador e abre o aceite aqui, com o consentimento
 * da comunidade, como qualquer pessoa.
 */
export function TelaNovaComunidade() {
  const { conta } = useSessao()
  const consultas = useQueryClient()
  const [nome, setNome] = useState('')
  const [cor, setCor] = useState<CorDaComunidade>(COR_PADRAO)
  const [fuso, setFuso] = useState(FUSO_PADRAO)
  const [quem, setQuem] = useState<QuemAdministra>('eu')
  const [emailDoAdmin, setEmailDoAdmin] = useState('')
  const [erroDoNome, setErroDoNome] = useState<string | null>(null)
  const [erroDoEmail, setErroDoEmail] = useState<string | null>(null)
  const trava = useTravaDeEnvio()

  // ADR 0007 (revisa D12 e D31): criar comunidade não pede o código do autenticador.
  const criacao = useMutation({
    mutationFn: (p: Pedido) =>
      api.post<ComunidadeCriada>('/api/v1/plataforma/comunidades', {
        nome: p.nome,
        cor: p.cor,
        ...(p.emailDoAdmin ? { emailDoAdmin: p.emailDoAdmin } : {}),
      }),
    onSuccess: () => consultas.invalidateQueries({ queryKey: CHAVES.plataforma }),
    onSettled: () => trava.soltar(),
  })
  const criar = {
    dados: criacao.data,
    variaveis: criacao.variables,
    executando: criacao.isPending,
    erro: criacao.error,
  }

  const { alvo: tituloRef, pedirFoco } = useFocoAoMudar<NoDeTexto>(
    criar.dados ? 'criada' : 'formulario',
  )

  if (!conta?.criador) {
    return (
      <Tela pilha titulo="Nova comunidade">
        <EstadoVazio
          icone="seguranca"
          titulo="Área do Criador"
          descricao="Só o Criador da plataforma cria comunidades. Para entrar numa, use o convite que você recebeu."
          acao={{
            titulo: 'Entrar com um convite',
            aoPressionar: () => router.replace('/tenho-um-codigo'),
          }}
        />
      </Tela>
    )
  }

  if (criar.dados && criar.variaveis) {
    return (
      <ComunidadeCriadaAgora
        criada={criar.dados}
        pedido={criar.variaveis}
        refDoTitulo={tituloRef}
      />
    )
  }

  function enviar() {
    const nomeLimpo = nome.trim()
    const email = emailDoAdmin.trim().toLowerCase()
    const nomeOk = nomeLimpo.length >= 2
    const emailOk = quem === 'eu' || !email || EMAIL.test(email)
    setErroDoNome(nomeOk ? null : 'O nome precisa ter pelo menos 2 letras.')
    setErroDoEmail(emailOk ? null : 'Confira o e-mail: ele precisa ter o formato nome@exemplo.com.')
    if (!nomeOk || !emailOk || !conta) return
    if (!trava.pegar()) return
    pedirFoco()
    criacao.mutate({
      nome: nomeLimpo,
      cor,
      fuso,
      quem,
      // "Eu": o convite fica preso ao e-mail do Criador; só ele consegue usar.
      emailDoAdmin: quem === 'eu' ? conta.email : email || null,
    })
  }

  return (
    <Tela
      pilha
      titulo="Nova comunidade"
      descricao="Depois dá para ajustar tudo nas configurações."
      refDoTitulo={tituloRef}
      barraDeAcao={
        <BarraDeAcao>
          <Botao
            titulo="Criar comunidade"
            tamanho="grande"
            rotuloAcessivel={nome.trim() ? `Criar a comunidade ${nome.trim()}` : 'Criar comunidade'}
            aoPressionar={enviar}
            carregando={criar.executando}
          />
        </BarraDeAcao>
      }
    >
      {criar.erro ? <AvisoDeFalha erro={criar.erro} titulo="A comunidade não foi criada" /> : null}
      <CartaoDeVidro opaco>
        <Campo
          rotulo="Nome da comunidade"
          exemplo="Jovens Central"
          value={nome}
          onChangeText={setNome}
          erro={erroDoNome}
          autoCapitalize="words"
          maxLength={80}
        />
      </CartaoDeVidro>

      <Secao titulo="Cor">
        <CartaoDeVidro opaco>
          <SeletorDeCor valor={cor} aoMudar={setCor} />
        </CartaoDeVidro>
      </Secao>

      <Secao titulo="Prévia" rodape="Assim ela aparece no topo do app de quem participa.">
        <PilulaDaComunidade
          nome={nome.trim() || 'Nova comunidade'}
          vazia={false}
          podeTrocar={false}
          rotulo={`Prévia: comunidade ${nome.trim() || 'Nova comunidade'}`}
          aoPressionar={null}
        />
      </Secao>

      <Secao titulo="Quem vai administrar">
        <CartaoDeVidro opaco intervalo={ESPACO.e16}>
          <Segmentos
            rotulo="Quem vai administrar"
            valor={quem}
            aoMudar={setQuem}
            segmentos={[
              { valor: 'eu', rotulo: 'Eu mesmo' },
              { valor: 'outra', rotulo: 'Outra pessoa' },
            ]}
          />
          {quem === 'eu' ? (
            <Texto variante="legenda" cor="textoSuave">
              {`Logo depois de criar, você confirma a entrada com a sua conta (${conta.email}) e a comunidade já abre para você.`}
            </Texto>
          ) : (
            <Campo
              rotulo="E-mail de quem vai administrar"
              opcional
              ajuda="Com e-mail, só essa pessoa usa o convite. Sem e-mail, vale para quem abrir o link primeiro. O link vale 7 dias."
              value={emailDoAdmin}
              onChangeText={setEmailDoAdmin}
              erro={erroDoEmail}
              keyboardType="email-address"
              inputMode="email"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="off"
            />
          )}
        </CartaoDeVidro>
      </Secao>

      {quem === 'eu' ? (
        <Secao
          titulo="Fuso horário"
          rodape="A agenda e os horários seguem o fuso do lugar dos encontros."
        >
          <CartaoDeVidro opaco intervalo={ESPACO.e8}>
            <ListaDeOpcoes rotulo="Fuso" valor={fuso} aoMudar={setFuso} opcoes={opcoesDeFuso()} />
          </CartaoDeVidro>
        </Secao>
      ) : (
        <Texto variante="legenda" cor="textoSuave">
          {`Fuso: ${nomeDoFuso(FUSO_PADRAO)}. Quem administrar ajusta na aba Comunidade, em Configurações.`}
        </Texto>
      )}
    </Tela>
  )
}

function ComunidadeCriadaAgora({
  criada,
  pedido,
  refDoTitulo,
}: {
  criada: ComunidadeCriada
  pedido: Pedido
  refDoTitulo: Ref<NoDeTexto>
}) {
  const { link, expiraEm } = criada.conviteDoPrimeiroAdmin
  const token = lerTokenDoConvite(link)

  if (pedido.quem === 'eu' && token) {
    return <EntrarNaNova criada={criada} pedido={pedido} token={token} refDoTitulo={refDoTitulo} />
  }

  return (
    <Tela
      pilha
      titulo="Comunidade criada"
      descricao={`Agora mande o convite para quem vai administrar ${pedido.nome}. Por segurança, o link só aparece agora.`}
      refDoTitulo={refDoTitulo}
    >
      <LinkCompartilhavel
        titulo={`Convite de administrador de ${pedido.nome}`}
        papel="Administrador"
        link={link}
        expiraEm={expiraEm}
        emailDestino={pedido.emailDoAdmin}
        mostrarQr
        mensagem={`Você foi convidado para administrar ${pedido.nome} no ${NOME_DO_APP}. Abra o link para aceitar:`}
      />
      <CartaoDeVidro lista>
        <LinhaDeLista
          avatar={{ nome: pedido.nome, cor: pedido.cor }}
          titulo={pedido.nome}
          descricao="Aguardando o administrador. Ver na Plataforma"
          aoPressionar={() =>
            router.replace({
              pathname: '/plataforma/[comunidadeId]',
              params: { comunidadeId: criada.id },
            })
          }
        />
      </CartaoDeVidro>
    </Tela>
  )
}

/**
 * O Criador vai administrar: o aceite (com o consentimento desta comunidade)
 * acontece aqui. Quando a comunidade aparece na sessão, ela vira a ativa e o
 * fuso escolhido é gravado, já com o Criador como administrador.
 */
function EntrarNaNova({
  criada,
  pedido,
  token,
  refDoTitulo,
}: {
  criada: ComunidadeCriada
  pedido: Pedido
  token: string
  refDoTitulo: Ref<NoDeTexto>
}) {
  const { comunidades, trocarComunidade } = useSessao()
  const consultas = useQueryClient()
  const entrou = comunidades.some((c) => c.id === criada.id)
  const ajustado = useRef(false)

  const gravarFuso = useMutation({
    mutationFn: () => api.patch(`/api/v1/c/${criada.id}`, { fuso: pedido.fuso }),
    onSuccess: () => consultas.invalidateQueries({ queryKey: CHAVES.comunidade(criada.id) }),
  })

  // Sincroniza com a sessão (sistema externo): quando o vínculo novo chega de
  // `/eu`, a comunidade vira a ativa e o fuso escolhido é gravado na API.
  const { mutate: gravar } = gravarFuso
  useEffect(() => {
    if (!entrou || ajustado.current) return
    ajustado.current = true
    void trocarComunidade(criada.id)
    if (pedido.fuso !== FUSO_PADRAO) gravar()
  }, [entrou, criada.id, pedido.fuso, trocarComunidade, gravar])

  if (entrou) {
    return (
      <Tela pilha titulo={`Bem-vindo a ${pedido.nome}`} refDoTitulo={refDoTitulo}>
        <Cartao
          variante="momento"
          pose="pleno"
          etiqueta="Próximo passo"
          titulo="Chame a sua equipe"
          acoes={
            <ParDeBotoes>
              <Botao
                titulo="Abrir a Comunidade"
                aoPressionar={() => router.replace('/comunidade')}
              />
              <Botao
                titulo="Ir para o início"
                variante="secundario"
                aoPressionar={() => router.replace('/')}
              />
            </ParDeBotoes>
          }
        >
          <Texto variante="corpo" cor="textoSuave">
            {`Você é o administrador de ${pedido.nome}, que já está aberta no app. Convide a liderança para começar.`}
          </Texto>
        </Cartao>
        {gravarFuso.isPending ? (
          <Texto variante="legenda" cor="textoSuave" accessibilityLiveRegion="polite">
            Gravando o fuso horário
          </Texto>
        ) : null}
        {gravarFuso.error ? (
          <Aviso tipo="alerta" titulo="O fuso não foi gravado">
            {`A comunidade ficou no ${nomeDoFuso(FUSO_PADRAO)}. Ajuste na aba Comunidade, em Configurações.`}
          </Aviso>
        ) : null}
      </Tela>
    )
  }

  return (
    <AceitarComConta
      token={token}
      comunidade={pedido.nome}
      papel="Administrador"
      cartaoDoConvite={
        <Cartao
          variante="momento"
          pose="nascendo"
          etiqueta="Comunidade criada"
          titulo="Agora, entre nela"
          acoes={
            <View style={{ alignItems: 'flex-start' }}>
              <Botao
                titulo="Copiar o link"
                icone="copiar"
                variante="terciario"
                alinhado
                rotuloAcessivel="Copiar o link para entrar depois"
                aoPressionar={async () => {
                  const ok = await copiarTexto(criada.conviteDoPrimeiroAdmin.link)
                  mostrarToast(
                    ok
                      ? { texto: 'Link copiado.' }
                      : { texto: 'Não foi possível copiar agora.', tipo: 'erro' },
                  )
                }}
              />
            </View>
          }
        >
          <Texto variante="corpo" cor="textoSuave">
            {`${pedido.nome} foi criada. Confirme a sua entrada como administrador para ela abrir no app. Prefere entrar depois? Guarde o link: vale 7 dias, só funciona com a sua conta e não aparece de novo.`}
          </Texto>
        </Cartao>
      }
    />
  )
}
