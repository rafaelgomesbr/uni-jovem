import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ehPapel, NOME_DO_PAPEL, PAPEIS, podeConcederPapel, type Papel } from '@uj/dominio'
import { ESPACO } from '@uj/tokens'
import { router, useLocalSearchParams } from 'expo-router'
import { useState } from 'react'

import { NOME_DO_APP } from '@/constantes'
import { CHAVES } from '@/estado/clienteDeConsulta'
import { useSessao } from '@/estado/sessao'
import { api } from '@/servicos/api'
import type { ComunidadeDoVinculo, ConviteCriado } from '@/servicos/contrato'
import { BarraDeAcao } from '@/ui/BarraDeAcao'
import { Botao } from '@/ui/Botao'
import { Campo } from '@/ui/Campo'
import { CartaoDeVidro } from '@/ui/CartaoDeVidro'
import { EstadoVazio } from '@/ui/EstadoVazio'
import { useFocoAoMudar, type NoDeTexto } from '@/ui/foco'
import { Interruptor } from '@/ui/Interruptor'
import { ListaDeOpcoes } from '@/ui/ListaDeOpcoes'
import { Secao } from '@/ui/Secao'
import { Segmentos } from '@/ui/Segmentos'
import { Tela } from '@/ui/Tela'
import { Texto } from '@/ui/Texto'

import { AvisoDeFalha } from '../eventos/Falha'
import { SemComunidade } from '../navegacao/SemComunidade'
import { LinkCompartilhavel } from './LinkCompartilhavel'
import { DESCRICAO_DO_PAPEL } from './nomes'
import { usePode } from './permissoes'

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
      <Tela pilha titulo="Convidar">
        <SemComunidade oQue="os convites" />
      </Tela>
    )
  }
  if (!pode('convite', 'criar') || papeisConcedidosPor(comunidadeAtiva.papel).length === 0) {
    return (
      <Tela pilha titulo="Convidar">
        <EstadoVazio
          icone="seguranca"
          titulo="Convites são criados pela administração"
          descricao="Só quem administra a comunidade pode convidar pessoas. Fale com uma pessoa administradora."
          acao={{ titulo: 'Voltar para a Equipe', aoPressionar: () => router.back() }}
        />
      </Tela>
    )
  }
  return <FormularioDeConvite comunidade={comunidadeAtiva} />
}

/**
 * Convidar (3.6.2): "PAPEL" em lista de opções com a descrição de cada
 * papel, "VALIDADE" em segmentos, "PARA QUEM (OPCIONAL)" com o e-mail e o
 * interruptor de envio, e o primário "Criar convite" na barra. O resultado é
 * o cartão de destaque com o link, Copiar e Compartilhar.
 */
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

  // Criar e "Criar outro convite" trocam a tela inteira: o foco vai para o título novo.
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
      <Tela
        pilha
        titulo="Convite criado"
        descricao="Mande o link agora: por segurança, ele só aparece uma vez."
        refDoTitulo={tituloRef}
      >
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
          titulo="Criar outro convite"
          variante="terciario"
          alinhado
          aoPressionar={() => {
            pedirFoco()
            criar.reset()
            setEmail('')
          }}
        />
      </Tela>
    )
  }

  return (
    <Tela
      pilha
      titulo="Convidar"
      descricao="O link vale para uma pessoa, que entra com o papel escolhido."
      refDoTitulo={tituloRef}
      barraDeAcao={
        <BarraDeAcao>
          <Botao
            titulo="Criar convite"
            tamanho="grande"
            rotuloAcessivel={`Criar convite de ${NOME_DO_PAPEL[papel].toLowerCase()} para ${comunidade.nome}`}
            carregando={criar.isPending}
            aoPressionar={enviar}
          />
        </BarraDeAcao>
      }
    >
      {criar.error ? <AvisoDeFalha erro={criar.error} titulo="O convite não foi criado" /> : null}
      <ListaDeOpcoes
        rotulo="Papel"
        valor={papel}
        aoMudar={setPapel}
        opcoes={concedidos.map((p) => ({
          valor: p,
          rotulo: NOME_DO_PAPEL[p],
          descricao: DESCRICAO_DO_PAPEL[p],
        }))}
      />
      <Secao titulo="Validade" rodape="O máximo são 7 dias.">
        <Segmentos
          rotulo="Validade do link"
          segmentos={VALIDADES}
          valor={validade}
          aoMudar={setValidade}
        />
      </Secao>
      <Secao titulo="Para quem (opcional)">
        <CartaoDeVidro opaco intervalo={ESPACO.e8}>
          <Campo
            rotulo="E-mail"
            opcional
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
            <Interruptor
              rotulo="Enviar também por e-mail"
              descricao={enviarPorEmail ? 'Ligado: o link vai também para o e-mail' : 'Desligado'}
              ligado={enviarPorEmail}
              aoMudar={setEnviarPorEmail}
            />
          ) : (
            <Texto variante="legenda" cor="textoSuave">
              Sem e-mail, vale para quem abrir o link primeiro.
            </Texto>
          )}
        </CartaoDeVidro>
      </Secao>
    </Tela>
  )
}
