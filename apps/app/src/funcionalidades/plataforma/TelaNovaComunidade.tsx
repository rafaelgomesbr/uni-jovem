import { useMutation, useQueryClient } from '@tanstack/react-query'
import { router } from 'expo-router'
import { useEffect, useRef, useState, type Ref } from 'react'

import { NOME_DO_APP } from '@/constantes'
import { CHAVES } from '@/estado/clienteDeConsulta'
import { useSessao } from '@/estado/sessao'
import { api } from '@/servicos/api'
import { copiarTexto } from '@/utilidades/compartilhar'
import type { ComunidadeCriada } from '@/servicos/contrato'
import { Aviso } from '@/ui/Aviso'
import { AvisoDeErro } from '@/ui/AvisoDeErro'
import { Botao } from '@/ui/Botao'
import { Campo } from '@/ui/Campo'
import { Carregando } from '@/ui/Carregando'
import { Cartao } from '@/ui/Cartao'
import { EstadoVazio } from '@/ui/EstadoVazio'
import { useFocoAoMudar, type NoDeTexto } from '@/ui/foco'
import { GrupoDeOpcoes } from '@/ui/GrupoDeOpcoes'
import { Segmentos } from '@/ui/Segmentos'
import { Texto } from '@/ui/Texto'
import { TextoAnunciado } from '@/ui/TextoAnunciado'

import { FUSO_PADRAO, nomeDoFuso, opcoesDeFuso } from '../comunidade/fusos'
import { IdentidadeDaComunidade } from '../comunidade/Identidade'
import { LinkCompartilhavel } from '../comunidade/LinkCompartilhavel'
import { COR_PADRAO, SeletorDeCor, type CorDaComunidade } from '../comunidade/SeletorDeCor'
import { lerTokenDoConvite } from '../comunidade/TelaEntrarComConvite'
import { CabecalhoDeTela, CartaoDeDestaque, TelaPropria } from '../comunidade/visual'
import { AceitarComConta } from '../convite/AceitarComConta'
import { useAcaoDePlataforma } from './acaoDePlataforma'
import { PedidoDeCodigo } from './ProvaDeSegundoFator'

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
 * Criar comunidade (só o Criador). A API cria a comunidade e um convite de
 * administrador; não vincula ninguém direto (D12). Por isso "Eu serei o
 * administrador" prende o convite ao e-mail do Criador e abre o aceite aqui
 * mesmo, com o consentimento da comunidade, como qualquer pessoa.
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

  const criar = useAcaoDePlataforma<ComunidadeCriada, Pedido>({
    mutationFn: (p) =>
      api.post<ComunidadeCriada>('/api/v1/plataforma/comunidades', {
        nome: p.nome,
        cor: p.cor,
        ...(p.emailDoAdmin ? { emailDoAdmin: p.emailDoAdmin } : {}),
      }),
    onSuccess: () => consultas.invalidateQueries({ queryKey: CHAVES.plataforma }),
  })

  const { alvo: tituloRef, pedirFoco } = useFocoAoMudar<NoDeTexto>(
    criar.dados ? 'criada' : 'formulario',
  )

  if (!conta?.criador) {
    return (
      <TelaPropria>
        <Cartao>
          <EstadoVazio
            icone="seguranca"
            titulo="Área do Criador"
            descricao="Só o Criador da plataforma cria comunidades. Para entrar numa, use o convite que você recebeu."
            acao={{
              titulo: 'Entrar com um convite',
              aoPressionar: () => router.replace('/entrar-com-convite'),
            }}
          />
        </Cartao>
      </TelaPropria>
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
    pedirFoco()
    criar.executar({
      nome: nomeLimpo,
      cor,
      fuso,
      quem,
      // "Eu": o convite fica preso ao e-mail do Criador; só ele consegue usar.
      emailDoAdmin: quem === 'eu' ? conta.email : email || null,
    })
  }

  return (
    <TelaPropria>
      <CabecalhoDeTela
        sobrancelha="Plataforma"
        titulo="Criar comunidade"
        descricao="Nome, identidade e quem vai administrar. Depois dá para ajustar tudo nas configurações."
        refDoTitulo={tituloRef}
      />
      <Cartao titulo="Identidade" icone="comunidade">
        <Campo
          rotulo="Nome da comunidade"
          exemplo="Ex.: Jovens Central"
          value={nome}
          onChangeText={setNome}
          erro={erroDoNome}
          autoCapitalize="words"
          maxLength={80}
        />
        <SeletorDeCor valor={cor} aoMudar={setCor} />
        <IdentidadeDaComunidade
          nome={nome.trim() || 'Nova comunidade'}
          cor={cor}
          detalhe="Prévia de como ela aparece"
        />
      </Cartao>

      <Cartao titulo="Primeiro administrador" icone="chave">
        <Segmentos
          rotulo="Quem vai administrar"
          valor={quem}
          aoMudar={setQuem}
          segmentos={[
            { valor: 'eu', rotulo: 'Eu serei o administrador' },
            { valor: 'outra', rotulo: 'Outra pessoa' },
          ]}
        />
        {quem === 'eu' ? (
          <Texto variante="apoio" cor="textoSuave">
            Logo depois de criar, você confirma a entrada com a sua conta ({conta.email}) e a
            comunidade já abre para você.
          </Texto>
        ) : (
          <>
            <Campo
              rotulo="E-mail de quem vai administrar (opcional)"
              ajuda="Com e-mail, só essa pessoa consegue usar o convite. Sem e-mail, vale para quem abrir o link primeiro."
              value={emailDoAdmin}
              onChangeText={setEmailDoAdmin}
              erro={erroDoEmail}
              keyboardType="email-address"
              inputMode="email"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="off"
            />
            <Texto variante="apoio" cor="textoSuave">
              Depois de criar, aparece o link do convite para copiar, compartilhar ou mostrar no QR.
              Ele vale 7 dias.
            </Texto>
          </>
        )}
      </Cartao>

      {quem === 'eu' ? (
        <Cartao
          titulo="Fuso horário"
          icone="relogio"
          descricao="Agenda e programações seguem o fuso do lugar dos encontros."
        >
          <GrupoDeOpcoes rotulo="Fuso" valor={fuso} aoMudar={setFuso} opcoes={opcoesDeFuso()} />
        </Cartao>
      ) : (
        <Texto variante="apoio" cor="textoSuave">
          Fuso: {nomeDoFuso(FUSO_PADRAO)}. Quem administrar ajusta em Equipe, Configurações.
        </Texto>
      )}

      {criar.erro ? <AvisoDeErro erro={criar.erro} /> : null}
      <Botao
        titulo="Criar comunidade"
        rotuloAcessivel={nome.trim() ? `Criar a comunidade ${nome.trim()}` : 'Criar comunidade'}
        icone="adicionar"
        aoPressionar={enviar}
        carregando={criar.executando}
      />
      <PedidoDeCodigo prova={criar.prova} motivo="Para criar a comunidade" />
    </TelaPropria>
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
    <TelaPropria>
      <CabecalhoDeTela
        sobrancelha="Plataforma"
        titulo="Comunidade criada"
        descricao={`Agora mande o convite para quem vai administrar ${pedido.nome}. Por segurança, o link só aparece agora.`}
        refDoTitulo={refDoTitulo}
      />
      <IdentidadeDaComunidade
        nome={pedido.nome}
        cor={pedido.cor}
        detalhe="Aguardando o administrador"
      />
      <LinkCompartilhavel
        titulo={`Convite de administrador de ${pedido.nome}`}
        papel="Administrador"
        link={link}
        expiraEm={expiraEm}
        emailDestino={pedido.emailDoAdmin}
        mostrarQr
        mensagem={`Você foi convidado para administrar ${pedido.nome} no ${NOME_DO_APP}. Abra o link para aceitar:`}
      />
      <Botao
        titulo="Ver na Plataforma"
        icone="plataforma"
        variante="secundario"
        aoPressionar={() =>
          router.replace({
            pathname: '/plataforma/[comunidadeId]',
            params: { comunidadeId: criada.id },
          })
        }
      />
    </TelaPropria>
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

  const [copiado, setCopiado] = useState<string | null>(null)
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
      <TelaPropria>
        <CabecalhoDeTela
          sobrancelha="Tudo pronto"
          titulo={`Bem-vindo a ${pedido.nome}`}
          refDoTitulo={refDoTitulo}
        />
        <CartaoDeDestaque
          sobrancelha="Próximo passo"
          titulo="Chame a sua equipe"
          descricao={`Você é o administrador de ${pedido.nome}, que já está aberta no app. Convide a liderança para começar.`}
        >
          <Botao
            titulo="Abrir a Equipe"
            icone="comunidade"
            aoPressionar={() => router.replace('/comunidade')}
          />
          <Botao
            titulo="Ir para o início"
            variante="secundario"
            aoPressionar={() => router.replace('/')}
          />
        </CartaoDeDestaque>
        {gravarFuso.isPending ? <Carregando texto="Gravando o fuso horário" /> : null}
        {gravarFuso.error ? (
          <Aviso tipo="alerta" titulo="O fuso não foi gravado">
            {`A comunidade ficou no ${nomeDoFuso(FUSO_PADRAO)}. Ajuste em Equipe, Configurações.`}
          </Aviso>
        ) : null}
      </TelaPropria>
    )
  }

  return (
    <TelaPropria>
      <CabecalhoDeTela
        sobrancelha="Comunidade criada"
        titulo="Agora, entre nela"
        descricao={`${pedido.nome} foi criada. Confirme a sua entrada como administrador para ela abrir no app.`}
        refDoTitulo={refDoTitulo}
      />
      <IdentidadeDaComunidade nome={pedido.nome} cor={pedido.cor} detalhe="Papel: Administrador" />
      <AceitarComConta token={token} comunidade={pedido.nome} papel="Administrador" />
      <Texto variante="apoio" cor="textoSuave">
        Prefere entrar depois? Guarde o link: ele vale 7 dias, só funciona com a sua conta e, por
        segurança, não aparece de novo.
      </Texto>
      <Botao
        titulo="Copiar o link para entrar depois"
        icone="copiar"
        variante="terciario"
        aoPressionar={async () => {
          const ok = await copiarTexto(criada.conviteDoPrimeiroAdmin.link)
          setCopiado(ok ? 'Link copiado.' : 'Não foi possível copiar agora.')
        }}
      />
      {copiado ? <TextoAnunciado variante="apoio">{copiado}</TextoAnunciado> : null}
    </TelaPropria>
  )
}
