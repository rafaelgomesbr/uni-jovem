import { ATRIBUICAO, versiculoDoDia } from '@uj/conteudo'
import { router } from 'expo-router'
import { useState } from 'react'

import { NOTIFICACOES_DISPONIVEIS } from '@/servicos/notificacoesDoSistema'
import { abrirLink } from '@/utilidades/compartilhar'
import { lerHoraDigitada } from '@/utilidades/datas'
import { AvisoDeErro } from '@/ui/AvisoDeErro'
import { Botao } from '@/ui/Botao'
import { CaixaDeMarcar } from '@/ui/CaixaDeMarcar'
import { Campo } from '@/ui/Campo'
import { Carregando } from '@/ui/Carregando'
import { Cartao } from '@/ui/Cartao'
import { Linha } from '@/ui/Linha'
import { Tela } from '@/ui/Tela'
import { Texto } from '@/ui/Texto'
import { TextoAnunciado } from '@/ui/TextoAnunciado'

import { usePreferenciasDaConta, useSalvarVersiculo } from '../notificacoes/consultas'
import { PermissaoDoSistema } from '../notificacoes/PermissaoDoSistema'
import { CartaoDoVersiculo, useHoje } from './CartaoDoVersiculo'

/** TC-10.v1. */
export const TEXTO_DO_VERSICULO =
  'O versículo do dia é agendado no seu aparelho. Nada sobre ele é enviado ao servidor. Você pode desligar ou mudar o horário quando quiser.'

/** Rota `/versiculo`: ligar, desligar, horário e o estado da permissão do aparelho. */
export function TelaVersiculo() {
  const prefs = usePreferenciasDaConta()
  return (
    <Tela pilha titulo="Versículo do dia" descricao={TEXTO_DO_VERSICULO}>
      <CartaoDoVersiculo comAtalho={false} />
      {prefs.isPending ? (
        <Carregando texto="Carregando a sua preferência" />
      ) : prefs.error ? (
        <AvisoDeErro erro={prefs.error} aoTentarDeNovo={() => void prefs.refetch()} />
      ) : (
        <Preferencia
          key={`${prefs.data.versiculo.ativo}-${prefs.data.versiculo.hora}`}
          ativo={prefs.data.versiculo.ativo}
          hora={prefs.data.versiculo.hora}
        />
      )}
      <Cartao titulo="Sobre a tradução" icone="documento">
        <Linha
          titulo={ATRIBUICAO.traducao}
          descricao={`Licença ${ATRIBUICAO.licenca}. Toque para ver o crédito completo.`}
          aoPressionar={() => router.push('/versiculo/traducao')}
        />
      </Cartao>
    </Tela>
  )
}

function Preferencia({ ativo, hora }: { ativo: boolean; hora: string }) {
  const salvar = useSalvarVersiculo()
  const [texto, setTexto] = useState(hora)
  const [erro, setErro] = useState<string | null>(null)
  const lida = lerHoraDigitada(texto)

  function salvarHora() {
    if (!lida) {
      setErro('Use o formato HH:MM, por exemplo 07:00.')
      return
    }
    setErro(null)
    salvar.mutate({ versiculoHora: lida })
  }

  return (
    <>
      <Cartao titulo="No app" icone="versiculo">
        <CaixaDeMarcar
          rotulo="Receber o versículo do dia"
          descricao={
            ativo
              ? `Ligado, todo dia às ${hora}. Vale para a sua conta, não importa em quantas comunidades você está.`
              : 'Desligado. O versículo continua no Início.'
          }
          marcada={ativo}
          desabilitada={salvar.isPending}
          aoMudar={(v) => salvar.mutate({ versiculoAtivo: v })}
        />
        <Campo
          rotulo="Horário"
          exemplo="07:00"
          formato="hora"
          ajuda="No fuso do aparelho. Se você viajar, o app reagenda sozinho."
          value={texto}
          onChangeText={setTexto}
          erro={erro}
          inputMode="numeric"
          maxLength={5}
          onSubmitEditing={salvarHora}
        />
        {salvar.error ? <AvisoDeErro erro={salvar.error} /> : null}
        {salvar.isSuccess ? (
          <TextoAnunciado variante="corpo" cor="sucesso">
            Preferência salva.
          </TextoAnunciado>
        ) : null}
        <Botao
          titulo="Salvar horário"
          variante="secundario"
          desabilitado={lida === hora}
          motivo="Digite outro horário para salvar."
          carregando={salvar.isPending}
          aoPressionar={salvarHora}
        />
      </Cartao>
      {NOTIFICACOES_DISPONIVEIS ? (
        <Cartao titulo="No aparelho" icone="aparelho">
          <PermissaoDoSistema ligadoNoApp={ativo} />
        </Cartao>
      ) : (
        <Texto variante="legenda" cor="textoSuave">
          Na web o versículo aparece só no Início. A notificação diária chega no app do celular.
        </Texto>
      )}
    </>
  )
}

/** Rota `/versiculo/traducao`: crédito completo exigido pela licença CC BY 4.0. */
export function TelaSobreATraducao() {
  const hoje = useHoje()
  return (
    <Tela pilha titulo="Sobre a tradução">
      <Cartao>
        <Texto selectable>{ATRIBUICAO.texto}</Texto>
      </Cartao>
      <Cartao>
        <Linha titulo="Tradução" descricao={ATRIBUICAO.traducao} />
        <Linha titulo="Autores" descricao={ATRIBUICAO.autores} />
        <Linha titulo="Versão" descricao={ATRIBUICAO.versao} />
        <Linha titulo="Licença" descricao={ATRIBUICAO.licenca} />
        <Botao
          titulo="Ver a licença"
          icone="link"
          variante="secundario"
          aoPressionar={() => void abrirLink(ATRIBUICAO.linkDaLicenca)}
        />
        <Botao
          titulo="Conhecer a Bíblia Livre"
          icone="link"
          variante="secundario"
          aoPressionar={() => void abrirLink(ATRIBUICAO.linkDaTraducao)}
        />
      </Cartao>
      <Texto variante="legenda" cor="textoSuave">
        Hoje: {versiculoDoDia(hoje).referencia}. Os 366 versículos do plano são citados sem
        alteração.
      </Texto>
    </Tela>
  )
}
