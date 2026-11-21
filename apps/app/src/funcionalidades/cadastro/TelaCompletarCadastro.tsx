import { useMutation } from '@tanstack/react-query'
import { router } from 'expo-router'
import { useState } from 'react'

import { useSessao } from '@/estado/sessao'
import type { FaixaEtaria } from '@/servicos/contratoDosModulos'
import { anunciar } from '@/ui/anunciar'
import { EstadoVazio } from '@/ui/EstadoVazio'
import { AvisoDeFalha } from '@/ui/Falha'
import { useTravaDeEnvio } from '@/ui/navegacao'
import { Tela } from '@/ui/Tela'

import { guardarUltimoMetodo } from '../autenticacao/ultimoMetodo'
import { CadastroTravado } from '../convite/Consentimentos'
import { useCadastroTravado } from '../convite/travaDeIdade'
import { FaltaPouco } from './FaltaPouco'

/**
 * "Falta pouco" (ADR 0007): Google ou Apple com um e-mail que ainda não tem
 * conta. Pede só o que o provedor não diz: a idade (TC-01, 16 ou mais) e os
 * Termos (TC-02), na MESMA tela de quem criou a conta por e-mail (D63). O token
 * do cadastro vive na sessão, em memória, e vale 15 minutos; sem ele (app
 * reaberto), a tela manda começar de novo.
 */
export function TelaCompletarCadastro() {
  const sessao = useSessao()
  const pendente = sessao.cadastroPendente
  const [faixa, setFaixa] = useState<FaixaEtaria | null>(null)
  const [termos, setTermos] = useState(false)
  const trava = useTravaDeEnvio()
  const travado = useCadastroTravado()

  const concluir = useMutation({
    mutationFn: async (faixaEtaria: FaixaEtaria) => {
      await sessao.concluirCadastroComProvedor({
        faixaEtaria,
        // A opção de 16 ou 17 anos já declara que o responsável sabe e concorda (TC-01.v2).
        aceites: { termos, ...(faixaEtaria === '16_17' ? { responsavelCiente: true } : {}) },
      })
      anunciar('Conta criada.')
    },
    onSuccess: () => {
      if (pendente) guardarUltimoMetodo(pendente.provedor)
    },
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

  function enviar() {
    if (!faixa || faixa === 'menos_16' || !termos) return
    if (!trava.pegar()) return
    concluir.mutate(faixa)
  }

  return (
    <FaltaPouco
      apoio={`Olá, ${pendente.nome || 'tudo bem'}. Vamos criar sua conta com ${pendente.email}.`}
      faixa={faixa}
      aoMudarFaixa={(v) => {
        setFaixa(v)
        // TC-01.v2: com menos de 16, o token do cadastro é descartado e nada é criado.
        if (v === 'menos_16') sessao.descartarCadastroPendente()
      }}
      termos={termos}
      aoMudarTermos={setTermos}
      carregando={concluir.isPending}
      aoVoltar={() => {
        sessao.descartarCadastroPendente()
        router.replace('/entrar')
      }}
      aoConfirmar={enviar}
      chaveDoPasso="provedor"
      aviso={
        concluir.error ? (
          <AvisoDeFalha erro={concluir.error} titulo="A conta não foi criada" />
        ) : null
      }
    />
  )
}
