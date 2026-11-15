import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ehPapel, NOME_DO_PAPEL, PAPEIS, podeConcederPapel, type Papel } from '@uj/dominio'
import { router, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'

import { NOME_DO_APP } from '@/constantes'
import { CHAVES } from '@/estado/clienteDeConsulta'
import { useSessao } from '@/estado/sessao'
import { api } from '@/servicos/api'
import type { ComunidadeDoVinculo, ConviteCriado } from '@/servicos/contrato'
import { AvisoDeErro } from '@/ui/AvisoDeErro'
import { Botao } from '@/ui/Botao'
import { CaixaDeMarcar } from '@/ui/CaixaDeMarcar'
import { Campo } from '@/ui/Campo'
import { Cartao } from '@/ui/Cartao'
import { EstadoVazio } from '@/ui/EstadoVazio'
import { useFocoAoMudar, type NoDeTexto } from '@/ui/foco'
import { GrupoDeOpcoes } from '@/ui/GrupoDeOpcoes'
import { Segmentos } from '@/ui/Segmentos'

import { SemComunidade } from '../navegacao/SemComunidade'
import { LinkCompartilhavel } from './LinkCompartilhavel'
import { DESCRICAO_DO_PAPEL } from './nomes'
import { usePode } from './permissoes'
import { CabecalhoDeTela, TelaPropria } from './visual'

type Validade = '1' | '3' | '7'

const VALIDADES = [
  { valor: '1', rotulo: '1 dia' },
  { valor: '3', rotulo: '3 dias' },
  { valor: '7', rotulo: '7 dias' },
] as const

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Papéis que este papel pode conceder (a API confere de novo). */
export function papeisConcedidosPor(meuPapel: Papel): Papel[] {
  return PAPEIS.filter((p) => podeConcederPapel(meuPapel, p))
}

export function TelaConvidar() {
  const { comunidadeAtiva } = useSessao()
  const pode = usePode()

  if (!comunidadeAtiva) {
    return (
      <TelaPropria>
        <CabecalhoDeTela sobrancelha="Equipe" titulo="Convidar pessoas" />
        <SemComunidade oQue="os convites" />
      </TelaPropria>
    )
  }
  if (!pode('convite', 'criar') || papeisConcedidosPor(comunidadeAtiva.papel).length === 0) {
    return (
      <TelaPropria>
        <CabecalhoDeTela sobrancelha={comunidadeAtiva.nome} titulo="Convidar pessoas" />
        <Cartao>
          <EstadoVazio
            icone="seguranca"
            titulo="Convites são criados pela administração"
            descricao="Só quem administra a comunidade pode convidar pessoas. Fale com uma pessoa administradora."
            acao={{ titulo: 'Voltar', aoPressionar: () => router.back() }}
          />
        </Cartao>
      </TelaPropria>
    )
  }
  return <FormularioDeConvite comunidade={comunidadeAtiva} />
}

function FormularioDeConvite({ comunidade }: { comunidade: ComunidadeDoVinculo }) {
  const consultas = useQueryClient()
  const parametros = useLocalSearchParams<{ papel?: string; email?: string }>()
  const concedidos = papeisConcedidosPor(comunidade.papel)
  const papelInicial =
    ehPapel(parametros.papel) && concedidos.includes(parametros.papel)
      ? parametros.papel
      : concedidos.includes('membro')
        ? 'membro'
        : (concedidos[0] ?? 'membro')
  const [papel, setPapel] = useState<Papel>(papelInicial)
  const [validade, setValidade] = useState<Validade>('7')
  const [email, setEmail] = useState(typeof parametros.email === 'string' ? parametros.email : '')
  const [enviarPorEmail, setEnviarPorEmail] = useState(true)
  const [erroDoEmail, setErroDoEmail] = useState<string | null>(null)

  const emailLimpo = email.trim().toLowerCase()
  const criar = useMutation({
    mutationFn: () =>
      api.post<ConviteCriado>(`/api/v1/c/${comunidade.id}/convites`, {
        papel,
        validadeDias: Number(validade),
        ...(emailLimpo ? { email: emailLimpo, enviarPorEmail } : {}),
      }),
    onSuccess: () => consultas.invalidateQueries({ queryKey: CHAVES.convites(comunidade.id) }),
  })

  // Criar e "Convidar outra pessoa" trocam a tela inteira: o foco vai para o título novo.
  const { alvo: tituloRef, pedirFoco } = useFocoAoMudar<NoDeTexto>(
    criar.data ? 'criado' : 'formulario',
  )

  function enviar() {
    if (emailLimpo && !EMAIL.test(emailLimpo)) {
      setErroDoEmail('Confira o e-mail: ele precisa ter o formato nome@exemplo.com.')
      return
    }
    setErroDoEmail(null)
    pedirFoco()
    criar.mutate()
  }

  if (criar.data) {
    return (
      <TelaPropria>
        <CabecalhoDeTela
          sobrancelha={comunidade.nome}
          titulo="Convite criado"
          descricao="Mande o link agora: por segurança, ele só aparece uma vez."
          refDoTitulo={tituloRef}
        />
        <LinkCompartilhavel
          titulo={`Convite para ${comunidade.nome}`}
          papel={NOME_DO_PAPEL[papel]}
          link={criar.data.link}
          expiraEm={criar.data.expiraEm}
          emailDestino={emailLimpo || null}
          mostrarQr
          mensagem={`Você foi convidado para participar de ${comunidade.nome} no ${NOME_DO_APP}. Abra o link para aceitar:`}
        />
        <Botao
          titulo="Convidar outra pessoa"
          icone="convidar"
          variante="secundario"
          aoPressionar={() => {
            pedirFoco()
            criar.reset()
            setEmail('')
          }}
        />
        <Botao
          titulo="Voltar para a Equipe"
          variante="terciario"
          aoPressionar={() => router.back()}
        />
      </TelaPropria>
    )
  }

  return (
    <TelaPropria>
      <CabecalhoDeTela
        sobrancelha={comunidade.nome}
        titulo="Convidar pessoas"
        descricao="O convite gera um link de uso único. Quem abrir cria a conta (ou usa a que já tem) e entra com o papel escolhido."
        refDoTitulo={tituloRef}
      />
      <Cartao titulo="Papel de quem entra" icone="pessoa">
        <GrupoDeOpcoes
          rotulo="Papel"
          valor={papel}
          aoMudar={setPapel}
          opcoes={concedidos.map((p) => ({
            valor: p,
            rotulo: NOME_DO_PAPEL[p],
            descricao: DESCRICAO_DO_PAPEL[p],
          }))}
        />
      </Cartao>
      <Cartao titulo="Para quem" icone="email">
        <Campo
          rotulo="E-mail de quem vai receber (opcional)"
          ajuda="Com e-mail, o convite fica preso a ele: só essa pessoa consegue usar."
          value={email}
          onChangeText={setEmail}
          erro={erroDoEmail}
          keyboardType="email-address"
          inputMode="email"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="off"
        />
        {emailLimpo ? (
          <CaixaDeMarcar
            rotulo="Enviar o convite também por e-mail"
            marcada={enviarPorEmail}
            aoMudar={setEnviarPorEmail}
          />
        ) : null}
      </Cartao>
      <Cartao titulo="Validade do link" icone="relogio" descricao="O máximo são 7 dias.">
        <Segmentos
          rotulo="Validade do link"
          segmentos={VALIDADES}
          valor={validade}
          aoMudar={setValidade}
        />
      </Cartao>
      {criar.error ? <AvisoDeErro erro={criar.error} /> : null}
      <Botao
        titulo={`Criar convite de ${NOME_DO_PAPEL[papel].toLowerCase()}`}
        rotuloAcessivel={`Criar convite de ${NOME_DO_PAPEL[papel].toLowerCase()} para ${comunidade.nome}`}
        icone="convidar"
        aoPressionar={enviar}
        carregando={criar.isPending}
      />
    </TelaPropria>
  )
}
