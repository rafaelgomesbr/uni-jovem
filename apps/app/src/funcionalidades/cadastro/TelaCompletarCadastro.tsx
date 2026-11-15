import { useMutation } from '@tanstack/react-query'
import { router } from 'expo-router'
import { useState } from 'react'

import { useSessao } from '@/estado/sessao'
import type { FaixaEtaria } from '@/servicos/contratoDosModulos'
import { BarraDeAcao } from '@/ui/BarraDeAcao'
import { Botao } from '@/ui/Botao'
import { CartaoDeVidro } from '@/ui/CartaoDeVidro'
import { EstadoVazio } from '@/ui/EstadoVazio'
import { AvisoDeFalha } from '@/ui/Falha'
import { useTravaDeEnvio } from '@/ui/navegacao'
import { Tela } from '@/ui/Tela'
import { Texto } from '@/ui/Texto'

import {
  AceiteDosTermos,
  CadastroTravado,
  MenorDe16,
  PerguntaDeIdade,
} from '../convite/Consentimentos'
import { useCadastroTravado } from '../convite/travaDeIdade'

const NOME_DO_PROVEDOR = { google: 'Google', apple: 'Apple' } as const

/**
 * "Falta pouco" (ADR 0007): Google ou Apple com um e-mail que ainda não tem
 * conta. Pede só o que o provedor não diz: a idade (TC-01, 16 ou mais) e os
 * Termos (TC-02). O token do cadastro vive na sessão, em memória, e vale 15
 * minutos; sem ele (app reaberto), a tela manda começar de novo.
 */
export function TelaCompletarCadastro() {
  const sessao = useSessao()
  const pendente = sessao.cadastroPendente
  const [faixa, setFaixa] = useState<FaixaEtaria | null>(null)
  const [termos, setTermos] = useState(false)
  const trava = useTravaDeEnvio()
  const travado = useCadastroTravado()

  const concluir = useMutation({
    mutationFn: (faixaEtaria: FaixaEtaria) =>
      sessao.concluirCadastroComProvedor({
        faixaEtaria,
        // A opção de 16 ou 17 anos já declara que o responsável sabe e concorda (TC-01.v2).
        aceites: { termos, ...(faixaEtaria === '16_17' ? { responsavelCiente: true } : {}) },
      }),
    onSettled: () => trava.soltar(),
  })

  if (travado) {
    return (
      <Tela pilha aurora={1} titulo="Criar conta">
        <CadastroTravado
          aoVoltar={() => {
            sessao.descartarCadastroPendente()
            router.replace('/entrar')
          }}
        />
      </Tela>
    )
  }

  if (!pendente) {
    return (
      <Tela pilha titulo="Criar conta">
        <EstadoVazio
          icone="perfil"
          titulo="Comece de novo"
          descricao="O cadastro pelo Google ou pela Apple vale por alguns minutos. Toque em Entrar e escolha o botão de novo."
          acao={{ titulo: 'Voltar para Entrar', aoPressionar: () => router.replace('/entrar') }}
        />
      </Tela>
    )
  }

  const menor = faixa === 'menos_16'
  const motivo =
    faixa === null
      ? 'Responda quantos anos você tem.'
      : !termos
        ? 'Para criar a conta, é preciso concordar com os Termos de Uso.'
        : null

  function enviar() {
    if (motivo || menor || !faixa) return
    if (!trava.pegar()) return
    concluir.mutate(faixa)
  }

  return (
    <Tela
      pilha
      aurora={1}
      titulo="Falta pouco"
      descricao={`Olá, ${pendente.nome || 'tudo bem'}. Vamos criar sua conta com ${pendente.email}.`}
      {...(menor
        ? {}
        : {
            barraDeAcao: (
              <BarraDeAcao>
                <Botao
                  titulo="Criar conta"
                  tamanho="grande"
                  aoPressionar={enviar}
                  carregando={concluir.isPending}
                  desabilitado={motivo !== null}
                  {...(motivo ? { motivo } : {})}
                />
              </BarraDeAcao>
            ),
          })}
    >
      <Texto variante="corpo" cor="textoSuave">
        {`O ${NOME_DO_PROVEDOR[pendente.provedor]} já confirmou seu e-mail. Falta só a sua idade e o aceite dos termos.`}
      </Texto>
      <PerguntaDeIdade
        valor={faixa}
        aoMudar={(v) => {
          setFaixa(v)
          // TC-01.v2: com menos de 16, o token do cadastro é descartado e nada é criado.
          if (v === 'menos_16') sessao.descartarCadastroPendente()
        }}
      />
      {menor ? (
        <MenorDe16 />
      ) : (
        <CartaoDeVidro opaco>
          <AceiteDosTermos marcada={termos} aoMudar={setTermos} />
        </CartaoDeVidro>
      )}
      {concluir.error ? (
        <AvisoDeFalha erro={concluir.error} titulo="A conta não foi criada" />
      ) : null}
      <Botao
        titulo="Cancelar e voltar"
        variante="terciario"
        alinhado
        aoPressionar={() => {
          sessao.descartarCadastroPendente()
          router.replace('/entrar')
        }}
      />
    </Tela>
  )
}
